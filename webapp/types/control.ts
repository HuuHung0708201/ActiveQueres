import type { PropertyBindingInfo } from "sap/ui/base/ManagedObject";
import type Control from "sap/ui/core/Control";
import type MessageProcessor from "sap/ui/core/message/MessageProcessor";
import type PropertyBinding from "sap/ui/model/PropertyBinding";
import type SimpleType from "sap/ui/model/SimpleType";
import type JSONModel from "sap/ui/model/json/JSONModel";
import type { Dict } from "./utils";

export type CompositeBindingInfo = PropertyBindingInfo & {
  binding?: PropertyBinding;
  parts?: PropertyBindingInfo[];
};

export interface BindingContextInfoTarget<C extends Control, T extends Dict> {
  name: string;
  path: string;
  processor?: MessageProcessor;
  bindingType?: SimpleType;
  binding?: PropertyBinding;
  model: JSONModel;
  modelName: string;
  label: string;
  control: C;
  target: string;
  data: T;
}
