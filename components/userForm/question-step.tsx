"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  label: string;
  value: string | number;
}

interface QuestionStepProps {
  question: string;
  subtitle: string;
  options: ReadonlyArray<Option>;
  isMulti: boolean;
  selected: (string | number)[];
  onSelect: (value: string | number) => void;
}

export function QuestionStep({
  question,
  subtitle,
  options,
  isMulti,
  selected,
  onSelect,
}: QuestionStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground leading-snug">
          {question}
        </h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          {subtitle}
        </p>
        {isMulti && (
          <p className="text-xs text-primary/70 mt-1 font-medium">
            Select all that apply
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2.5">
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onSelect(option.value)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium border transition-all duration-200 cursor-pointer select-none",
                isSelected
                  ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "bg-secondary/20 border-border text-foreground hover:border-primary/50 hover:bg-secondary/40"
              )}
            >
              {isSelected && <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
