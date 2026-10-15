import type { DrumHit, DrumStyle } from "../types";

/** Keep every event, including simultaneous hits, at its actual subdivision. */
export function rhythmSteps(style: DrumStyle): DrumHit[][] {
  const steps = Array.from({ length: style.beatsPerBar * 4 }, () => [] as DrumHit[]);
  for (const hit of style.pattern) {
    const [bar, beat, subdivision] = hit.time.split(":").map(Number);
    const index = bar * style.beatsPerBar * 4 + beat * 4 + subdivision;
    if (steps[index]) steps[index].push(hit);
  }
  return steps;
}
