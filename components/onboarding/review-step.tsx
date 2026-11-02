'use client'

import { motion } from 'framer-motion'
import { Loader2, Shield, TrendingUp, Zap } from 'lucide-react'

import type { RiskCategory } from '@/lib/onboarding'
import { cn } from '@/lib/utils'

interface ReviewStepProps {
  riskScore: number | null
  riskCategory: RiskCategory | null
  notes: string
  onNotesChange: (value: string) => void
  onSubmit: () => void
  isSubmitting: boolean
  submitError: string | null
  onBack: () => void
}

const CATEGORY_CONFIG = {
  conservative: {
    label: 'Conservative',
    color: 'text-emerald-400',
    borderColor: 'border-emerald-400/30',
    bgColor: 'bg-emerald-400/8',
    glowColor: '164 80% 54%',
    icon: Shield,
    description: 'Capital preservation is your priority. You prefer stable, lower-risk assets.',
  },
  balanced: {
    label: 'Balanced',
    color: 'text-primary',
    borderColor: 'border-primary/30',
    bgColor: 'bg-primary/8',
    glowColor: '262 83% 71%',
    icon: TrendingUp,
    description: 'You seek growth while managing downside risk across your portfolio.',
  },
  aggressive: {
    label: 'Aggressive',
    color: 'text-orange-400',
    borderColor: 'border-orange-400/30',
    bgColor: 'bg-orange-400/8',
    glowColor: '25 95% 53%',
    icon: Zap,
    description: 'Maximum growth potential. You embrace high volatility for higher returns.',
  },
} satisfies Record<RiskCategory, unknown>

export function ReviewStep({
  riskScore,
  riskCategory,
  notes,
  onNotesChange,
  onSubmit,
  isSubmitting,
  submitError,
  onBack,
}: ReviewStepProps) {
  const config = riskCategory ? CATEGORY_CONFIG[riskCategory] : null
  const CategoryIcon = config?.icon ?? TrendingUp
  const scoreBarWidth = riskScore !== null ? `${riskScore}%` : '0%'

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-white/25">
            {'08 / 08'}
          </span>
          <div className="h-px flex-1 bg-white/5" />
        </div>
        <h2 className="text-2xl font-semibold text-white md:text-3xl">
          Your risk profile
        </h2>
        <p className="text-sm text-white/35">
          Review your results and complete setup
        </p>
      </div>

      {/* Score display */}
      <div
        className={cn(
          'rounded-2xl border p-6',
          config?.borderColor ?? 'border-white/10',
          config?.bgColor ?? 'bg-white/[0.025]',
        )}
        style={
          config
            ? {
                boxShadow: `0 0 32px hsl(${config.glowColor} / 0.12), inset 0 1px 0 hsl(${config.glowColor} / 0.15)`,
              }
            : undefined
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-mono text-white/30 tracking-widest uppercase">
              Risk Score
            </p>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-5xl font-bold text-white">
                {riskScore ?? '--'}
              </span>
              <span className="text-sm text-white/30">/ 100</span>
            </div>
          </div>

          {config && (
            <div
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2',
                config.borderColor,
                config.bgColor,
              )}
            >
              <CategoryIcon className={cn('h-4 w-4', config.color)} />
              <span className={cn('text-sm font-semibold', config.color)}>
                {config.label}
              </span>
            </div>
          )}
        </div>

        {/* Score bar */}
        <div className="mt-5 space-y-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: scoreBarWidth }}
              transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.1 }}
              style={{
                background: config
                  ? `linear-gradient(90deg, hsl(${config.glowColor} / 0.5) 0%, hsl(${config.glowColor}) 100%)`
                  : 'hsl(262 83% 71%)',
                boxShadow: config ? `0 0 8px hsl(${config.glowColor} / 0.6)` : undefined,
              }}
            />
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-[10px] text-white/20">Conservative</span>
            <span className="font-mono text-[10px] text-white/20">Aggressive</span>
          </div>
        </div>

        {config && (
          <p className="mt-4 text-sm text-white/50 leading-relaxed">
            {config.description}
          </p>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-2.5">
        <label htmlFor="notes" className="block text-sm font-medium text-white/60">
          Investment goals{' '}
          <span className="text-white/25">(optional)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Share your goals, constraints, or any context for the AI..."
          rows={3}
          maxLength={1000}
          className={cn(
            'w-full resize-none rounded-2xl border bg-white/[0.025] px-4 py-3.5 text-sm text-white',
            'border-white/8 outline-none placeholder:text-white/20',
            'transition-all duration-150',
            'focus:border-primary/40 focus:bg-white/[0.04] focus:ring-1 focus:ring-primary/20',
          )}
        />
      </div>

      {submitError && (
        <p className="rounded-xl border border-red-400/20 bg-red-400/8 px-4 py-3 text-sm text-red-300">
          {submitError}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className={cn(
            'rounded-xl border border-white/10 bg-white/[0.025] px-4 py-2.5 text-sm text-white/60',
            'transition-all duration-150 hover:border-white/20 hover:bg-white/[0.04] hover:text-white/80',
            'disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          Back
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className={cn(
            'inline-flex items-center gap-2.5 rounded-xl px-6 py-2.5 text-sm font-semibold',
            'bg-primary text-primary-foreground',
            'transition-all duration-150 hover:opacity-90',
            'shadow-lg',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
          style={{
            boxShadow: '0 0 24px hsl(262 83% 71% / 0.35), 0 4px 12px hsl(262 83% 71% / 0.2)',
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving profile...
            </>
          ) : (
            'Complete setup'
          )}
        </button>
      </div>
    </motion.div>
  )
}
