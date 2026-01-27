import JSONModel from "sap/ui/model/json/JSONModel";
import Base from "./Base.controller";
import type View from "sap/ui/core/mvc/View";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import AppComponent from "../Component";

/**
 * @namespace base.controller
 */

export default class App extends Base {
  public override onInit(): void {
    const view: View = this.getView()!;
    const OriginalBusyDelay: number = view.getBusyIndicatorDelay();

    const viewModel = new JSONModel({
      busy: true,
      delay: 0,
      layout: "OneColumn",
      previousLayout: "",
      actionButtonsInfo: {
        midColumn: {
          fullScreen: false
        }
      }
    });

    this.getOwnerComponent()?.setModel(viewModel, "appView");

    const fnSetAppNotBusy = (): void => {
      viewModel.setProperty("/busy", false);
      viewModel.setProperty("/delay", OriginalBusyDelay);
    };

    const ODataModel = <ODataModel>this.getOwnerComponent()!.getModel();

    if (ODataModel) {
      ODataModel.metadataLoaded().then(fnSetAppNotBusy);
      ODataModel.attachMetadataFailed(fnSetAppNotBusy);
    }

    view.addStyleClass((this.getOwnerComponent() as AppComponent)!.getContentDensityClass());

  }
}
