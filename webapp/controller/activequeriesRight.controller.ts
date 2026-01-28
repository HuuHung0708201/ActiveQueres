import type { FilterPayload } from "com/sphinxjsc/activequeries/types/filter";
import type DynamicPage from "sap/f/DynamicPage";
import type Button from "sap/m/Button";
import type ComboBox from "sap/m/ComboBox";
import type DatePicker from "sap/m/DatePicker";
import type Input from "sap/m/Input";
import MessageToast from "sap/m/MessageToast";
import type MultiComboBox from "sap/m/MultiComboBox";
import type MultiInput from "sap/m/MultiInput";
import Engine from "sap/m/p13n/Engine";
import GroupController from "sap/m/p13n/GroupController";
import MetadataHelper from "sap/m/p13n/MetadataHelper";
import SelectionController from "sap/m/p13n/SelectionController";
import SortController from "sap/m/p13n/SortController";
import type Select from "sap/m/Select";
import type Text from "sap/m/Text";
import type TextArea from "sap/m/TextArea";
import type TimePicker from "sap/m/TimePicker";
import Token from "sap/m/Token";
import type Event from "sap/ui/base/Event";
import type FilterBar from "sap/ui/comp/filterbar/FilterBar";
import type { FilterBar$FilterChangeEvent } from "sap/ui/comp/filterbar/FilterBar";
import type FilterGroupItem from "sap/ui/comp/filterbar/FilterGroupItem";
import type Control from "sap/ui/core/Control";
import type EventBus from "sap/ui/core/EventBus";
import type Item from "sap/ui/core/Item";
import CoreLibrary, { ValueState } from "sap/ui/core/library";
import type View from "sap/ui/core/mvc/View";
import type { Route$MatchedEvent } from "sap/ui/core/routing/Route";
import type Router from "sap/ui/core/routing/Router";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import JSONModel from "sap/ui/model/json/JSONModel";
import type ListBinding from "sap/ui/model/ListBinding";
import type ODataModel from "sap/ui/model/odata/v2/ODataModel";
import Sorter from "sap/ui/model/Sorter";
import Column from "sap/ui/table/Column";
import type Table from "sap/ui/table/Table";
import Base from "./Base.controller";
import type { Dict } from "com/sphinxjsc/activequeries/types/utils";
import type { ODataError, ODataResponse } from "com/sphinxjsc/activequeries/types/odata";
import type { XayDungToTrinh } from "com/sphinxjsc/activequeries/types/pages/main";

import type SearchField from "sap/m/SearchField";
import { StatusSelectData, XayDungToTrinhDetailData } from "../faker/activequeries";

/**
 * @namespace com.sphinxjsc.activequeries.controller
 */
export default class activequeriesRight extends Base {
  // Filter Search biến
  private view: View;
  private router: Router;
  private table: Table;
  private layout: DynamicPage;

  // Filters
  private filterBar: FilterBar;

  // Khai báo để căn chỉnh table
  private MetadataHelper!: MetadataHelper;
  private IntialWidth!: Record<string, string>;

  // #region Hàm khởi tạo
  public override onInit(): void {
    this.initMockData();
    this.initModels();
    this.initEventBus();
    this.initUIControls();
    this.initTableModel();
    this.initFilterBar();
    this.initBusinessLogic();
  }

  /**
   * Khởi tạo dữ liệu mock và gán vào model "dulieu"
   */
  private initMockData(): void {
    const model = new JSONModel(XayDungToTrinhDetailData);
    this.setModel(model, "dulieu");
  }

  /**
   * Khởi tạo các JSONModel dùng cho dữ liệu lọc, form và các danh sách select
   */
  private initModels(): void {
    this.setModel(new JSONModel({ dulieu: [] }), "dulieuFiltered");
    this.setModel(new JSONModel({ dulieu: [] }), "dulieuFiltered1");

    this.setModel(new JSONModel({ fromItems: [] }), "formModel");
    this.setModel(new JSONModel({ PriorityItems: [] }), "PriorityModel");
    this.setModel(new JSONModel({ StatusItems: [] }), "StatusModel");
    this.setModel(new JSONModel({ ForwardedByItems: [] }), "ForwardedByModel");

    this.setModel(new JSONModel(StatusSelectData), "showModel");
  }

  /**
   * Khởi tạo EventBus: đăng ký lắng nghe các sự kiện click item và load dữ liệu theo ID
   */
  private initEventBus(): void {
    const eventBus = this.getOwnerComponent()?.getEventBus() as EventBus;

    eventBus.subscribe("MyChannel", "itemClicked", this.onItemClicked, this);
    eventBus.subscribe(
      "LayDuLieuVoiIDTuongUng",
      "itemDataID",
      this.loadDataById,
      this
    );
  }

  /**
   * Khởi tạo và cache các control UI chính (View, Router, Table, Layout)
   */
  private initUIControls(): void {
    this.view = this.getView() as View;
    this.router = this.getRouter();
    this.table = this.getControlById<Table>("persoTable");
    this.layout = this.getControlById<DynamicPage>("dynamicPage");
  }

  /**
   * Khởi tạo model cho Table, quản lý dữ liệu dòng và các dòng được chọn
   */
  private initTableModel(): void {
    this.setModel(
      new JSONModel({
        rows: [],
        selectedIndices: []
      }),
      "table"
    );
  }

  /**
   * Khởi tạo FilterBar và đăng ký các hàm xử lý lấy, áp dụng và đọc bộ lọc
   */
  private initFilterBar(): void {
    this.filterBar = this.getControlById<FilterBar>("filterbar");

    this.filterBar.registerFetchData(this.fetchData);
    this.filterBar.registerApplyData(this.applyData);
    this.filterBar.registerGetFiltersWithValues(this.getFiltersWithValues);
  }

  /**
   * Khởi tạo logic nghiệp vụ: đổi tên nút, đăng ký cá nhân hoá và reset bộ lọc
   */
  private initBusinessLogic(): void {
    this.ThayDoiTenButton();
    this.registerForP13n();
    this.onResetFilters();
  }
  // #endregion

  // #region Load dữ liệu theo SubstepId từ OData, lọc Task tương ứng và cập nhật model hiển thị
  private loadDataById(
    channel: string,
    eventId: string,
    payload: { SubstepId?: string }
  ): void {
    if (!payload?.SubstepId) {
      return;
    }

    const model = this.getModel("dulieuFiltered");
    const odataModel = this.getModel<ODataModel>();

    odataModel.read("/StepListSet", {
      urlParameters: {
        "$expand": "ToSubstepList/ToTaskList"
      },
      success: (response: ODataResponse<any[]>) => {
        if (!payload.SubstepId) {
          return;
        }
        const result = this.extractTasksBySubstep(
          response.results,
          payload.SubstepId
        );

        this.updateTitle(result.substepDescr);
        model.setProperty("/dulieu", {
          ToTaskList: { results: result.tasks }
        });
      },
      error: (err: Error) => console.error(err)
    });
  }

  /**
   * Tìm Substep theo ID và trích xuất danh sách Task cùng mô tả Substep
   */
  private extractTasksBySubstep(
    steps: any[],
    substepId: string
  ): { tasks: any[]; substepDescr?: string } {
    for (const step of steps) {
      const substeps = step.ToSubstepList?.results || [];

      const substep = substeps.find(
        (s: any) => s.Substep === substepId
      );

      if (substep) {
        return {
          tasks: substep.ToTaskList?.results || [],
          substepDescr: substep.SubstepDescr
        };
      }
    }

    return { tasks: [] };
  }

  /**
   * Cập nhật tiêu đề hiển thị theo nội dung được truyền vào
   */
  private updateTitle(text?: string): void {
    if (!text) {
      return;
    }

    this.getControlById<Text>("tilteText")?.setText(text);
  }
  // #endregion

  // #region Hàm xử lý lấy thông tin json khi click vào
  private onItemClicked(
    channel: string,
    eventId: string,
    payload: any
  ): void {
    this.onResetFilters();

    const substep = payload?.data;
    if (!substep?.Substep) {
      return;
    }

    this.updateTitle(substep.SubstepDescr);
    this.updateDetailModel(substep);

    const filteredItems = this.filterChildrenByNode(substep.Substep);

    this.updateFilterModels(filteredItems);
  }

  /**
   * Cập nhật dữ liệu chi tiết vào model "dulieuFiltered"
   */
  private updateDetailModel(data: any): void {
    this.getModel("dulieuFiltered").setProperty("/dulieu", data);
  }

  /**
   * Lọc và trả về danh sách phần tử con theo nodeId
   */
  private filterChildrenByNode(nodeId: string): any[] {
    const source = this.getModel("dulieu")?.getData().dulieu || [];
    return source.filter((item: any) => item.idCha === nodeId);
  }

  /**
   * Tạo danh sách item duy nhất theo key, kèm text hiển thị (có thể custom)
   */
  private buildUniqueItems<T>(
    data: T[],
    key: keyof T,
    textMapper?: (value: any) => string
  ): { key: any; text: string }[] {
    return Array.from(
      new Map(
        data
          .filter(item => item[key])
          .map(item => [item[key], item])
      ).values()
    ).map(item => ({
      key: item[key],
      text: textMapper ? textMapper(item[key]) : String(item[key])
    }));
  }

  /**
   * Map mã trạng thái sang text hiển thị tương ứng
   */
  private mapStatusText(status: string): string {
    const map: Record<string, string> = {
      "01": "New",
      "02": "In Progress",
      "03": "Rejected",
      "04": "Approved"
    };
    return map[status] || status;
  }

  /**
   * Cập nhật các model filter (From, Priority, Status, ForwardedBy) từ danh sách item
   */
  private updateFilterModels(items: any[]): void {
    this.getModel<JSONModel>("formModel")
      .setProperty("/fromItems", this.buildUniqueItems(items, "From"));

    this.getModel<JSONModel>("PriorityModel")
      .setProperty("/PriorityItems", this.buildUniqueItems(items, "Priority"));

    this.getModel<JSONModel>("StatusModel")
      .setProperty(
        "/StatusItems",
        this.buildUniqueItems(items, "Status", this.mapStatusText)
      );

    this.getModel<JSONModel>("ForwardedByModel")
      .setProperty(
        "/ForwardedByItems",
        this.buildUniqueItems(items, "ForwardedBy")
      );
  }


  // private onItemClicked(channel: string, eventId: string, data: any): void {
  //   this.onResetFilters();

  //   let tilteText = this.getControlById<Text>("tilteText");

  //   if (tilteText) {
  //     (tilteText as any).setText(data.data.SubstepDescr);
  //   }

  //   const NodeID = data.data.Substep;

  //   if (!NodeID) {
  //     return;
  //   }

  //   const model = this.getModel("dulieuFiltered");

  //   model.setProperty("/dulieu", data.data);

  //   // // Lọc dữ liệu con theo idCha
  //   const Filtered = (this.getModel("dulieu")?.getData().dulieu || []).filter(
  //     (item: any) => item.idCha === NodeID
  //   );

  //   // Đẩy dữ liệu filtered vào model tạm để bind vào UI
  //   // const FilteredModel = new JSONModel({ dulieu: Filtered });

  //   // this.setModel(FilteredModel, "dulieuFiltered");

  //   // Lấy dữ liệu form ra
  //   const fromItems = Array.from(
  //     new Map(
  //       Filtered
  //         .filter((item: any) => item.From) // tránh null/undefined
  //         .map((item: any) => [item.From, item])
  //     ).values()
  //   ).map((item: any, index: number) => ({
  //     key: index + 1,
  //     text: item.From
  //   }))

  //   const PriorityItems = Array.from(
  //     new Map(
  //       Filtered
  //         .filter((item: any) => item.Priority) // tránh null/undefined
  //         .map((item: any) => [item.Priority, item])
  //     ).values()
  //   ).map((item: any, index: number) => ({
  //     key: index + 1,
  //     text: item.Priority
  //   }))

  //   const StatusItems = Array.from(
  //     new Map(
  //       Filtered
  //         .filter((item: any) => item.Status) // tránh null/undefined
  //         .map((item: any) => [item.Status, item])
  //     ).values()
  //   ).map((item: any, index: number) => ({
  //     key: item.Status,
  //     text:
  //       item.Status === "01"
  //         ? "New"
  //         : item.Status === "02"
  //           ? "In Progress"
  //           : item.Status === "03"
  //             ? "Rejected"
  //             : item.Status === "04"
  //               ? "Approved"
  //               : item.Status
  //   }))

  //   const ForwardedByItems = Array.from(
  //     new Map(
  //       Filtered
  //         .filter((item: any) => item.ForwardedBy) // tránh null/undefined
  //         .map((item: any) => [item.ForwardedBy, item])
  //     ).values()
  //   ).map((item: any, index: number) => ({
  //     key: index + 1,
  //     text: item.ForwardedBy
  //   }))

  //   const FormModel = <JSONModel>this.getModel("formModel");
  //   const PriorityModel = <JSONModel>this.getModel("PriorityModel");
  //   const StatusModel = <JSONModel>this.getModel("StatusModel");
  //   const ForwardedByModel = <JSONModel>this.getModel("ForwardedByModel");

  //   // Đổ danh sách item
  //   FormModel.setProperty("/fromItems", fromItems);
  //   PriorityModel.setProperty("/PriorityItems", PriorityItems);
  //   StatusModel.setProperty("/StatusItems", StatusItems);
  //   ForwardedByModel.setProperty("/ForwardedByItems", ForwardedByItems);
  // }

  // #endregion

  // #region Hàm xử lý thay đổi text ở Button
  private ThayDoiTenButton(): void {
    const filterBar = this.getControlById<FilterBar>("filterbar");
    if (!filterBar) {
      return;
    }

    this.renameClearButton(filterBar);
    this.customizeFilterBarButtons(filterBar);
  }

  /**
   * Đổi text nút Clear của FilterBar thành "Clear Filters"
   */
  private renameClearButton(filterBar: FilterBar): void {
    const clearButton = (filterBar as any)._oClearButtonOnFB;
    clearButton?.setText("Clear Filters");
  }

  /**
   * Tuỳ chỉnh nút Go và Adapt của FilterBar sau khi render
   */
  private customizeFilterBarButtons(filterBar: FilterBar): void {
    filterBar.addEventDelegate({
      onAfterRendering: () => {
        const allControls = <Control[]>filterBar.findAggregatedObjects(true);

        this.updateGoButton(allControls);
        this.updateAdaptButton(allControls);
      },
    });
  }

  /**
   * Cập nhật nút Go: đổi text thành "Search" và thêm icon tìm kiếm
   */
  private updateGoButton(controls: Control[]): void {
    const goButton = controls.find(
      (ctrl: any) => ctrl?.getText && ctrl.getText() === "Go"
    ) as Button;

    if (!goButton) {
      return;
    }

    goButton.setText("Search");
    goButton.setIcon("sap-icon://search");
  }

  /**
   * Cập nhật nút Adapt Filters: thêm icon filter-facets
   */
  private updateAdaptButton(controls: Control[]): void {
    const adaptButton = controls.find(
      (ctrl: any) => ctrl?.getText && ctrl.getText() === "Adapt Filters"
    ) as Button;

    if (!adaptButton) {
      return;
    }

    adaptButton.setIcon("sap-icon://filter-facets");
  }
  // #endregion

  // #region formatter trạng thái
  /**
   *  Format mã trạng thái sang text hiển thị tương ứng 
  */
  public formatStatusText(statusKey: string): string {
    const map: Record<string, string> = {
      "01": "New",
      "02": "Approved",
      "03": "Rejected",
    };

    return map[statusKey] ?? statusKey;
  }

  /**
   * Map mã trạng thái sang ValueState tương ứng để hiển thị UI
   */
  public formatStatusState(statusKey: string): ValueState {
    const map: Record<string, ValueState> = {
      "01": ValueState.Information,
      "02": ValueState.Success,
      "03": ValueState.Error,
    };
    return map[statusKey] ?? ValueState.None;
  }
  // #endregion

  // #region Xử lý liên quan đến bảng như: di chuyển cột các thứ
  /**
   * Đăng ký Table với P13n Engine để hỗ trợ cá nhân hóa (ẩn/hiện cột, sort, group)
   */
  private registerForP13n(): void {
    const table = this.getControlById<Table>("persoTable");
    if (!table) {
      return;
    }

    this.initP13nMetadata();
    this.initP13nWidths();
    this.registerP13nEngine(table);
  }

  /**
   * Khởi tạo metadata cho P13n (cá nhân hoá) các cột của Table
   */
  private initP13nMetadata(): void {
    this.MetadataHelper = new MetadataHelper([
      { key: "TaskDescr_col", label: "TaskDescr", path: "TaskDescr" },
      { key: "sentOn_col", label: "Sent On", path: "WiCd" },
      { key: "Priority_col", label: "Priority", path: "WiPrio" },
      { key: "dueDate_col", label: "Due date", path: "WiAed" },
      { key: "status_col", label: "Status", path: "WiStat" },
      { key: "Forward_col", label: "Forward By", path: "WiForwBy" },
    ]);
  }

  /**
   * Khởi tạo độ rộng mặc định cho các cột Table (P13n)
   */
  private initP13nWidths(): void {
    this.IntialWidth = {
      TaskDescr_col: "11rem",
      sentOn_col: "11rem",
      Priority_col: "11rem",
      dueDate_col: "11rem",
      status_col: "11rem",
      Forward_col: "11rem",
    };
  }

  /**
   * Đăng ký Table với P13n Engine để hỗ trợ cá nhân hoá cột, sort và group
   */
  private registerP13nEngine(table: Table): void {
    const engine = Engine.getInstance();

    engine.register(table, {
      helper: this.MetadataHelper,
      controller: {
        Columns: new SelectionController({
          targetAggregation: "columns",
          control: table,
        }),
        Sorter: new SortController({ control: table }),
        Groups: new GroupController({ control: table }),
      },
    });

    engine.attachStateChange(this.handleStateChange.bind(this));
  }

  /**
   * Mở dialog tùy chỉnh bảng (ẩn/hiện cột, sắp xếp) dựa trên sự kiện click
   */
  public openPersoDialog(event: Event): void {
    const table = this.getControlById<Table>("persoTable");

    Engine.getInstance().show(table, ["Columns", "Sorter"], {
      source: <Control>event.getSource()
    });
  }

  /**
   * Xử lý sự kiện khi người dùng nhấn vào header cột: xác định loại panel (sắp xếp hoặc ẩn/hiện cột) và mở dialog personalization cho bảng
   */
  public onColumnHeaderItemPress(event: Event): void {
    const table = this.getControlById<Table>("persoTable");
    const icon = <string>(event.getSource() as any).getIcon();
    const panel = icon.indexOf("sort") >= 0 ? "Sorter" : "Columns";

    Engine.getInstance().show(table, [panel], {
      source: table
    });
  }

  /**
   * Xử lý sự kiện sắp xếp cột: cập nhật trạng thái sorter của bảng và áp dụng lại state thông qua Engine
   */
  public onSort(event: Event): void {
    const table = this.getControlById<Table>("persoTable");
    const AffectedProperty = this.getKey(<Column>(event as any).getParameter("column"));
    const SortOrder = (event as any).getParameter("sortOrder");

    Engine.getInstance().retrieveState(table).then((State: any) => {
      State.Sorter.forEach((Sorter: any) => {
        Sorter.sorted = false;
      });

      State.Sorter.push({
        key: AffectedProperty,
        descending: SortOrder === CoreLibrary.SortOrder.Descending
      });

      Engine.getInstance().applyState(table, State);
    });
  }

  /**
   * Xử lý sự kiện khi người dùng di chuyển cột: cập nhật vị trí cột trong state và áp dụng lại thông qua Engine
   */
  public onColumnMove(event: Event): void {
    const table = this.getControlById<Table>("persoTable");
    const AffectedColumn = <Column>(event as any).getParameter("column");
    const NewPos = <number>(event as any).getParameter("newPos");
    const Key = this.getKey(AffectedColumn);

    event.preventDefault();

    Engine.getInstance().retrieveState(table).then((state: any) => {
      const col =
        state.Columns.find((c: any) => c.key === Key) || { key: Key };

      col.position = NewPos;

      // Áp dụng lại toàn bộ state
      Engine.getInstance().applyState(table, state);
    });
  }

  /**
   * Lấy key duy nhất của cột dựa trên local ID trong view
   */
  private getKey(Control: Column): string {
    return this.getView()?.getLocalId(Control.getId()) || "";
  }

  /**
   * Cập nhật trạng thái bảng (cột, chiều rộng, hiển thị, sắp xếp) dựa trên state
  */
  public handleStateChange(event: Event): void {
    const table = this.getControlById<Table>("persoTable");
    const state = (event as any).getParameter("state");

    if (!table || !state) {
      return;
    }

    this.resetTableColumns(table);
    this.applyColumnState(table, state);
    this.applySorterState(table, state);
  }

  /**
   * Reset trạng thái cột Table: ẩn cột và xoá sort
   */
  private resetTableColumns(table: Table): void {
    table.getColumns().forEach((column: Column) => {
      const key = this.getKey(column);
      if (!key) {
        return;
      }

      column.setVisible(false);
      column.setSortOrder(CoreLibrary.SortOrder.None);
    });
  }

  /**
   * Áp dụng trạng thái cột: hiển thị và sắp xếp lại thứ tự theo state P13n
   */
  private applyColumnState(table: Table, state: any): void {
    state.Columns?.forEach((prop: any, index: number) => {
      const column = this.getControlById<Column>(prop.key);
      if (!column) {
        return;
      }

      column.setVisible(true);
      table.removeColumn(column);
      table.insertColumn(column, index);
    });
  }

  /**
   * Áp dụng trạng thái sort từ P13n: set sort order cột và sort dữ liệu Table
   */
  private applySorterState(table: Table, state: any): void {
    const sorters: Sorter[] = [];

    state.Sorter?.forEach((sort: any) => {
      const column = this.getControlById<Column>(sort.key);
      if (!column) {
        return;
      }

      column.setSortOrder(
        sort.descending
          ? CoreLibrary.SortOrder.Descending
          : CoreLibrary.SortOrder.Ascending
      );

      const property = this.MetadataHelper.getProperty(sort.key)?.path;
      if (property) {
        sorters.push(new Sorter(property, sort.descending));
      }
    });

    const binding = table.getBinding("rows") as ListBinding;
    if (binding) {
      binding.sort(sorters);
    }
  }

  /**
   * Lưu và áp dụng lại độ rộng cột khi người dùng resize cột trong Table
   */
  public onColumnResize(event: Event): void {
    const Column = <Column>(event as any).getParameter("column");
    const Width = <string>(event as any).getParameter("width");
    const Table = this.getControlById<Table>("persoTable");

    const ColumnState: Record<string, string> = {};
    ColumnState[this.getKey(Column)] = Width;

    Engine.getInstance().applyState(Table, { ColumnWidth: ColumnState } as any);
  }

  /**
   * Xử lý khi thay đổi Status: tạo filter theo lựa chọn và áp dụng lọc cho Table
   */
  public onStatusChange(event: Event): void {
    const key = (<Item>(event as any).getParameter("selectedItem")).getKey();
    const table = this.getControlById<Table>("persoTable");
    const binding = <ListBinding>table.getBinding("rows");
    const Filters: Filter[] = [];

    switch (key) {
      case "1": {
        Filters.push(new Filter({
          filters: [
            new Filter("Status", FilterOperator.EQ, "01"),
            new Filter("Status", FilterOperator.EQ, "02")
          ],

          and: false // OR
        }));

        break;
      }
      case "2": {
        Filters.push(new Filter("Status", FilterOperator.EQ, "01"));

        break;
      }
      case "3": {
        Filters.push(new Filter("Status", FilterOperator.EQ, "02"));

        break;
      }
      case "4": {
        Filters.push(new Filter("Status", FilterOperator.EQ, "03"));

        break;
      }
      case "5": {
        Filters.push(new Filter({
          filters: [
            new Filter("Status", FilterOperator.EQ, "01"),
            new Filter("Status", FilterOperator.EQ, "02"),
            new Filter("Status", FilterOperator.EQ, "03"),
            new Filter("Status", FilterOperator.EQ, "04")
          ],

          and: false // OR
        }));

        break;
      }
    }

    if (binding) {
      binding.filter(Filters);
    }
  }
  // #endregion

  // #region Filter Search
  // Lifecycle hook
  public override onAfterRendering(): void | undefined {
    this.filterBar.fireSearch();
  }

  // Lấy các giá trị của các trường để tạo một biến thể bộ lọc mới.
  private fetchData = () => {
    return this.filterBar.getAllFilterItems(false).reduce<FilterPayload[]>((acc, item: FilterGroupItem) => {
      const control = item.getControl();
      const groupName = item.getGroupName();
      const fieldName = item.getName();

      if (control) {
        let fieldData: string | string[] = "";

        switch (true) {
          case this.isControl<Input>(control, "sap.m.Input"):
          case this.isControl<TextArea>(control, "sap.m.TextArea"): {
            fieldData = control.getValue();

            break;
          }
          case this.isControl<MultiInput>(control, "sap.m.MultiInput"): {
            fieldData = control.getTokens().map((token) => token.getKey());

            break;
          }
          case this.isControl<DatePicker>(control, "sap.m.DatePicker"):
          case this.isControl<TimePicker>(control, "sap.m.TimePicker"): {
            fieldData = control.getValue();

            break;
          }
          case this.isControl<Select>(control, "sap.m.Select"):
          case this.isControl<ComboBox>(control, "sap.m.ComboBox"): {
            fieldData = control.getSelectedKey();

            break;
          }
          case this.isControl<MultiComboBox>(control, "sap.m.MultiComboBox"): {
            fieldData = control.getSelectedKeys();

            break;
          }
          default:
            break;
        }

        acc.push({
          groupName,
          fieldName,
          fieldData,
        });
      }

      return acc;
    }, []);
  };

  // Áp dụng các giá trị của các trường từ biến thể bộ lọc.
  private applyData = (data: unknown) => {
    (<FilterPayload[]>data).forEach((item) => {
      const { groupName, fieldName, fieldData } = item;

      const control = this.filterBar.determineControlByName(fieldName, groupName);

      switch (true) {
        case this.isControl<Input>(control, "sap.m.Input"):
        case this.isControl<TextArea>(control, "sap.m.TextArea"): {
          control.setValue(<string>fieldData);

          break;
        }
        case this.isControl<MultiInput>(control, "sap.m.MultiInput"): {
          const tokens = (<string[]>fieldData).map((key) => new Token({ key, text: key }));

          control.setTokens(tokens);

          break;
        }
        case this.isControl<DatePicker>(control, "sap.m.DatePicker"):
        case this.isControl<TimePicker>(control, "sap.m.TimePicker"): {
          control.setValue(<string>fieldData);

          break;
        }
        case this.isControl<Select>(control, "sap.m.Select"):
        case this.isControl<ComboBox>(control, "sap.m.ComboBox"): {
          control.setSelectedKey(<string>fieldData);

          break;
        }
        case this.isControl<MultiComboBox>(control, "sap.m.MultiComboBox"): {
          control.setSelectedKeys(<string[]>fieldData);

          break;
        }
        default:
          break;
      }
    });
  };

  // Lấy các bộ lọc có giá trị để hiển thị trên nhãn
  private getFiltersWithValues = () => {
    return this.filterBar.getFilterGroupItems().reduce<FilterGroupItem[]>((acc, item) => {
      const control = item.getControl();

      if (control) {
        switch (true) {
          case this.isControl<Input>(control, "sap.m.Input"):
          case this.isControl<TextArea>(control, "sap.m.TextArea"): {
            const value = control.getValue();

            if (value) {
              acc.push(item);
            }

            break;
          }
          case this.isControl<MultiInput>(control, "sap.m.MultiInput"): {
            const tokens = control.getTokens();

            if (tokens.length) {
              acc.push(item);
            }

            break;
          }
          case this.isControl<DatePicker>(control, "sap.m.DatePicker"):
          case this.isControl<TimePicker>(control, "sap.m.TimePicker"): {
            const value = control.getValue();

            if (value) {
              acc.push(item);
            }

            break;
          }
          case this.isControl<Select>(control, "sap.m.Select"):
          case this.isControl<ComboBox>(control, "sap.m.ComboBox"): {
            const value = control.getSelectedKey();

            if (value) {
              acc.push(item);
            }

            break;
          }
          case this.isControl<MultiComboBox>(control, "sap.m.MultiComboBox"): {
            const keys = control.getSelectedKeys();

            if (keys.length) {
              acc.push(item);
            }

            break;
          }
          default:
            break;
        }
      }

      return acc;
    }, []);
  };

  // Chuyển tiếp sự kiện thay đổi bộ lọc từ FilterBar
  public onSelectionChange(event: FilterBar$FilterChangeEvent) {
    this.filterBar.fireEvent("filterChange", event);
  }

  // Xử lý khi bộ lọc thay đổi và cập nhật nhãn cùng bảng dữ liệu
  public onFilterChange() {
    this.updateLabelsAndTable();
  }

  // Cập nhật lại nhãn và bảng dữ liệu sau khi áp dụng xong biến thể lọc
  public onAfterVariantLoad() {
    this.updateLabelsAndTable();
  }

  // Cập nhật nội dung nhãn hiển thị bộ lọc (expanded/snapped) và chuẩn bị làm mới bảng dữ liệu
  private updateLabelsAndTable() {
    console.log("Cập nhật text nhé");
  }

  // Thu thập và trả về các giá trị bộ lọc hiện tại từ FilterBar theo từng loại control
  public getFilters() {
    const filters = this.filterBar.getFilterGroupItems().reduce<Dict>((acc, item) => {
      const control = item.getControl();
      const name = item.getName();

      switch (true) {
        case this.isControl<Input>(control, "sap.m.Input"):
        case this.isControl<TextArea>(control, "sap.m.TextArea"): {
          const value = control.getValue();

          if (value) {
            acc[name] = value;
          }

          break;
        }
        case this.isControl<DatePicker>(control, "sap.m.DatePicker"):
        case this.isControl<TimePicker>(control, "sap.m.TimePicker"): {
          const value = control.getValue();

          if (value) {
            acc[name] = value;
          }

          break;
        }
        case this.isControl<Select>(control, "sap.m.Select"):
        case this.isControl<ComboBox>(control, "sap.m.ComboBox"): {
          const value = control.getSelectedKey();

          if (value) {
            acc[name] = value;
          }

          break;
        }
        default:
          break;
      }

      return acc;
    }, {});

    console.log("Filters:", filters);

    return filters;
  }

  // Search
  // public onSearch() {
  //   const oDataModel = this.getModel<ODataModel>("dulieuFiltered");
  //   const tableModel = this.getModel<JSONModel>("table");

  //   this.table.setBusy(true);
  //   oDataModel.read("/dulieu", {
  //     filters: [],
  //     urlParameters: {},
  //     success: (response: ODataResponse<XayDungToTrinh[]>) => {
  //       this.table.setBusy(false);

  //       console.log("OData read success:", response.results);

  //       tableModel.setProperty("/rows", response.results);
  //     },
  //     error: (error: ODataError) => {
  //       this.table.setBusy(false);
  //       console.error("OData read error:", error);
  //     },
  //   });
  // }

  public onSearch() {
    const tableModel = this.getModel<JSONModel>("table");
    const data = this.getModel<JSONModel>("dulieuFiltered1").getProperty("/dulieu");

    this.table.setBusy(true);

    const subject = this.getControlById<Input>("Subject")?.getValue()?.toLowerCase();
    const from = this.getControlById<MultiComboBox>("From")?.getSelectedItems();
    const sentOn = this.getControlById<DatePicker>("SentOn")?.getValue();
    const priority = this.getControlById<MultiComboBox>("Priority")?.getSelectedItems();
    const dueDate = this.getControlById<DatePicker>("Duedate")?.getValue();
    const status = this.getControlById<MultiComboBox>("Status")?.getSelectedKeys();
    const forwardedBy = this.getControlById<MultiComboBox>("ForwardedBy")?.getSelectedItems();
    const normalizeDate = (Date: string) => Date ? Date.replace(/-/g, "") : "";

    const filteredData = data.filter((item: any) => {
      return (
        (!subject || item.Subject?.toLowerCase().includes(subject)) &&
        (!from?.length || from.map(item => item.getText()).includes(item.From)) &&
        (!sentOn || normalizeDate(item.SentOn) === sentOn) &&
        (!priority?.length || priority.map(item => item.getText()).includes(item.Priority)) &&
        (!dueDate || normalizeDate(item.Duedate) === dueDate) &&
        (!status?.length || status.includes(item.Status)) &&
        (!forwardedBy?.length || forwardedBy.map(item => item.getText()).includes(item.ForwardedBy))
      );
    });

    this.getModel<JSONModel>("dulieuFiltered")!.setProperty("/dulieu", filteredData);

    this.table.setBusy(false);
  }

  // Hàm reset dữ liệu filter
  public clearFilterBar(): void {
    this.onResetFilters();
  }

  private onResetFilters(): void {
    const FilterBar = this.getControlById<FilterBar>("filterbar");

    FilterBar.getAllFilterItems(true).forEach((item: any) => {
      const control = item.getControl();

      if (control?.setValue) {
        control.setValue(""); // Input, DatePicker
      }

      if (control?.setSelectedKeys) {
        control.setSelectedKeys([]); // MultiComboBox
      }
    });

    const data = this.getModel<JSONModel>("dulieuFiltered1").getProperty("/dulieu");

    this.getModel<JSONModel>("dulieuFiltered")!.setProperty("/dulieu", data);
  }

  // #endregion
}
