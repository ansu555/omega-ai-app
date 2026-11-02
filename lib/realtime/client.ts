/**
 * Frontend client for the Omeswap realtime-service (see /realtime-service).
 *
 * A single shared WebSocket connection to the service receives live `price`,
 * `pool`, and `trade` deltas (block-time on HashKey Chain). Consumers subscribe via
 * `onMessage`; React hooks layer on top (see hooks/use-realtime-feed.tsx).
 *
 * This mirrors the service wire protocol in realtime-service/src/messages.ts —
 * keep the two in sync. Auto-reconnects with backoff; if the socket is down,
 * callers fall back to the existing on-chain pollers.
 */

export type WirePool = {
  address: string;
  pair: string;
  token0: string;
  token1: string;
  symbol0: string;
  symbol1: string;
  decimals0: number;
  decimals1: number;
  fee: number;
  feeBps: number;
  price0in1: number;
  reserve0: string;
  reserve1: string;
  updatedAt: number;
};

export type WireTrade = {
  id: string;
  poolAddress: string;
  pair: string;
  side: "buy" | "sell";
  priceUsd: number;
  amountIn: number;
  amountOut: number;
  amountUsd: number;
  trader: string;
  txHash: string;
  timestamp: number;
};

export type ServerMessage =
  | { type: "snapshot"; pools: WirePool[]; prices: Record<string, number> }
  | { type: "price"; prices: Record<string, number> }
  | { type: "pool"; pool: WirePool }
  | { type: "trade"; trade: WireTrade };

export type ConnectionStatus = "idle" | "connecting" | "live" | "error";

type MessageHandler = (msg: ServerMessage) => void;
type StatusHandler = (status: ConnectionStatus) => void;

const WS_URL =
  process.env.NEXT_PUBLIC_REALTIME_WS_URL?.trim() || "ws://localhost:8080";

class RealtimeClient {
  private ws: WebSocket | null = null;
  private messageHandlers = new Set<MessageHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private status: ConnectionStatus = "idle";

  /** Latest values cached so late subscribers get state immediately. */
  prices: Record<string, number> = {};
  pools = new Map<string, WirePool>(); // keyed by pair "T0/T1" (deepest wins on snapshot order)

  private ensureConnected(): void {
    if (typeof window === "undefined") return; // never connect during SSR
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.setStatus("connecting");
    try {
      this.ws = new WebSocket(WS_URL);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus("live");
    };
    this.ws.onclose = () => {
      this.setStatus("error");
      this.scheduleReconnect();
    };
    this.ws.onerror = () => {
      this.setStatus("error");
    };
    this.ws.onmessage = (evt) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(evt.data as string) as ServerMessage;
      } catch {
        return;
      }
      this.cache(msg);
      for (const h of this.messageHandlers) h(msg);
    };
  }

  private cache(msg: ServerMessage): void {
    if (msg.type === "snapshot") {
      this.prices = msg.prices;
      for (const p of msg.pools) this.pools.set(p.pair, p);
    } else if (msg.type === "price") {
      this.prices = { ...this.prices, ...msg.prices };
    } else if (msg.type === "pool") {
      this.pools.set(msg.pool.pair, msg.pool);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 15000);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureConnected();
    }, delay);
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const h of this.statusHandlers) h(status);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  onMessage(handler: MessageHandler): () => void {
    this.ensureConnected();
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this.status);
    return () => this.statusHandlers.delete(handler);
  }
}

/** Process-wide singleton — one socket shared across all hooks/components. */
export const realtimeClient = new RealtimeClient();
