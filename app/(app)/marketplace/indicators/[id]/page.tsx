"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

export default function IndicatorDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ["indicator-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/indicators/${id}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{
        indicator: Record<string, unknown>;
        currentVersion: Record<string, unknown> | null;
        versions: unknown[];
        strategiesUsing: { strategy_id: string; name: string }[];
      }>;
    },
  });

  if (isLoading) {
    return (
      <div className="container max-w-3xl mx-auto px-4 pt-24 text-zinc-500 text-sm">
        Loading…
      </div>
    );
  }
  if (error || !data?.indicator) {
    return (
      <div className="container max-w-3xl mx-auto px-4 pt-24 text-red-400 text-sm">
        {(error as Error)?.message ?? "Not found"}
      </div>
    );
  }

  const ind = data.indicator;

  return (
    <div className="container max-w-3xl mx-auto px-4 pt-24 pb-16">
      <Link
        href="/marketplace"
        className="text-sm text-zinc-500 hover:text-zinc-300"
      >
        ← Marketplace
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-100">
        {String(ind.name)}
      </h1>
      <p className="mt-2 text-zinc-400 text-sm">{String(ind.description ?? "")}</p>
      <p className="mt-4 text-xs text-zinc-500">
        Output:{" "}
        <span className="text-zinc-300">{String(ind.output_type)}</span>
      </p>

      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
        <h2 className="text-sm font-medium text-zinc-300">Used in strategies</h2>
        <ul className="mt-2 text-sm text-zinc-400 space-y-1">
          {data.strategiesUsing.length === 0 && <li>None yet</li>}
          {data.strategiesUsing.map((s) => (
            <li key={s.strategy_id}>
              <Link
                href={`/marketplace/strategies/${s.strategy_id}`}
                className="text-cyan-400 hover:underline"
              >
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <Link
          href="/agent-builder"
          className="text-sm text-cyan-400 hover:underline"
        >
          Open Agent builder → add from palette under Marketplace indicators
        </Link>
      </div>
    </div>
  );
}
