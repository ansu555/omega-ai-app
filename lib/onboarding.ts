export const RISK_CATEGORY_VALUES = [
  'conservative',
  'balanced',
  'aggressive',
] as const

export type RiskCategory = (typeof RISK_CATEGORY_VALUES)[number]

export const RISK_QUESTIONNAIRE_VERSION = 1 as const

export const RESPONSE_KEYS = [
  'q1',
  'q2',
  'q3',
  'q4',
  'q5',
  'q6',
  'q7',
  'q8',
] as const

export type QuestionId = (typeof RESPONSE_KEYS)[number]

export type ResponseScore = 1 | 2 | 3 | 4 | 5

export type RiskResponses = Record<QuestionId, ResponseScore>

export interface QuestionOption {
  id: string
  label: string
  score: ResponseScore
}

export interface RiskQuestion {
  id: QuestionId
  title: string
  description: string
  options: QuestionOption[]
}

export interface StoredAnswer {
  questionId: QuestionId
  questionTitle: string
  selectedOptionId: string
  selectedOptionLabel: string
  score: ResponseScore
}

export type StoredAnswers = Record<QuestionId, StoredAnswer>

export const RISK_QUESTIONS: RiskQuestion[] = [
  {
    id: 'q1',
    title: 'Investment horizon',
    description: 'How long do you plan to keep your crypto portfolio invested before needing the funds? Longer horizons allow you to ride out volatility.',
    options: [
      { id: 'q1_o1', label: 'Less than 1 year', score: 1 },
      { id: 'q1_o2', label: '1 to 2 years', score: 2 },
      { id: 'q1_o3', label: '3 to 5 years', score: 3 },
      { id: 'q1_o4', label: '5 to 10 years', score: 4 },
      { id: 'q1_o5', label: 'More than 10 years', score: 5 },
    ],
  },
  {
    id: 'q2',
    title: 'Reaction to a sudden 20–30% drop',
    description: 'Imagine your portfolio loses 20–30% of its value in a week. What would you realistically do? This reveals your emotional risk tolerance.',
    options: [
      { id: 'q2_o1', label: 'Sell immediately — protect what\'s left', score: 1 },
      { id: 'q2_o2', label: 'Sell part to reduce exposure', score: 2 },
      { id: 'q2_o3', label: 'Hold and wait for recovery', score: 3 },
      { id: 'q2_o4', label: 'Buy a little more at the dip', score: 4 },
      { id: 'q2_o5', label: 'Buy aggressively — great opportunity', score: 5 },
    ],
  },
  {
    id: 'q3',
    title: 'Maximum acceptable drawdown',
    description: 'Drawdown is the peak-to-trough decline in your portfolio value. What\'s the largest loss you could endure in a single year without abandoning your strategy?',
    options: [
      { id: 'q3_o1', label: 'Up to 5% — very conservative', score: 1 },
      { id: 'q3_o2', label: 'Up to 10%', score: 2 },
      { id: 'q3_o3', label: 'Up to 20%', score: 3 },
      { id: 'q3_o4', label: 'Up to 30%', score: 4 },
      { id: 'q3_o5', label: 'More than 30% — high risk tolerance', score: 5 },
    ],
  },
  {
    id: 'q4',
    title: 'Allocation to high-volatility assets',
    description: 'High-volatility assets (altcoins, new DeFi protocols) offer higher upside but can drop 70%+. What share of your portfolio are you comfortable holding in such assets?',
    options: [
      { id: 'q4_o1', label: '0–10% — mostly stable assets', score: 1 },
      { id: 'q4_o2', label: '10–25% of portfolio', score: 2 },
      { id: 'q4_o3', label: '25–40% of portfolio', score: 3 },
      { id: 'q4_o4', label: '40–70% of portfolio', score: 4 },
      { id: 'q4_o5', label: 'More than 70% — full risk-on', score: 5 },
    ],
  },
  {
    id: 'q5',
    title: 'Primary investment objective',
    description: 'What is the main goal for this portfolio? This shapes how Omega\'s AI calibrates routing, alerts, and strategy suggestions.',
    options: [
      { id: 'q5_o1', label: 'Capital preservation — protect principal first', score: 1 },
      { id: 'q5_o2', label: 'Steady growth with controlled risk', score: 2 },
      { id: 'q5_o3', label: 'Balanced growth and risk trade-off', score: 3 },
      { id: 'q5_o4', label: 'Growth-focused, accept higher volatility', score: 4 },
      { id: 'q5_o5', label: 'Aggressive maximization — prioritize upside', score: 5 },
    ],
  },
  {
    id: 'q6',
    title: 'DeFi & crypto experience',
    description: 'Your experience level helps us tailor complexity. Beginners get guided flows; experts unlock advanced routing, LP strategies, and automation.',
    options: [
      { id: 'q6_o1', label: 'None — completely new to crypto', score: 1 },
      { id: 'q6_o2', label: 'Beginner — basic buys/sells only', score: 2 },
      { id: 'q6_o3', label: 'Intermediate — swaps, DEXs, yield', score: 3 },
      { id: 'q6_o4', label: 'Advanced — DeFi protocols, LP, options', score: 4 },
      { id: 'q6_o5', label: 'Expert — professional or institutional', score: 5 },
    ],
  },
  {
    id: 'q7',
    title: 'Strategy complexity comfort',
    description: 'How sophisticated are the trading strategies you\'re comfortable running? This affects AI recommendations and automation features shown to you.',
    options: [
      { id: 'q7_o1', label: 'Simple spot buys/sells only', score: 1 },
      { id: 'q7_o2', label: 'Mostly spot with occasional limit orders', score: 2 },
      { id: 'q7_o3', label: 'Spot + simple DeFi (staking, liquidity)', score: 3 },
      { id: 'q7_o4', label: 'Active strategies with some automation', score: 4 },
      { id: 'q7_o5', label: 'Advanced — arbitrage, complex DeFi, bots', score: 5 },
    ],
  },
  {
    id: 'q8',
    title: 'Liquidity needs in the next 12 months',
    description: 'Do you expect to withdraw from this portfolio in the near term? Needing funds soon limits how much risk you can afford to take.',
    options: [
      { id: 'q8_o1', label: 'Need most funds readily accessible', score: 1 },
      { id: 'q8_o2', label: 'Need a large portion available', score: 2 },
      { id: 'q8_o3', label: 'Need around half available', score: 3 },
      { id: 'q8_o4', label: 'Need only a small portion available', score: 4 },
      { id: 'q8_o5', label: 'No near-term liquidity needs at all', score: 5 },
    ],
  },
]

export function normalizeWalletAddress(walletAddress: string): string {
  return walletAddress.trim().toLowerCase()
}

export function isValidWalletAddress(walletAddress: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(walletAddress.trim())
}

export function isValidResponseScore(value: unknown): value is ResponseScore {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  )
}

export function isValidRiskResponses(value: unknown): value is RiskResponses {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const candidate = value as Record<string, unknown>
  const candidateKeys = Object.keys(candidate)

  if (candidateKeys.length !== RESPONSE_KEYS.length) {
    return false
  }

  if (candidateKeys.some((key) => !RESPONSE_KEYS.includes(key as QuestionId))) {
    return false
  }

  return RESPONSE_KEYS.every((key) => isValidResponseScore(candidate[key]))
}

export function computeRiskScore(responses: RiskResponses): number {
  const raw = RESPONSE_KEYS.reduce((total, key) => total + responses[key], 0)
  return Math.round(((raw - 8) / 32) * 100)
}

export function getRiskCategory(riskScore: number): RiskCategory {
  if (riskScore <= 33) {
    return 'conservative'
  }

  if (riskScore <= 66) {
    return 'balanced'
  }

  return 'aggressive'
}

export function buildStoredAnswers(responses: RiskResponses): StoredAnswers {
  return RISK_QUESTIONS.reduce((accumulator, question) => {
    const score = responses[question.id]
    const option = question.options.find((entry) => entry.score === score)

    if (!option) {
      throw new Error(`Invalid response score for ${question.id}`)
    }

    accumulator[question.id] = {
      questionId: question.id,
      questionTitle: question.title,
      selectedOptionId: option.id,
      selectedOptionLabel: option.label,
      score,
    }

    return accumulator
  }, {} as StoredAnswers)
}
