import type { CSSProperties } from "react";
import type { DrumStyle } from "@/lib/types";
import { rhythmSteps } from "@/lib/audio/rhythmVisualization";

interface Props {
  pattern: DrumStyle;
  playbackStep: number | null;
  paused?: boolean;
}

/** Heights encode instrument category, never amplitude. Timing comes from audio. */
export default function MiniBeatBars({ pattern, playbackStep, paused = false }: Props) {
  const bar = rhythmSteps(pattern);
  // Show a readable two-bar window; the audio-clock cursor wraps across the four-bar audition.
  const steps = [...bar, ...bar];
  const current = playbackStep === null ? null : playbackStep % steps.length;
  return <div className="mini-beat-bars" aria-hidden="true" style={{ "--rhythm-count": steps.length } as CSSProperties}>
    {steps.map((hits, step) => <span key={step} className={`mini-beat-step${current === step ? " is-current" : ""}${paused ? " is-paused" : ""}`}>
      {hits.length ? hits.map((hit, i) => <span key={i} className={`mini-beat-bar mini-beat-bar--${hit.instrument}`} />)
        : <span className="mini-beat-bar mini-beat-bar--empty" />}
    </span>)}
  </div>;
}
