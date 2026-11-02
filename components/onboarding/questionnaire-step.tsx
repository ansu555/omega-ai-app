'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'

import type { ResponseScore, RiskQuestion } from '@/lib/onboarding'
import { cn } from '@/lib/utils'

interface QuestionnaireStepProps {
  question: RiskQuestion
  selectedScore: ResponseScore | undefined
  questionIndex: number
  totalQuestions: number
  onSelect: (score: ResponseScore) => void
}

const KEY_LABELS = ['A', 'B', 'C', 'D', 'E']

export function QuestionnaireStep({
  question,
  selectedScore,
  questionIndex,
  totalQuestions,
  onSelect,
}: QuestionnaireStepProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={question.id}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="space-y-8"
      >
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-white/25">
              {String(questionIndex + 1).padStart(2, '0')}
              {' / '}
              {String(totalQuestions).padStart(2, '0')}
            </span>
            <div className="h-px flex-1 bg-white/5" />
          </div>

          <div>
            <h2 className="text-2xl font-semibold leading-snug text-white md:text-3xl">
              {question.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/45">
              {question.description}
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-2.5">
          {question.options.map((option, index) => {
            const isSelected = option.score === selectedScore

            return (
              <motion.button
                key={option.id}
                type="button"
                onClick={() => onSelect(option.score)}
                className={cn(
                  'group relative w-full rounded-2xl border px-5 py-4 text-left outline-none',
                  'transition-colors duration-150',
                  isSelected
                    ? 'border-primary/50 bg-primary/8'
                    : 'border-white/8 bg-white/[0.025] hover:border-white/18 hover:bg-white/[0.04]',
                )}
                style={
                  isSelected
                    ? {
                        boxShadow:
                          '0 0 0 1px hsl(262 83% 71% / 0.25), 0 0 28px hsl(262 83% 71% / 0.12), inset 0 1px 0 hsl(262 83% 71% / 0.1)',
                      }
                    : undefined
                }
                whileHover={isSelected ? undefined : { scale: 1.004 }}
                whileTap={{ scale: 0.997 }}
                transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 0.4 }}
              >
                <div className="flex items-center gap-4">
                  {/* Key badge */}
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono text-xs',
                      'transition-all duration-150',
                      isSelected
                        ? 'border-primary/40 bg-primary/15 text-primary'
                        : 'border-white/10 bg-white/[0.03] text-white/30 group-hover:border-white/18 group-hover:text-white/50',
                    )}
                  >
                    {isSelected ? (
                      <motion.span
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 600, damping: 25 }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </motion.span>
                    ) : (
                      KEY_LABELS[index]
                    )}
                  </span>

                  {/* Label */}
                  <span
                    className={cn(
                      'flex-1 text-sm font-medium transition-colors duration-150',
                      isSelected
                        ? 'text-white'
                        : 'text-white/60 group-hover:text-white/80',
                    )}
                  >
                    {option.label}
                  </span>

                  {/* Score pill */}
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px]',
                      'transition-all duration-150',
                      isSelected
                        ? 'border-primary/30 text-primary/70'
                        : 'border-white/8 text-white/18 group-hover:border-white/14 group-hover:text-white/35',
                    )}
                  >
                    {option.score}
                  </span>
                </div>

                {/* Inner glow on select */}
                {isSelected && (
                  <motion.div
                    className="pointer-events-none absolute inset-0 -z-10 rounded-2xl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                      background:
                        'radial-gradient(ellipse 80% 60% at 50% 50%, hsl(262 83% 71% / 0.08) 0%, transparent 100%)',
                    }}
                  />
                )}
              </motion.button>
            )
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
