import type { OHLCVCandle } from "@/types/agent-builder-canvas";

export type IndicatorParamType = "number" | "select";

export type IndicatorParam = {
  key: string;
  label: string;
  type: IndicatorParamType;
  default: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string | number }[];
};

export type IndicatorPane = "overlay" | "sub";
export type IndicatorOutputType = "line" | "histogram" | "area" | "band";

export type IndicatorOutput = {
  id: string;
  label: string;
  pane: IndicatorPane;
  type: IndicatorOutputType;
  color?: string;
};

export type IndicatorCategory =
  | "momentum"
  | "trend"
  | "volatility"
  | "volume"
  | "custom";

export type IndicatorSource = "builtin" | "user";

export type IndicatorParamValues = Record<string, number | string>;

export type IndicatorComputeResult = Record<string, (number | null)[]>;

export type IndicatorDefinition = {
  id: string;
  name: string;
  category: IndicatorCategory;
  source: IndicatorSource;
  params: IndicatorParam[];
  outputs: IndicatorOutput[];
  compute: (candles: OHLCVCandle[], params: IndicatorParamValues) => IndicatorComputeResult;
};

export type IndicatorInstance = {
  instanceId: string;
  definitionId: string;
  params: IndicatorParamValues;
  colorOverrides?: Record<string, string>;
};
