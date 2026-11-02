"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "./step-indicator";
import { QuestionStep } from "./question-step";
import { ReviewStep } from "./review-step";
import { calculateRiskScore, type FormAnswers } from "@/lib/onboarding/risk-score";

const QUESTIONS = [
  {
    id: "defiExperience" as const,
    question: "What's your DeFi experience level?",
    subtitle: "Help us understand where you're starting from",
    isMulti: false,
    options: [
      { label: "Novice", value: 1 },
      { label: "Beginner", value: 2 },
      { label: "Intermediate", value: 3 },
      { label: "Knowledgeable", value: 4 },
      { label: "Expert", value: 5 },
    ],
  },
  {
    id: "investmentHorizon" as const,
    question: "What's your investment horizon?",
    subtitle: "How long do you plan to hold your positions?",
    isMulti: false,
    options: [
      { label: "Less than 1 year", value: 1 },
      { label: "1–2 years", value: 2 },
      { label: "3–5 years", value: 3 },
      { label: "5–10 years", value: 4 },
      { label: "More than 10 years", value: 5 },
    ],
  },
  {
    id: "riskTolerance" as const,
    question: "What's your risk tolerance?",
    subtitle: "How comfortable are you with portfolio volatility?",
    isMulti: false,
    options: [
      { label: "Very Conservative", value: 1 },
      { label: "Conservative", value: 2 },
      { label: "Moderate", value: 3 },
      { label: "Aggressive", value: 4 },
      { label: "Very Aggressive", value: 5 },
    ],
  },
  {
    id: "useCases" as const,
    question: "Which DeFi use cases interest you?",
    subtitle: "Select everything that appeals to you",
    isMulti: true,
    options: [
      { label: "Trading", value: "Trading" },
      { label: "Lending", value: "Lending" },
      { label: "Staking", value: "Staking" },
      { label: "Yield Farming", value: "Yield Farming" },
      { label: "Rewards", value: "Rewards" },
      { label: "NFTs", value: "NFTs" },
      { label: "Derivatives", value: "Derivatives" },
    ],
  },
  {
    id: "preferredNetworks" as const,
    question: "Which networks do you prefer?",
    subtitle: "Select all the chains you use or plan to use",
    isMulti: true,
    options: [
      { label: "Avalanche", value: "Avalanche" },
      { label: "Ethereum", value: "Ethereum" },
      { label: "Arbitrum", value: "Arbitrum" },
      { label: "Optimism", value: "Optimism" },
      { label: "Polygon", value: "Polygon" },
      { label: "Unichain", value: "Unichain" },
      { label: "ATOM", value: "ATOM" },
    ],
  },
] as const;

const TOTAL_STEPS = QUESTIONS.length;
const REVIEW_STEP = TOTAL_STEPS + 1;

const initialAnswers: FormAnswers = {
  defiExperience: 0,
  investmentHorizon: 0,
  riskTolerance: 0,
  useCases: [],
  preferredNetworks: [],
};

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -48 : 48, opacity: 0 }),
};

export function MultiStepForm() {
  const router = useRouter();
  const { address } = useAccount();

  const [[currentStep, direction], setPage] = useState<[number, number]>([1, 0]);
  const [answers, setAnswers] = useState<FormAnswers>(initialAnswers);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isReview = currentStep === REVIEW_STEP;
  const question = QUESTIONS[currentStep - 1];

  const getCurrentSelection = (): (string | number)[] => {
    if (!question) return [];
    const val = answers[question.id];
    if (Array.isArray(val)) return val;
    return val !== 0 ? [val] : [];
  };

  const isStepValid = (): boolean => {
    if (isReview) return true;
    if (!question) return false;
    const val = answers[question.id];
    return Array.isArray(val) ? val.length > 0 : val !== 0;
  };

  const handleSelect = (value: string | number) => {
    if (!question) return;
    const key = question.id;

    setAnswers((prev) => {
      if (question.isMulti) {
        const current = prev[key] as string[];
        return {
          ...prev,
          [key]: current.includes(value as string)
            ? current.filter((v) => v !== value)
            : [...current, value as string],
        };
      }
      return { ...prev, [key]: value };
    });
  };

  const goNext = () => setPage(([step]) => [step + 1, 1]);
  const goBack = () => setPage(([step]) => [step - 1, -1]);
  const goToStep = (step: number) =>
    setPage(([curr]) => [step, step < curr ? -1 : 1]);

  const handleSubmit = async () => {
    if (!address || isSubmitting) return;
    setIsSubmitting(true);

    const { score, label } = calculateRiskScore(answers);

    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          answers,
          riskScore: score,
          riskLabel: label,
        }),
      });
    } catch {
      // Graceful fallback — localStorage is set below regardless
    }

    localStorage.setItem("onboarding_wallet", address);
    router.push("/explore");
  };

  const buildReviewItems = () =>
    QUESTIONS.map((q) => {
      const val = answers[q.id];
      let answer: string;
      if (Array.isArray(val)) {
        answer = val.length > 0 ? val.join(", ") : "Not selected";
      } else {
        const opt = q.options.find((o) => o.value === val);
        answer = opt ? opt.label : "Not selected";
      }
      return { question: q.question, answer };
    });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-8">
      <div className="w-full max-w-lg">
        {/* Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-xl shadow-2xl p-8">
          {/* Step indicator (hidden on review) */}
          {!isReview && (
            <StepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />
          )}

          {/* Animated content */}
          <div className="relative overflow-hidden" style={{ minHeight: 260 }}>
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeInOut" }}
              >
                {isReview ? (
                  <ReviewStep items={buildReviewItems()} onEdit={goToStep} />
                ) : (
                  <QuestionStep
                    question={question.question}
                    subtitle={question.subtitle}
                    options={question.options}
                    isMulti={question.isMulti}
                    selected={getCurrentSelection()}
                    onSelect={handleSelect}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/50">
            <Button
              variant="ghost"
              onClick={goBack}
              disabled={currentStep === 1}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>

            {isReview ? (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    Submit
                    <Check className="w-4 h-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={goNext}
                disabled={!isStepValid()}
                className="gap-2"
              >
                {currentStep === TOTAL_STEPS ? "Review" : "Next"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Branding */}
        <p className="text-center text-xs text-muted-foreground/50 mt-4">
          Omega · Powered by HashKey Chain
        </p>
      </div>
    </div>
  );
}
