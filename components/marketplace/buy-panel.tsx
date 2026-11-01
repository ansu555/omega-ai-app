"use client"

import { useState } from "react"
import Link from "next/link"
import { useSendTransaction, useWriteContract } from "wagmi"
import { parseEther, parseUnits } from "viem"
import { ShieldCheck, Wallet, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useWallet } from "@/hooks/use-wallet"
import { normalizeWalletAddress } from "@/lib/onboarding"

// ERC-20 transfer ABI fragment for USDC
const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

// USDC contract on HashKey Chain — update via chain registry once deployed
const USDC_ADDRESS = "0x0000000000000000000000000000000000000001" as `0x${string}`
const USDC_DECIMALS = 6

type PurchaseState = "idle" | "sending" | "verifying" | "done" | "error"

export type BuyPanelProps = {
  strategyId: string
  strategyName: string
  isFree: boolean
  priceAmount?: number | null
  priceToken?: string | null
  currentVersionId?: string | null
  /** Called after purchase is verified and user may activate */
  onPurchaseVerified?: () => void
}

export function BuyPanel({
  strategyId,
  strategyName,
  isFree,
  priceAmount,
  priceToken,
  onPurchaseVerified,
}: BuyPanelProps) {
  const { address, isConnected } = useWallet()
  const wallet = address ? normalizeWalletAddress(address) : null

  const [state, setState] = useState<PurchaseState>("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { sendTransactionAsync } = useSendTransaction()
  const { writeContractAsync } = useWriteContract()

  const treasury = process.env.NEXT_PUBLIC_TREASURY_WALLET as `0x${string}` | undefined
  const token = priceToken && priceToken !== "free" ? priceToken : "OG"
  const amount = priceAmount ?? 0

  async function handleBuy() {
    if (!wallet) {
      setErrorMsg("Connect wallet to continue")
      return
    }
    if (!treasury) {
      setErrorMsg("Treasury wallet not configured")
      return
    }

    setState("sending")
    setErrorMsg(null)

    try {
      let txHash: `0x${string}`

      if (token === "USDC") {
        txHash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [treasury, parseUnits(String(amount), USDC_DECIMALS)],
        })
      } else {
        txHash = await sendTransactionAsync({
          to: treasury,
          value: parseEther(String(amount)),
        })
      }

      setState("verifying")

      const res = await fetch(
        `/api/marketplace/strategies/${strategyId}/purchase`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-wallet-address": wallet,
          },
          body: JSON.stringify({
            tx_hash: txHash,
            strategy_id: strategyId,
          }),
        },
      )

      if (!res.ok) {
        const j = await res.json().catch(async () => ({
          error: await res.text(),
        }))
        throw new Error(typeof j.error === "string" ? j.error : "Verification failed")
      }

      setState("done")
      onPurchaseVerified?.()
    } catch (e) {
      setState("error")
      setErrorMsg(e instanceof Error ? e.message : "Transaction failed")
    }
  }

  // ── Free strategy panel ───────────────────────────────────────────────────
  if (isFree) {
    return (
      <div
        id="activate"
        className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5 space-y-3"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-200">{strategyName}</span>
          <Badge className="bg-violet-500/15 text-violet-300 border-violet-500/30">
            Free
          </Badge>
        </div>
        <p className="text-xs text-zinc-500">
          This strategy is free. Activate it to start running it in the Agent Builder.
        </p>
        {!isConnected ? (
          <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 p-3">
            <Wallet className="h-4 w-4 text-zinc-500 shrink-0" />
            <p className="text-sm text-zinc-400">Connect wallet to activate</p>
          </div>
        ) : (
          <Button
            asChild
            className="w-full bg-violet-600 hover:bg-violet-500 text-white"
          >
            <Link href={`/marketplace/strategies/${strategyId}#activate`}>
              Activate Free
            </Link>
          </Button>
        )}
      </div>
    )
  }

  // ── Paid strategy panel ───────────────────────────────────────────────────
  return (
    <div
      id="buy"
      className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5 space-y-4"
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Strategy</p>
          <p className="text-sm font-medium text-zinc-200">{strategyName}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Price</p>
          <p className="text-base font-semibold text-zinc-100">
            {amount} {token}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        <span>Payment verified on-chain before access is granted</span>
      </div>

      {/* Connect prompt */}
      {!isConnected ? (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 p-3">
          <Wallet className="h-4 w-4 text-zinc-500 shrink-0" />
          <p className="text-sm text-zinc-400">Connect wallet to continue</p>
        </div>
      ) : (
        <div className="space-y-3">
          {state === "done" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <p className="text-sm text-emerald-400">
                  Purchase verified! You can now activate this strategy.
                </p>
              </div>
              <Button
                asChild
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <Link href={`/marketplace/strategies/${strategyId}#activate`}>
                  Activate Now
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <Button
                disabled={
                  state === "sending" ||
                  state === "verifying" ||
                  !treasury
                }
                onClick={() => void handleBuy()}
                className={cn(
                  "w-full",
                  state === "idle" || state === "error"
                    ? "bg-violet-600 hover:bg-violet-500 text-white"
                    : "bg-zinc-800 text-zinc-400",
                )}
              >
                {state === "sending" ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending transaction…
                  </span>
                ) : state === "verifying" ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying on-chain…
                  </span>
                ) : (
                  `Buy for ${amount} ${token}`
                )}
              </Button>

              {errorMsg && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">{errorMsg}</p>
                </div>
              )}
            </>
          )}

          <p className="text-[10px] text-zinc-600">
            Payment is sent to the treasury wallet. Access unlocks after on-chain
            verification.
          </p>
        </div>
      )}
    </div>
  )
}
