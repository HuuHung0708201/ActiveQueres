import JSONModel from "sap/ui/model/json/JSONModel";
import Base from "./Base.controller";
import type Tree from "sap/m/Tree";
import type StandardTreeItem from "sap/m/StandardTreeItem";
import type EventBus from "sap/ui/core/EventBus";
import type TreeSelector from "./ListSelector";
import type { Route$MatchedEvent, Route$PatternMatchedEvent } from "sap/ui/core/routing/Route";
import type { ODataResponse } from "com/sphinxjsc/activequeries/types/odata";
import type ODataModel from "sap/ui/model/odata/v2/ODataModel";
import type TreeItemBase from "sap/m/TreeItemBase";
import type Router from "sap/ui/core/routing/Router";

/**
 * @namespace com.sphinxjsc.activequeries.controller
 */
export default class Main extends Base {
  private isFirstLoad = true;

  // #region Hàm khởi tạo
  public override onInit(): void {
    const router = this.getRouter();
    const tree = this.getControlById<Tree>("queryTree");

    this.initModels(tree);
    this.initRoutes(router);
    this.initTree(tree);
    this.bindTreeSelector(tree);

    router.attachBypassed(this.onBypassed, this);
  }

  /**
   * Khởi tạo các model cho Tree, cấu hình busy delay và tự động expand toàn bộ node sau khi load
   */
  private initModels(tree: Tree): void {
    const viewModel = this.createViewModel();
    const originalBusyDelay = tree.getBusyIndicatorDelay();

    this.setModel(viewModel, "masterView");
    this.setModel(
      new JSONModel({
        StepListSet: [],
        count: ""
      }),
      "activequeries"
    );

    tree.attachEventOnce("updateFinished", () => {
      viewModel.setProperty("/delay", originalBusyDelay);
      tree.expandToLevel(99);
    });
  }

  /**
   * Khởi tạo routing: lắng nghe khi route khớp để load dữ liệu và xử lý màn hình chi tiết
   */
  private initRoutes(router: Router): void {
    router.getRoute("RouteMain")?.attachMatched(this.onRouteMatched, this);
    router.getRoute("activequeriesRight")?.attachMatched(this.onRouteMatched, this);

    router.getRoute("activequeriesRight")?.attachPatternMatched(
      this.onActiveQueriesMatched,
      this
    );
  }

  /**
   * Gắn TreeSelector với Tree trước khi View hiển thị lần đầu
   */
  private bindTreeSelector(tree: Tree): void {
    this.getView()?.addEventDelegate({
      onBeforeFirstShow: () => {
        this.getTreeSelector().setBoundTree(tree);
      }
    });
  }

  /**
   * Xử lý khi route chi tiết được match: set layout và chọn đúng item trong Tree theo objectId
   */
  private onActiveQueriesMatched(event: Route$PatternMatchedEvent): void {
    const args = event.getParameter("arguments") as { objectId?: string };
    if (!args?.objectId) {
      return;
    }

    this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
    this.getTreeSelector().selectTreeItem(args.objectId);
  }

  /**
   * Lấy instance TreeSelector từ Component để thao tác chọn item trong Tree
   */
  private getTreeSelector(): TreeSelector {
    const component = this.getOwnerComponent() as unknown as {
      TreeSelector: TreeSelector;
    };
    return component.TreeSelector;
  }

  /**
   * Khởi tạo Tree: khôi phục busy delay và expand toàn bộ node sau khi load xong
   */
  private initTree(tree: Tree): void {
    const viewModel = this.getModel("masterView") as JSONModel;
    const originalBusyDelay = tree.getBusyIndicatorDelay();

    tree.attachEventOnce("updateFinished", () => {
      viewModel.setProperty("/delay", originalBusyDelay);
      tree.expandToLevel(99);
    });
  }
  // #endregion

  // #region Get dữ liệu
  /**
   * Hàm được gọi khi route khớp, chờ metadata load xong rồi lấy dữ liệu StepListSet và xử lý lỗi nếu có.
   */
  private onRouteMatched = (event: Route$MatchedEvent) => {
    this.getMetadataLoaded()
      .then(() => {
        this.getStepListSet();
      })
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {
        // loading off
      });
  };

  /**
   * Lấy dữ liệu StepListSet từ OData, chuẩn hoá dữ liệu và xử lý logic khi load lần đầu
   */
  private getStepListSet(): void {
    const model = this.getModel("activequeries");
    const odataModel = this.getModel<ODataModel>();

    odataModel.read("/StepListSet", {
      urlParameters: {
        "$expand": "ToSubstepList/ToTaskList"
      },
      success: (response: ODataResponse<any[]>) => {
        const data = this.normalizeStepData(response.results);
        model.setProperty("/StepListSet", data);

        if (!this.isFirstLoad) {
          return;
        }

        this.isFirstLoad = false;
        this.handleFirstLoad();
      },
      error: (err: Error) => console.error(err)
    });
  }

  /**
   * Chuẩn hoá dữ liệu Step/Substep và thêm count số Task cho mỗi Substep
   */
  private normalizeStepData(steps: any[]): any[] {
    return steps.map(step => {
      const substeps = step.ToSubstepList?.results || [];

      substeps.forEach((sub: any) => {
        sub.count = sub.ToTaskList?.results?.length || 0;
      });

      return {
        ...step,
        ToSubstepList: substeps
      };
    });
  }

  /**
   * Xử lý logic khi load lần đầu: chọn item trong Tree và điều hướng tới Substep đầu tiên
   */
  private handleFirstLoad(): void {
    const tree = this.getControlById<Tree>("queryTree");
    const items = tree.getItems();

    if (!items?.length) {
      return;
    }

    tree.setSelectedItem(items[1], true);

    const leafNode = this.findLeafNode(items as any);

    if (!leafNode?.Substep) {
      return;
    }

    this.navigateToDetail(leafNode.Substep);
    this.publishSelectedSubstep(leafNode.Substep);
  }

  /**
   * Tìm và trả về node lá (không có Substep con) trong Tree
   */
  private findLeafNode(items: TreeItemBase[]): any | null {
    const leafItem = items.find(item => {
      const node = item.getBindingContext("activequeries")?.getObject();
      return !(node as any)?.ToSubstepList || (node as any).ToSubstepList.length === 0;
    });

    return leafItem
      ?.getBindingContext("activequeries")
      ?.getObject() || null;
  }

  /**
   * Điều hướng sang màn hình chi tiết theo Substep được chọn
   */
  private navigateToDetail(substepId: string): void {
    this.getRouter().navTo(
      "activequeriesRight",
      { objectId: substepId },
      true
    );
  }

  /**
   * Phát sự kiện qua EventBus để truyền SubstepId sang component khác
   */
  private publishSelectedSubstep(substepId: string): void {
    const eventBus = this.getOwnerComponent()?.getEventBus() as EventBus;
    eventBus.publish(
      "LayDuLieuVoiIDTuongUng",
      "itemDataID",
      { SubstepId: substepId }
    );
  }
  // #endregion

  // #region Format tiêu đề Tree: ưu tiên SubstepDescr, nếu không có thì dùng StepDescr
  public formatTreeTitle(oData?: any): string {
    if (!oData || typeof oData === "string") {
      return oData || "";
    }

    return oData.SubstepDescr || oData.StepDescr || "";
  }
  // #endregion


  // #region Xử lý khi click vào từng item
  /**
   * Kiểm tra node có phải là node lá (không có Substep con) hay không
   */
  private isLeafNode(node: any): boolean {
    return !node?.ToSubstepList || node.ToSubstepList.length === 0;
  }

  /**
   * Xử lý khi chọn item trong Tree: chỉ cho phép node lá được mở chi tiết
   */
  public onTreeSelectionChange(event: Event): void {
    const item = (event as any).getParameter("listItem") as StandardTreeItem;

    if (!item) {
      return;
    }

    const data = item.getBindingContext("activequeries")?.getObject();

    if (!this.isLeafNode(data)) {
      return;
    }

    const tree = this.getControlById<Tree>("queryTree");

    if (tree.getMode() === "MultiSelect") {
      return;
    }

    this.showDetail(item);
  }

  /**
   * Phát sự kiện khi item được click để truyền dữ liệu qua EventBus
   */
  private publishItemClicked(data: any): void {
    const eventBus = this.getOwnerComponent()?.getEventBus() as EventBus;

    eventBus.publish("MyChannel", "itemClicked", { data });
  }

  /**
   * Hiển thị chi tiết Substep: cập nhật layout, phát sự kiện và điều hướng sang màn hình chi tiết
   */
  private showDetail(item: StandardTreeItem): void {
    const context = item.getBindingContext("activequeries");

    if (!context) {
      return;
    }

    this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");

    const data = context.getObject();

    this.publishItemClicked(data);

    const substepId = context.getProperty("Substep");

    if (!substepId) {
      return;
    }

    this.getRouter().navTo("activequeriesRight", { objectId: substepId });
  }
  // #endregion


  // #region Tạo ViewModel dùng cho trạng thái hiển thị (busy, no data) của Tree
  private createViewModel(): JSONModel {
    return new JSONModel({
      delay: 0,
      noDataText: this.getResourceBundle().getText("treeNoDataText")
    });
  }
  // #endregion

  // #region Khi route không khớp (bypassed), xóa tất cả selection trên Tree
  public onBypassed(): void {
    const tree = this.getControlById<Tree>("queryTree");

    tree.removeSelections(true);
  }
  // #endregion

  // #region Làm mới dữ liệu của Tree bằng cách refresh binding của items
  public onRefresh(): void {
    const tree = this.getControlById<Tree>("queryTree");

    tree.getBinding("items")?.refresh();
  }
  // #endregion
}
