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
  { name: "Canon", description: "I - V - vi - iii - IV - I - IV - V", degrees: [0, 4, 5, 2, 3, 0, 3, 4] },
  { name: "Rock Solid", description: "I - IV - V - I", degrees: [0, 3, 4, 0] },
  { name: "Dreamy", description: "I - iii - vi - IV", degrees: [0, 2, 5, 3] },
  { name: "Folk", description: "I - IV - I - V", degrees: [0, 3, 0, 4] },
];

const MINOR_PROGRESSIONS: ProgressionTemplate[] = [
  { name: "Minor Pop", description: "i - VI - III - VII", degrees: [0, 5, 2, 6] },
  { name: "Dramatic", description: "i - iv - VII - III", degrees: [0, 3, 6, 2] },
  { name: "Dark Drive", description: "i - VII - VI - VII", degrees: [0, 6, 5, 6] },
  { name: "Minor Classic", description: "i - iv - v - i", degrees: [0, 3, 4, 0] },
  { name: "Andalusian", description: "i - VII - VI - V", degrees: [0, 6, 5, 4] },
  { name: "Moody", description: "i - III - VII - iv", degrees: [0, 2, 6, 3] },
  { name: "Cinematic", description: "i - VI - iv - VII", degrees: [0, 5, 3, 6] },
  { name: "Grunge", description: "i - iv - III - VI", degrees: [0, 3, 2, 5] },
];

function getRelativeKey(key: string, mode: "major" | "minor"): { key: string; mode: "major" | "minor" } {
  const root = NOTE_NAMES.indexOf(key);
  if (mode === "major") {
    return { key: NOTE_NAMES[(root + 9) % 12], mode: "minor" };
  } else {
    return { key: NOTE_NAMES[(root + 3) % 12], mode: "major" };
  }
}

export function generateChordProgressions(
  keyResult: KeyResult,
  includeRelative = true
): ChordProgression[] {
  const rootIndex = NOTE_NAMES.indexOf(keyResult.key);
  const diatonicChords = buildDiatonicChords(rootIndex, keyResult.mode);
  const templates = keyResult.mode === "major" ? MAJOR_PROGRESSIONS : MINOR_PROGRESSIONS;

  const primary = templates.map((template) => ({
    name: template.name,
    description: `${keyResult.key} ${keyResult.mode}: ${template.description}`,
    chords: template.degrees.map((deg) => diatonicChords[deg]),
  }));

  if (!includeRelative) return primary;

  const rel = getRelativeKey(keyResult.key, keyResult.mode);
  const relRoot = NOTE_NAMES.indexOf(rel.key);
  const relChords = buildDiatonicChords(relRoot, rel.mode);
  const relTemplates = rel.mode === "major" ? MAJOR_PROGRESSIONS : MINOR_PROGRESSIONS;

  const secondary = relTemplates.map((template) => ({
    name: `${template.name} (${rel.key} ${rel.mode})`,
    description: `${rel.key} ${rel.mode}: ${template.description} (relative ${rel.mode})`,
    chords: template.degrees.map((deg) => relChords[deg]),
  }));

  return [...primary, ...secondary];
}

// --- B-section chord recommendation ---

/** Pitch classes (0–11) present in a chord's MIDI notes. */
function chordPitchClasses(chord: Chord): Set<number> {
  return new Set(chord.notes.map((n) => n % 12));
}

/** Count how many pitch classes two chords share. */
function commonTones(a: Chord, b: Chord): number {
  const setA = chordPitchClasses(a);
  let count = 0;
  for (const pc of chordPitchClasses(b)) {
    if (setA.has(pc)) count++;
  }
  return count;
}

/**
 * How many chords (by name) are identical between two progressions,
 * normalized to 0–1 where 1 = every chord position matches.
 */
function chordOverlap(a: ChordProgression, b: ChordProgression): number {
  const len = Math.min(a.chords.length, b.chords.length);
  if (len === 0) return 0;
  let matches = 0;
  for (let i = 0; i < len; i++) {
    if (a.chords[i].name === b.chords[i].name) matches++;
  }
  return matches / Math.max(a.chords.length, b.chords.length);
}

/**
 * Score how well B's last chord resolves back to A's first chord.
 * Strong resolutions (V→I, iv→I, VII→i, etc.) get higher scores.
 */
function resolutionScore(lastOfB: Chord, firstOfA: Chord): number {
  const from = lastOfB.notes[0] % 12; // root pitch class
  const to = firstOfA.notes[0] % 12;
  const interval = ((to - from) + 12) % 12; // semitones up from B-last to A-first

  // Perfect cadence: V → I (interval 7 up from V root = 5 semitones down, i.e. interval 7)
  if (interval === 7) return 3;
  // Plagal cadence: IV → I (interval 5)
  if (interval === 5) return 2.5;
  // Subtonic resolution: VII → I (interval 1 — one semitone below, leading tone)
  if (interval === 1) return 2.5;
  // bVII → i (interval 2 — whole step, common in minor)
  if (interval === 2) return 2;
  // ii → I (interval 10, i.e. whole step down)
  if (interval === 10) return 1.5;
  // vi → I (interval 4) or III → i (interval 8)
  if (interval === 4 || interval === 8) return 1;

  return 0;
}

/**
 * Rank B-section chord progression candidates by music-theory compatibility
 * with the chosen A-section. Returns a new array sorted best-first, excluding
 * the A progression itself.
 */
export function rankBProgressions(
  aProgression: ChordProgression,
  allOptions: ChordProgression[]
): ChordProgression[] {
  const candidates = allOptions.filter((p) => p.name !== aProgression.name);

  const scored = candidates.map((b) => {
    // 1. Voice-leading smoothness: common tones between A's last chord and B's first chord
    const voiceLeading = commonTones(
      aProgression.chords[aProgression.chords.length - 1],
      b.chords[0]
    );

    // 2. Harmonic contrast: penalize high overlap (identical or near-identical sequences)
    const overlap = chordOverlap(aProgression, b);
    const contrast = 1 - overlap; // 0 = identical, 1 = completely different

    // 3. Resolution quality: how well B's last chord leads back to A's first chord
    const resolution = resolutionScore(
      b.chords[b.chords.length - 1],
      aProgression.chords[0]
    );

    // Weighted total (higher = better)
    const score = voiceLeading * 1.0 + contrast * 2.0 + resolution * 1.5;

    return { progression: b, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.progression);
}
