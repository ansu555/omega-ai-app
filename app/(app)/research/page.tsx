"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import dynamic_import from "next/dynamic";
import ResearchChat from "@/components/research/ResearchChat";
import { useResearchStore } from "@/store/research";
import { useChatContext } from "@/components/providers/chat-provider";
import { Loader2, Settings, Sparkles } from "lucide-react";
import Link from "next/link";

// ── Lazy-load the graph canvas (uses @xyflow/react which is heavy) ─────────────
const AgentGraphCanvas = dynamic_import(
  () => import("@/components/research/AgentGraphCanvas"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-[28px] border border-white/10 bg-[#080910]/90">
        <Loader2 size={20} className="animate-spin text-violet-200" />
      </div>
    ),
  },
);

// ── Settings gate ─────────────────────────────────────────────────────────────

interface UserSettings {
  model: string | null;
  mode: "autonomous" | "assisted" | "solo" | null;
  hasApiKey: boolean;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ResearchPage() {
  const { address } = useAccount();
  const setMode = useResearchStore((s) => s.setMode);
  const { closeChat } = useChatContext();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    closeChat();
  }, [closeChat]);

  // Load user settings and apply mode to the store
  useEffect(() => {
    if (!address) {
      setSettingsLoading(false);
      return;
    }

    fetch("/api/user-settings", {
      headers: { "x-wallet-address": address },
    })
      .then((r) => r.json())
      .then((data: UserSettings) => {
        setSettings(data);
        if (data.mode) setMode(data.mode);
      })
      .catch(() => setSettings({ model: null, mode: null, hasApiKey: false }))
      .finally(() => setSettingsLoading(false));
  }, [address, setMode]);

  // ── Not connected ───────────────────────────────────────────────────────────
  if (!address) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 pt-20">
        <div
          className="max-w-sm rounded-[28px] px-10 py-12 text-center shadow-2xl shadow-black/40"
          style={{
            background: "linear-gradient(180deg, rgba(17,17,29,0.98), rgba(8,9,16,0.98))",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div
            className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              background: "rgba(139,92,246,0.14)",
              border: "1px solid rgba(139,92,246,0.22)",
            }}
          >
            <Sparkles className="h-5 w-5 text-violet-100" />
          </div>
          <h2 className="text-base font-semibold text-white mb-2">
            Connect Your Wallet
          </h2>
          <p className="text-[11px] text-white/40">
            Connect a wallet to access the ATS research co-pilot.
          </p>
        </div>
      </div>
    );
  }

  // ── Loading settings ────────────────────────────────────────────────────────
  if (settingsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-20">
        <Loader2 size={24} className="animate-spin text-violet-200" />
      </div>
    );
  }

  // ── Missing API key / model — redirect banner ────────────────────────────────
  const missingConfig = Boolean(
    settings && (!settings.hasApiKey || !settings.model),
  );

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-y-auto px-3 pb-3 pt-[72px] sm:px-4 sm:pb-4 lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 24% 18%, rgba(139,92,246,0.13), transparent 30%), radial-gradient(circle at 78% 4%, rgba(45,212,191,0.08), transparent 26%), linear-gradient(135deg, rgba(5,7,13,0.98), rgba(10,10,18,0.98))",
      }}
    >
      {/* Missing-settings banner */}
      {missingConfig && (
        <div
          className="mb-3 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-[12px] shadow-lg shadow-black/20"
          style={{
            background: "rgba(234,179,8,0.10)",
            border: "1px solid rgba(234,179,8,0.22)",
          }}
        >
          <div className="flex items-center gap-2 text-amber-300">
            <Settings size={14} />
            <span>
              Set your OpenRouter API key and model in Portfolio Settings to
              enable full ATS reasoning.
            </span>
          </div>
          <Link
            href="/portfolio"
            className="shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-medium text-amber-200 transition-colors hover:text-white"
            style={{ background: "rgba(234,179,8,0.15)" }}
          >
            Go to Settings
          </Link>
        </div>
      )}

      <div className="grid flex-1 gap-3 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
        <section className="min-h-[520px] overflow-hidden rounded-[28px] border border-white/10 bg-[#07080f]/95 shadow-2xl shadow-black/[0.35] lg:min-h-0">
          <AgentGraphCanvas />
        </section>

        <section className="min-h-[620px] overflow-hidden rounded-[28px] border border-white/10 bg-[#0d0d17]/[0.98] shadow-2xl shadow-black/[0.35] lg:min-h-0">
          <ResearchChat />
        </section>
      </div>
    </div>
  );
}
