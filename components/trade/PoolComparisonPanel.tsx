"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Droplets, ExternalLink, Layers, Plus } from "lucide-react";
import { useReadContract, useChainId } from "wagmi";
import { Address, formatUnits } from "viem";
import { MultiTokenLiquidityPoolsABI } from "@/contracts/abis";
import { CONTRACT_ADDRESSES, TOKENS } from "@/contracts/config";
import { getChainConfig, getDefaultChainId, getExplorerLink } from "@/lib/chain-registry";
import { DEFAULT_DEX_MARKET_ID } from "@/lib/dex/markets";
import { cn } from "@/lib/utils";
import type { DexMarket } from "@/lib/dex/types";

type MarketResponse = {
  market?: DexMarket;
};

interface PoolComparisonPanelProps {
  token0Symbol?: string;
  token1Symbol?: string;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const REFRESH_MS = 30_000;

function formatUsd(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function shortAddress(value: string) {
  if (!value || value.length < 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function PoolComparisonPanel({ token0Symbol = "WHSK", token1Symbol = "USDT" }: PoolComparisonPanelProps) {
  const [activeTab, setActiveTab] = useState<"hskswap" | "omega">("hskswap");
  const [hskswapMarket, setHskswapMarket] = useState<DexMarket | null>(null);
  const [isLoadingMarket, setIsLoadingMarket] = useState(true);
  const [marketError, setMarketError] = useState<string | null>(null);

  const connectedChainId = useChainId();
  // Use connected chain if it's supported, otherwise fall back to default
  const activeChainId = (() => {
    try { getChainConfig(connectedChainId); return connectedChainId; }
    catch { return getDefaultChainId(); }
  })();

  const chainCfg = getChainConfig(activeChainId);
  const poolsAddress = (chainCfg.omeswapPools ?? CONTRACT_ADDRESSES.POOLS) as Address;
  const isOmeSwapConfigured = poolsAddress.toLowerCase() !== ZERO_ADDRESS;

  const omegaToken0Cfg = TOKENS[token0Symbol] ?? TOKENS.WHSK;
  const omegaToken1Cfg = TOKENS[token1Symbol] ?? TOKENS.USDC;

  const [token0Address, token1Address] = useMemo(() => {
    const a0 = omegaToken0Cfg.address as Address;
    const a1 = omegaToken1Cfg.address as Address;
    return a0.toLowerCase() < a1.toLowerCase() ? [a0, a1] : [a1, a0];
  }, [omegaToken0Cfg, omegaToken1Cfg]);

  const token0 =
    token0Address.toLowerCase() === (omegaToken0Cfg.address as string).toLowerCase()
      ? omegaToken0Cfg
      : omegaToken1Cfg;
  const token1 = token0 === omegaToken0Cfg ? omegaToken1Cfg : omegaToken0Cfg;

  const { data: poolId } = useReadContract({
    address: poolsAddress,
    abi: MultiTokenLiquidityPoolsABI,
    functionName: "getPoolId",
    args: [token0Address, token1Address],
    chainId: activeChainId,
    query: {
      enabled: isOmeSwapConfigured,
      refetchInterval: REFRESH_MS,
    },
  });

  const { data: poolInfo } = useReadContract({
    address: poolsAddress,
    abi: MultiTokenLiquidityPoolsABI,
    functionName: "getPoolInfo",
    args: [poolId as bigint],
    chainId: activeChainId,
    query: {
      enabled: isOmeSwapConfigured && poolId != null,
      refetchInterval: REFRESH_MS,
    },
  });

  useEffect(() => {
    let disposed = false;
    const aborter = new AbortController();

    async function loadMarket() {
      try {
        const response = await fetch(
          `/api/dex/markets?id=${encodeURIComponent(DEFAULT_DEX_MARKET_ID)}`,
          { signal: aborter.signal },
        );
        if (!response.ok) throw new Error("Unable to load HSKSwap market");

        const payload = (await response.json()) as MarketResponse;
        if (!disposed) {
          setHskswapMarket(payload.market ?? null);
          setMarketError(null);
        }
      } catch {
        if (!disposed && !aborter.signal.aborted) {
          setMarketError("HSKSwap market feed is temporarily unavailable.");
        }
      } finally {
        if (!disposed) setIsLoadingMarket(false);
      }
    }

    loadMarket();
    const timer = window.setInterval(loadMarket, REFRESH_MS);

    return () => {
      disposed = true;
      aborter.abort();
      window.clearInterval(timer);
    };
  }, []);

  const poolTuple = poolInfo as readonly [Address, Address, bigint, bigint, bigint] | undefined;
  const reserve0 = Number.parseFloat(formatUnits(poolTuple?.[2] ?? 0n, token0.decimals));
  const reserve1 = Number.parseFloat(formatUnits(poolTuple?.[3] ?? 0n, token1.decimals));
  const totalSupply = Number.parseFloat(formatUnits(poolTuple?.[4] ?? 0n, 18));
  const hskswapPoolExplorer =
    hskswapMarket && hskswapMarket.chainId
      ? getExplorerLink(hskswapMarket.chainId, "address", hskswapMarket.poolAddress)
      : null;

  return (
    <div className="glass-card rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pool Details</h3>
        </div>
        <span className="text-[11px] px-2 py-1 rounded-full border border-primary/30 text-primary">
          HashKey Chain
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1">
        <button
          onClick={() => setActiveTab("hskswap")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-sm font-medium transition-colors",
            activeTab === "hskswap"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Activity className="w-3.5 h-3.5" />
          HSKSwap
        </button>
        <button
          onClick={() => setActiveTab("omega")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-sm font-medium transition-colors",
            activeTab === "omega"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Droplets className="w-3.5 h-3.5" />
          Omega
        </button>
      </div>

      {/* HSKSwap Tab */}
      {activeTab === "hskswap" && (
        <div className="rounded-xl border border-border/70 bg-muted/25 p-4 space-y-3">
          {isLoadingMarket && !hskswapMarket ? (
            <p className="text-sm text-muted-foreground">Loading HSKSwap pool data...</p>
          ) : hskswapMarket ? (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pair</span>
                <span className="font-medium">{hskswapMarket.pairLabel}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Price</span>
                <span className="font-medium">{formatUsd(hskswapMarket.priceUsd)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Liquidity</span>
                <span className="font-medium">{formatUsd(hskswapMarket.liquidityUsd)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">24h Volume</span>
                <span className="font-medium">{formatUsd(hskswapMarket.volume24hUsd)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">24h Trades</span>
                <span className="font-medium">{hskswapMarket.transactions24h.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Execution Venue</span>
                <span className="font-medium">{hskswapMarket.executionVenue}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pool</span>
                {hskswapPoolExplorer ? (
                  <a
                    href={hskswapPoolExplorer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {shortAddress(hskswapMarket.poolAddress)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="font-mono">{shortAddress(hskswapMarket.poolAddress)}</span>
                )}
              </div>
              <a
                href="https://app.hskswap.com/positions"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-primary/30 text-xs text-primary hover:bg-primary/10 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Provide LP on HSKSwap
                <ExternalLink className="w-3 h-3" />
              </a>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{marketError ?? "No HSKSwap pool data yet."}</p>
          )}
        </div>
      )}

      {/* Omega Tab */}
      {activeTab === "omega" && (
        <div className="rounded-xl border border-border/70 bg-muted/25 p-4 space-y-3">
          {!isOmeSwapConfigured ? (
            <p className="text-sm text-muted-foreground">
              Omega pool contract is not deployed on this network yet.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pair</span>
                <span className="font-medium">
                  {token0.symbol}/{token1.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pool ID</span>
                <span className="font-mono">{poolId != null ? poolId.toString() : "-"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Reserve ({token0.symbol})</span>
                <span className="font-medium">{reserve0.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Reserve ({token1.symbol})</span>
                <span className="font-medium">{reserve1.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">LP Supply</span>
                <span className="font-medium">{totalSupply.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pools Contract</span>
                <a
                  href={getExplorerLink(activeChainId, "address", poolsAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <span className="font-mono">{shortAddress(poolsAddress)}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Layers className="w-3.5 h-3.5" />
        <span>Refreshes every {REFRESH_MS / 1000}s while chart panel is open.</span>
      </div>
    </div>
  );
}
