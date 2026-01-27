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

  public override onInit(): void {
    // Mockdata để test do chưa có API
    const model = new JSONModel(XayDungToTrinhDetailData);

    this.setModel(model, "dulieu");

    // Tạo model trống cho dữ liệu con hiển thị
    this.setModel(new JSONModel({ dulieu: [] }), "dulieuFiltered");
    this.setModel(new JSONModel({ dulieu: [] }), "dulieuFiltered1");
    // Tạo để điển dữ liệu vào thanh search Form
    this.setModel(new JSONModel({ fromItems: [] }), "formModel");
    this.setModel(new JSONModel({ PriorityItems: [] }), "PriorityModel");
    this.setModel(new JSONModel({ StatusItems: [] }), "StatusModel");
    this.setModel(new JSONModel({ ForwardedByItems: [] }), "ForwardedByModel");

    const ShowModel = new JSONModel(StatusSelectData);

    this.setModel(ShowModel, "showModel");

    // Nếu muốn tự động chọn node dựa trên objectId (ví dụ từ router)
    // const objectId = this.getRouter().getHashChanger().getHash().split("/")[1];
    // if (objectId) {
    //   this.filterByNodeId(objectId);
    // }

    const EventBus = <EventBus>this.getOwnerComponent()?.getEventBus();

    EventBus.subscribe("MyChannel", "itemClicked", this.onItemClicked, this);
    EventBus.subscribe("LayDuLieuVoiIDTuongUng", "itemDataID", this.loadDataById, this);

    this.ThayDoiTenButton();
    this.registerForP13n();
    this.onResetFilters();

    // Filter Search
    this.view = <View>this.getView();
    this.router = this.getRouter();
    this.table = this.getControlById<Table>("persoTable");
    this.layout = this.getControlById<DynamicPage>("dynamicPage");

    this.setModel(
      new JSONModel({
        rows: [],
        selectedIndices: [],
      }),
      "table"
    );

    // Filters
    this.filterBar = this.getControlById<FilterBar>("filterbar");

    // Filter initialize
    this.filterBar.registerFetchData(this.fetchData);
    this.filterBar.registerApplyData(this.applyData);
    this.filterBar.registerGetFiltersWithValues(this.getFiltersWithValues);
    // Filter Search Hết
  }

  // Load dữ liệu tương ứng
  private loadDataById(channel: string, eventId: string, leafId: any): void {
    const model = this.getModel("dulieuFiltered");

    const ODataModel = this.getModel<ODataModel>();

    ODataModel.read("/StepListSet", {
      urlParameters: {
        "$expand": "ToSubstepList/ToTaskList"
      },
      success: (response: ODataResponse<any[]>) => {

        // 1️⃣ tìm đúng Substep
        let aTasks: any[] = [];

        let tilteText = this.getControlById<Text>("tilteText");

        if (tilteText) {
          (tilteText as any).setText(response.results[0].ToSubstepList.results[0].SubstepDescr);
        }

        response.results.some(step => {
          const aSubsteps = step.ToSubstepList?.results || [];

          const Substep = aSubsteps.find(
            (s: any) => s.substep === (leafId as any).leafId
          );

          if (Substep) {
            aTasks = Substep.ToTaskList?.results || [];
            return true; // break
          }
          return false;
        });

        let dulieu = {
          ToTaskList: {
            results: aTasks || []
          }
        }

        model.setProperty("/dulieu", dulieu);
      },
      error: (err: Error) => console.error(err)
    });


  }

  // #region Hàm xử lý lấy thông tin json khi click vào
  private onItemClicked(channel: string, eventId: string, data: any): void {
    this.onResetFilters();

    let tilteText = this.getControlById<Text>("tilteText");

    if (tilteText) {
      (tilteText as any).setText(data.data.SubstepDescr);
    }

    const NodeID = data.data.Substep;

    if (!NodeID) {
      return;
    }

    const model = this.getModel("dulieuFiltered");

    model.setProperty("/dulieu", data.data);

    // // Lọc dữ liệu con theo idCha
    const Filtered = (this.getModel("dulieu")?.getData().dulieu || []).filter(
      (item: any) => item.idCha === NodeID
    );

    // Đẩy dữ liệu filtered vào model tạm để bind vào UI
    // const FilteredModel = new JSONModel({ dulieu: Filtered });

    // this.setModel(FilteredModel, "dulieuFiltered");

    // Lấy dữ liệu form ra
    const fromItems = Array.from(
      new Map(
        Filtered
          .filter((item: any) => item.From) // tránh null/undefined
          .map((item: any) => [item.From, item])
      ).values()
    ).map((item: any, index: number) => ({
      key: index + 1,
      text: item.From
    }))

    const PriorityItems = Array.from(
      new Map(
        Filtered
          .filter((item: any) => item.Priority) // tránh null/undefined
          .map((item: any) => [item.Priority, item])
      ).values()
    ).map((item: any, index: number) => ({
      key: index + 1,
      text: item.Priority
    }))

    const StatusItems = Array.from(
      new Map(
        Filtered
          .filter((item: any) => item.Status) // tránh null/undefined
          .map((item: any) => [item.Status, item])
      ).values()
    ).map((item: any, index: number) => ({
      key: item.Status,
      text:
        item.Status === "01"
          ? "New"
          : item.Status === "02"
            ? "In Progress"
            : item.Status === "03"
              ? "Rejected"
              : item.Status === "04"
                ? "Approved"
                : item.Status
    }))

    const ForwardedByItems = Array.from(
      new Map(
        Filtered
          .filter((item: any) => item.ForwardedBy) // tránh null/undefined
          .map((item: any) => [item.ForwardedBy, item])
      ).values()
    ).map((item: any, index: number) => ({
      key: index + 1,
      text: item.ForwardedBy
    }))

    const FormModel = <JSONModel>this.getModel("formModel");
    const PriorityModel = <JSONModel>this.getModel("PriorityModel");
    const StatusModel = <JSONModel>this.getModel("StatusModel");
    const ForwardedByModel = <JSONModel>this.getModel("ForwardedByModel");

    // Đổ danh sách item
    FormModel.setProperty("/fromItems", fromItems);
    PriorityModel.setProperty("/PriorityItems", PriorityItems);
    StatusModel.setProperty("/StatusItems", StatusItems);
    ForwardedByModel.setProperty("/ForwardedByItems", ForwardedByItems);
  }

  // Hàm lọc dữ liệu theo nodeID khi load lần đầu
  // private filterByNodeId(nodeId: string): void {
  //   const Filtered = (this.getModel("dulieu")?.getData().dulieu || []).filter(
  //     (item: any) => item.idCha === nodeId
  //   );

  //   const FilteredModel = <JSONModel>this.getModel("dulieuFiltered");

  //   FilteredModel.setData({ dulieu: Filtered });

  //   const FilteredModel1 = <JSONModel>this.getModel("dulieuFiltered1");

  //   FilteredModel1.setData({ dulieu: Filtered });

  //   const model = new JSONModel(XayDungToTrinhLeftData);

  //   this.setModel(model);

  //   const treeData = this.getModel()?.getData()?.queries || [];
  //   let parentNodeName = "";

  //   treeData.some((query: any) =>
  //     query.nodes.some((node: any) => {
  //       if (node.id === nodeId) {
  //         parentNodeName = node.name;
  //         return true;
  //       }
  //       return false;
  //     })
  //   );

  //   const titleText = this.getControlById<Text>("tilteText");

  //   if (titleText && parentNodeName) {
  //     titleText.setText(parentNodeName);
  //   }

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
  //   }));

  //   const PriorityItems = Array.from(
  //     new Map(
  //       Filtered
  //         .filter((item: any) => item.Priority) // tránh null/undefined
  //         .map((item: any) => [item.Priority, item])
  //     ).values()
  //   ).map((item: any, index: number) => ({
  //     key: index + 1,
  //     text: item.Priority
  //   }));

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
  //   }));

  //   const ForwardedByItems = Array.from(
  //     new Map(
  //       Filtered
  //         .filter((item: any) => item.ForwardedBy) // tránh null/undefined
  //         .map((item: any) => [item.ForwardedBy, item])
  //     ).values()
  //   ).map((item: any, index: number) => ({
  //     key: index + 1,
  //     text: item.ForwardedBy
  //   }));

  //   const FormModel = <JSONModel>this.getModel("formModel");
  //   const PriorityModel = <JSONModel>this.getModel("PriorityModel");
  //   const StatusModel = <JSONModel>this.getModel("StatusModel");
  //   const ForwardedByModel = <JSONModel>this.getModel("ForwardedByModel");

  //   FormModel.setData({ fromItems: fromItems });
  //   PriorityModel.setData({ PriorityItems: PriorityItems });
  //   StatusModel.setData({ StatusItems: StatusItems });
  //   ForwardedByModel.setData({ ForwardedByItems: ForwardedByItems });
  // }


  // #endregion

  // #region Hàm xử lý thay đổi text ở Button
  private ThayDoiTenButton(): void {
    const filterBar = this.getControlById<FilterBar>("filterbar");

    if (filterBar) {
      const goButton = (filterBar as any)._oClearButtonOnFB;

      if (goButton) {
        goButton.setText("Clear Filters");
      }
    }

    if (filterBar) {
      filterBar.addEventDelegate({
        onAfterRendering: function () {
          // 🔹 Lấy toàn bộ phần tử con được render bên trong FilterBar
          const allControls = filterBar.findAggregatedObjects(true);

          // 🔹 Tìm button có text "Go"
          const goButton = <Button>allControls.find((ctrl: any) => ctrl?.getText && ctrl.getText() === "Go");

          const adaptButton = <Button>(
            allControls.find((ctrl: any) => ctrl?.getText && ctrl.getText() === "Adapt Filters")
          );

          if (goButton) {
            goButton.setText("Search");

            goButton.setIcon("sap-icon://search");
          } else {
            console.warn("⚠️ Không tìm thấy nút Go trong FilterBar.");
          }

          if (adaptButton) {
            adaptButton.setIcon("sap-icon://filter-facets");
          } else {
            console.warn("⚠️ Không tìm thấy nút Go trong FilterBar.");
          }
        },
      });
    }
  }
  // #endregion

  // #region formatter trạng thái 
  public formatStatusText(statusKey: string): string {
    const map: Record<string, string> = {
      "01": "New",
      "02": "Approved",
      "03": "Rejected",
    };

    return map[statusKey] ?? statusKey;
  }

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

  // #region Đăng ký Table với P13n Engine để hỗ trợ cá nhân hóa (ẩn/hiện cột, sort, group)
  private registerForP13n(): void {
    const table = this.getControlById<Table>("persoTable");

    this.MetadataHelper = new MetadataHelper([
      { key: "TaskDescr_col", label: "TaskDescr", path: "TaskDescr" },
      { key: "sentOn_col", label: "Sent On", path: "WiCd" },
      { key: "Priority_col", label: "Priority", path: "WiPrio" },
      { key: "dueDate_col", label: "Due date", path: "WiAed" },
      { key: "status_col", label: "Status", path: "WiStat" },
      { key: "Forward_col", label: "Forward By", path: "WiForwBy" },
    ]);

    this.IntialWidth = {
      TaskDescr_col: "11rem",
      sentOn_col: "11rem",
      Priority_col: "11rem",
      dueDate_col: "11rem",
      status_col: "11rem",
      Forward_col: "11rem",
    };

    Engine.getInstance().register(table, {
      helper: this.MetadataHelper,

      controller: {
        Columns: new SelectionController({
          targetAggregation: "columns",
          control: table
        }),
        Sorter: new SortController({
          control: table
        }),
        Groups: new GroupController({
          control: table
        }),
      }
    });

    Engine.getInstance().attachStateChange(this.handleStateChange.bind(this));
  }

  // Mở dialog tùy chỉnh bảng (ẩn/hiện cột, sắp xếp) dựa trên sự kiện click
  public openPersoDialog(event: Event): void {
    const table = this.getControlById<Table>("persoTable");

    Engine.getInstance().show(table, ["Columns", "Sorter"], {
      source: <Control>event.getSource()
    });
  }

  // Xử lý sự kiện khi người dùng nhấn vào header cột: xác định loại panel (sắp xếp hoặc ẩn/hiện cột) và mở dialog personalization cho bảng
  public onColumnHeaderItemPress(event: Event): void {
    const table = this.getControlById<Table>("persoTable");
    const icon = <string>(event.getSource() as any).getIcon();
    const panel = icon.indexOf("sort") >= 0 ? "Sorter" : "Columns";

    Engine.getInstance().show(table, [panel], {
      source: table
    });
  }

  // Xử lý sự kiện sắp xếp cột: cập nhật trạng thái sorter của bảng và áp dụng lại state thông qua Engine
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

  // Xử lý sự kiện khi người dùng di chuyển cột: cập nhật vị trí cột trong state và áp dụng lại thông qua Engine
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

  // Lấy key duy nhất của cột dựa trên local ID trong view
  private getKey(Control: Column): string {
    return this.getView()?.getLocalId(Control.getId()) || "";
  }

  // Cập nhật trạng thái bảng (cột, chiều rộng, hiển thị, sắp xếp) dựa trên state
  public handleStateChange(event: Event): void {
    const table = this.getControlById<Table>("persoTable");
    const State = (event as any).getParameter("state");

    // table.getColumns().forEach((column: Column) => {
    //   const Key = this.getKey(column);
    //   // const ColumnWidth =
    //   //   State.ColumnWidth && State.ColumnWidth[Key]
    //   //     ? State.ColumnWidth[Key]
    //   //     : this.IntialWidth[Key];
    //   // const ColumnWidth = State.ColumnWidth[Key];

    //   // column.setWidth(ColumnWidth);
    //   column.setVisible(false);
    //   column.setSortOrder(CoreLibrary.SortOrder.None);
    // });

    table.getColumns().forEach((column: Column) => {
      const key = this.getKey(column);

      if (!key) {
        return; // ⚠️ cột không được khai báo trong MetadataHelper
      }

      column.setVisible(false);
      column.setSortOrder(CoreLibrary.SortOrder.None);
    });

    State.Columns.forEach((Prop: any, Index: number) => {
      const Col = this.getControlById<Column>(Prop.key);
      Col.setVisible(true);

      table.removeColumn(Col);
      table.insertColumn(Col, Index);
    });

    const Sorters: Sorter[] = [];

    State.Sorter.forEach((Sorte: any) => {
      const Column = this.getControlById<Column>(Sorte.key);

      // Cập nhật hiển thị sort order trên column
      Column.setSortOrder(
        Sorte.descending
          ? CoreLibrary.SortOrder.Descending
          : CoreLibrary.SortOrder.Ascending
      );

      // Tạo sorter cho binding
      const ColumnSorter = new Sorter(
        this.MetadataHelper.getProperty(Sorte.key).path,
        Sorte.descending
      );

      Sorters.push(ColumnSorter);
    });

    // Áp dụng sorter cho binding
    const Binding = <ListBinding>table.getBinding("rows");

    Binding.sort(Sorters);
  }

  // Lưu và áp dụng lại độ rộng cột khi người dùng resize cột trong Table
  public onColumnResize(event: Event): void {
    const Column = <Column>(event as any).getParameter("column");
    const Width = <string>(event as any).getParameter("width");
    const Table = this.getControlById<Table>("persoTable");

    const ColumnState: Record<string, string> = {};
    ColumnState[this.getKey(Column)] = Width;

    Engine.getInstance().applyState(Table, { ColumnWidth: ColumnState } as any);
  }

  // #endregion

  // #region Khi chọn trạng thái ở table
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
