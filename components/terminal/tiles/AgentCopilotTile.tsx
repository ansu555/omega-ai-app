"use client";

import { useState } from "react";
import { Bot, Send } from "lucide-react";
import { useChartStore } from "@/store/chart";
import { useTerminalStore } from "@/store/terminal";
import { getIndicator, listIndicators } from "@/lib/indicators/registry";

type Message = { role: "user" | "agent"; text: string };

const HELP_TEXT =
  "Try: `rsi 14`, `ema 20`, `macd`, `price`, `change 24h`, `indicators`. Co-pilot reads live chart data.";

export function AgentCopilotTile() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "agent", text: HELP_TEXT },
  ]);

  const submit = () => {
    const q = input.trim();
    if (!q) return;
    setMessages((m) => [...m, { role: "user", text: q }, { role: "agent", text: respond(q) }]);
    setInput("");
  };

  return (
    <div className="flex h-full w-full flex-col text-xs">
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
        <Bot size={12} className="text-primary" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Agent Co-pilot
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-auto max-w-[70%] rounded-md bg-primary/20 px-2 py-1 text-foreground"
                : "max-w-[70%] rounded-md bg-muted/40 px-2 py-1 text-muted-foreground"
            }
          >
            {m.text}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 border-t border-border/40 px-3 py-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="Ask the chart…"
          className="flex-1 rounded-md border border-border/40 bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={submit}
          onMouseDown={(e) => e.stopPropagation()}
          className="rounded-md border border-border/40 bg-card/60 p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}

function respond(q: string): string {
  const lower = q.toLowerCase().trim();
  const candles = useChartStore.getState().candles;
  const activeSymbol = useTerminalStore.getState().activeSymbol;
  const last = candles.length > 0 ? candles[candles.length - 1] : null;

  if (!last) return "No candles loaded yet.";

  if (lower === "indicators" || lower === "list") {
    const all = listIndicators({ source: "builtin" });
    return `${all.length} built-in indicators: ${all.slice(0, 8).map((d) => d.name).join(", ")}…`;
  }

  if (lower === "price" || lower === "p") {
    return `${activeSymbol.symbol} = $${last.close.toFixed(4)}`;
  }

  if (lower.startsWith("change")) {
    const first24h = candles.length > 24 ? candles[candles.length - 24] : candles[0];
    const change = first24h.close ? ((last.close - first24h.close) / first24h.close) * 100 : 0;
    return `${activeSymbol.symbol} 24h: ${change.toFixed(2)}%`;
  }

  // Indicator query: "<name> [period]"
  const tokens = lower.split(/\s+/);
  const idMap: Record<string, string> = {
    rsi: "builtin:rsi",
    ema: "builtin:ema",
    sma: "builtin:sma",
    wma: "builtin:wma",
    macd: "builtin:macd",
    bb: "builtin:bbands",
    bbands: "builtin:bbands",
    atr: "builtin:atr",
    vwap: "builtin:vwap",
    obv: "builtin:obv",
    stoch: "builtin:stoch",
    cci: "builtin:cci",
    adx: "builtin:adx",
  };
  const defId = idMap[tokens[0]];
  if (defId) {
    const def = getIndicator(defId);
    if (!def) return "Indicator not registered.";
    const params: Record<string, number | string> = {};
    for (const p of def.params) params[p.key] = p.default as number | string;
    if (tokens[1] && def.params[0]) {
      const v = parseFloat(tokens[1]);
      if (Number.isFinite(v)) params[def.params[0].key] = v;
    }
    const result = def.compute(candles, params);
    const summary = def.outputs
      .map((o) => {
        const series = result[o.id];
        const v = series && series.length > 0 ? series[series.length - 1] : null;
        return `${o.label}: ${v == null ? "—" : v.toFixed(4)}`;
      })
      .join(", ");
    const paramSummary = def.params.map((p) => `${p.key}=${params[p.key]}`).join(",");
    return `${def.name} (${paramSummary}) → ${summary}`;
  }

  return `Unknown command. ${HELP_TEXT}`;
}
