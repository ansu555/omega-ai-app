"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type MarketplaceStrategyRow = {
  id: string;
  name: string;
  description: string | null;
  risk_level: string;
  status: string;
  creator_wallet: string;
  asset_pairs: unknown;
  tags: unknown;
  activation_count?: number;
  paper_pnl?: number;
  live_pnl?: number;
};

function shortAddr(a: string) {
  if (!a || a.length < 10) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function StrategyCard({ s }: { s: MarketplaceStrategyRow }) {
  const pairs = (s.asset_pairs as string[]) ?? [];
  const livePnl = s.live_pnl ?? 0;

  return (
    <Card className="border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-lg text-zinc-100">{s.name}</CardTitle>
          <Badge variant="outline" className="capitalize border-zinc-600">
            {s.status.replace("_", " ")}
          </Badge>
        </div>
        <CardDescription className="line-clamp-2 text-zinc-400">
          {s.description || "—"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-zinc-400">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="capitalize">
            Risk: {s.risk_level}
          </Badge>
          {pairs.slice(0, 3).map((p) => (
            <Badge key={p} variant="outline" className="text-xs">
              {p}
            </Badge>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
          <div>
            Creator <span className="text-zinc-300">{shortAddr(s.creator_wallet)}</span>
          </div>
          <div>
            Activations{" "}
            <span className="text-zinc-300">{s.activation_count ?? 0}</span>
          </div>
          <div>
            Live PnL{" "}
            <span className="text-zinc-300">
              {livePnl === 0 ? "—" : livePnl.toFixed(4)}
            </span>
          </div>
          <div>
            Paper <span className="text-amber-400/80">Coming soon</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button asChild size="sm" variant="secondary">
          <Link href={`/marketplace/strategies/${s.id}`}>View</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="border-zinc-600">
          <Link href={`/marketplace/strategies/${s.id}#activate`}>Activate</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
