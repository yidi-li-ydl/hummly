"use client";

import type { WizardStep } from "@/lib/types";

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "record", label: "Record" },
  { key: "processing", label: "Analyze" },
  { key: "chords", label: "Chords" },
  { key: "drums", label: "Drums" },
  { key: "mix", label: "Mix" },
];

export default function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, i) => {
        const isActive = i === currentIndex;
        const isDone = i < currentIndex;

        return (
          <div key={step.key} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  isActive
                    ? "bg-neon-purple animate-pulse-neon"
                    : isDone
                      ? "bg-neon-green"
                      : "bg-surface-card"
                }`}
              />
              <span
                className={`text-[10px] transition-colors ${
                  isActive ? "text-neon-purple font-medium" : isDone ? "text-neon-green" : "text-text-secondary"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-8 h-px mb-4 transition-colors ${
                  isDone ? "bg-neon-green" : "bg-surface-card"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
