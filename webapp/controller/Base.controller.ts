import Formatter from "com/sphinxjsc/activequeries/utils/Formatter";
import type ResourceBundle from "sap/base/i18n/ResourceBundle";
import type Control from "sap/ui/core/Control";
import UI5Element from "sap/ui/core/Element";
import Controller from "sap/ui/core/mvc/Controller";
import type View from "sap/ui/core/mvc/View";
import syncStyleClass from "sap/ui/core/syncStyleClass";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import Model from "sap/ui/model/Model";
import type ODataModel from "sap/ui/model/odata/v2/ODataModel";
import ResourceModel from "sap/ui/model/resource/ResourceModel";
import type Component from "../Component";
import type PropertyBinding from "sap/ui/model/PropertyBinding";
import type SimpleType from "sap/ui/model/SimpleType";
import type { Dict } from "../types/utils";
import type Input from "sap/m/Input";
import type TextArea from "sap/m/TextArea";
import type MultiInput from "sap/m/MultiInput";
import type DatePicker from "sap/m/DatePicker";
import type TimePicker from "sap/m/TimePicker";
import type Select from "sap/m/Select";
import type ComboBox from "sap/m/ComboBox";
import type MultiComboBox from "sap/m/MultiComboBox";
import type { BindingContextInfoTarget, CompositeBindingInfo } from "../types/control";

const formControlTypes = [
  "sap.m.Input",
  "sap.m.TextArea",
  "sap.m.DatePicker",
  "sap.m.Select",
  "sap.m.RadioButtonGroup",
  "sap.m.CheckBox",
  "sap.m.ComboBox",
] as const;

type FormControlType = (typeof formControlTypes)[number];

/**
 * @namespace com.sphinxjsc.activequeries.controller
 */
export default class Base extends Controller {
  public formatter = Formatter;
  public dataType = {};

  protected getRouter() {
    return UIComponent.getRouterFor(this);
  }

  protected getModel<T = JSONModel>(name?: string) {
    return this.getView()?.getModel(name) as T;
  }

  protected setModel(model: Model, name?: string) {
    this.getView()?.setModel(model, name);
  }

  protected getGlobalModel() {
    return this.getComponentModel("global");
  }

  protected getControlById<T = UI5Element>(id: string) {
    return this.getView()?.byId(id) as T;
  }

  protected getControlId<T = string>(control: UI5Element): T;
  // eslint-disable-next-line no-dupe-class-members
  protected getControlId<T = string | null>(control?: UI5Element): T;
  // eslint-disable-next-line no-dupe-class-members
  protected getControlId<T = string | null>(control?: UI5Element) {
    if (!control) return null;
    return this.getView()?.getLocalId(control.getId()) as T;
  }

  protected reload() {
    // eslint-disable-next-line fiori-custom/sap-no-location-reload
    window.location.reload();
  }

  protected getResourceBundle() {
    const resourceModel = <ResourceModel>this.getComponent().getModel("i18n");
    return <ResourceBundle>resourceModel.getResourceBundle();
  }

  protected getBundleText(i18nKey: string, placeholders?: string[]) {
    return this.getResourceBundle().getText(i18nKey, placeholders) || i18nKey;
  }

  protected getComponent() {
    return this.getOwnerComponent() as Component;
  }

  protected getComponentModel<T = ODataModel>(name?: string) {
    return this.getComponent().getModel(name) as T;
  }

  protected setComponentModel(model: Model, name?: string) {
    this.getComponent().setModel(model, name);
  }

  protected getMetadataLoaded() {
    return this.getComponentModel().metadataLoaded();
  }

  protected attachControl(control: Control) {
    const view = <View>this.getView();

    const styleClass = this.getComponent().getContentDensityClass();

    syncStyleClass(styleClass, view, control);

    view.addDependent(control);
  }

  protected async loadView<T extends Control>(viewName: string) {
    const fragment = <Promise<T>>this.loadFragment({
      name: `${this.getAppID()}.view.fragments.${viewName}`,
    });

    fragment
      .then((control) => {
        this.attachControl(control);
      })
      .catch((error) => {
        console.log(error);
      });

    return fragment;
  }

  protected getAppID() {
    return <string>this.getComponent().getManifestEntry("/sap.app/id");
  }

  protected getControlName<T extends Control>(control: T): string {
    return control.getMetadata().getName();
  }

  protected isControl<T extends Control>(control: unknown, name: string): control is T {
    return this.getControlName(<Control>control) === name;
  }

  protected displayTarget(options: { target: string; title?: string; description?: string }) {
    const { target, title, description } = options;

    void this.getRouter().getTargets()?.display(target);
  }

  protected getFormControlsByFieldGroup<T extends Control>(props: {
    groupId: string | string[];
    container?: Control;
    types?: readonly FormControlType[];
  }) {
    const { groupId, container, types = formControlTypes } = props;

    const _container = container ?? this.getView();

    if (!_container) return [];

    return _container.getControlsByFieldGroupId(groupId).filter((control) => {
      const isFormControl = (<string[]>types).some((type) => {
        return this.isControl(control, type);
      });

      const isVisible = control.getVisible();

      return isFormControl && isVisible;
    }) as T[];
  }

  protected getBindingContextInfo<C extends Control, T extends Dict = Dict>(source: C) {
    let bindingInfo = <CompositeBindingInfo>{
      parts: [],
    };

    switch (true) {
      case this.isControl<Input>(source, "sap.m.Input"):
      case this.isControl<TextArea>(source, "sap.m.TextArea"): {
        bindingInfo = source.getBindingInfo("value");

        break;
      }
      case this.isControl<MultiInput>(source, "sap.m.MultiInput"): {
        bindingInfo = source.getBindingInfo("tokens");

        break;
      }
      case this.isControl<DatePicker>(source, "sap.m.DatePicker"):
      case this.isControl<TimePicker>(source, "sap.m.TimePicker"): {
        bindingInfo = source.getBindingInfo("value");

        break;
      }
      case this.isControl<Select>(source, "sap.m.Select"):
      case this.isControl<ComboBox>(source, "sap.m.ComboBox"): {
        bindingInfo = source.getBindingInfo("selectedKey");

        break;
      }
      case this.isControl<MultiComboBox>(source, "sap.m.MultiComboBox"): {
        bindingInfo = source.getBindingInfo("selectedKeys");

        break;
      }
    }

    bindingInfo = bindingInfo || {
      parts: [],
    };

    const binding = bindingInfo.binding;
    const context = binding?.getContext();
    const model = <JSONModel>context?.getModel();
    const path = bindingInfo.parts?.[0]?.path || "";
    const modelName = bindingInfo.parts?.[0]?.model || "";

    const tooltipBinding = <PropertyBinding>source.getBinding("tooltip");

    const value: BindingContextInfoTarget<C, T> = {
      name: binding?.getPath() ?? path ?? "", // Property name (alt: getBindingPath)
      path: context?.getPath() ?? "", // Value binding path
      processor: context?.getModel(), // Binding model
      bindingType: <SimpleType>binding?.getType?.(), // Input data type,
      data: context?.getObject() as T, // Binding object value
      binding,
      model,
      modelName,
      label: <string>tooltipBinding?.getValue() || source.getTooltip_Text() || "",
      control: source,
      get target() {
        const path = this.path;
        const name = this.name;

        return `${path}${path === "/" ? "" : "/"}${name}`;
      },
    };

    return value;
  }
}
