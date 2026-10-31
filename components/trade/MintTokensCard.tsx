"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Coins, ExternalLink, RefreshCw } from "lucide-react";
import { useBatchMint, useTokenMint, MINTABLE_TOKENS } from "@/hooks/use-token-mint";
import { useWallet } from "@/hooks/use-wallet";
import { TOKENS } from "@/contracts/config";
import WalletConnect from "@/components/features/wallet/wallet-connect";
import { getChainConfig, getDefaultChainId, getExplorerLink } from "@/lib/chain-registry";

const CHAIN_NAME = getChainConfig(getDefaultChainId()).chain.name;

const TOKEN_LOGOS: Record<string, string> = {
  WHSK: "https://coin-images.coingecko.com/coins/images/29779/small/HSKlogo.jpg?1719445510",
  HSK: "https://coin-images.coingecko.com/coins/images/29779/small/HSKlogo.jpg?1719445510",
  USDC: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
  USDT: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png",
  WETH: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27ead9083C756Cc2/logo.png",
  ETH: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27ead9083C756Cc2/logo.png",
  OmE: "/logo.png",
  USDO: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png",
};

function TokenIcon({ symbol, className = "w-8 h-8" }: { symbol: string; className?: string }) {
  const [error, setError] = useState(false);
  const logoUrl = TOKEN_LOGOS[symbol];

  if (logoUrl && !error) {
    return (
      <img
        src={logoUrl}
        alt={symbol}
        className={`${className} rounded-full object-cover shrink-0 bg-transparent`}
        onError={() => setError(true)}
      />
    );
  }

  return (
    <div className={`${className} rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20`}>
      {symbol.charAt(0)}
    </div>
  );
}

interface TokenMintRowProps {
  tokenSymbol: string;
  chainId: number;
  isMinting: boolean;
  lastMintedHash?: string;
  setMinting: Dispatch<SetStateAction<Record<string, boolean>>>;
  setLastMinted: Dispatch<SetStateAction<Record<string, string>>>;
}

function TokenMintRow({
  tokenSymbol,
  chainId,
  isMinting,
  lastMintedHash,
  setMinting,
  setLastMinted,
}: TokenMintRowProps) {
  const { balance, mint, isLoading, isSuccess, refetchBalance } =
    useTokenMint(tokenSymbol);
  const token = TOKENS[tokenSymbol];
  if (!token) return null;

  const handleMint = async (amount: string) => {
    setMinting((current) => ({ ...current, [tokenSymbol]: true }));
    const txHash = await mint(amount);
    await refetchBalance();
    setLastMinted((current) => ({ ...current, [tokenSymbol]: txHash || "" }));
    setMinting((current) => ({ ...current, [tokenSymbol]: false }));
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/20 hover:bg-secondary/30 transition-colors">
      <div className="flex items-center gap-3">
        <TokenIcon symbol={token.symbol} className="w-10 h-10" />
        <div>
          <div className="font-semibold">{token.symbol}</div>
          <div className="text-xs text-muted-foreground">
            Balance: {parseFloat(balance).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isSuccess && lastMintedHash && (
          <a
            href={getExplorerLink(chainId, "tx", lastMintedHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-success hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <button
          onClick={() => handleMint("1000")}
          disabled={isLoading || isMinting}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading || isMinting ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            "Mint 1,000"
          )}
        </button>
        <button
          onClick={() => handleMint("10000")}
          disabled={isLoading || isMinting}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading || isMinting ? "..." : "10K"}
        </button>
      </div>
    </div>
  );
}

export function MintTokensCard() {
  const { isConnected, chain } = useWallet();
  const [minting, setMinting] = useState<Record<string, boolean>>({});
  const [lastMinted, setLastMinted] = useState<Record<string, string>>({});
  const { mintAll, isLoading: isBatchMinting } = useBatchMint();
  const chainId = chain?.id ?? getDefaultChainId();

  if (!isConnected) {
    return (
      <div className="swap-card w-full max-w-2xl p-8 text-center">
        <Coins className="w-12 h-12 mx-auto mb-4 text-primary" />
        <h3 className="text-xl font-semibold mb-4">Mint Test Tokens</h3>
        <p className="text-muted-foreground mb-6">
          Connect your wallet to mint test tokens for the DEX
        </p>
        <WalletConnect variant="default" />
      </div>
    );
  }

  if (chain?.id !== getDefaultChainId()) {
    return (
      <div className="swap-card w-full max-w-2xl p-8 text-center">
        <h3 className="text-xl font-semibold mb-4 text-destructive">
          Wrong Network
        </h3>
        <p className="text-muted-foreground">Please switch to {CHAIN_NAME}</p>
      </div>
    );
  }

  return (
    <div className="swap-card w-full p-1">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Coins className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">Mint Test Tokens</h3>
            <p className="text-sm text-muted-foreground">
              Get free test tokens to try out the DEX
            </p>
          </div>
        </div>

        <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <div className="flex gap-2">
            <div className="text-blue-500 text-2xl">ℹ️</div>
            <div className="text-sm text-blue-500">
              <strong>Test Tokens Only:</strong> These tokens have no real value
              and are only for testing purposes on {CHAIN_NAME}. You can
              mint as many as you need!
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {MINTABLE_TOKENS.map((key) => (
            <TokenMintRow
              key={key}
              tokenSymbol={key}
              chainId={chainId}
              isMinting={!!minting[key]}
              lastMintedHash={lastMinted[key]}
              setMinting={setMinting}
              setLastMinted={setLastMinted}
            />
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted/30 rounded-xl">
          <h4 className="font-semibold mb-2 text-sm">Quick Start Guide:</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Mint some test tokens (at least 2 different types)</li>
            <li>Go to "Add Liquidity" to create or join a pool</li>
            <li>Use the "Swap" tab to trade tokens</li>
            <li>Check your positions and earned fees</li>
          </ol>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => mintAll("1000")}
            disabled={isBatchMinting}
            className="flex-1 py-3 px-4 rounded-xl font-medium bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {isBatchMinting ? "Minting..." : "🚀 Mint All Tokens (1K each)"}
          </button>
        </div>
      </div>
    </div>
  );
}
