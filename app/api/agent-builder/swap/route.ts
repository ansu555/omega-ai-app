/**
 * POST /api/agent-builder/swap
 *
 * Executes a token swap using the caller's server-managed agent wallet.
 * The agent wallet private key is decrypted on the server and never sent
 * to the client.
 *
 * Body: { dex, tokenIn, tokenOut, amountIn, slippage? }
 * Auth: x-wallet-address header (user's connected wallet, identifies agent wallet)
 *
 * Dispatch is driven by the chain registry:
 *   - `custom`     router (e.g. HSKSwap) → viem `exactInputSingle` adapter
 *   - `uniswapV2`  router                   → ethers `swapExactTokensForTokens`
 */

import { type NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { parseUnits as viemParseUnits } from "viem";

import { requireWallet } from "@/lib/marketplace/wallet-header";
import { getOrCreateAgentWallet } from "@/lib/agent-wallet/manager";
import { getChainConfig, getDefaultChainId } from "@/lib/chain-registry";
import { executeHSKSwapAgentSwap } from "@/lib/dex/hskswap";

// ── ABIs (UniswapV2-compatible generic path) ──────────────────────────────────

const ROUTER_ABI = [
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTokenAmount(value: bigint, decimals: number) {
  const [whole, fraction = ""] = ethers.formatUnits(value, decimals).split(".");
  const trimmed = fraction.replace(/0+$/, "").slice(0, 6);
  return trimmed ? `${whole}.${trimmed}` : whole;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const userWallet = requireWallet(req);
  if (userWallet instanceof Response) return userWallet;

  let body: { dex?: string; tokenIn?: string; tokenOut?: string; amountIn?: number; slippage?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const amountIn = Number(body.amountIn ?? 0);
  const slippage = Number(body.slippage ?? 0.5);

  if (!Number.isFinite(amountIn) || amountIn <= 0) {
    return NextResponse.json({ error: "amountIn must be > 0" }, { status: 400 });
  }

  try {
    const chainId = getDefaultChainId();
    const chainConfig = getChainConfig(chainId);

    // Resolve the requested router (by id or name), falling back to the chain's
    // first configured DEX.
    const routerEntry =
      chainConfig.dexRouters.find(
        (r) => r.id === body.dex || r.name === body.dex,
      ) ?? chainConfig.dexRouters[0];

    if (!routerEntry) {
      return NextResponse.json(
        { error: `No DEX router configured for chain ${chainId}` },
        { status: 400 },
      );
    }

    const nativeSymbol = chainConfig.chain.nativeCurrency.symbol;
    const tokenInKey = body.tokenIn ?? Object.keys(chainConfig.tokens)[0];
    const tokenOutKey = body.tokenOut ?? Object.keys(chainConfig.tokens)[1];

    const outToken = chainConfig.tokens[tokenOutKey];
    if (!outToken) {
      return NextResponse.json({ error: `Unknown tokenOut: ${tokenOutKey}` }, { status: 400 });
    }

    const { account, address: agentAddress, privateKey } = await getOrCreateAgentWallet(
      userWallet,
      chainId,
    );

    // ── Custom V3 router (HSKSwap) — viem exactInputSingle adapter ──────────
    if (routerEntry.type === "custom") {
      const inToken = chainConfig.tokens[tokenInKey];
      if (!inToken) {
        return NextResponse.json({ error: `Unknown tokenIn: ${tokenInKey}` }, { status: 400 });
      }
      if (tokenInKey === nativeSymbol) {
        return NextResponse.json(
          {
            error: `Native ${nativeSymbol} is not directly swappable on ${routerEntry.name}. Wrap to ${chainConfig.tokens[Object.keys(chainConfig.tokens)[0]]?.symbol ?? "the wrapped token"} first.`,
          },
          { status: 400 },
        );
      }

      const result = await executeHSKSwapAgentSwap({
        account,
        chain: chainConfig.chain,
        rpcUrl: chainConfig.chain.rpcUrls.default.http[0],
        tokenIn: { address: inToken.address, symbol: inToken.symbol, decimals: inToken.decimals },
        tokenOut: { address: outToken.address, symbol: outToken.symbol, decimals: outToken.decimals },
        amountIn: viemParseUnits(amountIn.toString(), inToken.decimals),
        slippageBps: Math.max(0, Math.floor(slippage * 100)),
        swapRouter: routerEntry.routerAddress,
        quoter: routerEntry.quoterAddress,
      });

      return NextResponse.json({ txHash: result.txHash, agentAddress });
    }

    // ── Generic UniswapV2 router path (ethers) ────────────────────────────────
    const rpcUrl = chainConfig.chain.rpcUrls.default.http[0];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    const slippageBps = BigInt(Math.floor((1 - slippage / 100) * 10000));
    const router = new ethers.Contract(routerEntry.routerAddress, ROUTER_ABI, signer);

    let txHash: string;

    if (tokenInKey === nativeSymbol) {
      const amountInWei = ethers.parseEther(amountIn.toString());
      const path = [chainConfig.nativeWrapped, outToken.address];
      const amounts = await router.getAmountsOut(amountInWei, path);
      const amountOutMin = (amounts[1] * slippageBps) / BigInt(10000);
      const tx = await router.swapExactETHForTokens(amountOutMin, path, agentAddress, deadline, {
        value: amountInWei,
      });
      await tx.wait();
      txHash = tx.hash;
    } else {
      const inToken = chainConfig.tokens[tokenInKey];
      if (!inToken) {
        return NextResponse.json({ error: `Unknown tokenIn: ${tokenInKey}` }, { status: 400 });
      }
      const amountInWei = ethers.parseUnits(amountIn.toString(), inToken.decimals);
      const path = [inToken.address, outToken.address];
      const amounts = await router.getAmountsOut(amountInWei, path);
      const amountOutMin = (amounts[1] * slippageBps) / BigInt(10000);

      const tokenContract = new ethers.Contract(inToken.address, ERC20_ABI, signer);
      const [balance, allowance] = await Promise.all([
        tokenContract.balanceOf(agentAddress) as Promise<bigint>,
        tokenContract.allowance(agentAddress, routerEntry.routerAddress) as Promise<bigint>,
      ]);
      if (balance < amountInWei) {
        return NextResponse.json(
          {
            error: `Agent wallet has insufficient ${inToken.symbol}: need ${amountIn}, have ${formatTokenAmount(balance, inToken.decimals)}`,
          },
          { status: 400 },
        );
      }
      if (allowance < amountInWei) {
        const approveTx = await tokenContract.approve(routerEntry.routerAddress, ethers.MaxUint256);
        await approveTx.wait();
      }
      const tx = await router.swapExactTokensForTokens(
        amountInWei,
        amountOutMin,
        path,
        agentAddress,
        deadline,
      );
      await tx.wait();
      txHash = tx.hash;
    }

    return NextResponse.json({ txHash, agentAddress });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
