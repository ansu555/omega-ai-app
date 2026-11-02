'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { WifiOff, ExternalLink } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'

export function DisconnectOverlay() {
  const { isConnected } = useAccount()
  const [wasConnected, setWasConnected] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const prevConnected = useRef<boolean | null>(null)

  useEffect(() => {
    // First render — just record state, don't trigger overlay
    if (prevConnected.current === null) {
      prevConnected.current = isConnected
      setWasConnected(isConnected)
      return
    }

    const prev = prevConnected.current
    prevConnected.current = isConnected

    // Only show overlay when transitioning FROM connected → disconnected
    if (prev && !isConnected) {
      setShowOverlay(true)
    }

    // Hide overlay when reconnected
    if (isConnected) {
      setShowOverlay(false)
    }
  }, [isConnected])

  // Don't render if user was never connected (avoids flash on first load)
  if (!wasConnected && !showOverlay) return null

  return (
    <AnimatePresence>
      {showOverlay && (
        <motion.div
          key="disconnect-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-background/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 p-7"
            style={{
              background: 'hsl(0 0% 100% / 0.04)',
              backdropFilter: 'blur(24px)',
              boxShadow:
                '0 0 0 1px hsl(262 83% 71% / 0.1), 0 24px 64px hsl(270 40% 4% / 0.7), inset 0 1px 0 hsl(0 0% 100% / 0.07)',
            }}
          >
            {/* Glow */}
            <div
              className="pointer-events-none absolute -top-12 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full opacity-25"
              style={{
                background: 'radial-gradient(circle, hsl(262 83% 71% / 0.4) 0%, transparent 70%)',
              }}
            />

            <div className="relative space-y-6 text-center">
              {/* Icon */}
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <WifiOff className="h-5 w-5 text-white/50" />
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-white">Wallet disconnected</h2>
                <p className="text-sm leading-relaxed text-white/45">
                  Your session is paused. Reconnect your wallet to resume trading.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                <ConnectButton.Custom>
                  {({ openConnectModal, connectModalOpen }) => (
                    <motion.button
                      type="button"
                      onClick={openConnectModal}
                      disabled={connectModalOpen}
                      className="w-full rounded-2xl py-3 text-sm font-semibold text-white disabled:opacity-60"
                      style={{
                        background:
                          'linear-gradient(135deg, hsl(262 83% 65%) 0%, hsl(262 83% 55%) 100%)',
                        boxShadow:
                          '0 0 20px hsl(262 83% 71% / 0.35), 0 4px 12px hsl(262 83% 71% / 0.15)',
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    >
                      Reconnect wallet
                    </motion.button>
                  )}
                </ConnectButton.Custom>

                <button
                  type="button"
                  onClick={() => setShowOverlay(false)}
                  className="w-full rounded-2xl border border-white/8 bg-white/[0.025] py-3 text-sm text-white/45 transition-all hover:border-white/15 hover:text-white/65"
                >
                  <span className="flex items-center justify-center gap-2">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Continue without connecting
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
