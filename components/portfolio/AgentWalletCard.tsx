"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  ArrowDownLeft,
  Send,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getChainConfig, getExplorerLink } from "@/lib/chain-registry";
import { useSendTransaction, useAccount, useConfig } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { parseEther, isAddress } from "viem";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentWalletData {
  isInitialized: boolean;
  address: string | null;
  balance: string | null;
  chainId: number;
}

type StatusLabel = "not-initialized" | "needs-funding" | "initialized" | "ready";

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(addr: string) {
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function getResolvedChain(chainId: number) {
  try {
    return getChainConfig(chainId).chain;
  } catch {
    return null;
  }
}

function getExplorerHref(address: string, chainId: number) {
  try {
    return getExplorerLink(chainId, "address", address);
  } catch {
    return null;
  }
}

function getStatus(data: AgentWalletData): StatusLabel {
  if (!data.isInitialized) return "not-initialized";
  const bal = parseFloat(data.balance ?? "0");
  if (bal === 0) return "needs-funding";
  if (bal >= 0.01) return "ready";
  return "initialized";
}

const STATUS_CONFIG: Record<
  StatusLabel,
  { label: string; className: string }
> = {
  "not-initialized": {
    label: "Not Initialized",
    className: "bg-muted text-muted-foreground",
  },
  "needs-funding": {
    label: "Needs Funding",
    className: "bg-yellow-500/20 text-yellow-400",
  },
  initialized: {
    label: "Initialized",
    className: "bg-blue-500/20 text-blue-400",
  },
  ready: {
    label: "Ready for Autonomous Mode",
    className: "bg-success/20 text-success",
  },
};

// ── SendToAgentDialog ─────────────────────────────────────────────────────────

interface SendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentAddress: string;
  nativeSymbol: string;
  onSuccess?: () => void;
}

function SendToAgentDialog({
  open,
  onOpenChange,
  agentAddress,
  nativeSymbol,
  onSuccess,
}: SendDialogProps) {
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "confirming" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Reset state every time the dialog opens
  useEffect(() => {
    if (open) {
      setStatus("idle");
      setAmount("");
      setErrorMsg("");
    }
  }, [open]);

  const { sendTransactionAsync } = useSendTransaction();
  const config = useConfig();

  const handleSend = async () => {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setErrorMsg("Enter a valid amount.");
      return;
    }
    if (!isAddress(agentAddress)) {
      setErrorMsg("Invalid agent address.");
      return;
    }
    setErrorMsg("");
    setStatus("sending");
    try {
      const hash = await sendTransactionAsync({
        to: agentAddress as `0x${string}`,
        value: parseEther(amount),
      });
      setStatus("confirming");
      try {
        await waitForTransactionReceipt(config, { hash, timeout: 60_000, pollingInterval: 3_000 });
      } catch {
        // HashKey Chain can be slow — tx was submitted, treat as success
      }
      setStatus("sent");
      setAmount("");
      onSuccess?.();
      setTimeout(() => {
        setStatus("idle");
        onOpenChange(false);
      }, 2000);
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Transaction failed.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Fund Agent Wallet</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Send native {nativeSymbol} from your connected wallet to your agent burner
            EOA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="glass-card rounded-xl p-3">
            <p className="text-xs text-muted-foreground mb-1">Agent Address</p>
            <p className="text-sm font-mono text-foreground break-all">
              {agentAddress}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">
              Amount ({nativeSymbol})
            </label>
            <Input
              type="number"
              min="0"
              step="0.001"
              placeholder="0.1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>

          {errorMsg && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}

          <Button
            className="w-full bg-primary hover:bg-primary/90"
            onClick={handleSend}
            disabled={status === "sending" || status === "confirming" || status === "sent"}
          >
            {(status === "sending" || status === "confirming") && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            {status === "sent" && <Check className="w-4 h-4 mr-2" />}
            {status === "sent"
              ? "Sent!"
              : status === "confirming"
              ? "Confirming…"
              : `Send ${nativeSymbol}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── AgentWalletCard ───────────────────────────────────────────────────────────

export function AgentWalletCard() {
  const { address: userAddress } = useAccount();

  const [data, setData] = useState<AgentWalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [sweepResult, setSweepResult] = useState<string | null>(null);
  const resolvedChain = data ? getResolvedChain(data.chainId) : null;
  const nativeSymbol = resolvedChain?.nativeCurrency.symbol ?? "HSK";
  const explorerHref =
    data?.address ? getExplorerHref(data.address, data.chainId) : null;

  // Poll balance a few times after funding — chain takes a few seconds to reflect
  const pollAfterFund = useCallback(async () => {
    for (let i = 1; i <= 4; i++) {
      await new Promise((r) => setTimeout(r, i * 3000));
      if (!userAddress) break;
      try {
        const res = await fetch("/api/agent-wallet", {
          headers: { "x-wallet-address": userAddress },
          cache: "no-store",
        });
        if (res.ok) {
          const json = (await res.json()) as AgentWalletData;
          setData(json);
        }
      } catch { /* ignore */ }
    }
  }, [userAddress]);

  const fetchWallet = useCallback(async () => {
    if (!userAddress) return;
    setLoading(true);
    try {
      const res = await fetch("/api/agent-wallet", {
        headers: { "x-wallet-address": userAddress },
        cache: "no-store",
      });
      if (res.ok) {
        const json = (await res.json()) as AgentWalletData;
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const handleInit = async () => {
    if (!userAddress) return;
    setInitializing(true);
    try {
      const res = await fetch("/api/agent-wallet", {
        method: "POST",
        headers: {
          "x-wallet-address": userAddress,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        await fetchWallet();
      }
    } finally {
      setInitializing(false);
    }
  };

  const handleSweep = async () => {
    if (!userAddress) return;
    setSweeping(true);
    setSweepResult(null);
    try {
      const res = await fetch("/api/agent-wallet/withdraw", {
        method: "POST",
        headers: {
          "x-wallet-address": userAddress,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.native?.txHash) {
        setSweepResult(`Swept ${json.native.amount} ${nativeSymbol} — tx: ${json.native.txHash.slice(0, 10)}…`);
      } else if (json.error) {
        setSweepResult(`Error: ${json.error}`);
      } else {
        setSweepResult("Nothing to sweep.");
      }
      await fetchWallet();
    } finally {
      setSweeping(false);
    }
  };

  const handleCopy = async () => {
    if (data?.address) {
      await navigator.clipboard.writeText(data.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!userAddress) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="glass-card rounded-2xl p-6 h-full flex flex-col items-center justify-center gap-2"
      >
        <Zap className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Connect wallet to view agent EOA</p>
      </motion.div>
    );
  }

  const status = data ? getStatus(data) : null;
  const statusCfg = status ? STATUS_CONFIG[status] : null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="glass-card rounded-2xl p-6 h-full flex flex-col gap-4"
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/20">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <h3 className="text-primary font-medium text-sm">Agent Wallet</h3>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={fetchWallet}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Status pill */}
        {statusCfg && (
          <span
            className={`self-start px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.className}`}
          >
            {statusCfg.label}
          </span>
        )}

        {/* Balance block */}
        <div className="glass-card rounded-xl p-4 flex-1">
          {loading && !data ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          ) : data?.isInitialized ? (
            <>
              <p className="text-muted-foreground text-xs mb-1">Balance</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-foreground">
                  {parseFloat(data.balance ?? "0").toFixed(4)}
                </span>
                <span className="text-muted-foreground text-sm">{nativeSymbol}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {resolvedChain
                  ? `${resolvedChain.name} · Chain ID: ${data.chainId}`
                  : `Chain ID: ${data.chainId}`}
              </p>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              Agent wallet not initialized yet.
            </div>
          )}
        </div>

        {/* Address row */}
        {data?.address && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 glass-card rounded-lg p-2.5 flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
            >
              <span>{truncate(data.address)}</span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-success shrink-0" />
              ) : (
                <Copy className="w-3.5 h-3.5 shrink-0" />
              )}
            </button>
            {explorerHref && (
              <a
                href={explorerHref}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 glass-card rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                title="View on explorer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {/* Sweep result banner */}
        <AnimatePresence>
          {sweepResult && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2"
            >
              {sweepResult}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        {!data?.isInitialized ? (
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            onClick={handleInit}
            disabled={initializing}
          >
            {initializing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Initialize Agent Wallet
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs"
              onClick={() => setFundOpen(true)}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Fund
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-border hover:bg-muted text-xs"
              onClick={handleSweep}
              disabled={sweeping}
            >
              {sweeping ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <ArrowDownLeft className="w-3.5 h-3.5 mr-1.5" />
              )}
              Sweep Back
            </Button>
          </div>
        )}
      </motion.div>

      {data?.address && (
        <SendToAgentDialog
          open={fundOpen}
          onOpenChange={setFundOpen}
          onSuccess={pollAfterFund}
          agentAddress={data.address}
          nativeSymbol={nativeSymbol}
        />
      )}
    </>
  );
}
