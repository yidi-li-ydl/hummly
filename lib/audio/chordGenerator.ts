import type { KeyResult, Chord, ChordProgression } from "../types";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Semitone intervals from root for diatonic scale degrees
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]; // natural minor

// Chord quality: [root offset, third offset, fifth offset] in semitones from chord root
// Major = [0, 4, 7], Minor = [0, 3, 7], Diminished = [0, 3, 6]
const MAJOR_CHORD_QUALITIES: [number, number, number][] = [
  [0, 4, 7], // I - major
  [0, 3, 7], // ii - minor
  [0, 3, 7], // iii - minor
  [0, 4, 7], // IV - major
  [0, 4, 7], // V - major
  [0, 3, 7], // vi - minor
  [0, 3, 6], // vii° - diminished
];

const MINOR_CHORD_QUALITIES: [number, number, number][] = [
  [0, 3, 7], // i - minor
  [0, 3, 6], // ii° - diminished
  [0, 4, 7], // III - major
  [0, 3, 7], // iv - minor
  [0, 3, 7], // v - minor
  [0, 4, 7], // VI - major
  [0, 4, 7], // VII - major
];

const MAJOR_ROMAN = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
const MINOR_ROMAN = ["i", "ii°", "III", "iv", "v", "VI", "VII"];

function buildDiatonicChords(rootNote: number, mode: "major" | "minor"): Chord[] {
  const scale = mode === "major" ? MAJOR_SCALE : MINOR_SCALE;
  const qualities = mode === "major" ? MAJOR_CHORD_QUALITIES : MINOR_CHORD_QUALITIES;
  const romanNumerals = mode === "major" ? MAJOR_ROMAN : MINOR_ROMAN;

  return scale.map((interval, degree) => {
    const chordRoot = (rootNote + interval) % 12;
    const quality = qualities[degree];
    // Voice: root in octave 3, 3rd and 5th in octave 4
    const rootMidi = 48 + chordRoot; // C3 = 48
    const thirdMidi = 60 + ((chordRoot + quality[1]) % 12); // C4 = 60
    const fifthMidi = 60 + ((chordRoot + quality[2]) % 12); // C4 = 60

    const chordName = NOTE_NAMES[chordRoot];
    const isMinor = quality[1] === 3;
    const isDim = quality[2] === 6;
    const suffix = isDim ? "dim" : isMinor ? "m" : "";

    return {
      name: `${chordName}${suffix}`,
      symbol: romanNumerals[degree],
      notes: [rootMidi, thirdMidi, fifthMidi],
    };
  });
}

interface ProgressionTemplate {
  name: string;
  description: string;
  degrees: number[]; // 0-indexed scale degrees
}

const MAJOR_PROGRESSIONS: ProgressionTemplate[] = [
  { name: "Pop Anthem", description: "I - V - vi - IV", degrees: [0, 4, 5, 3] },
  { name: "Classic Pop", description: "I - vi - IV - V", degrees: [0, 5, 3, 4] },
  { name: "Emotional", description: "vi - IV - I - V", degrees: [5, 3, 0, 4] },
  { name: "Jazz Lite", description: "ii - V - I - vi", degrees: [1, 4, 0, 5] },
];

const MINOR_PROGRESSIONS: ProgressionTemplate[] = [
  { name: "Minor Pop", description: "i - VI - III - VII", degrees: [0, 5, 2, 6] },
  { name: "Dramatic", description: "i - iv - VII - III", degrees: [0, 3, 6, 2] },
  { name: "Dark Drive", description: "i - VII - VI - VII", degrees: [0, 6, 5, 6] },
  { name: "Minor Classic", description: "i - iv - v - i", degrees: [0, 3, 4, 0] },
];

export function generateChordProgressions(keyResult: KeyResult): ChordProgression[] {
  const rootIndex = NOTE_NAMES.indexOf(keyResult.key);
  const diatonicChords = buildDiatonicChords(rootIndex, keyResult.mode);
  const templates = keyResult.mode === "major" ? MAJOR_PROGRESSIONS : MINOR_PROGRESSIONS;

  return templates.map((template) => ({
    name: template.name,
    description: `${keyResult.key} ${keyResult.mode}: ${template.description}`,
    chords: template.degrees.map((deg) => diatonicChords[deg]),
  }));
}
