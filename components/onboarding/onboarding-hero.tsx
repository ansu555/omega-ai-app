'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { motion } from 'framer-motion'
import { ExternalLink, Shield } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { BackgroundPaths } from '@/components/layout/background-paths'
import LiquidEther from '@/components/ui/liquid-ether'

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } },
}

export function OnboardingHero() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07070A]">
      <BackgroundPaths />

      {/* Cursor-following gradient background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.25]">
        <LiquidEther
          colors={['#5227FF', '#FF9FFC', '#B19EEF']}
          mouseForce={15}
          cursorSize={80}
          autoDemo={true}
          autoSpeed={0.3}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Content */}


      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-20">
        <div className="w-full max-w-6xl grid md:grid-cols-[1.1fr_0.9fr] gap-12 items-start">
          {/* Left — Value prop */}
          <div className="max-w-[600px] space-y-16">
            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="space-y-10">
              {/* Brand Identity Anchor */}
              <div className="flex items-center gap-3">
                <div className="relative h-8 w-8">
                  <img src="/logo.png" alt="Omega" className="h-full w-full object-contain" />
                </div>
                <span className="text-lg font-bold tracking-tight text-white">Omega</span>
              </div>

              <div className="space-y-6">
                <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-[4rem]">
                  Your AI-powered <br />
                  <span>
                    DeFi Command Center
                  </span>
                </h1>

                <p className="max-w-[480px] text-[18px] leading-relaxed text-white/50">
                  Connect your wallet to unlock AI-powered trading, smart routing,
                  and portfolio insights — all in one terminal.
                </p>
              </div>
            </motion.div>



            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="flex items-center gap-4 pt-8 border-t border-white/5">
              <div className="flex items-center gap-2 text-[13px] font-medium text-white/20">
                <Shield className="h-4 w-4" /> Non-custodial
              </div>
              <span className="text-white/5">•</span>
              <div className="text-[13px] font-medium text-white/20">Product-grade security</div>
            </motion.div>
          </div>

          {/* Right — Action panel */}
          <div className="relative flex items-start justify-center md:pt-16">
            <motion.div
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              className="w-full max-w-[400px] relative"
            >
              {/* Refined background light-bending glow */}
              <div className="absolute -inset-10 bg-[#818CF8]/10 blur-[100px] rounded-full opacity-40 pointer-events-none" />
              <div className="absolute -inset-4 bg-primary/5 blur-3xl rounded-full opacity-30 pointer-events-none" />

              <WalletConnectPanel />
            </motion.div>
          </div>

        </div>
      </div>

    </div>
  )
}

function WalletConnectPanel() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8"
      style={{
        backdropFilter: 'blur(24px)',
        boxShadow: `
          0 25px 50px -12px rgba(0, 0, 0, 0.5),
          inset 0 1px 1px rgba(255, 255, 255, 0.05),
          0 0 40px -10px rgba(168, 85, 247, 0.08)
        `,
      }}
    >
      <div className="relative space-y-8">

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white tracking-tight">
            Connect Wallet
          </h2>
          <p className="text-[15px] leading-relaxed text-white/50">
            Onboarding is saved once per wallet. Your profile persists across sessions.
          </p>
        </div>

        {/* RainbowKit connect button */}
        <div className="flex flex-col gap-4">
          <ConnectButton.Custom>
            {({ openConnectModal, connectModalOpen }) => (
              <motion.button
                type="button"
                onClick={openConnectModal}
                disabled={connectModalOpen}
                className="group relative w-full overflow-hidden rounded-2xl h-14 text-[15px] font-semibold text-white disabled:opacity-70 shadow-lg transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
                  boxShadow: '0 4px 15px rgba(168, 85, 247, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                }}
                whileHover={{
                  scale: 1.01,
                  boxShadow: '0 0 25px 5px rgba(168, 85, 247, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                  filter: 'brightness(1.05)'
                }}
                whileTap={{ scale: 0.99 }}
              >

                <span className="relative z-10 flex items-center justify-center gap-3">
                  <WalletIcon />
                  Connect Wallet
                </span>

                {/* Subtle shimmer */}
                <motion.div
                  className="absolute inset-0 -translate-x-full skew-x-12 bg-white/10"
                  animate={{ translateX: ['-100%', '200%'] }}
                  transition={{ duration: 3, repeat: Infinity, repeatDelay: 4, ease: 'linear' }}
                />
              </motion.button>
            )}
          </ConnectButton.Custom>

          <Link
            href="/explore"
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] h-12 text-sm text-white/40 transition-all duration-200 hover:bg-white/[0.05] hover:text-white/60"
          >
            <ExternalLink className="h-4 w-4" />
            Explore without connecting
          </Link>
        </div>

        {/* Divider */}
        <div className="relative flex items-center gap-4 px-2">
          <div className="h-px flex-1 bg-white/[0.05]" />
          <span className="text-[10px] font-bold text-white/10 uppercase tracking-[0.2em]">Supported</span>
          <div className="h-px flex-1 bg-white/[0.05]" />
        </div>

        {/* Wallet icons */}
        <div className="flex items-center justify-center gap-3">
          <WalletBadge name="MetaMask" image="/meta-mask-logo.png" />
          <WalletBadge name="WalletConnect" image="/walletconnect-seeklogo.png" />
          <WalletBadge name="Coinbase" image="https://static-assets.coinbase.com/ui-infra/illustration/v1/pictogram/svg/light/coinbaseLogoNavigation-4.svg" />
        </div>
      </div>
    </div>
  )
}


function WalletIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
      <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
    </svg>
  )
}

function WalletBadge({ name, emoji, image }: { name: string; emoji?: string; image?: string }) {
  return (
    <motion.div
      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition-all hover:bg-white/10 hover:border-white/20"
      title={name}
      whileHover={{ y: -1 }}
    >
      {image ? (
        <div className="relative h-5 w-5">
          <Image src={image} alt={name} fill className="object-contain" />
        </div>
      ) : (
        <span className="text-lg leading-none">{emoji}</span>
      )}
      <span className="text-[12px] font-medium text-white/40 group-hover:text-white/60">{name}</span>
    </motion.div>
  )
}

