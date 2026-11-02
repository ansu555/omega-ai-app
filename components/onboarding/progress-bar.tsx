'use client'

import { motion } from 'framer-motion'

interface ProgressBarProps {
  answeredCount: number
  total: number
}

export function ProgressBar({ answeredCount, total }: ProgressBarProps) {
  const pct = total > 0 ? Math.min((answeredCount / total) * 100, 100) : 0

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.2em] text-white/30 uppercase">
          Risk Profile
        </span>
        <span className="font-mono text-[10px] text-primary/60">
          {answeredCount} / {total}
        </span>
      </div>

      <div className="relative h-px w-full overflow-visible rounded-full bg-white/5">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            height: '1px',
            background:
              'linear-gradient(90deg, hsl(262 83% 60%) 0%, hsl(262 83% 78%) 100%)',
            boxShadow:
              '0 0 6px hsl(262 83% 71% / 0.9), 0 0 12px hsl(262 83% 71% / 0.4)',
          }}
          initial={{ width: '0%' }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
        />

        {pct > 2 && (
          <motion.div
            className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary"
            style={{
              boxShadow:
                '0 0 8px hsl(262 83% 71%), 0 0 20px hsl(262 83% 71% / 0.5)',
            }}
            initial={{ left: '0%', opacity: 0 }}
            animate={{ left: `calc(${pct}% - 4px)`, opacity: 1 }}
            transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        )}
      </div>
    </div>
  )
}
