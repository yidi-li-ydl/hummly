import type { WizardStep } from "@/lib/types";

const PHASES = ["Hum", "Analysis", "Find chords", "Find beats", "Mix"];
const PHASE_INDEX: Record<WizardStep, number> = { record: 0, processing: 1, review: 1, chords: 2, drums: 3, mix: 4 };

export default function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const active = PHASE_INDEX[currentStep];
  return (
    <div className="creation-progress" role="group" aria-label={`Music creation progress: ${PHASES[active]}`}>
      <ol>{PHASES.map((label, i) => (
        <li key={label} className={`progress-dot${i <= active ? " is-reached" : ""}`} aria-current={i === active ? "step" : undefined}>
          <span className="sr-only">{label}: {i === active ? "current" : i < active ? "completed" : "upcoming"}</span>
        </li>
      ))}</ol>
    </div>
  );
}
