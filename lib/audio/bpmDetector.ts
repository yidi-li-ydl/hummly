/**
 * BPM detection from quantized note onsets.
 *
 * Much more reliable for vocal/humming input than energy-based detection,
 * because it works with actual melodic note changes rather than amplitude
 * transients.
 *
 * Algorithm:
 * 1. Collect inter-onset intervals (IOIs) between consecutive notes
 * 2. For each candidate BPM (60–180), score how well the IOIs align
 *    to multiples of the beat period
 * 3. Pick the BPM with the highest alignment score
 */

import type { QuantizedNote } from "../types";

const MIN_BPM = 60;
const MAX_BPM = 180;

export function detectBpmFromNotes(notes: QuantizedNote[]): number {
  if (notes.length < 2) return 100;

  // Collect inter-onset intervals
  const iois: number[] = [];
  for (let i = 1; i < notes.length; i++) {
    const ioi = notes[i].startTime - notes[i - 1].startTime;
    if (ioi > 0.1 && ioi < 3.0) {
      iois.push(ioi);
    }
  }

  if (iois.length === 0) return 100;

  let bestBpm = 100;
  let bestScore = -Infinity;

  for (let bpm = MIN_BPM; bpm <= MAX_BPM; bpm++) {
    const beatPeriod = 60 / bpm;
    let score = 0;

    for (const ioi of iois) {
      // How close is this IOI to a small integer multiple of the beat?
      const ratio = ioi / beatPeriod;
      const nearest = Math.round(ratio);
      if (nearest >= 1 && nearest <= 4) {
        const error = Math.abs(ratio - nearest);
        // Gaussian-like weight: perfect alignment → 1, far off → ~0
        score += Math.exp(-error * error * 20);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }

  return bestBpm;
}
