"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { parseUnits, formatUnits, Address } from "viem";
import { TOKENS } from "@/contracts/config";
import { MultiTokenLiquidityPoolsABI, ERC20ABI } from "@/contracts/abis";
import { getChainConfig, getDefaultChainId } from "@/lib/chain-registry";
import { useTransactionStore } from "@/store/transaction-store";

export function useLiquidity(token0Symbol: string, token1Symbol: string) {
  const { address } = useAccount();
  const connectedChainId = useChainId();
  const queryClient = useQueryClient();

  const chainConfig = (() => {
    try { return getChainConfig(connectedChainId) }
    catch { return getChainConfig(getDefaultChainId()) }
  })();
  const chainId = chainConfig.chain.id;
  const poolsAddress = (chainConfig.omeswapPools ?? '0x0000000000000000000000000000000000000000') as Address;

  const [amount0, setAmount0] = useState<string>("");
  const [amount1, setAmount1] = useState<string>("");

  // Token 0 approval hook
  const {
    writeContract: writeApprove0,
    data: approveHash0,
    isPending: isApprovePending0,
    error: approveError0,
  } = useWriteContract();
  const { isLoading: isConfirmingApprove0, isSuccess: isApproveSuccess0 } = useWaitForTransactionReceipt({
    hash: approveHash0,
  });

  // Token 1 approval hook
  const {
    writeContract: writeApprove1,
    data: approveHash1,
    isPending: isApprovePending1,
    error: approveError1,
  } = useWriteContract();
  const { isLoading: isConfirmingApprove1, isSuccess: isApproveSuccess1 } = useWaitForTransactionReceipt({
    hash: approveHash1,
  });

  // Liquidity (add/remove) hook
  const {
    writeContract: writeLiquidity,
    data: liquidityHash,
    isPending: isLiquidityPending,
    error: liquidityError,
  } = useWriteContract();
  const { isLoading: isConfirmingLiquidity, isSuccess: isLiquiditySuccess } = useWaitForTransactionReceipt({
    hash: liquidityHash,
  });

  const [error, setError] = useState<string | null>(null);

  const token0 = TOKENS[token0Symbol];
  const token1 = TOKENS[token1Symbol];

  const dec0 = token0.decimals ?? 18;
  const dec1 = token1.decimals ?? 18;

  const token0Addr =
    token0.address.toLowerCase() < token1.address.toLowerCase()
      ? (token0.address as Address)
      : (token1.address as Address);
  const token1Addr =
    token0.address.toLowerCase() < token1.address.toLowerCase()
      ? (token1.address as Address)
      : (token0.address as Address);

  // Get pool ID
  const { data: poolId } = useReadContract({
    address: poolsAddress,
    abi: MultiTokenLiquidityPoolsABI,
    functionName: "getPoolId",
    args: [token0Addr, token1Addr],
    chainId,
  });

  // Get pool info
  const { data: poolInfo, refetch: refetchPoolInfo } = useReadContract({
    address: poolsAddress,
    abi: MultiTokenLiquidityPoolsABI,
    functionName: "getPoolInfo",
    args: [poolId as bigint],
    chainId,
    query: {
      enabled: !!poolId,
    },
  });

  // Get user position
  const { data: userPosition, refetch: refetchPosition } = useReadContract({
    address: poolsAddress,
    abi: MultiTokenLiquidityPoolsABI,
    functionName: "getUserPosition",
    args: [poolId as bigint, address as Address],
    chainId,
    query: {
      enabled: !!poolId && !!address,
    },
  });

  // Get token0 allowance
  const { data: allowance0, refetch: refetchAllowance0 } = useReadContract({
    address: token0.address as Address,
    abi: ERC20ABI,
    functionName: "allowance",
    args: [address as Address, poolsAddress],
    chainId,
    query: {
      enabled: !!address,
    },
  });

  // Get token1 allowance
  const { data: allowance1, refetch: refetchAllowance1 } = useReadContract({
    address: token1.address as Address,
    abi: ERC20ABI,
    functionName: "allowance",
    args: [address as Address, poolsAddress],
    chainId,
    query: {
      enabled: !!address,
    },
  });

  // Get balances
  const { data: balance0, refetch: refetchBalance0 } = useReadContract({
    address: token0.address as Address,
    abi: ERC20ABI,
    functionName: "balanceOf",
    args: [address as Address],
    chainId,
    query: {
      enabled: !!address,
    },
  });

  const { data: balance1, refetch: refetchBalance1 } = useReadContract({
    address: token1.address as Address,
    abi: ERC20ABI,
    functionName: "balanceOf",
    args: [address as Address],
    chainId,
    query: {
      enabled: !!address,
    },
  });

  // Approve token0
  const approveToken0 = async () => {
    if (!amount0) return;

    writeApprove0({
      address: token0.address as Address,
      abi: ERC20ABI,
      functionName: "approve",
      args: [poolsAddress, parseUnits(amount0, dec0)],
      chainId,
    });
  };

  // Approve token1
  const approveToken1 = async () => {
    if (!amount1) return;

    writeApprove1({
      address: token1.address as Address,
      abi: ERC20ABI,
      functionName: "approve",
      args: [poolsAddress, parseUnits(amount1, dec1)],
      chainId,
    });
  };

  // Add liquidity
  const addLiquidity = async () => {
    console.log("addLiquidity called", {
      amount0,
      amount1,
      poolId,
      poolIdType: typeof poolId,
    });

    // Validate inputs - poolId can be 0n (BigInt zero is valid)
    if (!amount0 || !amount1 || poolId === undefined || poolId === null) {
      console.error("Missing required values for addLiquidity:", {
        amount0: !!amount0,
        amount1: !!amount1,
        poolId: poolId !== undefined && poolId !== null,
      });
      return;
    }

    try {
      console.log("Calling addLiquidity with params:", {
        poolId: poolId.toString(),
        amount0: parseUnits(amount0, dec0).toString(),
        amount1: parseUnits(amount1, dec1).toString(),
      });

      writeLiquidity({
        address: poolsAddress,
        abi: MultiTokenLiquidityPoolsABI,
        functionName: "addLiquidity",
        args: [
          poolId as bigint,
          parseUnits(amount0, dec0),
          parseUnits(amount1, dec1),
          BigInt(0), // min amount0
          BigInt(0), // min amount1
        ],
        chainId,
      });
    } catch (error: any) {
      console.error("Error in addLiquidity:", error);
    }
  };

  // Remove liquidity
  const removeLiquidity = async (liquidityAmount: string) => {
    if (!poolId) return;

    writeLiquidity({
      address: poolsAddress,
      abi: MultiTokenLiquidityPoolsABI,
      functionName: "removeLiquidity",
      args: [
        poolId as bigint,
        parseUnits(liquidityAmount, 18),
        BigInt(0), // min amount0
        BigInt(0), // min amount1
      ],
      chainId,
    });
  };

  // Calculate quote for proportional amounts
  const getQuote = (inputAmount: string, isToken0: boolean) => {
    if (!poolInfo || !inputAmount) return "0";

    const [, , reserve0, reserve1] = poolInfo as [
      Address,
      Address,
      bigint,
      bigint,
      bigint,
    ];

    if (reserve0 === BigInt(0) || reserve1 === BigInt(0)) {
      return inputAmount; // Initial liquidity, can be any ratio
    }

    const input = parseUnits(inputAmount, isToken0 ? dec0 : dec1);
    if (isToken0) {
      const output = (input * reserve1) / reserve0;
      return formatUnits(output, dec1);
    } else {
      const output = (input * reserve0) / reserve1;
      return formatUnits(output, dec0);
    }
  };

  // Check if approvals are needed
  const needsApproval0 = () => {
    if (!amount0 || parseFloat(amount0) <= 0 || allowance0 === undefined) return false;
    return parseUnits(amount0, dec0) > (allowance0 as bigint);
  };

  const needsApproval1 = () => {
    if (!amount1 || parseFloat(amount1) <= 0 || allowance1 === undefined) return false;
    return parseUnits(amount1, dec1) > (allowance1 as bigint);
  };

  // Handle write errors
  useEffect(() => {
    const writeError = approveError0 || approveError1 || liquidityError;
    if (writeError) {
      setError(writeError.message || "Transaction failed");
      console.error("Write contract error:", writeError);
    }
  }, [approveError0, approveError1, liquidityError]);

  // Clear error on success
  useEffect(() => {
    if (isApproveSuccess0 || isApproveSuccess1 || isLiquiditySuccess) {
      setError(null);
    }
  }, [isApproveSuccess0, isApproveSuccess1, isLiquiditySuccess]);

  // Record transaction in store
  const addTransaction = useTransactionStore((s) => s.addTransaction);
  const lastActionRef = { current: "" as "add" | "remove" | "" };

  const wrappedAddLiquidity = async () => {
    lastActionRef.current = "add";
    return addLiquidity();
  };
  const wrappedRemoveLiquidity = async (amt: string) => {
    lastActionRef.current = "remove";
    return removeLiquidity(amt);
  };

  useEffect(() => {
    if (isLiquiditySuccess && liquidityHash && address) {
      const txType =
        lastActionRef.current === "remove"
          ? ("REMOVE_LIQUIDITY" as const)
          : ("ADD_LIQUIDITY" as const);
      addTransaction({
        type: txType,
        fromToken: token0Symbol,
        toToken: token1Symbol,
        fromAmount: parseFloat(amount0) || 0,
        toAmount: parseFloat(amount1) || 0,
        txHash: liquidityHash,
        walletAddress: address,
        timestamp: Date.now(),
        source: "liquidity",
      });
    }
  }, [isLiquiditySuccess, liquidityHash, address, amount0, amount1, token0Symbol, token1Symbol]);

  // Refetch allowance 0 after approval 0
  useEffect(() => {
    if (isApproveSuccess0) {
      refetchAllowance0();
      queryClient.invalidateQueries({ queryKey: ["readContract"] });
    }
  }, [isApproveSuccess0, refetchAllowance0, queryClient]);

  // Refetch allowance 1 after approval 1
  useEffect(() => {
    if (isApproveSuccess1) {
      refetchAllowance1();
      queryClient.invalidateQueries({ queryKey: ["readContract"] });
    }
  }, [isApproveSuccess1, refetchAllowance1, queryClient]);

  // Refetch all data after liquidity transaction
  useEffect(() => {
    if (isLiquiditySuccess) {
      refetchBalance0();
      refetchBalance1();
      refetchAllowance0();
      refetchAllowance1();
      refetchPoolInfo();
      refetchPosition();
      queryClient.invalidateQueries({ queryKey: ["readContract"] });
    }
  }, [
    isLiquiditySuccess,
    refetchBalance0,
    refetchBalance1,
    refetchAllowance0,
    refetchAllowance1,
    refetchPoolInfo,
    refetchPosition,
    queryClient,
  ]);

  const isLoading =
    isApprovePending0 ||
    isConfirmingApprove0 ||
    isApprovePending1 ||
    isConfirmingApprove1 ||
    isLiquidityPending ||
    isConfirmingLiquidity;

  return {
    amount0,
    setAmount0,
    amount1,
    setAmount1,
    balance0: balance0 ? formatUnits(balance0 as bigint, dec0) : "0",
    balance1: balance1 ? formatUnits(balance1 as bigint, dec1) : "0",
    poolInfo: poolInfo
      ? {
          token0: (poolInfo as any)[0],
          token1: (poolInfo as any)[1],
          reserve0: formatUnits((poolInfo as any)[2], dec0),
          reserve1: formatUnits((poolInfo as any)[3], dec1),
          totalSupply: formatUnits((poolInfo as any)[4], 18),
        }
      : null,
    userPosition: userPosition
      ? {
          liquidity: formatUnits((userPosition as any)[0], 18),
          token0Amount: formatUnits((userPosition as any)[1], dec0),
          token1Amount: formatUnits((userPosition as any)[2], dec1),
        }
      : null,
    needsApproval0: needsApproval0(),
    needsApproval1: needsApproval1(),
    approveToken0,
    approveToken1,
    addLiquidity: wrappedAddLiquidity,
    removeLiquidity: wrappedRemoveLiquidity,
    getQuote,
    isLoading,
    isSuccess: isLiquiditySuccess,
    hash: liquidityHash,
    error,
  };
}
