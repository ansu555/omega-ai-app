"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useBalance,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useReadContract,
  useChainId,
} from "wagmi";
import { parseUnits, formatUnits, Address, Hex } from "viem";
import { MAINNET_TOKENS } from "@/contracts/config";
import { ERC20ABI } from "@/contracts/abis";
import {
  getChainConfig,
  getDefaultChainId,
  isNativeTokenAddress,
} from "@/lib/chain-registry";
import {
  HSKSWAP_DEX_ID,
  buildHSKSwapTx,
  buildUnwrapTx,
  buildWrapTx,
  isPlaceholderAddress,
  quoteHSKSwapBestTier,
  quoteHSKSwapMultiHop,
} from "@/lib/dex/hskswap";
import { useTransactionStore } from "@/store/transaction-store";

const OMESWAP_DEX_ID = "omeswap" as const;
const OMESWAP_DEX_NAME = "Omega";
/** Pseudo-venue for the 1:1 HSK ⇄ WHSK conversion (settles on WHSK itself). */
const WRAP_DEX_ID = "wrap" as const;

const OMESWAP_POOLS_ABI = [
  {
    inputs: [{ internalType: "address", name: "token0", type: "address" }, { internalType: "address", name: "token1", type: "address" }],
    name: "getPoolId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "poolId", type: "uint256" }],
    name: "getPoolInfo",
    outputs: [
      { internalType: "address", name: "token0", type: "address" },
      { internalType: "address", name: "token1", type: "address" },
      { internalType: "uint256", name: "reserve0", type: "uint256" },
      { internalType: "uint256", name: "reserve1", type: "uint256" },
      { internalType: "uint256", name: "totalLPTokens", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "reserveIn", type: "uint256" },
      { internalType: "uint256", name: "reserveOut", type: "uint256" },
    ],
    name: "getAmountOut",
    outputs: [{ internalType: "uint256", name: "amountOut", type: "uint256" }],
    stateMutability: "pure",
    type: "function",
  },
] as const;

const OMESWAP_ROUTER_ABI = [
  {
    inputs: [
      { internalType: "address", name: "tokenIn", type: "address" },
      { internalType: "address", name: "tokenOut", type: "address" },
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "address", name: "recipient", type: "address" },
    ],
    name: "swapSingleHop",
    outputs: [{ internalType: "uint256", name: "amountOut", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// UniswapV2-compatible router ABI
const V1_ROUTER_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
    ],
    name: "getAmountsOut",
    outputs: [
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapExactTokensForTokens",
    outputs: [
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export type DexSource = string;

export interface DexQuote {
  dex: DexSource;
  dexName: string;
  amountOut: bigint;
  amountOutFormatted: string;
  path: Address[];
  // V3-specific — the fee tier (hundredths of a bip) the swap must use for a
  // single-hop `exactInputSingle`. Unset when `v3Path` is set instead.
  v3Fee?: number;
  // V3-specific — packed-bytes multi-hop path for `exactInput`, set when a
  // route through a hub token (e.g. tokenIn -> USDT -> tokenOut) beats the
  // direct pool.
  v3Path?: Hex;
  isBest: boolean;
}

export function useDexAggregator(
  tokenInSymbol: string,
  tokenOutSymbol: string,
  amountInRaw: string,
  slippage: number,
) {
  const { address } = useAccount();
  const connectedChainId = useChainId();

  // Fall back to the default chain if the connected chain is not registered
  const chainConfig = (() => {
    try { return getChainConfig(connectedChainId) }
    catch { return getChainConfig(getDefaultChainId()) }
  })();
  const chainId = chainConfig.chain.id;

  const publicClient = usePublicClient({ chainId });
  const tokenIn = MAINNET_TOKENS[tokenInSymbol];
  const tokenOut = MAINNET_TOKENS[tokenOutSymbol];

  // ── Native HSK ──────────────────────────────────────────────────────────────
  // HSK is the gas coin, not an ERC-20. Quote and route it as WHSK, but keep
  // the user's chosen side native so the router wraps/unwraps for them.
  const nativeIn = isNativeTokenAddress(tokenIn?.address);
  const nativeOut = isNativeTokenAddress(tokenOut?.address);
  const wrappedNative = chainConfig.nativeWrapped;
  // Cast is safe: every consumer below sits behind a `!tokenIn || !tokenOut` guard.
  const tokenInAddress = (nativeIn ? wrappedNative : tokenIn?.address) as Address;
  const tokenOutAddress = (nativeOut ? wrappedNative : tokenOut?.address) as Address;

  /**
   * HSK ⇄ WHSK is not a swap — there is no pool, the rate is exactly 1:1 and it
   * settles through WHSK's own deposit/withdraw. Detected here so the UI can
   * quote and execute it instead of reporting "no liquidity".
   */
  const isWrap =
    nativeIn && !nativeOut && tokenOutAddress?.toLowerCase() === wrappedNative.toLowerCase();
  const isUnwrap =
    nativeOut && !nativeIn && tokenInAddress?.toLowerCase() === wrappedNative.toLowerCase();
  const isWrapOrUnwrap = !!(isWrap || isUnwrap);
  // Uniswap-V3-shaped "custom" routers (HSKSwap) — QuoterV2 + SwapRouter02,
  // quoted and executed generically via the HSKSwap adapter's ABIs.
  const v3CustomDexConfig = chainConfig.dexRouters
    .filter((r) => r.type === 'custom' && r.quoterAddress)
    .map((r) => ({ dex: r.id as DexSource, dexName: r.name, router: r.routerAddress, quoter: r.quoterAddress as Address }))
    .filter(({ router, quoter }) => !isPlaceholderAddress(router) && !isPlaceholderAddress(quoter));
  const hasV3CustomRouters =
    v3CustomDexConfig.length > 0 &&
    !!tokenInAddress &&
    !!tokenOutAddress &&
    // Compare resolved addresses: HSK and WHSK are the same pool-side asset,
    // so that pair is a wrap, not a route.
    tokenInAddress.toLowerCase() !== tokenOutAddress.toLowerCase();

  // DEX config derived from registry
  const v1DexConfig = chainConfig.dexRouters
    .filter(r => r.type === 'uniswapV2')
    .map(r => ({ dex: r.id as DexSource, dexName: r.name, router: r.routerAddress }));
  const activeV1DexConfig = v1DexConfig.filter(({ router }) => !isPlaceholderAddress(router));
  const omeswapPoolsAddr = chainConfig.omeswapPools as Address | undefined;
  const omeswapRouterAddr = chainConfig.omeswapRouter as Address | undefined;
  const hasOmeswapRouter =
    !isPlaceholderAddress(omeswapPoolsAddr) && !isPlaceholderAddress(omeswapRouterAddr);
  const hasConfiguredRouters =
    activeV1DexConfig.length > 0 || hasV3CustomRouters || hasOmeswapRouter;

  const [quotes, setQuotes] = useState<DexQuote[]>([]);
  const [selectedDex, setSelectedDex] = useState<DexSource>(() => {
    if (hasV3CustomRouters) return v3CustomDexConfig[0].dex;
    if (hasOmeswapRouter) return OMESWAP_DEX_ID;
    return (activeV1DexConfig[0]?.dex ?? v1DexConfig[0]?.dex ?? HSKSWAP_DEX_ID) as DexSource;
  });
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDexConfig = v1DexConfig.find((d) => d.dex === selectedDex);
  const selectedQuote =
    quotes.find((q) => q.dex === selectedDex) ?? quotes[0] ?? null;

  const selectedV3CustomDex = v3CustomDexConfig.find((d) => d.dex === selectedDex);

  const defaultSpender =
    (hasV3CustomRouters ? v3CustomDexConfig[0].router : undefined) ??
    (hasOmeswapRouter ? omeswapRouterAddr : undefined) ??
    activeV1DexConfig[0]?.router ??
    "0x0000000000000000000000000000000000000000";
  const approvalSpender: Address =
    selectedV3CustomDex
      ? selectedV3CustomDex.router
      : selectedDex === OMESWAP_DEX_ID && hasOmeswapRouter && omeswapRouterAddr
      ? omeswapRouterAddr
      : (selectedDexConfig?.router ?? defaultSpender);

  // Balance query — ERC-20 path.
  const { data: balance, refetch: refetchErc20Balance } = useReadContract({
    address: tokenIn?.address as Address,
    abi: ERC20ABI,
    functionName: "balanceOf",
    args: [address as Address],
    chainId,
    query: { enabled: !!address && !!tokenIn && !nativeIn },
  });

  // Balance query — native HSK path (no contract to call).
  const { data: nativeBalance, refetch: refetchNativeBalance } = useBalance({
    address,
    chainId,
    query: { enabled: !!address && nativeIn },
  });

  const refetchBalance = nativeIn ? refetchNativeBalance : refetchErc20Balance;

  // Allowance query. Native HSK is sent as `value`, so it has no allowance;
  // neither does unwrapping, which burns the caller's own WHSK.
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenIn?.address as Address,
    abi: ERC20ABI,
    functionName: "allowance",
    args: [address as Address, approvalSpender],
    chainId,
    query: {
      enabled: !!address && !!tokenIn && hasConfiguredRouters && !nativeIn && !isUnwrap,
    },
  });

  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: isApprovePending,
    error: approveError,
  } = useWriteContract();

  const {
    writeContract: writeSwap,
    data: swapHash,
    isPending: isSwapPending,
    error: swapError,
  } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({ hash: approveHash });

  const { isLoading: isSwapConfirming, isSuccess: isSwapSuccess } =
    useWaitForTransactionReceipt({ hash: swapHash });

  // After approval confirmed → execute swap
  useEffect(() => {
    if (
      isApproveSuccess &&
      isApproving &&
      selectedQuote &&
      address &&
      amountInRaw &&
      tokenIn
    ) {
      setIsApproving(false);
      refetchAllowance().then(() => executeSwapTx());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApproveSuccess, isApproving]);

  // Fetch quotes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (
        !publicClient ||
        !amountInRaw ||
        parseFloat(amountInRaw) <= 0 ||
        !tokenIn ||
        !tokenOut
      ) {
        setQuotes([]);
        return;
      }
      if (!hasConfiguredRouters && !isWrapOrUnwrap) {
        setQuotes([]);
        setIsLoadingQuotes(false);
        return;
      }

      setIsLoadingQuotes(true);
      const amountIn = parseUnits(amountInRaw, tokenIn.decimals);
      const newQuotes: DexQuote[] = [];

      // HSK ⇄ WHSK: fixed 1:1, no pool, no price impact.
      if (isWrapOrUnwrap) {
        setQuotes([
          {
            dex: WRAP_DEX_ID,
            dexName: isWrap ? "Wrap HSK" : "Unwrap WHSK",
            amountOut: amountIn,
            amountOutFormatted: formatUnits(amountIn, tokenOut.decimals),
            path: [tokenInAddress, tokenOutAddress],
            isBest: true,
          },
        ]);
        setSelectedDex(WRAP_DEX_ID);
        setIsLoadingQuotes(false);
        return;
      }

      // --- Uniswap-V3-shaped "custom" router quotes (HSKSwap) ---
      // For each router, compare the direct pool against the best two-hop route
      // through a hub token (USDT/WHSK) and keep whichever is better.
      if (hasV3CustomRouters) {
        for (const { dex, dexName, quoter } of v3CustomDexConfig) {
          try {
            const [direct, multiHop] = await Promise.all([
              quoteHSKSwapBestTier(publicClient, {
                tokenIn: tokenInAddress,
                tokenOut: tokenOutAddress,
                amountIn,
                quoter,
              }),
              quoteHSKSwapMultiHop(publicClient, {
                tokenIn: tokenInAddress,
                tokenOut: tokenOutAddress,
                amountIn,
                hubTokens: chainConfig.hubTokens,
                quoter,
              }),
            ]);

            let quote: DexQuote | null = null;
            if (direct && direct.amountOut > 0n) {
              quote = {
                dex,
                dexName,
                amountOut: direct.amountOut,
                amountOutFormatted: formatUnits(direct.amountOut, tokenOut.decimals),
                path: [tokenInAddress, tokenOutAddress],
                v3Fee: direct.fee,
                isBest: false,
              };
            }
            if (multiHop && multiHop.amountOut > 0n && (!quote || multiHop.amountOut > quote.amountOut)) {
              quote = {
                dex,
                dexName,
                amountOut: multiHop.amountOut,
                amountOutFormatted: formatUnits(multiHop.amountOut, tokenOut.decimals),
                path: multiHop.path,
                v3Path: multiHop.encodedPath,
                isBest: false,
              };
            }
            if (quote) newQuotes.push(quote);
          } catch {
            /* no pool for this pair on this router */
          }
        }
      }

      // --- V1 DEX quotes ---
      for (const { dex, dexName, router } of activeV1DexConfig) {
        // Always try direct path
        const paths: Address[][] = [[tokenInAddress, tokenOutAddress]];

        // Try hub paths for each registered hub token
        for (const hubAddress of chainConfig.hubTokens) {
          if (
            tokenInAddress.toLowerCase() !== hubAddress.toLowerCase() &&
            tokenOutAddress.toLowerCase() !== hubAddress.toLowerCase()
          ) {
            paths.push([tokenInAddress, hubAddress, tokenOutAddress]);
          }
        }

        let bestAmountOut = 0n;
        let bestPath = paths[0];

        for (const path of paths) {
          try {
            const amounts = (await publicClient.readContract({
              address: router,
              abi: V1_ROUTER_ABI,
              functionName: "getAmountsOut",
              args: [amountIn, path],
            })) as bigint[];
            const out = amounts[amounts.length - 1];
            if (out > bestAmountOut) {
              bestAmountOut = out;
              bestPath = path;
            }
          } catch {
            /* no pool */
          }
        }

        if (bestAmountOut > 0n) {
          newQuotes.push({
            dex,
            dexName,
            amountOut: bestAmountOut,
            amountOutFormatted: formatUnits(bestAmountOut, tokenOut.decimals),
            path: bestPath,
            isBest: false,
          });
        }
      }

      // --- OmeSwap pool quote ---
      if (hasOmeswapRouter && omeswapPoolsAddr && omeswapRouterAddr) {
        try {
          const poolId = await publicClient.readContract({
            address: omeswapPoolsAddr,
            abi: OMESWAP_POOLS_ABI,
            functionName: "getPoolId",
            args: [tokenInAddress, tokenOutAddress],
          }) as bigint;

          if (poolId > 0n) {
            const poolInfo = await publicClient.readContract({
              address: omeswapPoolsAddr,
              abi: OMESWAP_POOLS_ABI,
              functionName: "getPoolInfo",
              args: [poolId],
            }) as [Address, Address, bigint, bigint, bigint];

            const [t0,, reserve0, reserve1] = poolInfo;
            const isToken0 = tokenInAddress.toLowerCase() === t0.toLowerCase();
            const reserveIn  = isToken0 ? reserve0 : reserve1;
            const reserveOut = isToken0 ? reserve1 : reserve0;

            if (reserveIn > 0n && reserveOut > 0n) {
              const amountOut = await publicClient.readContract({
                address: omeswapPoolsAddr,
                abi: OMESWAP_POOLS_ABI,
                functionName: "getAmountOut",
                args: [amountIn, reserveIn, reserveOut],
              }) as bigint;

              if (amountOut > 0n) {
                newQuotes.push({
                  dex: OMESWAP_DEX_ID,
                  dexName: OMESWAP_DEX_NAME,
                  amountOut,
                  amountOutFormatted: formatUnits(amountOut, tokenOut.decimals),
                  path: [tokenInAddress, tokenOutAddress],
                  isBest: false,
                });
              }
            }
          }
        } catch {
          // pool doesn't exist for this pair
        }
      }

      newQuotes.sort((a, b) => (b.amountOut > a.amountOut ? 1 : -1));
      if (newQuotes.length > 0) {
        newQuotes[0].isBest = true;
        setSelectedDex(newQuotes[0].dex);
      }
      setQuotes(newQuotes);
      setIsLoadingQuotes(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [amountInRaw, tokenInSymbol, tokenOutSymbol, publicClient, hasConfiguredRouters, hasV3CustomRouters, hasOmeswapRouter]);

  const needsApproval = (): boolean => {
    // Native HSK travels as `value`, and unwrapping burns the caller's own WHSK
    // — neither touches an allowance.
    if (nativeIn || isUnwrap) return false;
    if (!hasConfiguredRouters) return false;
    if (!amountInRaw || allowance === undefined || !tokenIn) return true;
    return parseUnits(amountInRaw, tokenIn.decimals) > (allowance as bigint);
  };

  const executeSwapTx = () => {
    if (!hasConfiguredRouters && !isWrapOrUnwrap) {
      setError("No DEX routers are configured for this chain yet.");
      return;
    }
    if (!selectedQuote || !address || !amountInRaw || !tokenIn || !tokenOut) return;

    const amountIn = parseUnits(amountInRaw, tokenIn.decimals);
    const slippageBps = BigInt(Math.floor(slippage * 100));
    const amountOutMin =
      (selectedQuote.amountOut * (10000n - slippageBps)) / 10000n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

    // HSK ⇄ WHSK settles 1:1 on the WHSK contract, not through any router.
    if (isWrapOrUnwrap) {
      const tx = isWrap
        ? buildWrapTx(wrappedNative, amountIn)
        : buildUnwrapTx(wrappedNative, amountIn);
      writeSwap({
        address: tx.address,
        abi: tx.abi,
        functionName: tx.functionName,
        args: tx.args,
        value: tx.value,
        chainId,
      } as Parameters<typeof writeSwap>[0]);
      return;
    }

    if (selectedQuote.dex === OMESWAP_DEX_ID && hasOmeswapRouter && omeswapRouterAddr) {
      writeSwap({
        address: omeswapRouterAddr,
        abi: OMESWAP_ROUTER_ABI,
        functionName: "swapSingleHop",
        args: [tokenInAddress, tokenOutAddress, amountIn, amountOutMin, address],
        chainId,
      });
    } else if (selectedV3CustomDex) {
      // One builder covers all four directions: ERC-20↔ERC-20 goes out as a
      // plain router call, while native HSK on either side is wrapped into a
      // `multicall` with unwrapWETH9 / refundETH as needed.
      const tx = buildHSKSwapTx({
        router: selectedV3CustomDex.router,
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress,
        recipient: address,
        amountIn,
        amountOutMinimum: amountOutMin,
        fee: selectedQuote.v3Path ? undefined : selectedQuote.v3Fee ?? 3000,
        path: selectedQuote.v3Path,
        nativeIn,
        nativeOut,
        deadline,
      });
      writeSwap({
        address: tx.address,
        abi: tx.abi,
        functionName: tx.functionName,
        args: tx.args,
        value: tx.value,
        chainId,
      } as Parameters<typeof writeSwap>[0]);
    } else {
      const router = v1DexConfig.find((d) => d.dex === selectedDex)?.router
        ?? activeV1DexConfig[0]?.router;
      if (!router) {
        setError("No configured router available for this swap.");
        return;
      }
      writeSwap({
        address: router,
        abi: V1_ROUTER_ABI,
        functionName: "swapExactTokensForTokens",
        args: [amountIn, amountOutMin, selectedQuote.path, address, deadline],
        chainId,
      });
    }
  };

  const executeSwap = () => {
    if (!hasConfiguredRouters && !isWrapOrUnwrap) {
      setError("No DEX routers are configured for this chain yet.");
      return;
    }
    if (!selectedQuote || !address || !amountInRaw || !tokenIn) return;
    setError(null);

    if (needsApproval()) {
      setIsApproving(true);
      writeApprove({
        address: tokenInAddress,
        abi: ERC20ABI,
        functionName: "approve",
        args: [approvalSpender, parseUnits(amountInRaw, tokenIn.decimals)],
        chainId,
      });
    } else {
      executeSwapTx();
    }
  };

  useEffect(() => {
    if (approveError) {
      setError(approveError.message || "Approval failed");
      setIsApproving(false);
    }
  }, [approveError]);

  useEffect(() => {
    if (swapError) setError(swapError.message || "Swap failed");
  }, [swapError]);

  // Record transaction in store
  const addTransaction = useTransactionStore((s) => s.addTransaction);
  useEffect(() => {
    if (isSwapSuccess && swapHash && address && tokenIn && tokenOut) {
      const dexName = selectedQuote?.dexName ?? selectedDex;
      addTransaction({
        type: "SWAP",
        fromToken: tokenInSymbol,
        toToken: tokenOutSymbol,
        fromAmount: parseFloat(amountInRaw) || 0,
        toAmount: parseFloat(selectedQuote?.amountOutFormatted ?? "0") || 0,
        txHash: swapHash,
        walletAddress: address,
        timestamp: Date.now(),
        source: "dex-aggregator",
        dex: dexName,
      });
    }
  }, [isSwapSuccess, swapHash]);

  useEffect(() => {
    if (isSwapSuccess) {
      setError(null);
      refetchBalance();
      refetchAllowance();
    }
  }, [isSwapSuccess]);

  return {
    quotes,
    selectedDex,
    setSelectedDex,
    selectedQuote,
    isLoadingQuotes,
    hasConfiguredRouters,
    estimatedOutput: selectedQuote?.amountOutFormatted ?? "0",
    balance: nativeIn
      ? nativeBalance
        ? formatUnits(nativeBalance.value, nativeBalance.decimals)
        : "0"
      : balance !== undefined && tokenIn
        ? formatUnits(balance as bigint, tokenIn.decimals)
        : "0",
    /** True when the input side is the native gas coin — the UI should leave gas headroom. */
    isNativeIn: nativeIn,
    /** True for the 1:1 HSK ⇄ WHSK conversion rather than a pool swap. */
    isWrapOrUnwrap,
    needsApproval: needsApproval(),
    executeSwap,
    isApproving,
    isLoading:
      isApprovePending ||
      isApproveConfirming ||
      isSwapPending ||
      isSwapConfirming ||
      isApproving,
    isSuccess: isSwapSuccess,
    hash: swapHash,
    error,
  };
}
