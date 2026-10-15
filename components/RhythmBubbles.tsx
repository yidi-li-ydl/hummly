import type { CSSProperties } from "react";
import type { DrumStyle } from "@/lib/types";
import { rhythmSteps } from "@/lib/audio/rhythmVisualization";

interface Props {
  pattern: DrumStyle;
  playbackStep: number | null;
  paused?: boolean;
}

/** Visualization only. Playback position comes from the existing audio clock. */
export default function RhythmBubbles({ pattern, playbackStep, paused = false }: Props) {
  const steps = rhythmSteps(pattern);
  const current = playbackStep === null ? null : playbackStep % steps.length;
  return <div className="rhythm-bubbles" aria-hidden="true" style={{ "--rhythm-count": steps.length } as CSSProperties}>
    {steps.map((hits, step) => <span key={step} className={`rhythm-bubble-step${current === step ? " is-current" : ""}${paused ? " is-paused" : ""}`}>
      {hits.length ? hits.map((hit, i) => <span key={i} className={`rhythm-bubble rhythm-bubble--${hit.instrument}`} />)
        : <span className="rhythm-bubble rhythm-bubble--empty" />}
    </span>)}
  </div>;
}
