import type { Chord, KeyResult } from "./types";

export type MusicalColor = "lavender" | "peach" | "mint" | "pink";
const PITCH_CLASSES: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

/** Color follows harmonic role relative to the detected tonic, never list position. */
export function chordVisual(chord: Chord, key: KeyResult): { color: MusicalColor; role: string } {
  const root = ((chord.notes[0] ?? 0) % 12 + 12) % 12;
  const interval = (root - (PITCH_CLASSES[key.key] ?? 0) + 12) % 12;
  if (interval === 0) return { color: "lavender", role: "Home chord" };
  if (interval === 7) return { color: "peach", role: "Dominant chord" };
  if (interval === 2 || interval === 5) return { color: "mint", role: "Supporting chord" };
  return { color: "pink", role: "Color chord" };
}
