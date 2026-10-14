import type { WizardStep } from "@/lib/types";

const PHASES = ["Hum", "Analysis", "Find chords", "Find beats", "Mix"];
const PHASE_INDEX: Record<WizardStep, number> = { record: 0, processing: 1, review: 1, chords: 2, drums: 3, mix: 4 };
export default function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const active = PHASE_INDEX[currentStep];
  return (
    <nav className="journey" aria-label="Creation progress">
      <ol>{PHASES.map((label, i) => (
        <li key={label} className={i === active ? "is-current" : i < active ? "is-complete" : ""} aria-current={i === active ? "step" : undefined}>
          <span className="journey-number" aria-hidden="true">{i < active ? <svg viewBox="0 0 16 16" fill="none"><path d="m3.5 8 3 3 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg> : `0${i + 1}`}</span>
          <span className="journey-label">{label.startsWith("Find ") ? <>Find<br />{label.slice(5)}</> : label}</span>{i < active && <span className="sr-only">completed</span>}
        </li>
      ))}</ol>
    </nav>
  );
}
