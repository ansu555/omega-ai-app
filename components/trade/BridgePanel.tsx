"use client";

/**
 * Bridge panel — lives inside the swap card as a mode, not a separate page,
 * because bridging is part of getting into a position, not a separate product.
 *
 * Deposits (Ethereum → HashKey Chain) execute here. Withdrawals start here and
 * finish on the canonical bridge: an OP Stack withdrawal needs a proof and a
 * finalisation after the challenge window, which is not something to fake in a
 * trading UI.
 */

import { useState } from "react";
import { ArrowDown, ArrowUpDown, Check, ChevronDown, ExternalLink, Info, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBridge, type BridgeDirection } from "@/hooks/use-bridge";
import { getExplorerLink } from "@/lib/chain-registry";
import { ETHEREUM_CHAIN_ID } from "@/lib/bridge/hashkey-bridge";
import { HASHKEY_MAINNET_CHAIN_ID } from "@/lib/chain-registry/chains/hashkey";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const CHAIN_LABEL: Record<string, string> = {
  ethereum: "Ethereum",
  hashkey: "HashKey Chain",
};

export function BridgePanel() {
  const [direction, setDirection] = useState<BridgeDirection>("deposit");
  const [assetSymbol, setAssetSymbol] = useState("HSK");
  const [amount, setAmount] = useState("");
  const [assetOpen, setAssetOpen] = useState(false);

  const {
    assets,
    asset,
    balance,
    needsApproval,
    isWrongChain,
    requiredChainName,
    execute,
    switchToRequiredChain,
    isLoading,
    isSuccess,
    txHash,
    error,
    withdrawalPending,
    canonicalBridgeUrl,
  } = useBridge(assetSymbol, amount, direction);

  const fromChain = direction === "deposit" ? CHAIN_LABEL.ethereum : CHAIN_LABEL.hashkey;
  const toChain = direction === "deposit" ? CHAIN_LABEL.hashkey : CHAIN_LABEL.ethereum;

  const hasAmount = !!amount && parseFloat(amount) > 0;
  const insufficient = hasAmount && parseFloat(amount) > parseFloat(balance);

  // HSK leaves L2 as the native coin, which the standard bridge cannot withdraw
  // on its own — that claim has to be driven from the canonical bridge.
  const withdrawNativeBlocked = direction === "withdraw" && asset?.route === "gas-token";

  const explorerChainId = direction === "deposit" ? ETHEREUM_CHAIN_ID : HASHKEY_MAINNET_CHAIN_ID;
  const txUrl = (() => {
    if (!txHash) return null;
    if (explorerChainId === ETHEREUM_CHAIN_ID) return `https://etherscan.io/tx/${txHash}`;
    try {
      return getExplorerLink(HASHKEY_MAINNET_CHAIN_ID, "tx", txHash);
    } catch {
      return null;
    }
  })();

  return (
    <div className="p-4 pt-2 space-y-2">
      {/* Direction */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">From</div>
          <div className="font-semibold truncate">{fromChain}</div>
        </div>
        <button
          onClick={() => {
            setDirection((d) => (d === "deposit" ? "withdraw" : "deposit"));
            setAmount("");
          }}
          className="swap-direction-btn shrink-0 mx-3"
          aria-label="Reverse bridge direction"
        >
          <ArrowUpDown className="w-4 h-4" />
        </button>
        <div className="min-w-0 text-right">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">To</div>
          <div className="font-semibold truncate">{toChain}</div>
        </div>
      </div>

      {/* Amount + asset */}
      <div className="token-input-section">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Bridge</span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet className="w-3 h-3" />
            <span>
              {parseFloat(balance).toFixed(4)} {asset?.symbol}
            </span>
            <button
              onClick={() => setAmount(balance)}
              disabled={parseFloat(balance) <= 0}
              className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors disabled:opacity-40"
            >
              Max
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="flex-1 bg-transparent text-3xl font-medium outline-none placeholder:text-muted-foreground/50 w-full min-w-0"
          />
          <Popover open={assetOpen} onOpenChange={setAssetOpen}>
            <PopoverTrigger asChild>
              <button className="token-selector">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                  {asset?.symbol.charAt(0)}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="font-semibold">{asset?.symbol}</div>
                  <div className="text-xs text-muted-foreground">{asset?.name}</div>
                </div>
                <div className="text-left sm:hidden font-semibold">{asset?.symbol}</div>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 bg-card border-border backdrop-blur-xl p-1" align="end">
              {assets.map((a) => (
                <button
                  key={a.symbol}
                  onClick={() => {
                    setAssetSymbol(a.symbol);
                    setAmount("");
                    setAssetOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="text-left">
                    <div className="font-semibold flex items-center gap-1.5">
                      {a.symbol}
                      {a.route === "gas-token" && (
                        <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium">
                          Gas token
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{a.name}</div>
                  </div>
                  {assetSymbol === a.symbol && <Check className="w-4 h-4 text-primary" />}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex justify-center -my-1 relative z-10">
        <div className="swap-direction-btn pointer-events-none opacity-60">
          <ArrowDown className="w-4 h-4" />
        </div>
      </div>

      <div className="token-input-section">
        <div className="text-sm text-muted-foreground mb-2">You receive on {toChain}</div>
        <div className="text-3xl font-medium">
          {hasAmount ? amount : "0"}{" "}
          <span className="text-lg text-muted-foreground">{asset?.symbol}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          The canonical bridge is 1:1 — it mints and burns rather than swapping, so there is no
          price impact. You pay gas on {fromChain}.
        </div>
      </div>

      {/* ETH is not bridgeable here, and people will expect it to be. */}
      <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground flex gap-2">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          HashKey Chain pays gas in HSK, so the canonical bridge{" "}
          <span className="font-medium text-foreground">cannot move native ETH</span>. Bridge{" "}
          <span className="font-medium text-foreground">WETH</span> instead — it arrives as the
          WETH that HSKSwap&apos;s WETH/USDT pool actually trades.
        </span>
      </div>

      {withdrawNativeBlocked && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <span className="font-medium">HSK withdrawals run on the canonical bridge.</span> HSK
          leaves HashKey Chain as the native coin, and the claim has to be proved and finalised on
          Ethereum after the challenge window.{" "}
          <a
            href={canonicalBridgeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline inline-flex items-center gap-1 text-amber-100"
          >
            Open the bridge <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {direction === "withdraw" && !withdrawNativeBlocked && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <span className="font-medium">Withdrawals take days, not minutes.</span> This submits the
          HashKey Chain half. Your funds then wait out the fault-proof challenge window before you
          prove and finalise the claim on Ethereum, which you do from the canonical bridge.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive break-words">
          {error}
        </div>
      )}

      {isSuccess && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-300 space-y-1">
          <div className="font-medium">
            {direction === "deposit"
              ? "Deposit submitted. Funds usually appear on HashKey Chain within a few minutes."
              : "Withdrawal started on HashKey Chain."}
          </div>
          {txUrl && (
            <a
              href={txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline inline-flex items-center gap-1"
            >
              View transaction <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {withdrawalPending && (
            <a
              href={canonicalBridgeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline inline-flex items-center gap-1"
            >
              Track and finalise the claim <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      <button
        onClick={isWrongChain ? switchToRequiredChain : execute}
        disabled={
          !isWrongChain && (!hasAmount || insufficient || isLoading || withdrawNativeBlocked)
        }
        className={cn("swap-action-btn w-full", (isLoading || withdrawNativeBlocked) && "opacity-70")}
      >
        {isWrongChain
          ? `Switch to ${requiredChainName}`
          : isLoading
            ? "Confirming…"
            : insufficient
              ? `Insufficient ${asset?.symbol}`
              : !hasAmount
                ? "Enter an amount"
                : needsApproval
                  ? `Approve ${asset?.symbol}`
                  : direction === "deposit"
                    ? `Deposit to ${toChain}`
                    : `Withdraw to ${toChain}`}
      </button>
    </div>
  );
}
