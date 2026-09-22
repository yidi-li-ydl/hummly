import type { QuantizedNote, KeyResult } from "../types";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Krumhansl-Schmuckler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function rotateArray(arr: number[], steps: number): number[] {
  const n = arr.length;
  const s = ((steps % n) + n) % n;
  return [...arr.slice(s), ...arr.slice(0, s)];
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

export function detectKey(notes: QuantizedNote[]): KeyResult {
  // Build duration-weighted pitch class histogram
  const histogram = new Array(12).fill(0);
  for (const note of notes) {
    histogram[note.pitchClass] += note.duration;
  }

  let bestKey = "C";
  let bestMode: "major" | "minor" = "major";
  let bestCorrelation = -Infinity;

  for (let root = 0; root < 12; root++) {
    // Rotate histogram so that root = index 0
    const rotated = rotateArray(histogram, root);

    const majorCorr = pearsonCorrelation(rotated, MAJOR_PROFILE);
    if (majorCorr > bestCorrelation) {
      bestCorrelation = majorCorr;
      bestKey = NOTE_NAMES[root];
      bestMode = "major";
    }

    const minorCorr = pearsonCorrelation(rotated, MINOR_PROFILE);
    if (minorCorr > bestCorrelation) {
      bestCorrelation = minorCorr;
      bestKey = NOTE_NAMES[root];
      bestMode = "minor";
    }
  }

  return { key: bestKey, mode: bestMode, correlation: bestCorrelation };
}
