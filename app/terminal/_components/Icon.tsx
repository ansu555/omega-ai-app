"use client";

import { useState } from "react";
import Image from "next/image";

const TOKEN_LOGOS: Record<string, string> = {
  WHSK: "https://coin-images.coingecko.com/coins/images/29779/small/HSKlogo.jpg?1719445510",
  HSK: "https://coin-images.coingecko.com/coins/images/29779/small/HSKlogo.jpg?1719445510",
  WETH: "https://cryptologos.cc/logos/ethereum-eth-logo.png?v=035",
  ETH: "https://cryptologos.cc/logos/ethereum-eth-logo.png?v=035",
  USDC: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=035",
  USDT: "https://cryptologos.cc/logos/tether-usdt-logo.png?v=035",
  WBTC: "https://cryptologos.cc/logos/wrapped-bitcoin-wbtc-logo.png?v=035",
  BTC: "https://cryptologos.cc/logos/bitcoin-btc-logo.png?v=035",
  UNI: "https://cryptologos.cc/logos/uniswap-uni-logo.png?v=035",
  LINK: "https://cryptologos.cc/logos/chainlink-link-logo.png?v=035",
  AAVE: "https://cryptologos.cc/logos/aave-aave-logo.png?v=035",
  ARB: "https://cryptologos.cc/logos/arbitrum-arb-logo.png?v=035",
  OP: "https://cryptologos.cc/logos/optimism-ethereum-op-logo.png?v=035",
  AVAX: "https://cryptologos.cc/logos/avalanche-avax-logo.png?v=035",
  PEPE: "https://cryptologos.cc/logos/pepe-pepe-logo.png?v=035",
};

function symbolToLetter(symbol: string) {
  return symbol.replace(/^W/, "")[0] ?? symbol[0];
}

export function TokenIcon({
  symbol,
  color,
  size = 24,
}: {
  symbol: string;
  color: string;
  size?: number;
}) {
  const [errored, setErrored] = useState(false);
  const src = TOKEN_LOGOS[symbol.toUpperCase()];

  if (!src || errored) {
    return (
      <div
        className={`${color} rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0`}
        style={{ height: size, width: size }}
      >
        {symbolToLetter(symbol)}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={symbol}
      width={size}
      height={size}
      className="rounded-full shrink-0 bg-white object-contain p-[1px]"
      onError={() => setErrored(true)}
    />
  );
}
