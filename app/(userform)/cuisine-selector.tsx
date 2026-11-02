"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, ChevronRight, ChevronLeft, Edit2 } from "lucide-react"

const experienceLevels = ["Novice", "Beginner", "Intermediate", "Knowledgeable", "Expert"]

const defiUseCases = ["LP'ing", "Earning Yield", "Growing capital", "Rewards", "Vibes"]

const cryptoAssets = [
  "BTC",
  "ETH",
  "SOL",
  "BNB",
  "XRP",
  "ADA",
  "DOGE",
  "AVAX",
  "DOT",
  "MATIC",
  "LINK",
  "UNI",
  "ATOM",
  "LTC",
  "APT",
  "ARB",
  "OP",
  "NEAR",
  "STX",
  "IMX",
]

const networks = [
  "Ethereum",
  "Base",
  "Arbitrum",
  "Optimism",
  "Polygon",
  "Solana",
  "BSC",
  "Avalanche",
  "Plasma",
  "Unichain",
]

const transitionProps = {
  type: "spring",
  stiffness: 500,
  damping: 30,
  mass: 0.5,
}

function ChipButton({
  label,
  isSelected,
  onClick,
}: {
  label: string
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      onClick={onClick}
      layout
      initial={false}
      animate={{
        backgroundColor: isSelected ? "#1e3a5f" : "rgba(39, 39, 42, 0.5)",
      }}
      whileHover={{
        backgroundColor: isSelected ? "#1e3a5f" : "rgba(39, 39, 42, 0.8)",
      }}
      whileTap={{
        backgroundColor: isSelected ? "#152943" : "rgba(39, 39, 42, 0.9)",
      }}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 30,
        mass: 0.5,
        backgroundColor: { duration: 0.1 },
      }}
      className={`
        inline-flex items-center px-4 py-2 rounded-full text-base font-medium
        whitespace-nowrap overflow-hidden ring-1 ring-inset
        ${isSelected ? "text-blue-400 ring-[hsla(0,0%,100%,0.12)]" : "text-zinc-400 ring-[hsla(0,0%,100%,0.06)]"}
      `}
    >
      <motion.div
        className="relative flex items-center"
        animate={{
          width: isSelected ? "auto" : "100%",
          paddingRight: isSelected ? "1.5rem" : "0",
        }}
        transition={{
          ease: [0.175, 0.885, 0.32, 1.275],
          duration: 0.3,
        }}
      >
        <span>{label}</span>
        <AnimatePresence>
          {isSelected && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 30,
                mass: 0.5,
              }}
              className="absolute right-0"
            >
              <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" strokeWidth={1.5} />
              </div>
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.button>
  )
}

export default function CuisineSelector() {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedExperience, setSelectedExperience] = useState<string>("")
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([])
  const [selectedAssets, setSelectedAssets] = useState<string[]>([])
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([])

  const totalSteps = 5

  const toggleUseCase = (useCase: string) => {
    setSelectedUseCases((prev) => (prev.includes(useCase) ? prev.filter((u) => u !== useCase) : [...prev, useCase]))
  }

  const toggleAsset = (asset: string) => {
    setSelectedAssets((prev) => (prev.includes(asset) ? prev.filter((a) => a !== asset) : [...prev, asset]))
  }

  const toggleNetwork = (network: string) => {
    setSelectedNetworks((prev) => (prev.includes(network) ? prev.filter((n) => n !== network) : [...prev, network]))
  }

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = () => {
    console.log("Form submitted:", {
      experience: selectedExperience,
      useCases: selectedUseCases,
      assets: selectedAssets,
      networks: selectedNetworks,
    })
    alert("Preferences saved!")
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedExperience !== ""
      case 2:
        return selectedUseCases.length > 0
      case 3:
        return selectedAssets.length > 0
      case 4:
        return selectedNetworks.length > 0
      case 5:
        return true
      default:
        return false
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-[540px]">
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-zinc-500 text-sm font-medium">
              Step {currentStep} of {totalSteps}
            </span>
          </div>
          <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500"
              initial={{ width: "0%" }}
              animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {currentStep === 1 && (
              <div>
                <h1 className="text-white text-xl font-semibold mb-4">What's your experience in DeFi?</h1>
                <p className="text-zinc-400 text-base mb-12">Select your experience level</p>
                <motion.div className="flex flex-wrap gap-3 overflow-visible" layout transition={transitionProps}>
                  {experienceLevels.map((level, index) => (
                    <ChipButton
                      key={level}
                      label={`${index + 1} - ${level}`}
                      isSelected={selectedExperience === level}
                      onClick={() => setSelectedExperience(level)}
                    />
                  ))}
                </motion.div>
              </div>
            )}

            {currentStep === 2 && (
              <div>
                <h1 className="text-white text-xl font-semibold mb-4">What do you use DeFi for?</h1>
                <p className="text-zinc-400 text-base mb-12">Select all that apply</p>
                <motion.div className="flex flex-wrap gap-3 overflow-visible" layout transition={transitionProps}>
                  {defiUseCases.map((useCase) => (
                    <ChipButton
                      key={useCase}
                      label={useCase}
                      isSelected={selectedUseCases.includes(useCase)}
                      onClick={() => toggleUseCase(useCase)}
                    />
                  ))}
                </motion.div>
              </div>
            )}

            {currentStep === 3 && (
              <div>
                <h1 className="text-white text-xl font-semibold mb-4">What assets do you hold?</h1>
                <p className="text-zinc-400 text-base mb-12">Select all that apply</p>
                <motion.div className="flex flex-wrap gap-3 overflow-visible" layout transition={transitionProps}>
                  {cryptoAssets.map((asset) => (
                    <ChipButton
                      key={asset}
                      label={asset}
                      isSelected={selectedAssets.includes(asset)}
                      onClick={() => toggleAsset(asset)}
                    />
                  ))}
                </motion.div>
              </div>
            )}

            {currentStep === 4 && (
              <div>
                <h1 className="text-white text-xl font-semibold mb-4">What networks do you use the most?</h1>
                <p className="text-zinc-400 text-base mb-12">Select all that apply</p>
                <motion.div className="flex flex-wrap gap-3 overflow-visible" layout transition={transitionProps}>
                  {networks.map((network) => (
                    <ChipButton
                      key={network}
                      label={network}
                      isSelected={selectedNetworks.includes(network)}
                      onClick={() => toggleNetwork(network)}
                    />
                  ))}
                </motion.div>
              </div>
            )}

            {currentStep === 5 && (
              <div>
                <h1 className="text-white text-xl font-semibold mb-4">Review Your Answers</h1>
                <p className="text-zinc-400 text-base mb-12">Make sure everything looks good before submitting</p>
                <div className="space-y-6">
                  <div className="p-6 border border-zinc-800 bg-[rgba(25,25,28,0)] rounded-3xl">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-medium">DeFi Experience</h3>
                      <button
                        onClick={() => setCurrentStep(1)}
                        className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 text-sm"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </button>
                    </div>
                    <p className="text-zinc-400">
                      {selectedExperience
                        ? `${experienceLevels.indexOf(selectedExperience) + 1} - ${selectedExperience}`
                        : "Not selected"}
                    </p>
                  </div>

                  <div className="p-6 border border-zinc-800 bg-[rgba(25,25,28,0)] rounded-3xl">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-medium">DeFi Use Cases</h3>
                      <button
                        onClick={() => setCurrentStep(2)}
                        className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 text-sm"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedUseCases.length > 0 ? (
                        selectedUseCases.map((useCase) => (
                          <span key={useCase} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                            {useCase}
                          </span>
                        ))
                      ) : (
                        <p className="text-zinc-400">None selected</p>
                      )}
                    </div>
                  </div>

                  <div className="p-6 border border-zinc-800 bg-[rgba(25,25,28,0.08695652173913043)] rounded-3xl">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-medium">Crypto Assets</h3>
                      <button
                        onClick={() => setCurrentStep(3)}
                        className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 text-sm"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedAssets.length > 0 ? (
                        selectedAssets.map((asset) => (
                          <span key={asset} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                            {asset}
                          </span>
                        ))
                      ) : (
                        <p className="text-zinc-400">None selected</p>
                      )}
                    </div>
                  </div>

                  <div className="p-6 border border-zinc-800 bg-[rgba(25,25,28,0)] rounded-3xl">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-medium">Networks</h3>
                      <button
                        onClick={() => setCurrentStep(4)}
                        className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 text-sm"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedNetworks.length > 0 ? (
                        selectedNetworks.map((network) => (
                          <span key={network} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                            {network}
                          </span>
                        ))
                      ) : (
                        <p className="text-zinc-400">None selected</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-12 flex justify-between items-center">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all ${
              currentStep === 1 ? "opacity-0 pointer-events-none" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {currentStep < totalSteps ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all ${
                canProceed()
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
              }`}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-6 py-3 rounded-full font-medium bg-blue-500 text-white hover:bg-blue-600 transition-all"
            >
              Submit
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
