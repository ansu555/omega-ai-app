"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/store/agent-builder";
import { useWallet } from "@/hooks/use-wallet";
import { normalizeWalletAddress } from "@/lib/onboarding";
import type { IndicatorDraftPayload } from "@/lib/marketplace/validate-strategy";
import { PublishWizard } from "@/components/creator/publish-wizard";

const IND_KEY = "omeswap_draft_indicator_id";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: "strategy" | "indicator";
};

export function PublishModal({ open, onClose, mode }: Props) {
  const { address } = useWallet();
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const nodeInstances = useStore((s) => s.nodeInstances);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [outputNodeId, setOutputNodeId] = useState("");
  const [outputHandle, setOutputHandle] = useState("price");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const wallet = address ? normalizeWalletAddress(address) : null;

  const buildConfigs = useCallback(() => {
    const configs: Record<string, Record<string, unknown>> = {};
    nodeInstances.forEach((inst, id) => {
      configs[id] = { ...inst.config };
    });
    return configs;
  }, [nodeInstances]);

  const indicatorDraftPayload = useCallback(
    (): IndicatorDraftPayload => ({
      nodes: nodes as IndicatorDraftPayload["nodes"],
      edges: edges as IndicatorDraftPayload["edges"],
      configs: buildConfigs(),
      outputNodeId: outputNodeId.trim(),
      outputHandle: outputHandle.trim() || "out",
      inputSchema: [],
    }),
    [nodes, edges, buildConfigs, outputNodeId, outputHandle],
  );

  useEffect(() => {
    if (!open) return;
    setMsg(null);
  }, [open]);

  async function ensureIndicatorId(): Promise<string | null> {
    if (typeof window === "undefined" || !wallet) return null;
    let iid = sessionStorage.getItem(IND_KEY);
    if (iid) return iid;
    if (!name.trim()) {
      setMsg("Enter an indicator name");
      return null;
    }
    const res = await fetch("/api/creator/indicators", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-wallet-address": wallet,
      },
      body: JSON.stringify({ name: name.trim(), description }),
    });
    if (!res.ok) {
      setMsg(await res.text());
      return null;
    }
    const { id } = (await res.json()) as { id: string };
    sessionStorage.setItem(IND_KEY, id);
    return id;
  }

  async function saveDraftIndicator() {
    if (!wallet) {
      setMsg("Connect wallet");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      let iid = sessionStorage.getItem(IND_KEY);
      if (!iid) {
        if (!name.trim()) {
          setMsg("Enter name");
          setBusy(false);
          return;
        }
        const cr = await fetch("/api/creator/indicators", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-wallet-address": wallet,
          },
          body: JSON.stringify({ name: name.trim(), description }),
        });
        if (!cr.ok) {
          setMsg(await cr.text());
          return;
        }
        const { id } = (await cr.json()) as { id: string };
        sessionStorage.setItem(IND_KEY, id);
        iid = id;
      }
      const draft_payload = indicatorDraftPayload();
      const res = await fetch(`/api/creator/indicators/${iid}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": wallet,
        },
        body: JSON.stringify({ name: name.trim() || undefined, description, draft_payload }),
      });
      if (!res.ok) setMsg(await res.text());
      else setMsg("Indicator draft saved");
    } finally {
      setBusy(false);
    }
  }

  async function publishIndicator() {
    if (!wallet) {
      setMsg("Connect wallet");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const iid = await ensureIndicatorId();
      if (!iid) return;
      await fetch(`/api/creator/indicators/${iid}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": wallet,
        },
        body: JSON.stringify({
          draft_payload: indicatorDraftPayload(),
        }),
      });
      const res = await fetch(`/api/creator/indicators/${iid}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": wallet,
        },
        body: JSON.stringify({ draft_payload: indicatorDraftPayload() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(async () => ({ error: await res.text() }));
        setMsg(typeof j.error === "string" ? j.error : JSON.stringify(j));
        return;
      }
      setMsg("Indicator published");
    } finally {
      setBusy(false);
    }
  }

  // Strategy mode — delegate entirely to the 4-step PublishWizard
  if (mode === "strategy") {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg border-zinc-700 bg-zinc-950 text-zinc-100 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Publish strategy</DialogTitle>
          </DialogHeader>
          <PublishWizard onClose={onClose} />
        </DialogContent>
      </Dialog>
    );
  }

  // Indicator mode — flat form unchanged
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg border-zinc-700 bg-zinc-950 text-zinc-100 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publish indicator</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-zinc-700 bg-zinc-900"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border-zinc-700 bg-zinc-900"
            />
          </div>
          <div>
            <Label>Output node id (from canvas)</Label>
            <Input
              value={outputNodeId}
              onChange={(e) => setOutputNodeId(e.target.value)}
              placeholder="e.g. price_feed_2"
              className="border-zinc-700 bg-zinc-900"
            />
          </div>
          <div>
            <Label>Output handle key</Label>
            <Input
              value={outputHandle}
              onChange={(e) => setOutputHandle(e.target.value)}
              className="border-zinc-700 bg-zinc-900"
            />
          </div>

          {msg && (
            <p className="text-xs text-amber-200/90 whitespace-pre-wrap">{msg}</p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              disabled={busy || !wallet}
              onClick={() => void saveDraftIndicator()}
            >
              Save draft
            </Button>
            <Button
              type="button"
              disabled={busy || !wallet}
              onClick={() => void publishIndicator()}
            >
              Publish
            </Button>
          </div>
          {!wallet && (
            <p className="text-xs text-zinc-500">Connect a wallet to publish.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
