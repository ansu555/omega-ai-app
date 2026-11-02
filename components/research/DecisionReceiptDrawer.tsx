"use client";

import type { ReactNode } from "react";
import { ExternalLink, FileText, X } from "lucide-react";
import clsx from "clsx";
import { useResearchStore } from "@/store/research";
import type { DecisionReceipt, ResearchBrief } from "@/lib/ats/types";

function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const classes =
    tone === "good"
      ? "bg-emerald-500/15 text-emerald-100"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-100"
        : tone === "bad"
          ? "bg-rose-500/15 text-rose-100"
          : "bg-white/8 text-white/70";

  return (
    <span className={clsx("rounded-full px-2 py-1 text-[9px] font-medium", classes)}>
      {children}
    </span>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/28">
        {title}
      </p>
      {children}
    </section>
  );
}

function fallbackBrief(receipt: DecisionReceipt): ResearchBrief {
  return {
    verdict: receipt.consensus.decision,
    worth_it:
      receipt.consensus.decision === "BUY"
        ? "yes"
        : receipt.consensus.decision === "SELL" || receipt.consensus.decision === "VETO"
          ? "no"
          : "watch",
    headline: `${receipt.ticker} research brief`,
    summary: receipt.consensus.rationale,
    conviction_label:
      receipt.consensus.confidence >= 0.78
        ? "high"
        : receipt.consensus.confidence >= 0.56
          ? "medium"
          : "low",
    confidence: receipt.consensus.confidence,
    suggested_allocation_usd: receipt.risk_sizing.size_usd,
    max_loss_usd: receipt.risk_sizing.max_loss_usd,
    allocation_note: receipt.risk_sizing.veto_reason ?? "No detailed allocation note persisted for this run.",
    thesis: [receipt.consensus.rationale],
    counter_points: receipt.risk_sizing.veto_reason ? [receipt.risk_sizing.veto_reason] : [],
    risk_flags: receipt.risk_sizing.veto_reason
      ? [receipt.risk_sizing.veto_reason]
      : [`Modeled max loss: $${receipt.risk_sizing.max_loss_usd.toFixed(2)}`],
    execution: {
      mode: "solo",
      status: "not_applicable",
      summary: "Execution detail is unavailable for this receipt snapshot.",
      chain_id: receipt.chain_id,
      tx_hash: receipt.tx_hash,
    },
    agent_findings: receipt.agent_votes.map((vote) => ({
      agent: vote.agent,
      label: vote.agent,
      summary: vote.rationale,
      vote: vote.vote,
      confidence: vote.confidence,
    })),
    evidence: [],
  };
}

export default function DecisionReceiptDrawer() {
  const receiptOpen = useResearchStore((state) => state.receiptOpen);
  const setReceiptOpen = useResearchStore((state) => state.setReceiptOpen);
  const receipt = useResearchStore((state) => state.currentReceipt);

  if (!receiptOpen || !receipt) return null;

  const brief = receipt.research_brief ?? fallbackBrief(receipt);
  const decisionDate = receipt.created_at
    ? new Date(receipt.created_at).toLocaleString()
    : new Date().toLocaleString();

  return (
    <div className="absolute inset-0 z-30">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={() => setReceiptOpen(false)}
      />

      <div
        className="absolute inset-y-0 right-0 flex w-full max-w-[480px] flex-col overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(18,17,28,0.98), rgba(10,10,19,0.98))",
          borderLeft: "1px solid rgba(139,92,246,0.14)",
        }}
      >
        <div
          className="flex items-start justify-between gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <div className="flex items-center gap-2">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{
                  background: "rgba(139,92,246,0.14)",
                  border: "1px solid rgba(139,92,246,0.18)",
                }}
              >
                <FileText className="h-4.5 w-4.5 text-violet-100" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-white/92">
                  Research Brief
                </p>
                <p className="text-[10px] text-white/30">
                  {receipt.run_id} · {decisionDate}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge
                tone={
                  brief.worth_it === "yes"
                    ? "good"
                    : brief.worth_it === "no"
                      ? "bad"
                      : "warn"
                }
              >
                {brief.worth_it === "yes"
                  ? "Worth it"
                  : brief.worth_it === "no"
                    ? "Avoid"
                    : "Watch"}
              </Badge>
              <Badge>{brief.verdict}</Badge>
              <Badge>{Math.round(brief.confidence * 100)}% confidence</Badge>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setReceiptOpen(false)}
            className="rounded-xl p-2 text-white/45 transition-colors hover:text-white"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <Section title="Overview">
            <div
              className="rounded-[24px] p-4"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <h3 className="text-[16px] font-medium text-white/94">
                {brief.headline}
              </h3>
              <p className="mt-3 text-[12px] leading-relaxed text-white/60">
                {brief.summary}
              </p>
            </div>
          </Section>

          <Section title="Sizing">
            <div className="grid grid-cols-2 gap-2.5">
              <div
                className="rounded-[20px] px-3 py-3"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p className="text-[9px] uppercase tracking-[0.18em] text-white/24">
                  Suggested Allocation
                </p>
                <p className="mt-2 text-[14px] font-medium text-white/90">
                  ${brief.suggested_allocation_usd.toFixed(2)}
                </p>
              </div>
              <div
                className="rounded-[20px] px-3 py-3"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p className="text-[9px] uppercase tracking-[0.18em] text-white/24">
                  Max Loss
                </p>
                <p className="mt-2 text-[14px] font-medium text-white/90">
                  ${brief.max_loss_usd.toFixed(2)}
                </p>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-white/54">
              {brief.allocation_note}
            </p>
          </Section>

          <Section title="Why It Got This Verdict">
            <div className="space-y-2">
              {brief.thesis.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl px-3 py-3 text-[11px] leading-relaxed text-white/62"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Counter Risks">
            <div className="space-y-2">
              {brief.counter_points.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl px-3 py-3 text-[11px] leading-relaxed text-white/58"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Agent Findings">
            <div className="space-y-2.5">
              {brief.agent_findings.map((finding) => (
                <div
                  key={`${finding.agent}-${finding.label}`}
                  className="rounded-[20px] p-3"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium text-white/88">
                        {finding.label}
                      </p>
                      <p className="text-[9px] uppercase tracking-[0.18em] text-white/24">
                        {finding.agent}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {finding.vote && <Badge>{finding.vote}</Badge>}
                      {finding.confidence !== undefined && finding.confidence !== null && (
                        <Badge>{Math.round(finding.confidence * 100)}%</Badge>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-white/58">
                    {finding.summary}
                  </p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Evidence">
            {brief.evidence.length > 0 ? (
              <div className="space-y-2.5">
                {brief.evidence.map((item) => (
                  <a
                    key={item.url}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-[20px] p-3 transition-colors hover:bg-white/[0.04]"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium text-white/88">
                          {item.title}
                        </p>
                        <p className="mt-1 text-[10px] text-white/34">
                          {item.source} · {new Date(item.published_at).toLocaleString()}
                        </p>
                      </div>
                      <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-white/56">
                      {item.summary}
                    </p>
                  </a>
                ))}
              </div>
            ) : (
              <div
                className="rounded-[20px] px-3 py-3 text-[11px] leading-relaxed text-white/50"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                No external evidence links were attached to this brief.
              </div>
            )}
          </Section>

          <Section title="HashKey Execution">
            <div
              className="rounded-[20px] p-3"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex flex-wrap gap-2">
                <Badge>{brief.execution.status.replace(/_/g, " ")}</Badge>
                <Badge>Chain {brief.execution.chain_id}</Badge>
                {brief.execution.tx_hash && <Badge>{brief.execution.tx_hash.slice(0, 10)}…</Badge>}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-white/58">
                {brief.execution.summary}
              </p>
            </div>
          </Section>

          <Section title="Technical Receipt">
            <details
              className="rounded-[20px] p-3"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <summary className="cursor-pointer text-[11px] font-medium text-white/82">
                Show raw ATS fields
              </summary>
              <div className="mt-3 space-y-2 text-[11px] leading-relaxed text-white/54">
                <p>Prompt: {receipt.query ?? "Unavailable"}</p>
                <p>Consensus: {receipt.consensus.decision}</p>
                <p>Regime: {receipt.regime}</p>
                <p>Chain: {receipt.chain_id}</p>
                <p>Receipt ID: {receipt.id ?? "Unsaved"}</p>
                <p>Storage Root: {receipt.storage_root_hash ?? "Not uploaded yet"}</p>
                <p>Proof Ref: {receipt.proof_ref ?? "None"}</p>
              </div>
            </details>
          </Section>
        </div>
      </div>
    </div>
  );
}
