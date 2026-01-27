import { XayDungToTrinhDetailData, XayDungToTrinhLeftData } from "base/faker/activequeries";
import JSONModel from "sap/ui/model/json/JSONModel";
import Base from "./Base.controller";
import type Tree from "sap/m/Tree";
import type StandardTreeItem from "sap/m/StandardTreeItem";
import type EventBus from "sap/ui/core/EventBus";
import type TreeSelector from "./ListSelector";
import type { Route$MatchedEvent } from "sap/ui/core/routing/Route";
import type { ODataResponse } from "base/types/odata";
import type ODataModel from "sap/ui/model/odata/v2/ODataModel";

/**
 * @namespace base.controller
 */
export default class Main extends Base {
  private isFirstLoad = true;

  public override onInit(): void {

    const tree = this.getControlById<Tree>("queryTree");

    const ViewModel = this.createViewModel();

    const OriginalBusyDelay = tree.getBusyIndicatorDelay();

    this.setModel(ViewModel, "masterView");

    this.setModel(
      new JSONModel({
        StepListSet: [],
        count: ""
      }),
      "activequeries"
    );

    this.getRouter().getRoute("RouteMain")?.attachMatched(this.onRouteMatched);
    this.getRouter().getRoute("activequeriesRight")?.attachMatched(this.onRouteMatched);

    tree.attachEventOnce("updateFinished", () => {
      ViewModel.setProperty("/delay", OriginalBusyDelay);
    });

    this.getView()?.addEventDelegate({
      onBeforeFirstShow: () => {
        const Component = this.getOwnerComponent() as unknown as {
          TreeSelector: TreeSelector;
        };
        const treeSelector = Component.TreeSelector;

        treeSelector.setBoundTree(tree);
      }
    });

    this.getRouter()?.getRoute("activequeriesRight")?.attachPatternMatched((event) => {
      const component = this.getOwnerComponent() as unknown as { TreeSelector: TreeSelector };
      const treeSelector = component.TreeSelector;

      const args = event.getParameter("arguments");

      const objectId = (args as any).objectId;


      if (objectId) {
        this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
        treeSelector.selectTreeItem(objectId);
      }
    }, this);

    this.getRouter().attachBypassed(this.onBypassed, this);

    tree.attachUpdateFinished(() => {
      tree.expandToLevel(99);
    });

  }

  // Get dữ liệu
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

  // Lấy dữ liệu StepListSet
  private getStepListSet() {
    const model = this.getModel("activequeries");

    const ODataModel = this.getModel<ODataModel>();

    ODataModel.read("/StepListSet", {
      urlParameters: {
        "$expand": "ToSubstepList/ToTaskList"
      },
      success: (reponse: ODataResponse<any[]>) => {
        reponse.results.forEach(step => {
          step.ToSubstepList = step.ToSubstepList?.results || [];

          step.ToSubstepList.forEach((substep: any) => {
            const tasks = substep.ToTaskList?.results || [];
            substep.count = tasks.length;
          });
        });

        model.setProperty("/StepListSet", reponse.results);

        // Xử lý load lần đầu
        if (!this.isFirstLoad) {
          return;
        }

        this.isFirstLoad = false;

        const tree = this.getControlById<Tree>("queryTree");
        const items = tree.getItems();

        if (!items || items.length === 0) {
          return;
        }

        const leafItem = items.find(item => {
          const ctx = item.getBindingContext("activequeries");
          const node = ctx?.getObject();

          return !(node as any)?.ToSubstepList || (node as any).ToSubstepList.length === 0;
        });

        if (!leafItem) {
          return;
        }

        const leafNode = leafItem
          ?.getBindingContext("activequeries")
          ?.getObject();

        let SubstepId;
        if (leafNode) {
          SubstepId = (leafNode as any).Substep;
        }

        if (SubstepId) {
          this.getRouter().navTo(
            "activequeriesRight",
            { objectId: SubstepId },
            true
          );
        }

        const EventBus = <EventBus>this.getOwnerComponent()?.getEventBus();
        EventBus.publish("LayDuLieuVoiIDTuongUng", "itemDataID", { SubstepId });

      },
      error: (err: Error) => console.error(err)
    });

  }

  // Forrmat theo tên
  public formatTreeTitle(oData?: any): string {
    if (!oData || typeof oData === "string") {
      return oData || "";
    }

    return oData.SubstepDescr || oData.StepDescr || "";
  }


  // #region Xử lý khi click vào từng item
  public onTreeSelectionChange(event: Event): void {
    const item = <StandardTreeItem>(event as any).getParameter("listItem");

    if (!item) {
      return;
    }

    const context = item.getBindingContext("activequeries");

    if (!context) {
      return;
    }

    const data = <any>context.getObject();

    if (!data || (data.ToSubstepList && data.ToSubstepList.length > 0)) {
      return;
    }


    const treeItem = <StandardTreeItem>(event as any).getParameter("listItem");
    const tree = this.getControlById<Tree>("queryTree");

    // Nếu Tree ở chế độ MultiSelect và item bị bỏ chọn, không show detail
    if (!(tree.getMode() === "MultiSelect")) {
      this.showDetail(treeItem || tree);
    }
  }

  // Tạo model cho Tree, lưu trạng thái delay và thông báo khi Tree trống
  private createViewModel(): JSONModel {
    return new JSONModel({
      delay: 0,                       // delay cho busy indicator
      noDataText: this.getResourceBundle().getText("treeNoDataText") // text khi tree trống
    });
  }

  // Khi route không khớp (bypassed), xóa tất cả selection trên Tree
  public onBypassed(): void {
    const tree = this.getControlById<Tree>("queryTree");

    tree.removeSelections(true);
  }

  // Làm mới dữ liệu của Tree bằng cách refresh binding của items
  public onRefresh(): void {
    const tree = this.getControlById<Tree>("queryTree");

    tree.getBinding("items")?.refresh();
  }

  // Hiển thị chi tiết item được chọn trong Tree và điều hướng sang route "object"
  private showDetail(item: StandardTreeItem): void {
    this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");

    const ObjectID = item.getBindingContext("activequeries")?.getProperty("Substep");

    const EventBus = <EventBus>this.getOwnerComponent()?.getEventBus();
    const Context = item.getBindingContext("activequeries");
    const data = Context?.getObject();

    EventBus.publish("MyChannel", "itemClicked", { data });

    this.getRouter().navTo(
      "activequeriesRight",
      {
        objectId: ObjectID
      }
    );
  }
}
