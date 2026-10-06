import type { ChordPattern } from "../types";

export const CHORD_PATTERNS: ChordPattern[] = [
  // --- 4/4 patterns ---
  {
    name: "Whole",
    description: "Block chord held for the whole bar",
    beatsPerBar: 4,
    hits: [
      { beat: 0, tones: [0, 1, 2], velocity: 1, sustain: 4 },
    ],
  },
  {
    name: "Half Notes",
    description: "Chord on beats 1 and 3",
    beatsPerBar: 4,
    hits: [
      { beat: 0, tones: [0, 1, 2], velocity: 1, sustain: 1.8 },
      { beat: 2, tones: [0, 1, 2], velocity: 0.85, sustain: 1.8 },
    ],
  },
  {
    name: "Arpeggio",
    description: "One note per beat, ascending",
    beatsPerBar: 4,
    hits: [
      { beat: 0, tones: [0], velocity: 1, sustain: 0.9 },
      { beat: 1, tones: [1], velocity: 0.8, sustain: 0.9 },
      { beat: 2, tones: [2], velocity: 0.8, sustain: 0.9 },
      { beat: 3, tones: [3], velocity: 0.75, sustain: 0.9 },
    ],
  },
  {
    name: "Fingerpick",
    description: "Alternating bass and treble in 8th notes",
    beatsPerBar: 4,
    hits: [
      { beat: 0,   tones: [0], velocity: 1,    sustain: 0.4 },
      { beat: 0.5, tones: [2], velocity: 0.7,  sustain: 0.4 },
      { beat: 1,   tones: [1], velocity: 0.8,  sustain: 0.4 },
      { beat: 1.5, tones: [2], velocity: 0.7,  sustain: 0.4 },
      { beat: 2,   tones: [0], velocity: 0.9,  sustain: 0.4 },
      { beat: 2.5, tones: [2], velocity: 0.7,  sustain: 0.4 },
      { beat: 3,   tones: [1], velocity: 0.8,  sustain: 0.4 },
      { beat: 3.5, tones: [2], velocity: 0.7,  sustain: 0.4 },
    ],
  },
  {
    name: "Pop Strum",
    description: "Guitar-style down-up strum pattern",
    beatsPerBar: 4,
    hits: [
      { beat: 0,   tones: [0, 1, 2], velocity: 1,    sustain: 0.4 }, // down
      { beat: 1,   tones: [0, 1, 2], velocity: 0.8,  sustain: 0.4 }, // down
      { beat: 1.5, tones: [1, 2],    velocity: 0.6,  sustain: 0.35 }, // up
      { beat: 2.5, tones: [1, 2],    velocity: 0.6,  sustain: 0.35 }, // up
      { beat: 3,   tones: [0, 1, 2], velocity: 0.85, sustain: 0.4 }, // down
      { beat: 3.5, tones: [1, 2],    velocity: 0.55, sustain: 0.35 }, // up
    ],
  },
  {
    name: "Driving 8ths",
    description: "Every 8th note, full chord with accents",
    beatsPerBar: 4,
    hits: [
      { beat: 0,   tones: [0, 1, 2], velocity: 1,    sustain: 0.4 },
      { beat: 0.5, tones: [0, 1, 2], velocity: 0.6,  sustain: 0.4 },
      { beat: 1,   tones: [0, 1, 2], velocity: 0.85, sustain: 0.4 },
      { beat: 1.5, tones: [0, 1, 2], velocity: 0.6,  sustain: 0.4 },
      { beat: 2,   tones: [0, 1, 2], velocity: 0.9,  sustain: 0.4 },
      { beat: 2.5, tones: [0, 1, 2], velocity: 0.6,  sustain: 0.4 },
      { beat: 3,   tones: [0, 1, 2], velocity: 0.85, sustain: 0.4 },
      { beat: 3.5, tones: [0, 1, 2], velocity: 0.6,  sustain: 0.4 },
    ],
  },
  // --- 3/4 patterns ---
  {
    name: "Waltz",
    description: "Bass on 1, chord on 2 and 3",
    beatsPerBar: 3,
    hits: [
      { beat: 0, tones: [0],    velocity: 1,   sustain: 0.9 },
      { beat: 1, tones: [1, 2], velocity: 0.7, sustain: 0.9 },
      { beat: 2, tones: [1, 2], velocity: 0.65, sustain: 0.9 },
    ],
  },
  {
    name: "Arpeggio 3/4",
    description: "One note per beat, ascending",
    beatsPerBar: 3,
    hits: [
      { beat: 0, tones: [0], velocity: 1,   sustain: 0.9 },
      { beat: 1, tones: [1], velocity: 0.8, sustain: 0.9 },
      { beat: 2, tones: [2], velocity: 0.8, sustain: 0.9 },
    ],
  },
  {
    name: "Broken Waltz",
    description: "Six 8th-note arpeggiated pattern",
    beatsPerBar: 3,
    hits: [
      { beat: 0,   tones: [0], velocity: 1,    sustain: 0.4 },
      { beat: 0.5, tones: [2], velocity: 0.7,  sustain: 0.4 },
      { beat: 1,   tones: [1], velocity: 0.8,  sustain: 0.4 },
      { beat: 1.5, tones: [2], velocity: 0.7,  sustain: 0.4 },
      { beat: 2,   tones: [1], velocity: 0.75, sustain: 0.4 },
      { beat: 2.5, tones: [2], velocity: 0.7,  sustain: 0.4 },
    ],
  },
];
