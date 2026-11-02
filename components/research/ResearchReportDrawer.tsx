"use client";

import type { ReactNode } from "react";
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  ShieldCheck,
  ShieldQuestion,
  X,
  XCircle,
} from "lucide-react";
import clsx from "clsx";
import { useResearchStore } from "@/store/research";
import type {
  Citation,
  DomainFinding,
  Evidence,
  Recommendation,
  ResearchReport,
} from "@/lib/research/types";

// ── Small primitives ───────────────────────────────────────────────────────────

function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "good" | "warn" | "bad" | "info";
}) {
  const classes =
    tone === "good"
      ? "bg-emerald-500/15 text-emerald-100"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-100"
        : tone === "bad"
          ? "bg-rose-500/15 text-rose-100"
          : tone === "info"
            ? "bg-violet-500/15 text-violet-100"
            : "bg-white/8 text-white/70";
  return (
    <span className={clsx("rounded-full px-2 py-1 text-[9px] font-medium", classes)}>{children}</span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/28">{title}</p>
      {children}
    </section>
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx("rounded-[20px] p-3", className)}
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {children}
    </div>
  );
}

function stanceTone(stance: Recommendation["stance"]): "good" | "bad" | "warn" | "info" | "default" {
  if (stance === "buy") return "good";
  if (stance === "sell" || stance === "avoid") return "bad";
  if (stance === "watch") return "warn";
  if (stance === "hold") return "info";
  return "default";
}

// ── Allocation table ───────────────────────────────────────────────────────────

function AllocationTable({ recommendation }: { recommendation: Recommendation }) {
  if (recommendation.allocation.length === 0) return null;
  return (
    <Section title="Allocation">
      <Card>
        <div className="space-y-2">
          {recommendation.allocation.map((a) => (
            <div key={a.asset} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-white/85">{a.asset}</span>
                <span className="text-[12px] font-semibold text-white/90">
                  {a.weightPct}%
                  {a.amountUsd != null && (
                    <span className="ml-1.5 text-[10px] font-normal text-white/45">
                      ${a.amountUsd.toLocaleString()}
                    </span>
                  )}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-400"
                  style={{ width: `${Math.min(100, a.weightPct)}%` }}
                />
              </div>
              {a.reason && <p className="text-[10px] leading-snug text-white/45">{a.reason}</p>}
            </div>
          ))}
        </div>
      </Card>
    </Section>
  );
}

// ── Domain findings ────────────────────────────────────────────────────────────

function DomainCard({ finding }: { finding: DomainFinding }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-white/88">{finding.domain}</p>
        <Badge>{Math.round(finding.confidence * 100)}%</Badge>
      </div>
      {finding.summary && (
        <p className="mt-2 text-[11px] leading-relaxed text-white/58">{finding.summary}</p>
      )}
      {finding.keyPoints.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {finding.keyPoints.map((p, i) => (
            <li key={i} className="flex gap-1.5 text-[10.5px] leading-snug text-white/62">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-violet-300/70" />
              {p}
            </li>
          ))}
        </ul>
      )}
      {finding.gaps.length > 0 && (
        <p className="mt-2 text-[9.5px] leading-snug text-amber-200/70">
          Gaps: {finding.gaps.join("; ")}
        </p>
      )}
    </Card>
  );
}

// ── Citations ──────────────────────────────────────────────────────────────────

function citationIcon(status: Citation["status"]) {
  if (status === "supported") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />;
  if (status === "contradicted") return <XCircle className="h-3.5 w-3.5 text-rose-300" />;
  return <ShieldQuestion className="h-3.5 w-3.5 text-amber-300" />;
}

function CitationRow({ citation, evidence }: { citation: Citation; evidence: Evidence[] }) {
  const sources = citation.evidenceIndices
    .map((i) => evidence[i])
    .filter((e): e is Evidence => Boolean(e));
  return (
    <Card>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0">{citationIcon(citation.status)}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] leading-snug text-white/72">{citation.claim}</p>
          {sources.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {sources.map((e, i) =>
                e.url ? (
                  <a
                    key={i}
                    href={e.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] text-violet-100 transition-colors hover:text-white"
                    style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)" }}
                  >
                    {e.source}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                ) : (
                  <span
                    key={i}
                    className="rounded-full px-2 py-0.5 text-[9px] text-white/55"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {e.source} · {e.trustTier}
                  </span>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Proof banner ───────────────────────────────────────────────────────────────

function ProofBanner({ report }: { report: ResearchReport }) {
  const ref = report.proof_ref;
  const sealed = typeof ref === "string" && ref.startsWith("0g-sealed:");
  const hashed = typeof ref === "string" && ref.startsWith("sha256:");
  const value = ref ? ref.replace(/^0g-sealed:|^sha256:/, "") : null;

  return (
    <Card
      className={sealed ? "!border-teal-400/25" : undefined}
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className={clsx("h-4 w-4", sealed ? "text-teal-300" : "text-white/45")} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-white/82">
            {sealed
              ? "Sealed attestation on 0G Compute"
              : hashed
                ? "Local content-hash proof"
                : "Not attested"}
          </p>
          {value && (
            <p className="truncate font-mono text-[9.5px] text-white/40" title={value}>
              {value}
            </p>
          )}
        </div>
      </div>
      <p className="mt-2 text-[9.5px] leading-snug text-white/45">
        {sealed
          ? "A ZK-verified 0G inference committed this report's digest — anyone can verify the model ran over this exact document."
          : "0G Compute was unavailable, so the report is committed to a deterministic SHA-256 of its digest. The document is still tamper-evident."}
      </p>
    </Card>
  );
}

// ── Drawer ─────────────────────────────────────────────────────────────────────

export default function ResearchReportDrawer() {
  const reportOpen = useResearchStore((s) => s.reportOpen);
  const setReportOpen = useResearchStore((s) => s.setReportOpen);
  const report = useResearchStore((s) => s.currentReport);

  if (!reportOpen || !report) return null;

  const created = report.createdAt ? new Date(report.createdAt).toLocaleString() : "";
  const cv = report.crossVerification;

  return (
    <div className="absolute inset-0 z-30">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setReportOpen(false)} />

      <div
        className="absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(18,17,28,0.98), rgba(10,10,19,0.98))",
          borderLeft: "1px solid rgba(139,92,246,0.14)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{ background: "rgba(139,92,246,0.14)", border: "1px solid rgba(139,92,246,0.18)" }}
              >
                <FileText className="h-4.5 w-4.5 text-violet-100" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-white/92">Deep Research Report</p>
                <p className="truncate text-[10px] text-white/30">
                  {report.run_id}
                  {created ? ` · ${created}` : ""}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="info">{report.queryType.replace(/_/g, " ")}</Badge>
              {report.recommendation.stance !== "n/a" && (
                <Badge tone={stanceTone(report.recommendation.stance)}>
                  {report.recommendation.stance}
                </Badge>
              )}
              <Badge>{Math.round(report.confidence * 100)}% confidence</Badge>
              {typeof report.proof_ref === "string" && report.proof_ref.startsWith("0g-sealed:") && (
                <Badge tone="good">0G sealed</Badge>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setReportOpen(false)}
            className="rounded-xl p-2 text-white/45 transition-colors hover:text-white"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <Section title="Goal">
            <Card>
              <p className="text-[12px] leading-relaxed text-white/72">{report.goal || report.query}</p>
            </Card>
          </Section>

          <Section title="Recommendation">
            <Card>
              <p className="text-[12.5px] leading-relaxed text-white/82">
                {report.recommendation.headline}
              </p>
              {report.recommendation.actions.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {report.recommendation.actions.map((a, i) => (
                    <li key={i} className="flex gap-1.5 text-[11px] leading-snug text-white/62">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-300/70" />
                      {a}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Section>

          <AllocationTable recommendation={report.recommendation} />

          {report.findingsByDomain.length > 0 && (
            <Section title="Findings by Domain">
              <div className="space-y-2.5">
                {report.findingsByDomain.map((f) => (
                  <DomainCard key={f.agentId} finding={f} />
                ))}
              </div>
            </Section>
          )}

          {report.risks.length > 0 && (
            <Section title="Risks">
              <div className="space-y-2">
                {report.risks.map((r, i) => (
                  <Card key={i}>
                    <p className="text-[11px] leading-relaxed text-white/58">{r}</p>
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {cv && (
            <Section title="Cross-Verification">
              <Card>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[15px] font-semibold text-emerald-300">{cv.corroborated.length}</p>
                    <p className="text-[8.5px] uppercase tracking-[0.12em] text-white/35">Corroborated</p>
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-rose-300">{cv.contradicted.length}</p>
                    <p className="text-[8.5px] uppercase tracking-[0.12em] text-white/35">Contradicted</p>
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-amber-300">{cv.unverified.length}</p>
                    <p className="text-[8.5px] uppercase tracking-[0.12em] text-white/35">Unverified</p>
                  </div>
                </div>
                {cv.summary && (
                  <p className="mt-3 text-[10.5px] leading-relaxed text-white/55">{cv.summary}</p>
                )}
              </Card>
            </Section>
          )}

          {report.citations.length > 0 && (
            <Section title={`Citations (${report.citations.length})`}>
              <div className="space-y-2">
                {report.citations.map((c, i) => (
                  <CitationRow key={i} citation={c} evidence={report.evidence} />
                ))}
              </div>
              {report.unsupportedClaims.length > 0 && (
                <p className="text-[10px] leading-snug text-amber-200/70">
                  {report.unsupportedClaims.length} claim(s) could not be backed by evidence and were
                  flagged unsupported.
                </p>
              )}
            </Section>
          )}

          <Section title="Methodology">
            <Card>
              <p className="text-[11px] leading-relaxed text-white/58">{report.methodology}</p>
              {report.assumptions.length > 0 && (
                <p className="mt-2 text-[10px] leading-snug text-white/45">
                  Assumptions: {report.assumptions.join("; ")}
                </p>
              )}
            </Card>
          </Section>

          <Section title="Verifiable Proof">
            <ProofBanner report={report} />
          </Section>

          {report.evidence.length > 0 && (
            <Section title={`Evidence Pool (${report.evidence.length})`}>
              <details
                className="rounded-[20px] p-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <summary className="cursor-pointer text-[11px] font-medium text-white/82">
                  Show all sources
                </summary>
                <div className="mt-3 space-y-2">
                  {report.evidence.map((e, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Badge>{e.trustTier}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10.5px] leading-snug text-white/60">{e.claim}</p>
                        {e.url ? (
                          <a
                            href={e.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[9.5px] text-violet-200/80 hover:text-white"
                          >
                            {e.source}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : (
                          <span className="text-[9.5px] text-white/35">{e.source}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
