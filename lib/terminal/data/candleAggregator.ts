import type { UTCTimestamp } from "lightweight-charts";

export type AggrCandle = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const INTERVAL_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

export class CandleAggregator {
  private stepSec: number;
  private current: AggrCandle | null = null;

  constructor(interval: string) {
    this.stepSec = INTERVAL_SECONDS[interval] ?? 60;
  }

  tick(price: number): AggrCandle {
    const bucketTime = (Math.floor(Date.now() / 1000 / this.stepSec) * this.stepSec) as UTCTimestamp;

    if (!this.current || bucketTime > this.current.time) {
      // New bucket — open from previous close if we have one
      this.current = {
        time: bucketTime,
        open: this.current?.close ?? price,
        high: price,
        low: price,
        close: price,
        volume: 0,
      };
    } else {
      this.current = {
        ...this.current,
        high: Math.max(this.current.high, price),
        low: Math.min(this.current.low, price),
        close: price,
      };
    }

    return this.current;
  }

  reset(interval: string) {
    this.stepSec = INTERVAL_SECONDS[interval] ?? 60;
    this.current = null;
  }

  getCurrent(): AggrCandle | null {
    return this.current;
  }
}
