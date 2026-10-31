"use client";

import { ArrowDownUp, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useUniswapSwap, type SwapToken } from "@/hooks/use-uniswap-swap";

type Props = {
  tokenIn: SwapToken;
  tokenOut: SwapToken;
  marketId: string;
};

export function UniswapSwapCard({ tokenIn, tokenOut, marketId }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [slippageBps, setSlippageBps] = useState(50);

  const actualIn = flipped ? tokenOut : tokenIn;
  const actualOut = flipped ? tokenIn : tokenOut;

  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const {
    amountIn,
    setAmountIn,
    amountOut,
    quoteLoading,
    quoteError,
    needsApproval,
    approve,
    swap,
    txHash,
    txStatus,
    txError,
    balance,
    isWrongNetwork,
    switchToEthereum,
  } = useUniswapSwap(actualIn, actualOut, marketId, slippageBps);

  const actionDisabled =
    !isConnected ||
    isWrongNetwork ||
    !amountIn ||
    Number(amountIn) <= 0 ||
    quoteLoading ||
    !!quoteError ||
    txStatus === "approving" ||
    txStatus === "swapping";

  function getButtonLabel() {
    if (!isConnected) return "Connect Wallet";
    if (isWrongNetwork) return "Switch to Ethereum";
    if (txStatus === "approving") return "Approving…";
    if (txStatus === "swapping") return "Swapping…";
    if (!amountIn || Number(amountIn) <= 0) return "Enter amount";
    if (quoteLoading) return "Getting quote…";
    if (quoteError) return quoteError;
    if (needsApproval) return `Approve ${actualIn.symbol}`;
    return `Swap via Uniswap v3`;
  }

  function handleAction() {
    if (!isConnected) { openConnectModal?.(); return; }
    if (isWrongNetwork) { switchToEthereum(); return; }
    if (needsApproval) { approve(); return; }
    swap();
  }

  return (
    <div className="w-full rounded-2xl border border-border bg-card/60 backdrop-blur-md p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Swap · Ethereum Mainnet</span>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Slippage</span>
          {[25, 50, 100].map((bps) => (
            <button
              key={bps}
              onClick={() => setSlippageBps(bps)}
              className={`px-1.5 py-0.5 rounded ${slippageBps === bps ? "bg-primary/20 text-primary" : "hover:bg-muted"}`}
            >
              {bps / 100}%
            </button>
          ))}
        </div>
      </div>

      {/* Token In */}
      <div className="rounded-xl border border-border bg-panel/60 p-3 space-y-1">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>You pay</span>
          <button
            className="hover:text-foreground"
            onClick={() => setAmountIn(balance)}
          >
            Balance: {Number(balance).toFixed(4)} {actualIn.symbol}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            placeholder="0.0"
            className="flex-1 bg-transparent text-xl font-semibold outline-none tabular placeholder:text-muted-foreground/50"
          />
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium">
            {actualIn.symbol}
          </div>
        </div>
      </div>

      {/* Flip button */}
      <div className="flex justify-center -my-1">
        <button
          onClick={() => setFlipped((f) => !f)}
          className="rounded-full border border-border bg-card p-2 hover:bg-muted transition-colors"
        >
          <ArrowDownUp size={14} />
        </button>
      </div>

      {/* Token Out */}
      <div className="rounded-xl border border-border bg-panel/60 p-3 space-y-1">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>You receive</span>
          {quoteLoading && <Loader2 size={12} className="animate-spin" />}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 text-xl font-semibold tabular text-foreground/80">
            {amountOut ? Number(amountOut).toFixed(6) : "0.0"}
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium">
            {actualOut.symbol}
          </div>
        </div>
      </div>

      {/* Quote error */}
      {quoteError && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle size={13} /> {quoteError}
        </div>
      )}

      {/* Swap info */}
      {amountIn && amountOut && !quoteError && (
        <div className="rounded-lg bg-panel/40 px-3 py-2 space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Rate</span>
            <span className="tabular text-foreground">
              1 {actualIn.symbol} ={" "}
              {(Number(amountOut) / Number(amountIn)).toFixed(6)} {actualOut.symbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Max slippage</span>
            <span>{slippageBps / 100}%</span>
          </div>
          <div className="flex justify-between">
            <span>Route</span>
            <span>Uniswap v3</span>
          </div>
        </div>
      )}

      {/* Action button */}
      <button
        onClick={handleAction}
        disabled={actionDisabled && isConnected && !isWrongNetwork}
        className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_30px_-6px_hsl(var(--primary)/0.6)] transition-opacity"
      >
        {(txStatus === "approving" || txStatus === "swapping") && (
          <Loader2 size={15} className="animate-spin" />
        )}
        {getButtonLabel()}
      </button>

      {/* Tx success */}
      {txStatus === "success" && txHash && (
        <a
          href={`https://etherscan.io/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs text-bull hover:underline"
        >
          Swap confirmed <ExternalLink size={11} />
        </a>
      )}

      {/* Tx error */}
      {txStatus === "error" && txError && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle size={13} />
          <span className="truncate">{txError}</span>
        </div>
      )}
    </div>
  );
}
