import type { PitchReading, QuantizedNote } from "../types";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export { NOTE_NAMES };
const MIN_NOTE_DURATION = 0.08; // 80ms minimum
const MEDIAN_WINDOW = 3; // 3-point median filter (~150ms at 50ms polling)
const GAP_BRIDGE_THRESHOLD = 0.2; // 200ms gap bridging

function frequencyToMidi(freq: number): number {
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

function midiToNoteName(midi: number): string {
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pitchClass]}${octave}`;
}

/** Median of a small array (copies & sorts to avoid mutation). */
function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

interface NoteRun {
  midiNote: number;
  startTime: number;
  endTime: number;
}

export function quantizeNotes(readings: PitchReading[]): QuantizedNote[] {
  if (readings.length === 0) return [];

  // Stage 1: Convert frequencies to MIDI
  const rawMidi = readings.map((r) => frequencyToMidi(r.frequency));

  // Stage 1b: Median-filter MIDI values to smooth pitch wobble
  const smoothed = rawMidi.map((_, i) => {
    const half = Math.floor(MEDIAN_WINDOW / 2);
    const start = Math.max(0, i - half);
    const end = Math.min(rawMidi.length, i + half + 1);
    return median(rawMidi.slice(start, end));
  });

  const midiReadings = smoothed.map((midi, i) => ({
    midi,
    time: readings[i].time,
  }));

  // Stage 2: Run-length encoding with gap bridging
  const runs: NoteRun[] = [];
  let currentRun: NoteRun | null = null;

  for (const reading of midiReadings) {
    if (currentRun === null) {
      currentRun = { midiNote: reading.midi, startTime: reading.time, endTime: reading.time };
    } else if (reading.midi === currentRun.midiNote) {
      currentRun.endTime = reading.time;
    } else if (reading.time - currentRun.endTime < GAP_BRIDGE_THRESHOLD && reading.midi === currentRun.midiNote) {
      // Bridge small gaps of same note
      currentRun.endTime = reading.time;
    } else {
      runs.push(currentRun);
      currentRun = { midiNote: reading.midi, startTime: reading.time, endTime: reading.time };
    }
  }
  if (currentRun) runs.push(currentRun);

  // Merge consecutive runs of the same note with small gaps
  const merged: NoteRun[] = [];
  for (const run of runs) {
    const prev = merged[merged.length - 1];
    if (prev && prev.midiNote === run.midiNote && run.startTime - prev.endTime < GAP_BRIDGE_THRESHOLD) {
      prev.endTime = run.endTime;
    } else {
      merged.push({ ...run });
    }
  }

  // Stage 3: Convert to QuantizedNotes, filtering short notes
  return merged
    .filter((run) => {
      const duration = run.endTime - run.startTime + 0.05; // Add one poll interval
      return duration >= MIN_NOTE_DURATION;
    })
    .map((run) => {
      const pitchClass = ((run.midiNote % 12) + 12) % 12;
      const octave = Math.floor(run.midiNote / 12) - 1;
      const duration = run.endTime - run.startTime + 0.05;
      return {
        midiNote: run.midiNote,
        name: midiToNoteName(run.midiNote),
        pitchClass,
        octave,
        startTime: run.startTime,
        duration: Math.max(duration, MIN_NOTE_DURATION),
      };
    });
}

/**
 * Snap note start times and durations to the nearest beat subdivision.
 * subdivision = 16 means snap to 16th notes.
 */
export function snapToGrid(notes: QuantizedNote[], bpm: number, subdivision = 16): QuantizedNote[] {
  if (notes.length === 0) return [];

  const beatDuration = 60 / bpm; // seconds per beat
  const gridUnit = beatDuration / (subdivision / 4); // seconds per grid unit (16th = beatDuration/4)

  function snapTime(t: number): number {
    return Math.round(t / gridUnit) * gridUnit;
  }

  function snapDuration(d: number): number {
    const snapped = Math.max(Math.round(d / gridUnit), 1) * gridUnit;
    return snapped;
  }

  return notes.map((note) => ({
    ...note,
    startTime: snapTime(note.startTime),
    duration: snapDuration(note.duration),
  }));
}
