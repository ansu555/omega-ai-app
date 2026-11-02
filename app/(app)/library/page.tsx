"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useWallet } from "@/hooks/use-wallet";
import { normalizeWalletAddress } from "@/lib/onboarding";
import { Button } from "@/components/ui/button";

export default function LibraryPage() {
  const { address } = useWallet();
  const wallet = address ? normalizeWalletAddress(address) : null;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["library-activations", wallet],
    enabled: !!wallet,
    queryFn: async () => {
      const res = await fetch("/api/activations", {
        headers: { "x-wallet-address": wallet! },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{
        activations: {
          id: string;
          status: string;
          mode: string;
          strategy_id: string;
          strategy_version_id: string;
          strategy: { name: string } | null;
        }[];
      }>;
    },
  });

  if (!wallet) {
    return (
      <div className="container max-w-3xl mx-auto px-4 pt-24 text-zinc-400 text-sm">
        Connect your wallet to view activations.
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto px-4 pt-24 pb-16">
      <h1 className="text-2xl font-semibold text-zinc-100">My Library</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Active marketplace activations. Use Agent builder to run flows; session
        keys link swaps to receipts.
      </p>

      {isLoading && <p className="mt-6 text-zinc-500 text-sm">Loading…</p>}
      {error && (
        <p className="mt-6 text-red-400 text-sm">{(error as Error).message}</p>
      )}

      <ul className="mt-6 space-y-3">
        {(data?.activations ?? []).map((a) => (
          <li
            key={a.id}
            className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 flex flex-wrap items-center justify-between gap-2"
          >
            <div>
              <p className="font-medium text-zinc-200">
                {a.strategy?.name ?? "Strategy"}
              </p>
              <p className="text-xs text-zinc-500">
                {a.mode} · {a.status}
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link href={`/marketplace/strategies/${a.strategy_id}`}>
                  View
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-zinc-600"
                onClick={() => {
                  sessionStorage.setItem("omeswap_activation_id", a.id);
                  sessionStorage.setItem(
                    "omeswap_strategy_version_id",
                    a.strategy_version_id,
                  );
                  void refetch();
                }}
              >
                Use in session
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await fetch(`/api/activations/${a.id}/pause`, {
                    method: "POST",
                    headers: { "x-wallet-address": wallet },
                  });
                  void refetch();
                }}
              >
                Pause
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {(data?.activations?.length ?? 0) === 0 && !isLoading && (
        <p className="mt-8 text-zinc-500 text-sm">
          No activations yet. Activate a strategy from the marketplace.
        </p>
      )}

      <div className="mt-10">
        <Button asChild variant="outline" className="border-zinc-600">
          <Link href="/agent-builder">Open Agent builder</Link>
        </Button>
      </div>
    </div>
  );
}
