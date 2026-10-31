export type NodeCategory = "data" | "logic" | "action" | "flow";
export type NodeStatus = "idle" | "running" | "success" | "error";

export interface HandleDef {
  id: string;
  label: string;
  position: "left" | "right";
  type: "source" | "target";
  dataType: "number" | "boolean" | "signal" | "string" | "any";
}

export interface ConfigField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "toggle";
  options?: string[];
  default?: unknown;
  placeholder?: string;
}

export interface OHLCVCandle {
  time: number; // unix seconds (candle open time)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartExecutionAccess {
  getCandles: () => OHLCVCandle[];
  getIndicator: (definitionId: string, params?: Record<string, number | string>) => Record<string, (number | null)[]>;
  getActiveSymbol: () => { symbol: string; address: string; name: string } | null;
  addMarker: (marker: {
    time: number;
    color: string;
    shape: "arrowUp" | "arrowDown" | "circle";
    text?: string;
  }) => void;
}

export interface ExecutionContext {
  walletAddress: string | null;
  provider: unknown;
  signer: unknown;
  /** When set, successful SwapNode writes a marketplace decision receipt */
  activationId?: string | null;
  strategyVersionId?: string | null;
  addLog: (msg: string, level?: "info" | "warn" | "error") => void;
  showToast: (message: string, level?: "info" | "warn" | "error") => void;
  addChartMarker: (marker: {
    time: number;
    label: string;
    color: string;
    shape: "arrowUp" | "arrowDown" | "circle";
  }) => void;
  backtestCandle?: OHLCVCandle;
  /**
   * Live terminal chart access. Present only when the bot runs inside an active
   * terminal session. Nodes should treat its absence as the backtest path.
   */
  chart?: ChartExecutionAccess;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  nodeId: string;
  nodeLabel: string;
  message: string;
  level: "info" | "warn" | "error";
}
