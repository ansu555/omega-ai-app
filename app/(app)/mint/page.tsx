import { MintTokensCard } from "@/components/trade/MintTokensCard";

export const metadata = {
  title: "Mint Test Tokens | OmEswap",
  description: "Mint free test tokens to try out OmEswap on HashKey Chain Testnet.",
};

export default function MintPage() {
  return (
    <div className="min-h-screen bg-transparent relative z-10">
      <main className="container mx-auto px-4 py-8 pt-28">
        <div className="max-w-2xl mx-auto space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">Mint Test Tokens</h1>
            <p className="text-sm text-muted-foreground">
              Get free testnet tokens to try the DEX on HashKey Chain Testnet
            </p>
          </div>
          <MintTokensCard />
        </div>
      </main>
    </div>
  );
}
