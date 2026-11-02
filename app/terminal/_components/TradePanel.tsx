"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Infinity as InfinityIcon, Bot, Loader2, CheckCircle, XCircle, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { formatUnits, parseUnits, type Address, type Hex } from "viem";
import type { DexMarket } from "@/lib/dex/types";
import { UniswapSwapCard } from "@/components/trade/UniswapSwapCard";
import type { SwapToken } from "@/hooks/use-uniswap-swap";
import { getChainConfig, getDefaultChainId, getSupportedChains } from "@/lib/chain-registry";
import {
  HSKSWAP_CHAIN_ID,
  HSKSWAP_ERC20_ABI,
  HSKSWAP_ROUTER_ABI,
  HSKSWAP_ROUTER_EXACT_INPUT_ABI,
  ZERO_ADDRESS,
  isPlaceholderAddress,
  quoteHSKSwapBestTier,
  quoteHSKSwapMultiHop,
} from "@/lib/dex/hskswap";
import { isHashKeyNetwork } from "@/lib/dex/markets";

function getTokenDecimals(address: string): number {
  const config = getChainConfig(getDefaultChainId());
  const match = Object.values(config.tokens).find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );
  return match?.decimals ?? 18;
}

// ── Agent Activity Strip ──────────────────────────────────────────────────────

interface ReceiptSummary {
  id: string;
  run_id: string;
  ticker: string;
  created_at: string;
  consensus: { decision: string; confidence: number };
  risk_sizing: { size_usd: number };
  tx_hash: string | null;
}

function AgentActivityStrip({ address }: { address?: string }) {
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetch("/api/research/receipts?limit=5", {
      headers: { "x-wallet-address": address },
    })
      .then((r) => r.json())
      .then((d: { receipts: ReceiptSummary[] }) => setReceipts(d.receipts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  if (!address) return null;

  const decisionClass = (d: string) =>
    d === "BUY" ? "text-bull" : d === "SELL" ? "text-bear" : "text-muted-foreground";

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-panel/50 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Bot size={10} className="text-primary" />
          <span className="text-[10px] font-medium text-muted-foreground">Agent Activity</span>
          {receipts.length > 0 && (
            <span className="text-[9px] font-mono px-1 py-0.5 rounded-full bg-primary/15 text-primary">
              {receipts.length}
            </span>
          )}
        </div>
        <ChevronDown
          size={10}
          className={`text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div className="px-3 pb-2 space-y-1">
          {loading && (
            <div className="flex items-center gap-1.5 py-1">
              <Loader2 size={10} className="text-primary animate-spin" />
              <span className="text-[10px] text-muted-foreground">Loading trades…</span>
            </div>
          )}
          {!loading && receipts.length === 0 && (
            <p className="text-[10px] text-muted-foreground py-1">
              No agent trades yet.{" "}
              <Link href="/research" className="text-primary hover:underline">
                Run research →
              </Link>
            </p>
          )}
          {receipts.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-2 py-1.5 border-b border-border/40 last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[10px] font-bold shrink-0 ${decisionClass(r.consensus.decision)}`}>
                  {r.consensus.decision}
                </span>
                <span className="text-[10px] font-mono text-foreground shrink-0">{r.ticker}</span>
                <span className="text-[9px] text-muted-foreground tabular truncate">
                  ${r.risk_sizing.size_usd.toFixed(0)}
                </span>
              </div>
              <div className="shrink-0">
                {r.tx_hash ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-bull/10 text-bull border border-bull/20">
                    Executed
                  </span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    Research
                  </span>
                )}
              </div>
            </div>
          ))}
          <Link href="/research" className="block text-center text-[9px] text-primary hover:underline pt-0.5">
            Open Research →
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Agent Approval Banner (deep-link from /research assisted mode) ─────────────

type ApprovalExecState = "idle" | "executing" | "done" | "error";

function AgentApprovalBanner({
  runId,
  decision,
  sizeUsd,
  ticker,
  query,
  address,
  onDismiss,
}: {
  runId: string;
  decision: "BUY" | "SELL";
  sizeUsd: number;
  ticker: string;
  query: string;
  address: string;
  onDismiss: () => void;
}) {
  const [execState, setExecState] = useState<ApprovalExecState>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isBuy = decision === "BUY";

  const handleApprove = useCallback(async () => {
    setExecState("executing");
    setError(null);
    try {
      const res = await fetch("/api/research/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": address,
        },
        body: JSON.stringify({
          query,
          ticker,
          mode: "assisted",
          executionApproved: true,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") { streamDone = true; break; }
          try {
            const evt = JSON.parse(raw) as { type: string; payload?: Record<string, unknown>; message?: string };
            if (evt.type === "execution.done" && typeof evt.payload?.tx_hash === "string") {
              setTxHash(evt.payload.tx_hash as string);
            }
            if (evt.type === "run.done") { setExecState("done"); streamDone = true; break; }
            if (evt.type === "run.error") throw new Error(evt.message ?? "Run error");
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
      setExecState("done");
    } catch (e) {
      setError((e as Error).message ?? "Execution failed");
      setExecState("error");
    }
  }, [address, query, ticker]);

  return (
    <div
      className="border-b"
      style={{
        background: isBuy
          ? "linear-gradient(135deg, rgba(16,185,129,0.07), rgba(16,185,129,0.03))"
          : "linear-gradient(135deg, rgba(239,68,68,0.07), rgba(239,68,68,0.03))",
        borderColor: isBuy ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
      }}
    >
      <div
        className="flex items-center gap-1.5 px-3 py-1.5"
        style={{
          background: isBuy ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
          borderBottom: isBuy ? "1px solid rgba(16,185,129,0.12)" : "1px solid rgba(239,68,68,0.12)",
        }}
      >
        <Zap size={9} className={isBuy ? "text-emerald-400" : "text-red-400"} />
        <span
          className={`text-[9px] font-semibold uppercase tracking-widest ${isBuy ? "text-emerald-400" : "text-red-400"}`}
        >
          Assisted Mode · Approval Required
        </span>
        <span className="ml-auto text-[9px] font-mono text-muted-foreground">{runId.slice(0, 8)}</span>
      </div>

      <div className="px-3 py-2.5 space-y-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-foreground/80">
            ATS recommends:{" "}
            <span className={`font-bold ${isBuy ? "text-bull" : "text-bear"}`}>
              {decision} {ticker}
            </span>
          </span>
          <span className="text-xs font-mono text-muted-foreground">${sizeUsd.toFixed(2)}</span>
        </div>

        {execState === "done" && (
          <div className="flex items-center gap-1.5 text-bull text-[10px]">
            <CheckCircle size={10} />
            <span>Executed{txHash ? ` · ${txHash.slice(0, 10)}…` : ""}</span>
          </div>
        )}
        {execState === "error" && (
          <p className="text-[10px] text-bear flex items-center gap-1.5">
            <XCircle size={10} />
            {error}
          </p>
        )}

        {execState !== "done" && (
          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={execState === "executing"}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all disabled:opacity-40
                ${isBuy
                  ? "bg-bull/15 border border-bull/30 text-bull hover:bg-bull/25"
                  : "bg-bear/15 border border-bear/30 text-bear hover:bg-bear/25"
                }`}
            >
              {execState === "executing" ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <CheckCircle size={10} />
              )}
              {execState === "executing" ? "Executing…" : "Approve & Execute"}
            </button>
            <button
              onClick={onDismiss}
              disabled={execState === "executing"}
              className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-[10px] text-muted-foreground border border-border hover:border-border/70 hover:text-foreground transition-all disabled:opacity-40"
            >
              <XCircle size={10} />
              Dismiss
            </button>
          </div>
        )}
        {execState === "done" && (
          <button
            onClick={onDismiss}
            className="w-full text-[9px] text-muted-foreground hover:text-foreground transition-colors text-center"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Side = "buy" | "sell";
type OrderType = "Swap" | "Limit Intent";

type MarketResponse = {
  market: DexMarket;
};

const FALLBACK_PRICE = 0.0876;

type SpotToken = { address: Address; symbol: string; decimals: number };

/**
 * Reads the connected wallet's balances for an HSKSwap spot pair (base asset +
 * quote stable) on HashKey Chain. Both tokens are resolved from the chain registry.
 */
function useHashKeySpotBalances(
  baseToken: SpotToken | null,
  quoteToken: SpotToken | null,
  address: `0x${string}` | undefined,
  enabled: boolean,
  chainId: number,
) {
  const { data: baseRaw, refetch: refetchBase } = useReadContract({
    address: baseToken?.address,
    abi: HSKSWAP_ERC20_ABI,
    functionName: "balanceOf",
    args: [address ?? ZERO_ADDRESS],
    chainId,
    query: { enabled: !!address && !!baseToken && enabled, refetchInterval: 30000 },
  });

  const { data: quoteRaw, refetch: refetchQuote } = useReadContract({
    address: quoteToken?.address,
    abi: HSKSWAP_ERC20_ABI,
    functionName: "balanceOf",
    args: [address ?? ZERO_ADDRESS],
    chainId,
    query: { enabled: !!address && !!quoteToken && enabled, refetchInterval: 30000 },
  });

  const base = baseRaw !== undefined && baseToken ? parseFloat(formatUnits(baseRaw as bigint, baseToken.decimals)) : null;
  const quote = quoteRaw !== undefined && quoteToken ? parseFloat(formatUnits(quoteRaw as bigint, quoteToken.decimals)) : null;

  const refetch = useCallback(() => {
    refetchBase();
    refetchQuote();
  }, [refetchBase, refetchQuote]);

  return { base, quote, refetch };
}

export function TradePanel({ marketId }: { marketId: string }) {
  const { address } = useAccount();
  const connectedChainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Deep-link approval params (set when navigating from /research assisted-mode approval)
  const fromResearch = searchParams.get("from") === "research";
  const approvalRunId = searchParams.get("runId") ?? "";
  const approvalDecision = searchParams.get("decision") as "BUY" | "SELL" | null;
  const approvalSizeUsd = parseFloat(searchParams.get("sizeUsd") ?? "0");
  const approvalTicker = searchParams.get("ticker") ?? "";
  const approvalQuery = searchParams.get("query") ?? "";
  const hasApprovalBanner = fromResearch && !!approvalRunId && !!approvalDecision && !!address;

  const dismissApproval = useCallback(() => {
    router.replace("/terminal");
  }, [router]);

  const [side, setSide] = useState<Side>("buy");
  const [orderType, setOrderType] = useState<OrderType>("Swap");
  const [amount, setAmount] = useState("250");
  const [limitPrice, setLimitPrice] = useState("");
  const [percent, setPercent] = useState(0);
  const [slippageBps, setSlippageBps] = useState(50);
  const [autoClose, setAutoClose] = useState(false);
  const [market, setMarket] = useState<DexMarket | null>(null);
  const [pendingSwapAfterApprove, setPendingSwapAfterApprove] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    const aborter = new AbortController();

    async function loadMarket() {
      try {
        const response = await fetch(`/api/dex/markets?id=${encodeURIComponent(marketId)}`, {
          signal: aborter.signal,
        });

        if (!response.ok) throw new Error("Market request failed");

        const snapshot = (await response.json()) as MarketResponse;
        if (!disposed) setMarket(snapshot.market);
      } catch {
        if (!disposed && !aborter.signal.aborted) setMarket(null);
      }
    }

    loadMarket();
    const timer = window.setInterval(loadMarket, 30000);

    return () => {
      disposed = true;
      aborter.abort();
      window.clearInterval(timer);
    };
  }, [marketId]);

  const markPrice = market?.priceUsd ?? FALLBACK_PRICE;
  const baseSymbol = market?.symbol ?? "WHSK";
  const route = market?.executionVenue ?? "Swap adapter";
  const liquidity = market?.liquidityUsd ?? 0;
  const isPerp = market?.kind === "perp";
  const isEthSpot = market?.network === "eth" && market?.kind === "spot";
  const isHashKeySpot = isHashKeyNetwork(market?.network) && market?.kind === "spot";

  // Resolve the spot pair (base asset + quote stable) from the chain registry
  // of the market's own chain (HashKey mainnet 177 or testnet 133).
  // `base` is the market's asset, `quote` is the funding stable.
  const spotChainId =
    market?.chainId && getSupportedChains().some((c) => c.chain.id === market.chainId)
      ? market.chainId
      : HSKSWAP_CHAIN_ID;
  const activeChain = getChainConfig(spotChainId);

  // All Uniswap-V3-shaped "custom" routers (HSKSwap) with
  // a configured quoter — every trade quotes across all of them (plus a
  // two-hop route through a hub token on each) and routes through whichever
  // gives the best output, regardless of which DEX the market is tagged with.
  const v3CustomRouters = useMemo(
    () =>
      activeChain.dexRouters.filter(
        (r) =>
          r.type === "custom" &&
          !isPlaceholderAddress(r.routerAddress as Address) &&
          !isPlaceholderAddress(r.quoterAddress as Address),
      ),
    [activeChain],
  );

  const baseTok: SpotToken | null =
    market && activeChain.tokens[market.symbol]
      ? {
          address: activeChain.tokens[market.symbol].address,
          symbol: activeChain.tokens[market.symbol].symbol,
          decimals: activeChain.tokens[market.symbol].decimals,
        }
      : null;
  const quoteTok: SpotToken | null =
    market && activeChain.tokens[market.quoteToken.symbol]
      ? {
          address: activeChain.tokens[market.quoteToken.symbol].address,
          symbol: activeChain.tokens[market.quoteToken.symbol].symbol,
          decimals: activeChain.tokens[market.quoteToken.symbol].decimals,
        }
      : activeChain.tokens.USDC
      ? {
          address: activeChain.tokens.USDC.address,
          symbol: activeChain.tokens.USDC.symbol,
          decimals: activeChain.tokens.USDC.decimals,
        }
      : null;

  const publicClient = usePublicClient({ chainId: spotChainId });

  const { base: baseBalance, quote: quoteBalance, refetch: refetchBalances } =
    useHashKeySpotBalances(baseTok, quoteTok, address, isHashKeySpot, spotChainId);

  const availableToTradeValue = isHashKeySpot
    ? side === "buy"
      ? quoteBalance
      : baseBalance
    : null;

  const totalBalanceUsd =
    isHashKeySpot && baseBalance !== null && quoteBalance !== null
      ? quoteBalance + baseBalance * markPrice
      : null;

  // buy = spend the quote stable to receive the base asset; sell = the reverse.
  const fxTokenIn = side === "buy" ? quoteTok : baseTok;
  const fxTokenOut = side === "buy" ? baseTok : quoteTok;

  const fxAmountIn = useMemo(() => {
    if (!isHashKeySpot || !fxTokenIn || !amount || Number(amount) <= 0) return null;
    try {
      return parseUnits(amount, fxTokenIn.decimals);
    } catch {
      return null;
    }
  }, [amount, isHashKeySpot, fxTokenIn]);

  // Best route found across all configured DEXes for this pair — either a
  // direct pool or a two-hop route through a hub token.
  const [fxRoute, setFxRoute] = useState<{
    routerAddress: Address;
    dexName: string;
    amountOut: bigint;
    path: Address[];
    v3Fee?: number;
    v3Path?: Hex;
  } | null>(null);

  const { data: fxAllowance, refetch: refetchFxAllowance } = useReadContract({
    address: fxTokenIn?.address,
    abi: HSKSWAP_ERC20_ABI,
    functionName: "allowance",
    args: [address ?? ZERO_ADDRESS, (fxRoute?.routerAddress ?? ZERO_ADDRESS) as Address],
    chainId: spotChainId,
    query: { enabled: !!address && isHashKeySpot && !!fxTokenIn && !!fxRoute, refetchInterval: 30000 },
  });

  // Live multi-DEX, multi-hop quote — drives the route, fee/path, and
  // amountOutMinimum. Probes the direct pool and a two-hop route through each
  // hub token (USDT/WHSK) on every configured DEX (HSKSwap), then picks the
  // best. Debounced 300ms to avoid
  // firing a burst of RPC calls on every keystroke.
  useEffect(() => {
    if (!isHashKeySpot || !publicClient || !fxTokenIn || !fxTokenOut || !fxAmountIn || fxAmountIn <= 0n || v3CustomRouters.length === 0) {
      setFxRoute(null);
      return;
    }
    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      let best: typeof fxRoute = null;
      for (const r of v3CustomRouters) {
        const routerAddress = r.routerAddress as Address;
        const quoter = r.quoterAddress as Address;
        try {
          const [direct, multiHop] = await Promise.all([
            quoteHSKSwapBestTier(publicClient, {
              tokenIn: fxTokenIn.address,
              tokenOut: fxTokenOut.address,
              amountIn: fxAmountIn,
              quoter,
            }),
            quoteHSKSwapMultiHop(publicClient, {
              tokenIn: fxTokenIn.address,
              tokenOut: fxTokenOut.address,
              amountIn: fxAmountIn,
              hubTokens: activeChain.hubTokens,
              quoter,
            }),
          ]);

          if (direct && direct.amountOut > 0n && (!best || direct.amountOut > best.amountOut)) {
            best = {
              routerAddress,
              dexName: r.name,
              amountOut: direct.amountOut,
              path: [fxTokenIn.address, fxTokenOut.address],
              v3Fee: direct.fee,
            };
          }
          if (multiHop && multiHop.amountOut > 0n && (!best || multiHop.amountOut > best.amountOut)) {
            best = {
              routerAddress,
              dexName: r.name,
              amountOut: multiHop.amountOut,
              path: multiHop.path,
              v3Path: multiHop.encodedPath,
            };
          }
        } catch {
          /* no pool for this pair on this router */
        }
      }

      if (!cancelled) setFxRoute(best);
    }, 300);
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [isHashKeySpot, publicClient, fxTokenIn, fxTokenOut, fxAmountIn, v3CustomRouters, activeChain.hubTokens]);

  const {
    writeContract: writeFxApproval,
    data: fxApprovalHash,
    error: fxApprovalError,
    isPending: isFxApprovalPending,
  } = useWriteContract();

  const {
    writeContract: writeFxSwap,
    data: fxSwapHash,
    error: fxSwapError,
    isPending: isFxSwapPending,
  } = useWriteContract();

  const { isLoading: isFxApprovalConfirming, isSuccess: isFxApprovalSuccess } =
    useWaitForTransactionReceipt({ hash: fxApprovalHash });

  const { isLoading: isFxSwapConfirming, isSuccess: isFxSwapSuccess } =
    useWaitForTransactionReceipt({ hash: fxSwapHash });

  // Human-readable route label for the live multi-DEX/multi-hop quote, e.g.
  // "HSKSwap" (direct) or "HSKSwap · WETH -> USDT -> WHSK" (2-hop).
  const fxRouteLabel = useMemo(() => {
    if (!isHashKeySpot || !fxRoute) return null;
    if (fxRoute.path.length <= 2) return fxRoute.dexName;
    const symbols = fxRoute.path.map((addr) => {
      const match = Object.values(activeChain.tokens).find(
        (t) => t.address.toLowerCase() === addr.toLowerCase(),
      );
      return match?.symbol ?? `${addr.slice(0, 6)}…`;
    });
    return `${fxRoute.dexName} · ${symbols.join(" -> ")}`;
  }, [isHashKeySpot, fxRoute, activeChain.tokens]);

  const swapTokenBase = useMemo<SwapToken | null>(() => {
    if (!market || !isEthSpot) return null;
    return {
      address: market.baseToken.address as `0x${string}`,
      symbol: market.baseToken.symbol,
      name: market.baseToken.name,
      decimals: getTokenDecimals(market.baseToken.address),
    };
  }, [market, isEthSpot]);

  const swapTokenQuote = useMemo<SwapToken | null>(() => {
    if (!market || !isEthSpot) return null;
    return {
      address: market.quoteToken.address as `0x${string}`,
      symbol: market.quoteToken.symbol,
      name: market.quoteToken.name,
      decimals: getTokenDecimals(market.quoteToken.address),
    };
  }, [market, isEthSpot]);

  const fundingSymbol = isPerp
    ? market?.quoteToken.symbol ?? "USD"
    : market?.quoteToken.symbol ?? "USDC";

  const preview = useMemo(() => {
    const amountValue = Math.max(0, Number(amount) || 0);
    const entry = orderType === "Limit Intent" && Number(limitPrice) > 0 ? Number(limitPrice) : markPrice;
    const notionalUsd = side === "buy" || isPerp ? amountValue : amountValue * entry;
    const expectedReceive = side === "buy" && entry > 0 ? amountValue / entry : notionalUsd;

    // For HashKey spot, derive the real receive amount and price impact from the
    // live on-chain quote (vs. mark price) instead of the liquidity heuristic.
    if (isHashKeySpot && fxRoute && fxTokenOut && expectedReceive > 0) {
      const receive = Number(formatUnits(fxRoute.amountOut, fxTokenOut.decimals));
      const priceImpact = Math.min(100, Math.max(0, ((expectedReceive - receive) / expectedReceive) * 100));
      return { entry, amountValue, notionalUsd, receive, priceImpact };
    }

    const priceImpact = liquidity > 0 ? Math.min(8, (notionalUsd / liquidity) * 100) : 0;
    const impactMultiplier = Math.max(0, 1 - priceImpact / 100);
    const receive = expectedReceive * impactMultiplier;

    return {
      entry,
      amountValue,
      notionalUsd,
      receive,
      priceImpact,
    };
  }, [amount, isHashKeySpot, fxRoute, fxTokenOut, isPerp, limitPrice, liquidity, markPrice, orderType, side]);

  const fxAmountOutMin = useMemo(() => {
    if (!fxRoute || !fxTokenOut) return 0n;
    return (fxRoute.amountOut * BigInt(Math.max(0, 10_000 - slippageBps))) / 10_000n;
  }, [fxRoute, fxTokenOut, slippageBps]);

  const isWrongChain = isHashKeySpot && !!address && connectedChainId !== spotChainId;
  const needsFxApproval =
    isHashKeySpot &&
    !!fxAmountIn &&
    (fxAllowance === undefined || fxAmountIn > (fxAllowance as bigint));

  const executeFxSwap = useCallback(() => {
    if (!address || !fxTokenIn || !fxTokenOut || !fxAmountIn || fxAmountOutMin <= 0n || !fxRoute) return;

    setSwapError(null);
    if (fxRoute.v3Path) {
      writeFxSwap({
        address: fxRoute.routerAddress,
        abi: HSKSWAP_ROUTER_EXACT_INPUT_ABI,
        functionName: "exactInput",
        args: [
          {
            path: fxRoute.v3Path,
            recipient: address,
            amountIn: fxAmountIn,
            amountOutMinimum: fxAmountOutMin,
          },
        ],
        chainId: spotChainId,
      });
    } else {
      writeFxSwap({
        address: fxRoute.routerAddress,
        abi: HSKSWAP_ROUTER_ABI,
        functionName: "exactInputSingle",
        args: [
          {
            tokenIn: fxTokenIn.address,
            tokenOut: fxTokenOut.address,
            fee: fxRoute.v3Fee ?? 3000,
            recipient: address,
            amountIn: fxAmountIn,
            amountOutMinimum: fxAmountOutMin,
            sqrtPriceLimitX96: 0n,
          },
        ],
        chainId: spotChainId,
      });
    }
  }, [
    address,
    fxTokenIn,
    fxTokenOut,
    fxAmountIn,
    fxAmountOutMin,
    fxRoute,
    spotChainId,
    writeFxSwap,
  ]);

  const handleFxSwap = () => {
    if (!address) return;

    if (isWrongChain) {
      switchChain({ chainId: spotChainId });
      return;
    }

    if (!fxAmountIn || fxAmountIn <= 0n) {
      setSwapError("Enter an amount greater than 0.");
      return;
    }

    if (fxAmountOutMin <= 0n || !fxRoute) {
      setSwapError("No pool/liquidity for this pair yet.");
      return;
    }

    if (needsFxApproval && fxTokenIn) {
      setSwapError(null);
      setPendingSwapAfterApprove(true);
      writeFxApproval({
        address: fxTokenIn.address,
        abi: HSKSWAP_ERC20_ABI,
        functionName: "approve",
        args: [fxRoute.routerAddress, fxAmountIn],
        chainId: spotChainId,
      });
      return;
    }

    executeFxSwap();
  };

  useEffect(() => {
    if (!pendingSwapAfterApprove || !isFxApprovalSuccess) return;
    setPendingSwapAfterApprove(false);
    refetchFxAllowance().finally(() => executeFxSwap());
  }, [executeFxSwap, isFxApprovalSuccess, pendingSwapAfterApprove, refetchFxAllowance]);

  useEffect(() => {
    const error = fxApprovalError ?? fxSwapError;
    if (error) {
      setPendingSwapAfterApprove(false);
      setSwapError(error.message || "Swap failed");
    }
  }, [fxApprovalError, fxSwapError]);

  useEffect(() => {
    if (!isFxSwapSuccess) return;
    setSwapError(null);
    refetchBalances();
    refetchFxAllowance();
  }, [isFxSwapSuccess, refetchFxAllowance, refetchBalances]);

  const isFxSwapLoading =
    isFxApprovalPending ||
    isFxApprovalConfirming ||
    isFxSwapPending ||
    isFxSwapConfirming ||
    pendingSwapAfterApprove;

  const fxButtonLabel = isWrongChain
    ? "Switch to HashKey Chain"
    : isFxSwapLoading
      ? pendingSwapAfterApprove || isFxApprovalPending || isFxApprovalConfirming
        ? `Approving ${fxTokenIn?.symbol ?? ""}...`
        : "Swapping..."
      : needsFxApproval
        ? `Approve ${fxTokenIn?.symbol ?? ""}`
        : `${side === "buy" ? "Buy" : "Sell"} ${baseSymbol}`;

  return (
    <aside className="w-[340px] shrink-0 bg-background flex flex-col">
      {/* Deep-link approval banner — shown when arriving from /research assisted mode */}
      {hasApprovalBanner && (
        <AgentApprovalBanner
          runId={approvalRunId}
          decision={approvalDecision!}
          sizeUsd={approvalSizeUsd}
          ticker={approvalTicker}
          query={approvalQuery}
          address={address!}
          onDismiss={dismissApproval}
        />
      )}

      {/* Agent activity strip — collapsible history of last 5 agent-initiated trades */}
      <AgentActivityStrip address={address} />

      <div className="grid grid-cols-2 border-b border-border">
        <button
          onClick={() => setSide("buy")}
          className={`py-3 text-sm font-semibold ${
            side === "buy"
              ? "text-bull border-b-2 border-bull bg-bull/5"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {isPerp ? "Long" : "Buy"}
        </button>
        <button
          onClick={() => setSide("sell")}
          className={`py-3 text-sm font-semibold ${
            side === "sell"
              ? "text-bear border-b-2 border-bear bg-bear/5"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {isPerp ? "Short" : "Sell"}
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        <Row
          label="Available to Trade"
          value={
            availableToTradeValue !== null
              ? side === "buy"
                ? formatUsd(availableToTradeValue)
                : `${formatTokenAmount(availableToTradeValue)} ${baseSymbol}`
              : address ? "..." : "$0.00"
          }
        />
        <Row label={`${baseSymbol} Mark`} value={formatUsd(markPrice)} valueClass={(market?.change24h ?? 0) >= 0 ? "text-bull" : "text-bear"} />

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Order Type</span>
            <button
              onClick={() =>
                setOrderType((current) => (current === "Swap" ? "Limit Intent" : "Swap"))
              }
              className="text-xs text-foreground flex items-center gap-1"
            >
              {isPerp && orderType === "Swap" ? "Market" : orderType} <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <div className="flex items-center bg-panel rounded-lg border border-border h-10 px-3">
            <span className="text-muted-foreground">{side === "buy" ? "$" : ""}</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              className="flex-1 min-w-0 bg-transparent outline-none px-2 tabular text-foreground"
            />
            <button className="flex items-center gap-1 text-muted-foreground text-xs">
              <InfinityIcon className="h-4 w-4" />
              {isPerp || side === "buy" ? fundingSymbol : baseSymbol}
            </button>
          </div>
        </div>

        {orderType === "Limit Intent" ? (
          <div>
            <div className="text-xs text-muted-foreground mb-2">Limit Price</div>
            <div className="flex items-center bg-panel rounded-lg border border-border h-10 px-3">
              <span className="text-muted-foreground">$</span>
              <input
                value={limitPrice}
                onChange={(event) => setLimitPrice(event.target.value)}
                placeholder={markPrice.toFixed(fractionDigitsForPrice(markPrice))}
                inputMode="decimal"
                className="flex-1 min-w-0 bg-transparent outline-none px-2 tabular text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
        ) : null}

        <SliderField value={percent} min={0} max={100} suffix="%" onChange={setPercent} />

        <div>
          <div className="text-xs text-muted-foreground mb-2">Max Slippage</div>
          <SliderField value={slippageBps} min={5} max={300} suffix="bps" onChange={setSlippageBps} />
        </div>

        <Row label="Route" value={fxRouteLabel ?? route} />
        <Row label="Entry Price" value={formatUsd(preview.entry)} />
        <Row
          label={isPerp ? "Position Notional" : "Est. Receive"}
          value={
            isPerp
              ? formatUsd(preview.notionalUsd)
              : side === "buy"
              ? `${formatTokenAmount(preview.receive)} ${baseSymbol}`
              : formatUsd(preview.receive)
          }
        />
        <Row label={isPerp ? "Liquidity Impact Est." : "Price Impact Est."} value={`${preview.priceImpact.toFixed(2)}%`} muted />
        <Row label="Order Value" value={formatUsd(preview.notionalUsd)} />
        <Row label={isPerp ? "Market Liquidity" : "Pool Liquidity"} value={market?.liquidityUsd ? formatCompactUsd(market.liquidityUsd) : "..."} muted />
        <Row label={isPerp ? "24h Perp Volume" : "24h Spot Volume"} value={market?.volume24hUsd ? formatCompactUsd(market.volume24hUsd) : "..."} muted />

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Write Receipt</span>
          <button
            onClick={() => setAutoClose((current) => !current)}
            className={`relative h-5 w-9 rounded-full transition-colors ${autoClose ? "bg-primary" : "bg-secondary"}`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-foreground/90 transition-all ${
                autoClose ? "left-[18px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {isEthSpot && swapTokenBase && swapTokenQuote ? (
        <div className="p-3 border-t border-border">
          <UniswapSwapCard
            tokenIn={side === "buy" ? swapTokenQuote : swapTokenBase}
            tokenOut={side === "buy" ? swapTokenBase : swapTokenQuote}
            marketId={marketId}
          />
        </div>
      ) : (
        <div className="p-4 space-y-3 border-t border-border">
          {address ? (
            isHashKeySpot ? (
              <button
                onClick={handleFxSwap}
                disabled={isFxSwapLoading || (!isWrongChain && (!fxAmountIn || fxAmountIn <= 0n))}
                className={`w-full h-11 rounded-lg flex items-center justify-center gap-2 font-semibold hover:opacity-90 shadow-[0_0_30px_-6px_hsl(var(--primary)/0.7)] ${
                  side === "buy" ? "bg-bull text-white" : "bg-bear text-white"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isFxSwapLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {fxButtonLabel}
              </button>
            ) : (
              <button
                className={`w-full h-11 rounded-lg flex items-center justify-center gap-2 font-semibold hover:opacity-90 shadow-[0_0_30px_-6px_hsl(var(--primary)/0.7)] ${
                  side === "buy" ? "bg-bull text-white" : "bg-bear text-white"
                }`}
              >
                {isPerp ? (side === "buy" ? "Long" : "Short") : (side === "buy" ? "Buy" : "Sell")} {baseSymbol}
              </button>
            )
          ) : (
            <button
              onClick={openConnectModal}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground flex items-center justify-center gap-2 font-semibold hover:opacity-90 shadow-[0_0_30px_-6px_hsl(var(--primary)/0.7)]"
            >
              <Image src="/logo.png" alt="" width={18} height={18} className="rounded-full" /> Connect Wallet
            </button>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Balance</span>
            <span className="tabular">
              {totalBalanceUsd !== null ? formatUsd(totalBalanceUsd) : address ? "..." : "$0.00"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Available Balance</span>
            <span className="tabular">
              {availableToTradeValue !== null
                ? side === "buy"
                  ? formatUsd(availableToTradeValue)
                  : `${formatTokenAmount(availableToTradeValue)} ${baseSymbol}`
                : address ? "..." : "$0.00"}
            </span>
          </div>

          {isHashKeySpot && swapError ? (
            <p className="text-xs text-bear rounded-lg border border-bear/20 bg-bear/10 px-3 py-2">
              {swapError}
            </p>
          ) : null}
          {isHashKeySpot && isFxSwapSuccess && fxSwapHash ? (
            <p className="text-xs text-bull rounded-lg border border-bull/20 bg-bull/10 px-3 py-2">
              Swap confirmed: {fxSwapHash.slice(0, 10)}…
            </p>
          ) : null}

          {isHashKeySpot ? (
            <button
              className="w-full h-10 rounded-lg bg-primary/20 text-muted-foreground font-medium"
              disabled
            >
              Uses connected wallet balance
            </button>
          ) : (
            <button className="w-full h-10 rounded-lg bg-primary/30 text-foreground font-medium hover:bg-primary/40">
              Deposit
            </button>
          )}
          <button className="w-full h-10 rounded-lg bg-panel text-muted-foreground font-medium" disabled>
            Withdraw
          </button>
        </div>
      )}
    </aside>
  );
}

function Row({
  label,
  value,
  muted,
  valueClass = "",
}: {
  label: string;
  value: string;
  muted?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular text-right ${muted ? "text-muted-foreground" : "text-foreground"} ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

function SliderField({
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 relative h-5 flex items-center">
        <div className="absolute left-0 right-0 h-1.5 bg-secondary rounded-full" />
        <div className="absolute left-0 h-1.5 bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="relative z-10 w-full opacity-0 cursor-pointer"
        />
        <div
          className="pointer-events-none absolute h-3 w-3 rounded-full bg-foreground border border-border"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
      <div className="bg-panel rounded-md border border-border px-2 h-7 flex items-center tabular text-sm w-20 justify-center">
        {value} {suffix}
      </div>
    </div>
  );
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: fractionDigitsForPrice(value),
  }).format(value);
}

function formatCompactUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTokenAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 2 : 5,
  }).format(value);
}

function fractionDigitsForPrice(value: number) {
  const absolute = Math.abs(value);

  if (absolute >= 1000) return 1;
  if (absolute >= 1) return 2;
  if (absolute >= 0.01) return 4;
  if (absolute >= 0.0001) return 6;
  return 8;
}
