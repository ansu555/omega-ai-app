"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useSwitchChain,
} from "wagmi";
import { parseUnits, formatUnits, maxUint256 } from "viem";
import { mainnet } from "viem/chains";
import type { Address } from "viem";
import {
  UNISWAP_QUOTER_V2,
  UNISWAP_SWAP_ROUTER,
  QUOTER_V2_ABI,
  SWAP_ROUTER_ABI,
  ERC20_ABI,
  MARKET_FEES,
  FEE_MEDIUM,
  type PoolFee,
} from "@/lib/uniswap/constants";

export type SwapToken = {
  address: Address;
  symbol: string;
  decimals: number;
  name: string;
};

export type UniswapSwapState = {
  amountIn: string;
  setAmountIn: (v: string) => void;
  amountOut: string;
  quoteLoading: boolean;
  quoteError: string | null;
  needsApproval: boolean;
  approve: () => Promise<void>;
  swap: () => Promise<void>;
  txHash: string | null;
  txStatus: "idle" | "approving" | "swapping" | "success" | "error";
  txError: string | null;
  balance: string;
  isWrongNetwork: boolean;
  switchToEthereum: () => void;
};

export function useUniswapSwap(
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  marketId: string,
  slippageBps = 50,
): UniswapSwapState {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: mainnet.id });
  const { data: walletClient } = useWalletClient({ chainId: mainnet.id });
  const { switchChain } = useSwitchChain();

  const [amountIn, setAmountIn] = useState("");
  const [amountOut, setAmountOut] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<UniswapSwapState["txStatus"]>("idle");
  const [txError, setTxError] = useState<string | null>(null);
  const [balance, setBalance] = useState("0");

  const isWrongNetwork = chainId !== mainnet.id;
  const fee: PoolFee = MARKET_FEES[marketId] ?? FEE_MEDIUM;

  // Fetch balance
  useEffect(() => {
    if (!address || !publicClient) return;
    let cancelled = false;

    publicClient
      .readContract({
        address: tokenIn.address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      })
      .then((raw) => {
        if (!cancelled)
          setBalance(formatUnits(raw as bigint, tokenIn.decimals));
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [address, publicClient, tokenIn]);

  // Quote
  useEffect(() => {
    if (!amountIn || Number(amountIn) <= 0 || !publicClient) {
      setAmountOut("");
      setQuoteError(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setQuoteLoading(true);
      setQuoteError(null);

      try {
        const parsedIn = parseUnits(amountIn, tokenIn.decimals);

        const result = await publicClient.simulateContract({
          address: UNISWAP_QUOTER_V2,
          abi: QUOTER_V2_ABI,
          functionName: "quoteExactInputSingle",
          args: [
            {
              tokenIn: tokenIn.address,
              tokenOut: tokenOut.address,
              amountIn: parsedIn,
              fee,
              sqrtPriceLimitX96: 0n,
            },
          ],
        });

        const [out] = result.result as [bigint, bigint, number, bigint];
        setAmountOut(formatUnits(out, tokenOut.decimals));

        // Check allowance
        if (address) {
          const allowance = await publicClient.readContract({
            address: tokenIn.address,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [address, UNISWAP_SWAP_ROUTER],
          });
          setNeedsApproval((allowance as bigint) < parsedIn);
        }
      } catch (e) {
        setQuoteError("No liquidity or quote failed");
        setAmountOut("");
      } finally {
        setQuoteLoading(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [amountIn, tokenIn, tokenOut, fee, publicClient, address]);

  const approve = useCallback(async () => {
    if (!walletClient || !address || !publicClient) return;
    setTxStatus("approving");
    setTxError(null);

    try {
      // @ts-expect-error wagmi v2 overload inference doesn't handle custom ABI literals
      const hash = await walletClient.writeContract({
        address: tokenIn.address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [UNISWAP_SWAP_ROUTER, maxUint256],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setNeedsApproval(false);
      setTxStatus("idle");
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "Approval failed");
      setTxStatus("error");
    }
  }, [walletClient, address, publicClient, tokenIn]);

  const swap = useCallback(async () => {
    if (!walletClient || !address || !publicClient || !amountIn || !amountOut) return;
    setTxStatus("swapping");
    setTxError(null);
    setTxHash(null);

    try {
      const parsedIn = parseUnits(amountIn, tokenIn.decimals);
      const parsedOutMin =
        (parseUnits(amountOut, tokenOut.decimals) * BigInt(10000 - slippageBps)) /
        10000n;

      // @ts-expect-error wagmi v2 overload inference doesn't handle custom ABI literals
      const hash = await walletClient.writeContract({
        address: UNISWAP_SWAP_ROUTER,
        abi: SWAP_ROUTER_ABI,
        functionName: "exactInputSingle",
        args: [
          {
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            fee,
            recipient: address,
            amountIn: parsedIn,
            amountOutMinimum: parsedOutMin,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });

      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      setTxStatus("success");
      setAmountIn("");
      setAmountOut("");
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "Swap failed");
      setTxStatus("error");
    }
  }, [walletClient, address, publicClient, amountIn, amountOut, tokenIn, tokenOut, fee, slippageBps]);

  const switchToEthereum = useCallback(() => {
    switchChain({ chainId: mainnet.id });
  }, [switchChain]);

  return {
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
  };
}
