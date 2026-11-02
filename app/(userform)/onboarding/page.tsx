'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, RefreshCw, Copy, LogOut, Check } from 'lucide-react'
import { toast } from '@/hooks/use-toast'


import {
  RESPONSE_KEYS,
  RISK_QUESTIONNAIRE_VERSION,
  RISK_QUESTIONS,
  type RiskResponses,
  type ResponseScore,
  computeRiskScore,
  getRiskCategory,
  isValidResponseScore,
  normalizeWalletAddress,
} from '@/lib/onboarding'
import { BackgroundPaths } from '@/components/layout/background-paths'
import { OnboardingHero } from '@/components/onboarding/onboarding-hero'
import { ProgressBar } from '@/components/onboarding/progress-bar'
import { QuestionnaireStep } from '@/components/onboarding/questionnaire-step'
import { ReviewStep } from '@/components/onboarding/review-step'
import { useWallet } from '@/hooks/use-wallet'
import { ExploreSkeleton } from '@/components/explore/ExploreSkeleton'

import { cn } from '@/lib/utils'

type OnboardingStatusResponse =
  | { exists: false }
  | { exists: true; riskScore: number; riskCategory: 'conservative' | 'balanced' | 'aggressive' }

const STATUS_CHECK_TIMEOUT_MS = 8000

function hasCompleteResponses(r: Partial<RiskResponses>): r is RiskResponses {
  return RESPONSE_KEYS.every((key) => isValidResponseScore(r[key]))
}

export default function OnboardingPage() {
  const router = useRouter()
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusCheckedAddress, setStatusCheckedAddress] = useState<string | null>(null)
  const [responses, setResponses] = useState<Partial<RiskResponses>>({})
  const [notes, setNotes] = useState('')
  const [step, setStep] = useState(0)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Timer ref for auto-advance
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [copied, setCopied] = useState(false)

  const { address, isConnected, disconnect } = useWallet()

  const normalizedAddress = useMemo(
    () => (address ? normalizeWalletAddress(address) : ''),
    [address],
  )

  const fetchStatus = useCallback(async () => {
    if (!normalizedAddress) return

    setStatusLoading(true)
    setStatusError(null)
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), STATUS_CHECK_TIMEOUT_MS)

    try {
      const response = await fetch(
        `/api/onboarding?wallet=${encodeURIComponent(normalizedAddress)}`,
        { method: 'GET', cache: 'no-store', signal: controller.signal },
      )

      if (!response.ok) throw new Error('Unable to verify onboarding status.')

      const data = (await response.json()) as OnboardingStatusResponse

      if (data.exists) {
        router.replace('/explore')
        return
      }

      setStatusCheckedAddress(normalizedAddress)
    } catch {
      setStatusCheckedAddress(normalizedAddress)
      setStatusError('Could not verify previous onboarding status. You can continue and launch anyway.')
    } finally {
      window.clearTimeout(timeoutId)
      setStatusLoading(false)
    }
  }, [normalizedAddress, router])

  useEffect(() => {
    if (!isConnected || !normalizedAddress) {
      setStatusCheckedAddress(null)
      setStatusError(null)
      setStatusLoading(false)
      return
    }
    void fetchStatus()
  }, [fetchStatus, isConnected, normalizedAddress])

  // Cleanup advance timer on unmount
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
    }
  }, [])

  const answeredCount = useMemo(
    () => RESPONSE_KEYS.reduce((n, key) => (isValidResponseScore(responses[key]) ? n + 1 : n), 0),
    [responses],
  )

  const isReviewStep = step >= RISK_QUESTIONS.length
  const activeQuestion = isReviewStep ? null : RISK_QUESTIONS[step]
  const activeScore = activeQuestion ? responses[activeQuestion.id] : undefined

  const computedScore = hasCompleteResponses(responses) ? computeRiskScore(responses) : null
  const computedCategory = computedScore !== null ? getRiskCategory(computedScore) : null

  const onSelectScore = useCallback(
    (score: ResponseScore) => {
      if (!activeQuestion) return

      // Cancel any pending advance (e.g. if user re-clicks quickly)
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)

      setResponses((prev) => ({ ...prev, [activeQuestion.id]: score }))
      setSubmitError(null)

      // Auto-advance after brief visual feedback
      advanceTimerRef.current = setTimeout(() => {
        setStep((prev) => Math.min(prev + 1, RISK_QUESTIONS.length))
      }, 380)
    },
    [activeQuestion],
  )

  const onBack = useCallback(() => {
    // Cancel pending auto-advance before going back
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
    setStep((prev) => Math.max(prev - 1, 0))
  }, [])

  const onSubmit = useCallback(async () => {
    if (!normalizedAddress || !hasCompleteResponses(responses) || isSubmitting) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: normalizedAddress,
          responses,
          notes: notes.trim() || undefined,
          questionnaireVersion: RISK_QUESTIONNAIRE_VERSION,
        }),
      })

      if (response.status === 409) {
        window.localStorage.setItem('onboarding_wallet', normalizedAddress)
        router.replace('/explore')
        return
      }

      if (!response.ok) throw new Error('Unable to submit onboarding.')

      window.localStorage.setItem('onboarding_wallet', normalizedAddress)
      router.replace('/explore')
    } catch {
      setSubmitError('Submission failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [normalizedAddress, responses, notes, isSubmitting, router])

  const handleCopyAddress = useCallback(() => {
    if (!address) return
    void navigator.clipboard.writeText(address)
    setCopied(true)
    toast({
      title: 'Address copied',
      description: 'Wallet address copied to clipboard',
    })
    setTimeout(() => setCopied(false), 2000)
  }, [address])

  const handleDisconnect = useCallback(() => {
    disconnect()
    router.push('/')
  }, [disconnect, router])


  // ── Disconnected: show hero ──────────────────────────────────────
  if (!isConnected || !normalizedAddress) {
    return <OnboardingHero />
  }

  // ── Checking status ──────────────────────────────────────────────
  if (statusLoading || (isConnected && normalizedAddress && statusCheckedAddress !== normalizedAddress)) {
    return <ExploreSkeleton />
  }

  // ── Questionnaire ────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <BackgroundPaths />

      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-64 w-96 -translate-x-1/2 opacity-20"
        style={{ background: 'radial-gradient(ellipse, hsl(262 83% 71% / 0.3) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          {/* Top bar */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mb-10 space-y-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium tracking-widest text-white/25 uppercase">
                Omega
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopyAddress}
                  className="group flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1 transition-all hover:border-white/10 hover:bg-white/[0.04]"
                >
                  <span className="font-mono text-[10px] text-white/40 transition-colors group-hover:text-white/60">
                    {normalizedAddress.slice(0, 6)}…{normalizedAddress.slice(-4)}
                  </span>
                  {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3 text-white/20 transition-colors group-hover:text-white/40" />
                  )}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1 transition-all hover:border-red-500/20 hover:bg-red-500/5 group"
                  title="Disconnect Wallet"
                >
                  <LogOut className="h-3 w-3 text-white/20 transition-colors group-hover:text-red-400" />
                </button>
              </div>
            </div>

            {statusError && (
              <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
                <p className="text-xs leading-relaxed text-amber-200/75">
                  {statusError}
                </p>
                <button
                  type="button"
                  onClick={() => { void fetchStatus() }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/8 px-2.5 py-1 text-[11px] font-medium text-amber-200 transition hover:bg-amber-400/12"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </button>
              </div>
            )}

            <ProgressBar answeredCount={answeredCount} total={RISK_QUESTIONS.length} />
          </motion.div>

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="relative overflow-hidden rounded-3xl border border-white/8 p-7 md:p-9"
            style={{
              background: 'hsl(0 0% 100% / 0.025)',
              backdropFilter: 'blur(16px)',
              boxShadow:
                '0 0 0 1px hsl(262 83% 71% / 0.06), 0 20px 40px hsl(270 40% 4% / 0.4), inset 0 1px 0 hsl(0 0% 100% / 0.05)',
            }}
          >
            {!isReviewStep && activeQuestion ? (
              <QuestionnaireStep
                question={activeQuestion}
                selectedScore={activeScore as ResponseScore | undefined}
                questionIndex={step}
                totalQuestions={RISK_QUESTIONS.length}
                onSelect={onSelectScore}
              />
            ) : (
              <ReviewStep
                riskScore={computedScore}
                riskCategory={computedCategory}
                notes={notes}
                onNotesChange={setNotes}
                onSubmit={() => { void onSubmit() }}
                isSubmitting={isSubmitting}
                submitError={submitError}
                onBack={onBack}
              />
            )}

            {/* Back button for question steps */}
            {!isReviewStep && (
              <div className="mt-8 flex items-center justify-between">
                <button
                  type="button"
                  onClick={onBack}
                  disabled={step === 0}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.025]',
                    'px-4 py-2.5 text-sm text-white/50 transition-all duration-150',
                    'hover:border-white/15 hover:bg-white/[0.04] hover:text-white/70',
                    'disabled:cursor-not-allowed disabled:opacity-25',
                  )}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>

                <p className="text-xs text-white/20">
                  {activeScore !== undefined ? 'Auto-advancing…' : 'Select an option'}
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
