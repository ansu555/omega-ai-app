"use client";

/**
 * Canonical HashKey Chain bridge, wallet side.
 *
 * Deposits (Ethereum → HashKey Chain) run here end to end: approve the right L1
 * spender, then one L1 transaction. The assets and addresses come from
 * lib/bridge/hashkey-bridge.ts, where each L1↔L2 pairing was taken from the L2
 * token's own `remoteToken()`.
 *
 * Withdrawals are intentionally NOT completed here. An OP Stack withdrawal is
 * withdraw → challenge window → prove → finalize, spanning days and both
 * chains; a trading UI that pretended otherwise would strand people mid-claim.
 * `startWithdraw` submits the L2 half and then points at the canonical bridge,
 * which tracks the outstanding claim.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatUnits, parseUnits, type Address } from "viem";
import {
  BRIDGEABLE_ASSETS,
  BRIDGE_ERC20_ABI,
  CANONICAL_BRIDGE_URL,
  ETHEREUM_CHAIN_ID,
  buildDepositTx,
  buildWithdrawTx,
  getBridgeableAsset,
  getDepositSpender,
} from "@/lib/bridge/hashkey-bridge";
import { HASHKEY_MAINNET_CHAIN_ID } from "@/lib/chain-registry/chains/hashkey";

export type BridgeDirection = "deposit" | "withdraw";

export type BridgeStatus =
  | "idle"
  | "approving"
  | "depositing"
  | "withdrawing"
  | "success"
  | "error";

export function useBridge(assetSymbol: string, amountRaw: string, direction: BridgeDirection) {
  const { address } = useAccount();
  const connectedChainId = useChainId();
  const { switchChain } = useSwitchChain();

  const asset = useMemo(() => getBridgeableAsset(assetSymbol), [assetSymbol]);

  /** Deposits are signed on L1; withdrawals are signed on HashKey Chain. */
  const requiredChainId = direction === "deposit" ? ETHEREUM_CHAIN_ID : HASHKEY_MAINNET_CHAIN_ID;
  const isWrongChain = connectedChainId !== requiredChainId;

  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  /** Set once the L2 half of a withdrawal lands, to surface the claim step. */
  const [withdrawalPending, setWithdrawalPending] = useState(false);

  const amount = useMemo(() => {
    if (!asset || !amountRaw || Number(amountRaw) <= 0) return 0n;
    try {
      return parseUnits(amountRaw, asset.decimals);
    } catch {
      return 0n;
    }
  }, [asset, amountRaw]);

  // ── Balances ──────────────────────────────────────────────────────────────
  // On L1 every asset is an ERC-20, HSK included. On L2, HSK is the native coin.
  const isNativeOnL2 = asset?.route === "gas-token";
  const balanceChainId = direction === "deposit" ? ETHEREUM_CHAIN_ID : HASHKEY_MAINNET_CHAIN_ID;
  const balanceToken: Address | undefined =
    direction === "deposit" ? asset?.l1Address : (asset?.l2Address ?? undefined);

  const { data: erc20Balance, refetch: refetchErc20 } = useReadContract({
    address: balanceToken,
    abi: BRIDGE_ERC20_ABI,
    functionName: "balanceOf",
    args: [address as Address],
    chainId: balanceChainId,
    query: { enabled: !!address && !!balanceToken },
  });

  const { data: nativeBalance, refetch: refetchNative } = useBalance({
    address,
    chainId: HASHKEY_MAINNET_CHAIN_ID,
    query: { enabled: !!address && direction === "withdraw" && !!isNativeOnL2 },
  });

  const balance = useMemo(() => {
    if (!asset) return "0";
    if (direction === "withdraw" && isNativeOnL2) {
      return nativeBalance ? formatUnits(nativeBalance.value, nativeBalance.decimals) : "0";
    }
    return erc20Balance !== undefined
      ? formatUnits(erc20Balance as bigint, asset.decimals)
      : "0";
  }, [asset, direction, isNativeOnL2, nativeBalance, erc20Balance]);

  // ── Allowance (deposits only) ─────────────────────────────────────────────
  const spender = asset ? getDepositSpender(asset) : undefined;

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: asset?.l1Address,
    abi: BRIDGE_ERC20_ABI,
    functionName: "allowance",
    args: [address as Address, spender as Address],
    chainId: ETHEREUM_CHAIN_ID,
    query: { enabled: !!address && !!asset && !!spender && direction === "deposit" },
  });

  const needsApproval =
    direction === "deposit" && amount > 0n && (allowance === undefined || (allowance as bigint) < amount);

  // ── Writes ────────────────────────────────────────────────────────────────
  const { writeContract: writeApprove, data: approveHash, error: approveError } = useWriteContract();
  const { writeContract: writeBridge, data: bridgeHash, error: bridgeError } = useWriteContract();

  const { isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: isBridgeConfirming, isSuccess: isBridgeConfirmed } =
    useWaitForTransactionReceipt({ hash: bridgeHash });

  const submitBridgeTx = useCallback(() => {
    if (!asset || !address || amount <= 0n) return;
    try {
      const tx =
        direction === "deposit"
          ? buildDepositTx({ asset, recipient: address, amount })
          : buildWithdrawTx({ asset, recipient: address, amount });
      setStatus(direction === "deposit" ? "depositing" : "withdrawing");
      writeBridge({
        address: tx.address,
        abi: tx.abi,
        functionName: tx.functionName,
        args: tx.args,
        value: tx.value,
        chainId: requiredChainId,
      } as Parameters<typeof writeBridge>[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build the bridge transaction.");
      setStatus("error");
    }
  }, [asset, address, amount, direction, requiredChainId, writeBridge]);

  // Approval granted → continue into the bridge transaction.
  useEffect(() => {
    if (isApproveConfirmed && status === "approving") {
      refetchAllowance().then(() => submitBridgeTx());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApproveConfirmed, status]);

  useEffect(() => {
    if (!isBridgeConfirmed) return;
    setStatus("success");
    setError(null);
    if (direction === "withdraw") setWithdrawalPending(true);
    refetchAllowance();
    if (direction === "withdraw" && isNativeOnL2) refetchNative();
    else refetchErc20();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBridgeConfirmed]);

  useEffect(() => {
    const e = approveError ?? bridgeError;
    if (e) {
      setError(e.message || "Bridge transaction failed");
      setStatus("error");
    }
  }, [approveError, bridgeError]);

  const execute = useCallback(() => {
    setError(null);
    if (!asset) {
      setError("That asset cannot be bridged canonically.");
      setStatus("error");
      return;
    }
    if (!address || amount <= 0n) return;

    if (isWrongChain) {
      switchChain({ chainId: requiredChainId });
      return;
    }

    if (parseFloat(balance) < parseFloat(amountRaw || "0")) {
      setError(`Insufficient ${asset.symbol} balance.`);
      setStatus("error");
      return;
    }

    if (needsApproval) {
      setStatus("approving");
      writeApprove({
        address: asset.l1Address,
        abi: BRIDGE_ERC20_ABI,
        functionName: "approve",
        args: [spender as Address, amount],
        chainId: ETHEREUM_CHAIN_ID,
      });
      return;
    }

    submitBridgeTx();
  }, [
    asset, address, amount, amountRaw, balance, isWrongChain, needsApproval,
    requiredChainId, spender, switchChain, submitBridgeTx, writeApprove,
  ]);

  return {
    assets: BRIDGEABLE_ASSETS,
    asset,
    balance,
    amount,
    needsApproval,
    isWrongChain,
    requiredChainId,
    requiredChainName: direction === "deposit" ? "Ethereum" : "HashKey Chain",
    execute,
    switchToRequiredChain: () => switchChain({ chainId: requiredChainId }),
    status,
    isLoading: status === "approving" || status === "depositing" || status === "withdrawing" || isBridgeConfirming,
    isSuccess: isBridgeConfirmed,
    txHash: bridgeHash,
    error,
    withdrawalPending,
    canonicalBridgeUrl: CANONICAL_BRIDGE_URL,
  };
}
