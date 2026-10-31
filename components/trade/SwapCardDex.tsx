"use client";

import { useState } from "react";
import { ArrowUpDown, ChevronDown, Settings, Check, Wallet, Search, ExternalLink, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDexAggregator } from "@/hooks/use-dex-aggregator";
import { useWallet } from "@/hooks/use-wallet";
import { TOKEN_LIST, TOKEN_ADDRESSES } from "@/contracts/config";
import { useTokenBalances } from "@/hooks/use-token-balances";
import WalletConnect from "@/components/features/wallet/wallet-connect";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getExplorerLink, getDexRouters, getDefaultChainId, getChainConfig } from "@/lib/chain-registry";
import { HSKSWAP_DEX_ID } from "@/lib/dex/hskswap";
import { BridgePanel } from "@/components/trade/BridgePanel";

type SwapMode = "swap" | "bridge" | "limit";

/** Modes that are actually implemented; the rest render disabled. */
const ENABLED_MODES: SwapMode[] = ["swap", "bridge"];

interface SwapCardDexProps {
  onTokensChange?: (tokenIn: string, tokenOut: string) => void;
}

const DEX_LABEL_COLORS: Record<string, string> = {
  [HSKSWAP_DEX_ID]: "text-primary",
};

const DEX_LABELS: Record<string, { name: string; color: string }> =
  Object.fromEntries(
    getDexRouters(getDefaultChainId()).map(r => [
      r.id,
      { name: r.name, color: DEX_LABEL_COLORS[r.id] ?? 'text-blue-400' },
    ])
  );

const DEFAULT_CHAIN_ID = getDefaultChainId();
const DEFAULT_CHAIN_NAME = getChainConfig(DEFAULT_CHAIN_ID).chain.name;

/** Registry keys offered in the token pickers, native coin first. */
const SELECTABLE_TOKENS: ReadonlyArray<
  readonly [string, (typeof TOKEN_ADDRESSES)[string]]
> = Object.entries(TOKEN_ADDRESSES).sort(
  ([, a], [, b]) => Number(!!b.isNative) - Number(!!a.isNative),
);

const DEFAULT_TOKEN_IN =
  SELECTABLE_TOKENS.find(([, t]) => t.isNative)?.[0] ?? "WHSK";
const DEFAULT_TOKEN_OUT = TOKEN_ADDRESSES.USDT ? "USDT" : "USDC";

/** Native gas to hold back on "Max" so the swap itself can still be paid for. */
const NATIVE_GAS_BUFFER = 0.01;

export function SwapCardDex({ onTokensChange }: SwapCardDexProps) {
  const { isConnected, chain, address, switchChain } = useWallet();

  const [mode, setMode] = useState<SwapMode>("swap");
  // Default to the native coin the user actually holds, into USDT — the only
  // stablecoin on HashKey Chain with real HSKSwap liquidity.
  const [tokenIn, setTokenIn] = useState<string>(DEFAULT_TOKEN_IN);
  const [tokenOut, setTokenOut] = useState<string>(DEFAULT_TOKEN_OUT);
  const [amountIn, setAmountIn] = useState<string>("");
  const [slippage, setSlippage] = useState<number>(0.5);
  const [isPayTokenOpen, setIsPayTokenOpen] = useState(false);
  const [isReceiveTokenOpen, setIsReceiveTokenOpen] = useState(false);

  const { balances: walletBalances } = useTokenBalances(address);

  const {
    quotes,
    selectedDex,
    setSelectedDex,
    estimatedOutput,
    balance,
    needsApproval,
    executeSwap,
    isApproving,
    isLoading,
    isSuccess,
    hash,
    error,
    isLoadingQuotes,
    isNativeIn,
    isWrapOrUnwrap,
  } = useDexAggregator(tokenIn, tokenOut, amountIn, slippage);

  // tokenIn/tokenOut are object keys in TOKEN_ADDRESSES (e.g. "WHSK", "USDC")
  const payToken = TOKEN_ADDRESSES[tokenIn] ?? TOKEN_LIST[0];
  const receiveToken = TOKEN_ADDRESSES[tokenOut] ?? TOKEN_LIST[1];

  const handleSwapDirection = () => {
    const newIn = tokenOut;
    const newOut = tokenIn;
    setTokenIn(newIn);
    setTokenOut(newOut);
    setAmountIn('');
    onTokensChange?.(newIn, newOut);
  };

  const handleTokenSelect = (symbol: string, type: "pay" | "receive") => {
    let newIn = tokenIn;
    let newOut = tokenOut;
    if (type === "pay") {
      if (symbol === tokenOut) newOut = tokenIn;
      newIn = symbol;
      setTokenOut(newOut);
      setTokenIn(newIn);
      setIsPayTokenOpen(false);
    } else {
      if (symbol === tokenIn) newIn = tokenOut;
      newOut = symbol;
      setTokenIn(newIn);
      setTokenOut(newOut);
      setIsReceiveTokenOpen(false);
    }
    setAmountIn('');
    onTokensChange?.(newIn, newOut);
  };

  // Spending the whole native balance would leave nothing to pay gas with, so
  // "Max" holds a little HSK back. ERC-20s can go to the last unit.
  const maxSpendable = (() => {
    const bal = parseFloat(balance) || 0;
    if (!isNativeIn) return bal > 0 ? balance : "0";
    return Math.max(bal - NATIVE_GAS_BUFFER, 0).toString();
  })();

  const hasValidAmount = amountIn && parseFloat(amountIn) > 0;
  const hasSufficientBalance = parseFloat(balance) >= parseFloat(amountIn || "0");
  const hasQuote = quotes.length > 0 && parseFloat(estimatedOutput) > 0;
  const isValidSwap = hasValidAmount && hasSufficientBalance && hasQuote;
  const isWrongNetwork = isConnected && chain?.id !== DEFAULT_CHAIN_ID;

  const TokenIcon = ({ symbol }: { symbol: string }) => (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
      {symbol.charAt(0)}
    </div>
  );

  const TokenSelectorModal = ({
    open,
    onOpenChange,
    type,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    type: "pay" | "receive";
  }) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>Select a token</DialogTitle>
        </DialogHeader>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search by name or symbol"
            className="w-full bg-secondary/50 border border-border rounded-xl py-3 pl-10 pr-4 outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        <div className="grid gap-1 max-h-96 overflow-y-auto">
          {[...SELECTABLE_TOKENS]
            .sort(([keyA, tokA], [keyB, tokB]) => {
              // Funded tokens first, then the native coin, then the rest.
              const balA = parseFloat(walletBalances[keyA] ?? '0');
              const balB = parseFloat(walletBalances[keyB] ?? '0');
              if (balB !== balA) return balB - balA;
              return Number(!!tokB.isNative) - Number(!!tokA.isNative);
            })
            .map(([key, token]) => {
              const bal = walletBalances[key];
              const hasBalance = bal && parseFloat(bal) > 0;
              const isSelected = (type === "pay" ? tokenIn : tokenOut) === key;
              return (
                <button
                  key={key}
                  onClick={() => handleTokenSelect(key, type)}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-secondary/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <TokenIcon symbol={token.symbol} />
                    <div className="text-left">
                      <div className="font-semibold flex items-center gap-1.5">
                        {token.symbol}
                        {token.isNative && (
                          <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium">
                            Native
                          </span>
                        )}
                        {token.lowLiquidity && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-medium">
                            No liquidity
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{token.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasBalance && (
                      <span className="text-sm font-mono text-foreground">
                        {parseFloat(bal!).toFixed(4)}
                      </span>
                    )}
                    {isSelected && <Check className="w-4 h-4 text-primary" />}
                  </div>
                </button>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );

  if (!isConnected) {
    return (
      <div className="swap-card w-full max-w-md p-8 text-center">
        <h3 className="text-xl font-semibold mb-4">Connect Your Wallet</h3>
        <p className="text-muted-foreground mb-6">
          Connect your wallet to swap tokens on HashKey Chain
        </p>
        <WalletConnect variant="default" />
      </div>
    );
  }

  // Bridge mode deliberately bypasses this guard: a deposit is signed on
  // Ethereum, so being "off" HashKey Chain is the correct state there.
  if (isWrongNetwork && mode !== "bridge") {
    return (
      <div className="swap-card w-full max-w-md p-8 text-center">
        <h3 className="text-xl font-semibold mb-4 text-destructive">Wrong Network</h3>
        <p className="text-muted-foreground mb-6">
          Please switch to the configured HashKey Chain network to use this DEX
        </p>
        <button
          onClick={() => switchChain({ chainId: DEFAULT_CHAIN_ID })}
          className="swap-action-btn mb-4"
        >
          Switch to {DEFAULT_CHAIN_NAME}
        </button>
        <div className="text-sm text-muted-foreground">
          Current: {chain?.name} (ID: {chain?.id})<br />
          Required: Chain ID: {DEFAULT_CHAIN_ID}
        </div>
      </div>
    );
  }

  return (
    <div className="swap-card w-full p-1">
      {/* Mode Selector */}
      <div className="flex items-center justify-between p-5 pb-2 gap-3">
        <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 overflow-x-auto scrollbar-hide">
          {(["swap", "bridge", "limit"] as SwapMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "mode-tab capitalize whitespace-nowrap",
                mode === m ? "mode-tab-active" : "mode-tab-inactive",
                !ENABLED_MODES.includes(m) && "opacity-40 cursor-not-allowed"
              )}
              disabled={!ENABLED_MODES.includes(m)}
            >
              {m}
              {m === "limit" && (
                <span className="ml-1 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                  Soon
                </span>
              )}
            </button>
          ))}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <button className="settings-btn mr-1 shrink-0">
              <Settings className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 bg-card border-border backdrop-blur-xl" align="end">
            <div className="space-y-4">
              <h4 className="font-medium leading-none">Transaction Settings</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Slippage Tolerance</span>
                  <span className="text-sm font-medium text-primary">{slippage}%</span>
                </div>
                <div className="flex items-center gap-2">
                  {[0.1, 0.5, 1.0].map((val) => (
                    <button
                      key={val}
                      onClick={() => setSlippage(val)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        slippage === val
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-secondary/50 border-transparent hover:bg-secondary text-muted-foreground"
                      )}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {mode === "bridge" && <BridgePanel />}

      {mode === "swap" && (
      <div className="p-4 pt-2 space-y-2">
        {/* Pay Section */}
        <div className="token-input-section">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Pay</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wallet className="w-3 h-3" />
              <span>{parseFloat(balance).toFixed(4)} {payToken.symbol}</span>
              <button
                onClick={() => setAmountIn(maxSpendable)}
                disabled={parseFloat(maxSpendable) <= 0}
                className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors disabled:opacity-40"
              >
                Max
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <input
              type="number"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              placeholder="0"
              className="flex-1 bg-transparent text-3xl font-medium outline-none placeholder:text-muted-foreground/50 w-full min-w-0"
            />
            <button className="token-selector" onClick={() => setIsPayTokenOpen(true)}>
              <TokenIcon symbol={payToken.symbol} />
              <div className="text-left hidden sm:block">
                <div className="font-semibold">{payToken.symbol}</div>
                <div className="text-xs text-muted-foreground">{payToken.name}</div>
              </div>
              <div className="text-left sm:hidden font-semibold">{payToken.symbol}</div>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center -my-1 relative z-10">
          <button onClick={handleSwapDirection} className="swap-direction-btn">
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>

        {/* Receive Section */}
        <div className="token-input-section">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Receive (estimated)</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <input
              type="number"
              value={isLoadingQuotes ? '' : estimatedOutput}
              readOnly
              placeholder={isLoadingQuotes ? 'Fetching...' : '0'}
              className="flex-1 bg-transparent text-3xl font-medium outline-none placeholder:text-muted-foreground/50 w-full min-w-0"
            />
            <button className="token-selector" onClick={() => setIsReceiveTokenOpen(true)}>
              <TokenIcon symbol={receiveToken.symbol} />
              <div className="text-left hidden sm:block">
                <div className="font-semibold">{receiveToken.symbol}</div>
                <div className="text-xs text-muted-foreground">{receiveToken.name}</div>
              </div>
              <div className="text-left sm:hidden font-semibold">{receiveToken.symbol}</div>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          </div>
        </div>

        {/* Warn before a pair that cannot fill, rather than after it reverts. */}
        {(payToken.lowLiquidity || receiveToken.lowLiquidity) && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <span className="font-medium">
              {payToken.lowLiquidity ? payToken.symbol : receiveToken.symbol} has no HSKSwap
              liquidity.
            </span>{" "}
            It is a real bridged token, but no pool holds a usable amount of it, so this
            swap will fail or fill at a ruinous price. Use USDT as the stable side.
          </div>
        )}

        {isWrapOrUnwrap && hasValidAmount && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-primary">1:1 conversion</span> — HSK and WHSK
            are the same asset, so this settles on the WHSK contract with no pool, no price
            impact and no swap fee. You pay only gas.
          </div>
        )}

        {/* Route Selector */}
        {hasValidAmount && (
          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <Zap className="w-3 h-3" />
              <span>Best Route</span>
            </div>

            {isLoadingQuotes ? (
              <div className="text-xs text-muted-foreground animate-pulse">Fetching quotes...</div>
            ) : quotes.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                No liquidity found for this pair.
              </div>
            ) : (
              <div className="space-y-1.5">
                {quotes.map((quote) => {
                  const label = DEX_LABELS[quote.dex] ?? { name: quote.dexName, color: "text-primary" };
                  const isSelected = selectedDex === quote.dex;
                  return (
                    <button
                      key={quote.dex}
                      onClick={() => setSelectedDex(quote.dex)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                        isSelected
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/50 border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {isSelected && <Check className="w-3 h-3 text-primary" />}
                        {!isSelected && <div className="w-3 h-3" />}
                        <span className={cn("font-medium", label.color)}>{label.name}</span>
                        {quote.isBest && (
                          <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-medium">
                            Best
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs">
                        {parseFloat(quote.amountOutFormatted).toFixed(6)} {receiveToken.symbol}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Path display */}
            {quotes.find(q => q.dex === selectedDex)?.path && (
              <div className="text-[10px] text-muted-foreground/60 flex items-center gap-1 mt-1">
                {quotes
                  .find(q => q.dex === selectedDex)!
                  .path.map((addr, i, arr) => {
                    const token = TOKEN_LIST.find(
                      t => t.address.toLowerCase() === addr.toLowerCase()
                    );
                    return (
                      <span key={addr} className="flex items-center gap-1">
                        <span>{token?.symbol ?? addr.slice(0, 6)}</span>
                        {i < arr.length - 1 && <span>→</span>}
                      </span>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={() => { if (isValidSwap && !isLoading) executeSwap(); }}
          disabled={!isValidSwap || isLoading}
          className="swap-action-btn mt-4"
        >
          {isLoading
            ? isApproving
              ? `Approving ${payToken.symbol}...`
              : 'Swapping...'
            : !hasValidAmount
              ? 'Enter Amount'
              : !hasSufficientBalance
                ? 'Insufficient Balance'
                : !hasQuote
                  ? 'No Liquidity'
                  : needsApproval
                    ? `Approve ${payToken.symbol}`
                    : `Swap`}
        </button>

        {/* Success */}
        {isSuccess && hash && (
          <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-sm text-success font-medium">Swap Successful!</span>
              <a
                href={getExplorerLink(chain?.id ?? getDefaultChainId(), 'tx', hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                View <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <div className="font-medium mb-1">Transaction Error</div>
            <div className="text-xs">{error}</div>
          </div>
        )}

        {/* Warnings */}
        {hasValidAmount && !hasSufficientBalance && (
          <div className="mt-2 text-sm text-destructive">Insufficient balance</div>
        )}
      </div>
      )}

      <TokenSelectorModal open={isPayTokenOpen} onOpenChange={setIsPayTokenOpen} type="pay" />
      <TokenSelectorModal open={isReceiveTokenOpen} onOpenChange={setIsReceiveTokenOpen} type="receive" />
    </div>
  );
}
