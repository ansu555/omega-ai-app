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

export type MarketplaceIndicatorRow = {
  id: string;
  name: string;
  description: string | null;
  output_type: string;
  creator_wallet: string;
  used_in_strategy_count?: number;
};

function shortAddr(a: string) {
  if (!a || a.length < 10) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function IndicatorCard({ i }: { i: MarketplaceIndicatorRow }) {
  return (
    <Card className="border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-lg text-zinc-100">{i.name}</CardTitle>
          <Badge variant="outline" className="capitalize border-zinc-600">
            {i.output_type}
          </Badge>
        </div>
        <CardDescription className="line-clamp-2 text-zinc-400">
          {i.description || "—"}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-zinc-400">
        <div className="text-xs">
          Creator <span className="text-zinc-300">{shortAddr(i.creator_wallet)}</span>
        </div>
        <div className="mt-1 text-xs">
          Used in{" "}
          <span className="text-zinc-300">
            {i.used_in_strategy_count ?? 0}
          </span>{" "}
          strategies
        </div>
      </CardContent>
      <CardFooter>
        <Button asChild size="sm" variant="secondary">
          <Link href={`/marketplace/indicators/${i.id}`}>View</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
