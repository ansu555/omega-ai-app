// ─── Versioning ───────────────────────────────────────────────────────────────

export const RISK_QUESTIONNAIRE_VERSION = 1 as const

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResponseKey = 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q7' | 'q8'

export type ResponseScore = 1 | 2 | 3 | 4 | 5

export type RiskResponses = Record<ResponseKey, ResponseScore>

export type RiskCategory = 'conservative' | 'balanced' | 'aggressive'

export interface RiskQuestionOption {
  id: string
  score: ResponseScore
  label: string
  description: string
}

export interface RiskQuestion {
  id: ResponseKey
  title: string
  options: RiskQuestionOption[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const RESPONSE_KEYS: ResponseKey[] = [
  'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8',
]

export const RISK_CATEGORY_VALUES: RiskCategory[] = [
  'conservative',
  'balanced',
  'aggressive',
]

export const RISK_QUESTIONS: RiskQuestion[] = [
  {
    id: 'q1',
    title: 'What is your DeFi experience level?',
    options: [
      { id: 'q1-1', score: 1, label: 'None', description: "I have never used a DeFi protocol" },
      { id: 'q1-2', score: 2, label: 'Beginner', description: "I've tried a few basic swaps" },
      { id: 'q1-3', score: 3, label: 'Intermediate', description: "I use multiple protocols regularly" },
      { id: 'q1-4', score: 4, label: 'Advanced', description: "I manage complex DeFi positions" },
      { id: 'q1-5', score: 5, label: 'Expert', description: "I build on or deeply audit protocols" },
    ],
  },
  {
    id: 'q2',
    title: 'How long do you plan to hold your positions?',
    options: [
      { id: 'q2-1', score: 1, label: 'Under 1 month', description: "Short-term trades only" },
      { id: 'q2-2', score: 2, label: '1–6 months', description: "Medium-term positions" },
      { id: 'q2-3', score: 3, label: '6–12 months', description: "Hold through market cycles" },
      { id: 'q2-4', score: 4, label: '1–3 years', description: "Multi-year conviction" },
      { id: 'q2-5', score: 5, label: 'Over 3 years', description: "Long-term believer" },
    ],
  },
  {
    id: 'q3',
    title: 'How do you react when your portfolio drops 30%?',
    options: [
      { id: 'q3-1', score: 1, label: 'Sell everything', description: "I cannot tolerate large losses" },
      { id: 'q3-2', score: 2, label: 'Reduce exposure', description: "I trim risk when down significantly" },
      { id: 'q3-3', score: 3, label: 'Hold', description: "I wait for recovery without acting" },
      { id: 'q3-4', score: 4, label: 'Hold and monitor', description: "I stay calm and watch the market" },
      { id: 'q3-5', score: 5, label: 'Buy more', description: "I see dips as buying opportunities" },
    ],
  },
  {
    id: 'q4',
    title: 'What portion of your net worth is in crypto?',
    options: [
      { id: 'q4-1', score: 1, label: 'Under 5%', description: "Very small allocation" },
      { id: 'q4-2', score: 2, label: '5–15%', description: "Small allocation" },
      { id: 'q4-3', score: 3, label: '15–35%', description: "Moderate allocation" },
      { id: 'q4-4', score: 4, label: '35–60%', description: "Large allocation" },
      { id: 'q4-5', score: 5, label: 'Over 60%', description: "Majority of my assets" },
    ],
  },
  {
    id: 'q5',
    title: 'How comfortable are you with smart-contract risk?',
    options: [
      { id: 'q5-1', score: 1, label: 'Not at all', description: "Contract exploits are unacceptable" },
      { id: 'q5-2', score: 2, label: 'Audited only', description: "Only blue-chip, audited protocols" },
      { id: 'q5-3', score: 3, label: 'Moderate', description: "Well-established protocols with TVL" },
      { id: 'q5-4', score: 4, label: 'Open to newer', description: "I research protocols independently" },
      { id: 'q5-5', score: 5, label: 'Fully comfortable', description: "I actively farm new protocols" },
    ],
  },
  {
    id: 'q6',
    title: 'What is your primary investment goal?',
    options: [
      { id: 'q6-1', score: 1, label: 'Capital preservation', description: "Protect what I have" },
      { id: 'q6-2', score: 2, label: 'Stable yield', description: "Consistent, predictable returns" },
      { id: 'q6-3', score: 3, label: 'Balanced growth', description: "Mix of income and appreciation" },
      { id: 'q6-4', score: 4, label: 'High growth', description: "Maximize long-term gains" },
      { id: 'q6-5', score: 5, label: 'Maximum returns', description: "High risk, high reward" },
    ],
  },
  {
    id: 'q7',
    title: 'How actively do you manage your DeFi positions?',
    options: [
      { id: 'q7-1', score: 1, label: 'Set and forget', description: "I rarely check or rebalance" },
      { id: 'q7-2', score: 2, label: 'Monthly review', description: "I review once a month" },
      { id: 'q7-3', score: 3, label: 'Weekly review', description: "I check in every week" },
      { id: 'q7-4', score: 4, label: 'Daily monitoring', description: "I manage positions daily" },
      { id: 'q7-5', score: 5, label: 'Continuous', description: "I trade and optimize constantly" },
    ],
  },
  {
    id: 'q8',
    title: 'What single-position loss can you accept?',
    options: [
      { id: 'q8-1', score: 1, label: 'Up to 5%', description: "Very low loss tolerance" },
      { id: 'q8-2', score: 2, label: 'Up to 20%', description: "Low loss tolerance" },
      { id: 'q8-3', score: 3, label: 'Up to 40%', description: "Moderate loss tolerance" },
      { id: 'q8-4', score: 4, label: 'Up to 70%', description: "High loss tolerance" },
      { id: 'q8-5', score: 5, label: 'Over 70%', description: "Very high loss tolerance" },
    ],
  },
]

// ─── Validation ───────────────────────────────────────────────────────────────

export function isValidResponseScore(score: unknown): score is ResponseScore {
  return score === 1 || score === 2 || score === 3 || score === 4 || score === 5
}

export function isValidRiskResponses(
  responses: unknown,
): responses is RiskResponses {
  if (!responses || typeof responses !== 'object' || Array.isArray(responses)) {
    return false
  }
  return RESPONSE_KEYS.every((key) =>
    isValidResponseScore((responses as Record<string, unknown>)[key]),
  )
}

export function isValidWalletAddress(address: unknown): address is string {
  return typeof address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(address)
}

export function normalizeWalletAddress(address: string): string {
  return address.toLowerCase()
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export function computeRiskScore(responses: RiskResponses): number {
  const total = RESPONSE_KEYS.reduce((sum, key) => sum + responses[key], 0)
  const maxTotal = RESPONSE_KEYS.length * 5
  return Math.round((total / maxTotal) * 100)
}

export function getRiskCategory(score: number): RiskCategory {
  if (score <= 33) return 'conservative'
  if (score <= 66) return 'balanced'
  return 'aggressive'
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export type StoredAnswers = { [K in ResponseKey]: ResponseScore }

export function buildStoredAnswers(responses: RiskResponses): StoredAnswers {
  return { ...responses }
}
