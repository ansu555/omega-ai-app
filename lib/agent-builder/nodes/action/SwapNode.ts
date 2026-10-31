import { BaseNode } from "../BaseNode";
import type {
  HandleDef,
  ConfigField,
  ExecutionContext,
} from "@/types/agent-builder-canvas";
import { useTransactionStore } from "@/store/transaction-store";
import { getChainConfig, getDefaultChainId } from "@/lib/chain-registry";
import { normalizeWalletAddress } from "@/lib/onboarding";
import { HSKSWAP_DEX_NAME } from "@/lib/dex/hskswap";

// Resolved once at module load from the chain registry
const _config = getChainConfig(getDefaultChainId());
const _nativeSymbol = _config.chain.nativeCurrency.symbol;
const _dexNames = _config.dexRouters.map((r) => r.name);
const _defaultDex = _dexNames[0] ?? HSKSWAP_DEX_NAME;
const _tokenSymbols = Object.keys(_config.tokens);

function normalizeTokenKey(value: string) {
  if (_config.tokens[value]) return value;
  if (value.toUpperCase() === "USDC.E") return "USDC";
  return value;
}

export class SwapNode extends BaseNode {
  readonly type = "swap";
  readonly label = "Swap";
  readonly description = `Executes a token swap on ${_dexNames.join(" or ") || HSKSWAP_DEX_NAME}`;
  readonly icon = "Repeat2";
  readonly category = "action" as const;
  readonly color = "border-green-500";
  readonly bgColor = "bg-green-950";

  readonly handles: HandleDef[] = [
    {
      id: "signal",
      label: "Execute",
      position: "left",
      type: "target",
      dataType: "signal",
    },
    {
      id: "txHash",
      label: "Tx Hash",
      position: "right",
      type: "source",
      dataType: "string",
    },
  ];

  readonly configSchema: ConfigField[] = [
    {
      key: "dex",
      label: "DEX",
      type: "select",
      options: _dexNames.length ? _dexNames : [HSKSWAP_DEX_NAME],
      default: _defaultDex,
    },
    {
      key: "tokenIn",
      label: "Token In",
      type: "select",
      // Native coin is only available on generic V2-style routers.
      options: [_nativeSymbol, ..._tokenSymbols],
      default: "USDC",
    },
    {
      key: "tokenOut",
      label: "Token Out",
      type: "select",
      options: _tokenSymbols,
      default: "WHSK",
    },
    {
      key: "amountIn",
      label: "Amount In",
      type: "number",
      default: 0.1,
    },
    {
      key: "slippage",
      label: "Slippage %",
      type: "number",
      default: 0.5,
    },
  ];

  async execute(
    inputs: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<Record<string, unknown>> {
    if (!inputs.signal) {
      context.addLog("[Swap] Skipped: no execution signal received", "warn");
      return { txHash: null };
    }
    if (!context.walletAddress) throw new Error("Wallet not connected");

    const dex = (this.config.dex as string) || _defaultDex;
    const tokenIn = normalizeTokenKey((this.config.tokenIn as string) || "USDC");
    const tokenOut = normalizeTokenKey((this.config.tokenOut as string) || "WHSK");
    const amountIn = Number(this.config.amountIn ?? this.config.amount ?? 0.1);
    const slippage = (this.config.slippage as number) || 0.5;

    if (!Number.isFinite(amountIn) || amountIn <= 0) {
      throw new Error("Swap amount must be greater than 0");
    }

    context.addLog(
      `[Swap] ${amountIn} ${tokenIn} -> ${tokenOut} on ${dex} (slippage: ${slippage}%) via agent wallet`,
    );

    // All signing happens server-side using the agent wallet private key.
    // The user's connected wallet only identifies which agent wallet to load.
    const response = await fetch("/api/agent-builder/swap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-wallet-address": context.walletAddress,
      },
      body: JSON.stringify({ dex, tokenIn, tokenOut, amountIn, slippage }),
    });

    const payload = (await response.json()) as {
      txHash?: string;
      agentAddress?: string;
      error?: string;
    };

    if (!response.ok || !payload.txHash) {
      throw new Error(payload.error ?? "Swap API returned an unexpected error");
    }

    const { txHash } = payload;
    if (payload.agentAddress) {
      context.addLog(`[Swap] Agent wallet: ${payload.agentAddress}`);
    }
    context.addLog(`[Swap] Tx submitted: ${txHash}`);
    context.addLog(`[Swap] Confirmed!`);

    if (
      context.activationId &&
      context.strategyVersionId &&
      context.walletAddress &&
      typeof fetch !== "undefined"
    ) {
      try {
        void fetch("/api/receipts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-wallet-address": normalizeWalletAddress(context.walletAddress),
          },
          body: JSON.stringify({
            activation_id: context.activationId,
            strategy_version_id: context.strategyVersionId,
            mode: "live",
            asset_pair: `${tokenIn}/${tokenOut}`,
            signal: { type: "swap", tokenIn, tokenOut, amountIn },
            execution_request: { dex, amountIn, slippage },
            execution_result: { txHash },
            status: "confirmed",
            tx_hash: txHash,
          }),
        });
      } catch {
        /* non-critical */
      }
    }

    try {
      useTransactionStore.getState().addTransaction({
        type: "SWAP",
        fromToken: tokenIn,
        toToken: tokenOut,
        fromAmount: amountIn,
        toAmount: 0,
        txHash,
        walletAddress: payload.agentAddress ?? context.walletAddress,
        timestamp: Date.now(),
        source: "agent-builder",
        dex,
      });
    } catch {
      /* non-critical */
    }

    return { txHash };
  }
}
