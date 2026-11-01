"use client";

import { registerIndicator } from "../registry";
import { SMA, EMA, WMA, RMA } from "./movingAverages";
import { RSI, MACD, STOCH, CCI, ROC, WILLIAMS_R } from "./momentum";
import { BBANDS, ATR, KELTNER, DONCHIAN } from "./volatility";
import { VWAP, OBV, CMF, MFI, VWMA } from "./volume";
import { ADX, AROON, PSAR, SUPERTREND, ICHIMOKU } from "./trend";

let registered = false;

export function registerBuiltinIndicators() {
  if (registered) return;
  registered = true;
  for (const def of [
    SMA, EMA, WMA, RMA,
    RSI, MACD, STOCH, CCI, ROC, WILLIAMS_R,
    BBANDS, ATR, KELTNER, DONCHIAN,
    VWAP, OBV, CMF, MFI, VWMA,
    ADX, AROON, PSAR, SUPERTREND, ICHIMOKU,
  ]) {
    registerIndicator(def);
  }
}
