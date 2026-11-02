/**
 * Derives a simple 0–100 risk score and label from onboarding answers.
 * Used by the multi-step onboarding form before POST /api/onboarding.
 */

export type FormAnswers = {
  defiExperience: number;
  investmentHorizon: number;
  riskTolerance: number;
  useCases: string[];
  preferredNetworks: string[];
};

function clamp01(n: number): number {
  if (Number.isNaN(n) || n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

export function calculateRiskScore(answers: FormAnswers): {
  score: number;
  label: string;
} {
  const exp = Math.max(0, Math.min(5, answers.defiExperience));
  const horizon = Math.max(0, Math.min(5, answers.investmentHorizon));
  const tol = Math.max(0, Math.min(5, answers.riskTolerance));

  const coreAvg = exp + horizon + tol > 0 ? (exp + horizon + tol) / 15 : 0;
  const breadth = Math.min(
    1,
    (answers.useCases.length + answers.preferredNetworks.length) / 16,
  );
  const raw = clamp01(coreAvg) * 72 + clamp01(breadth) * 28;
  const score = Math.round(Math.min(100, Math.max(0, raw)));

  let label: string;
  if (score < 34) label = "Conservative";
  else if (score < 52) label = "Moderate";
  else if (score < 72) label = "Balanced";
  else label = "Aggressive";

  return { score, label };
}
