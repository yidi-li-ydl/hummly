import type { WizardStep } from "@/lib/types";

const PHASES = ["Hum", "Transform", "Play", "Create"];
const PHASE_INDEX: Record<WizardStep, number> = { record: 0, processing: 1, review: 2, chords: 2, drums: 2, mix: 3 };
export default function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const active = PHASE_INDEX[currentStep];
  return (
    <nav className="journey" aria-label="Creation progress">
      <ol>{PHASES.map((label, i) => (
        <li key={label} className={i === active ? "is-current" : i < active ? "is-complete" : ""} aria-current={i === active ? "step" : undefined}>
          <span className="journey-number" aria-hidden="true">{i < active ? "✓" : `0${i + 1}`}</span>
          <span>{label}</span>{i < active && <span className="sr-only">completed</span>}
        </li>
      ))}</ol>
    </nav>
  );
}
