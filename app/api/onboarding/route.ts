import { type NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import {
  RISK_CATEGORY_VALUES,
  RISK_QUESTIONNAIRE_VERSION,
  type RiskCategory,
  buildStoredAnswers,
  computeRiskScore,
  getRiskCategory,
  isValidRiskResponses,
  isValidWalletAddress,
  normalizeWalletAddress,
} from '@/lib/onboarding'
import { tryCreateSupabaseAdminClient } from '@/lib/supabase/server'

interface ExistingProfilePayload {
  exists: true
  riskScore: number
  riskCategory: RiskCategory
}

interface MissingProfilePayload {
  exists: false
}

interface PostRequestBody {
  walletAddress?: unknown
  responses?: unknown
  notes?: unknown
  questionnaireVersion?: unknown
}

interface LocalRiskProfileRecord {
  walletAddress: string
  questionnaireVersion: number
  answers: ReturnType<typeof buildStoredAnswers>
  notes: string | null
  riskScore: number
  riskCategory: RiskCategory
  createdAt: string
}

type LocalRiskProfileStore = Record<string, LocalRiskProfileRecord>

const LOCAL_DEV_STORE_PATH = path.join('/tmp', 'omeswap-onboarding-dev-store.json')
let hasLoggedFallbackWarning = false

function invalidPayload(message: string) {
  return NextResponse.json(
    { success: false, code: 'INVALID_PAYLOAD', message },
    { status: 400 },
  )
}


function isSupabaseMissingTableError(error: {
  code?: string | null
  message?: string | null
} | null): boolean {
  if (!error) {
    return false
  }

  return (
    error.code === 'PGRST205' ||
    error.message?.includes("public.user_risk_profiles") === true
  )
}

function shouldUseLocalDevFallback(error: {
  code?: string | null
  message?: string | null
} | null): boolean {
  return isSupabaseMissingTableError(error)
}

function logLocalFallbackOnce() {
  if (hasLoggedFallbackWarning) {
    return
  }

  hasLoggedFallbackWarning = true
  console.warn(
    '[onboarding] Supabase table public.user_risk_profiles is missing. Using local dev fallback store at /tmp/omeswap-onboarding-dev-store.json.',
  )
}

async function readLocalRiskProfiles(): Promise<LocalRiskProfileStore> {
  try {
    const content = await fs.readFile(LOCAL_DEV_STORE_PATH, 'utf8')
    const parsed = JSON.parse(content) as unknown

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return parsed as LocalRiskProfileStore
  } catch (error) {
    const typedError = error as NodeJS.ErrnoException

    if (typedError.code === 'ENOENT') {
      return {}
    }

    throw error
  }
}

async function writeLocalRiskProfiles(store: LocalRiskProfileStore): Promise<void> {
  await fs.writeFile(
    LOCAL_DEV_STORE_PATH,
    JSON.stringify(store, null, 2),
    'utf8',
  )
}

async function getLocalRiskProfile(
  walletAddress: string,
): Promise<{ riskScore: number; riskCategory: RiskCategory } | null> {
  const store = await readLocalRiskProfiles()
  const record = store[walletAddress]

  if (!record) {
    return null
  }

  if (!RISK_CATEGORY_VALUES.includes(record.riskCategory)) {
    return null
  }

  return {
    riskScore: record.riskScore,
    riskCategory: record.riskCategory,
  }
}

async function createLocalRiskProfile(
  record: LocalRiskProfileRecord,
): Promise<'created' | 'exists'> {
  const store = await readLocalRiskProfiles()

  if (store[record.walletAddress]) {
    return 'exists'
  }

  store[record.walletAddress] = record
  await writeLocalRiskProfiles(store)

  return 'created'
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ExistingProfilePayload | MissingProfilePayload>> {
  const walletParam = request.nextUrl.searchParams.get('wallet')

  if (!walletParam || !isValidWalletAddress(walletParam)) {
    return NextResponse.json({ exists: false }, { status: 400 })
  }

  const walletAddress = normalizeWalletAddress(walletParam)

  try {
    const supabase = tryCreateSupabaseAdminClient()

    if (!supabase) {
      console.error('[onboarding] GET error: Supabase client could not be created. Verify that SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.')
      return NextResponse.json({ exists: false })
    }

    console.log(`[onboarding] GET: Querying user_risk_profiles for wallet_address=${walletAddress}`)

    const { data, error } = await supabase
      .from('user_risk_profiles')
      .select('risk_score, risk_category')
      .eq('wallet_address', walletAddress)
      .maybeSingle()

    if (error) {
      console.error(`[onboarding] GET query error for wallet_address=${walletAddress}:`, error)
      if (shouldUseLocalDevFallback(error)) {
        logLocalFallbackOnce()
        const localProfile = await getLocalRiskProfile(walletAddress)

        if (!localProfile) {
          return NextResponse.json({ exists: false })
        }

        return NextResponse.json({
          exists: true,
          riskScore: localProfile.riskScore,
          riskCategory: localProfile.riskCategory,
        })
      }

      // Supabase query failed — treat as not onboarded so the user can proceed.
      // If they already completed onboarding, the POST will return 409 and redirect them.
      console.error('[onboarding] GET supabase error:', error)
      return NextResponse.json({ exists: false })
    }

    if (!data) {
      return NextResponse.json({ exists: false })
    }

    const normalizedCategory = RISK_CATEGORY_VALUES.find(
      (value) => value === data.risk_category,
    )

    if (!normalizedCategory) {
      console.error('[onboarding] GET unknown risk_category in DB:', data.risk_category)
      return NextResponse.json({ exists: false })
    }

    return NextResponse.json({
      exists: true,
      riskScore: data.risk_score,
      riskCategory: normalizedCategory,
    })
  } catch (err) {
    console.error('[onboarding] GET unexpected error:', err)
    return NextResponse.json({ exists: false })
  }
}

export async function POST(request: NextRequest) {
  let payload: PostRequestBody

  try {
    payload = (await request.json()) as PostRequestBody
  } catch {
    return invalidPayload('Request body must be valid JSON.')
  }

  if (
    typeof payload.walletAddress !== 'string' ||
    !isValidWalletAddress(payload.walletAddress)
  ) {
    return invalidPayload('walletAddress must be a valid EVM address.')
  }

  if (payload.questionnaireVersion !== RISK_QUESTIONNAIRE_VERSION) {
    return invalidPayload(
      `questionnaireVersion must be ${RISK_QUESTIONNAIRE_VERSION}.`,
    )
  }

  if (!isValidRiskResponses(payload.responses)) {
    return invalidPayload('responses must include q1..q8 with values 1..5.')
  }

  if (payload.notes !== undefined && typeof payload.notes !== 'string') {
    return invalidPayload('notes must be a string when provided.')
  }

  const walletAddress = normalizeWalletAddress(payload.walletAddress)
  const responses = payload.responses
  const notes = payload.notes?.trim() || null

  const riskScore = computeRiskScore(responses)
  const riskCategory = getRiskCategory(riskScore)
  const storedAnswers = buildStoredAnswers(responses)

  try {
    const supabase = tryCreateSupabaseAdminClient()

    if (!supabase) {
      console.error('[onboarding] POST error: Supabase client could not be created. Verify that SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.')
       return NextResponse.json({
        success: true,
        riskScore,
        riskCategory,
        storage: 'no-db-fallback',
      })
    }

    console.log(`[onboarding] POST: Inserting user_risk_profile for wallet_address=${walletAddress}`)

    const { error } = await supabase.from('user_risk_profiles').insert({
      wallet_address: walletAddress,
      questionnaire_version: RISK_QUESTIONNAIRE_VERSION,
      answers: storedAnswers,
      notes,
      risk_score: riskScore,
      risk_category: riskCategory,
    })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, code: 'ALREADY_COMPLETED' },
          { status: 409 },
        )
      }

      if (shouldUseLocalDevFallback(error)) {
        logLocalFallbackOnce()

        const result = await createLocalRiskProfile({
          walletAddress,
          questionnaireVersion: RISK_QUESTIONNAIRE_VERSION,
          answers: storedAnswers,
          notes,
          riskScore,
          riskCategory,
          createdAt: new Date().toISOString(),
        })

        if (result === 'exists') {
          return NextResponse.json(
            { success: false, code: 'ALREADY_COMPLETED' },
            { status: 409 },
          )
        }

        return NextResponse.json({
          success: true,
          riskScore,
          riskCategory,
          storage: 'local-dev-fallback',
        })
      }

      // Supabase insert failed for an unexpected reason (e.g. migration not applied,
      // column mismatch, network error). Log it but still return success — the client
      // stores completion in localStorage, so the user won't be re-prompted.
      console.error('[onboarding] POST supabase insert error:', error)
      return NextResponse.json({
        success: true,
        riskScore,
        riskCategory,
        storage: 'db-error-fallback',
      })
    }

    return NextResponse.json({
      success: true,
      riskScore,
      riskCategory,
    })
  } catch (err) {
    console.error('[onboarding] POST unexpected error:', err)
    return NextResponse.json({
      success: true,
      riskScore,
      riskCategory,
      storage: 'exception-fallback',
    })
  }
}
