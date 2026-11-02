"use client";

import { Pencil } from "lucide-react";

interface ReviewItem {
  question: string;
  answer: string;
}

interface ReviewStepProps {
  items: ReviewItem[];
  onEdit: (stepIndex: number) => void;
}

export function ReviewStep({ items, onEdit }: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Review Your Answers</h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          Make sure everything looks good before submitting
        </p>
      </div>

      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-4 p-4 rounded-xl bg-secondary/20 border border-border/60 hover:border-border transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {item.question}
              </p>
              <p className="text-sm font-medium text-foreground mt-1 break-words">
                {item.answer}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onEdit(i + 1)}
              className="shrink-0 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors mt-0.5"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
