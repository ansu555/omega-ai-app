"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/hooks/use-wallet";
import { normalizeWalletAddress } from "@/lib/onboarding";
import { Button } from "@/components/ui/button";

export default function AdminPage() {
  const { address } = useWallet();
  const wallet = address ? normalizeWalletAddress(address) : null;
  const qc = useQueryClient();

  const strategiesQ = useQuery({
    queryKey: ["admin-strategies", wallet],
    enabled: !!wallet,
    queryFn: async () => {
      const res = await fetch("/api/admin/strategies", {
        headers: { "x-wallet-address": wallet! },
      });
      if (res.status === 403) throw new Error("Not an admin wallet");
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{
        strategies: {
          id: string;
          name: string;
          status: string;
          creator_wallet: string;
        }[];
      }>;
    },
  });

  const reportsQ = useQuery({
    queryKey: ["admin-reports", wallet],
    enabled: !!wallet,
    queryFn: async () => {
      const res = await fetch("/api/admin/reports", {
        headers: { "x-wallet-address": wallet! },
      });
      if (res.status === 403) throw new Error("Not an admin wallet");
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{
        reports: { id: string; reason: string; target_id: string }[];
      }>;
    },
  });

  const pause = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/strategies/${id}/pause`, {
        method: "POST",
        headers: { "x-wallet-address": wallet! },
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-strategies"] }),
  });

  const delist = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/strategies/${id}/delist`, {
        method: "POST",
        headers: { "x-wallet-address": wallet! },
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-strategies"] }),
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/strategies/${id}/approve`, {
        method: "POST",
        headers: { "x-wallet-address": wallet! },
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-strategies"] }),
  });

  const resolveReport = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/reports/${id}/resolve`, {
        method: "POST",
        headers: { "x-wallet-address": wallet! },
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-reports"] }),
  });

  if (!wallet) {
    return (
      <div className="container max-w-4xl mx-auto px-4 pt-24 text-zinc-400 text-sm">
        Connect wallet (admin allowlist).
      </div>
    );
  }

  const err =
    (strategiesQ.error as Error)?.message ??
    (reportsQ.error as Error)?.message;

  return (
    <div className="container max-w-4xl mx-auto px-4 pt-24 pb-16">
      <h1 className="text-2xl font-semibold text-zinc-100">Admin</h1>
      {err && (
        <p className="mt-4 text-amber-400/90 text-sm">{err}</p>
      )}

      <div className="mt-8 grid gap-10 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-medium text-zinc-400 uppercase">Strategies</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(strategiesQ.data?.strategies ?? []).map((s) => (
              <li
                key={s.id}
                className="border border-zinc-800 rounded-lg p-3 space-y-2"
              >
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-200">{s.name}</span>
                  <span className="text-zinc-500 text-xs capitalize">{s.status}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={pause.isPending}
                    onClick={() => void pause.mutate(s.id)}
                  >
                    Pause
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={delist.isPending}
                    onClick={() => void delist.mutate(s.id)}
                  >
                    Delist
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs"
                    disabled={approve.isPending}
                    onClick={() => void approve.mutate(s.id)}
                  >
                    Live eligible
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-medium text-zinc-400 uppercase">Open reports</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(reportsQ.data?.reports ?? []).map((r) => (
              <li
                key={r.id}
                className="border border-zinc-800 rounded-lg p-3 flex justify-between gap-2"
              >
                <span className="text-zinc-400">{r.reason}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs shrink-0"
                  onClick={() => void resolveReport.mutate(r.id)}
                >
                  Resolve
                </Button>
              </li>
            ))}
            {(reportsQ.data?.reports?.length ?? 0) === 0 && (
              <li className="text-zinc-600">No open reports</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
