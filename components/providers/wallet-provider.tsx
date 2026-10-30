"use client";

import { useState, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createStorage, cookieStorage, http } from "wagmi";
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { getSupportedChains } from "@/lib/chain-registry";
import { mainnet } from "viem/chains";
import type { Chain } from "viem/chains";
import "@rainbow-me/rainbowkit/styles.css";

interface WalletProviderProps {
  children: ReactNode;
  initialState?: any;
}

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const hasWalletConnectProjectId =
  !!walletConnectProjectId && walletConnectProjectId !== "YOUR_PROJECT_ID";

export function WalletProvider({
  children,
  initialState,
}: WalletProviderProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [config] = useState(() => {
    // Trading chains come from the registry. Ethereum is added for the
    // canonical bridge only — deposits to HashKey Chain are L1 transactions, so
    // the wallet must be able to sit on mainnet. It is deliberately NOT in the
    // chain registry, which would advertise it as a venue the DEX can route on.
    const tradingChains = getSupportedChains().map((c) => c.chain);
    const supportedChains = [
      ...tradingChains,
      ...(tradingChains.some((c) => c.id === mainnet.id) ? [] : [mainnet as Chain]),
    ] as [Chain, ...Chain[]];
    // viem's bundled Ethereum endpoint is a shared public node and rate-limits
    // quickly under the bridge's balance/allowance polling, so allow an override.
    const ethereumRpc = process.env.NEXT_PUBLIC_ETHEREUM_RPC?.trim();
    const transports = Object.fromEntries(
      supportedChains.map((chain) => [
        chain.id,
        http(
          chain.id === mainnet.id && ethereumRpc
            ? ethereumRpc
            : chain.rpcUrls.default.http[0],
        ),
      ]),
    );
    return getDefaultConfig({
      appName: "Omega",
      projectId: walletConnectProjectId || "walletconnect-disabled",
      chains: supportedChains,
      transports,
      wallets: [
        {
          groupName: "Recommended",
          wallets: hasWalletConnectProjectId
            ? [metaMaskWallet, coinbaseWallet, walletConnectWallet]
            : [injectedWallet, metaMaskWallet, coinbaseWallet],
        },
      ],
      storage: createStorage({
        storage: cookieStorage,
      }),
    });
  });

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
