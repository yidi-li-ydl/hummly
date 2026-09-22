import type { QuantizedNote, KeyResult } from "../types";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

/**
 * Generate a "response phrase" — a suggested continuation melody.
 * Rules:
 * - Stay in key
 * - Start near the last note of the input
 * - Prefer stepwise motion (2nds) with occasional leaps (3rds/4ths)
 * - Tend toward resolving to the tonic or 5th
 * - Same rhythmic feel as the input (similar durations)
 */
export function suggestNextPhrase(
  notes: QuantizedNote[],
  key: KeyResult,
  bpm: number
): QuantizedNote[] {
  if (notes.length === 0) return [];

  const rootPc = NOTE_NAMES.indexOf(key.key);
  const scaleIntervals = key.mode === "major" ? MAJOR_SCALE : MINOR_SCALE;

  // Build the full scale pitch classes
  const scalePcs = scaleIntervals.map((i) => (rootPc + i) % 12);

  // Find scale tones near a given MIDI note (within ±7 semitones)
  function nearbyScaleTones(midi: number): number[] {
    const tones: number[] = [];
    for (let m = midi - 7; m <= midi + 7; m++) {
      const pc = ((m % 12) + 12) % 12;
      if (scalePcs.includes(pc)) tones.push(m);
    }
    return tones;
  }

  // Get average note duration from input for rhythmic consistency
  const avgDuration = notes.reduce((sum, n) => sum + n.duration, 0) / notes.length;
  const beatDuration = 60 / bpm;
  // Snap average duration to nearest 8th note
  const gridUnit = beatDuration / 2;
  const noteDuration = Math.max(Math.round(avgDuration / gridUnit), 1) * gridUnit;

  // Generate 4–8 notes for the response phrase
  const phraseLength = Math.min(Math.max(notes.length, 4), 8);
  const lastNote = notes[notes.length - 1];
  let currentMidi = lastNote.midiNote;
  const result: QuantizedNote[] = [];

  // Start time continues from where the input ended
  const inputEnd = lastNote.startTime + lastNote.duration;
  let currentTime = inputEnd + noteDuration * 0.5; // small gap

  // Target: resolve to tonic or 5th by the end
  const tonicMidi = findNearestScaleTone(currentMidi, rootPc, scalePcs);
  const fifthPc = (rootPc + 7) % 12;

  for (let i = 0; i < phraseLength; i++) {
    const nearby = nearbyScaleTones(currentMidi);
    const isLast = i === phraseLength - 1;
    const isSecondToLast = i === phraseLength - 2;

    let nextMidi: number;

    if (isLast) {
      // Resolve to tonic
      nextMidi = tonicMidi;
    } else if (isSecondToLast) {
      // Move toward tonic — pick the scale tone closest to tonic
      const fifthMidi = findNearestScaleTone(currentMidi, fifthPc, scalePcs);
      nextMidi = fifthMidi;
    } else {
      // Stepwise motion with occasional leaps
      const steps = nearby.filter((m) => {
        const interval = Math.abs(m - currentMidi);
        return interval >= 1 && interval <= 4; // steps and small leaps
      });

      if (steps.length === 0) {
        nextMidi = currentMidi;
      } else {
        // Weighted random: prefer small intervals, slight downward bias for resolution
        const weighted = steps.map((m) => {
          const dist = Math.abs(m - currentMidi);
          const towardTonic = Math.abs(m - tonicMidi) < Math.abs(currentMidi - tonicMidi) ? 1.5 : 1;
          return { midi: m, weight: (1 / dist) * towardTonic };
        });
        nextMidi = weightedPick(weighted);
      }
    }

    const pc = ((nextMidi % 12) + 12) % 12;
    const octave = Math.floor(nextMidi / 12) - 1;

    result.push({
      midiNote: nextMidi,
      name: `${NOTE_NAMES[pc]}${octave}`,
      pitchClass: pc,
      octave,
      startTime: currentTime,
      duration: noteDuration,
    });

    currentMidi = nextMidi;
    currentTime += noteDuration;
  }

  return result;
}

function findNearestScaleTone(midi: number, targetPc: number, scalePcs: number[]): number {
  // Find the nearest MIDI note with the target pitch class that's in the scale
  for (let offset = 0; offset <= 12; offset++) {
    const up = midi + offset;
    const down = midi - offset;
    if (((up % 12) + 12) % 12 === targetPc && scalePcs.includes(targetPc)) return up;
    if (((down % 12) + 12) % 12 === targetPc && scalePcs.includes(targetPc)) return down;
  }
  return midi;
}

function weightedPick(items: { midi: number; weight: number }[]): number {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const item of items) {
    rand -= item.weight;
    if (rand <= 0) return item.midi;
  }
  return items[items.length - 1].midi;
}
