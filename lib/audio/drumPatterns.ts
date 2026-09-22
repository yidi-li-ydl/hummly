import type { DrumStyle, DrumHit } from "../types";

function makeHits(
  kicks: string[],
  snares: string[],
  hihats: string[]
): DrumHit[] {
  return [
    ...kicks.map((t): DrumHit => ({ time: t, instrument: "kick" })),
    ...snares.map((t): DrumHit => ({ time: t, instrument: "snare" })),
    ...hihats.map((t): DrumHit => ({ time: t, instrument: "hihat" })),
  ];
}

export const DRUM_STYLES: DrumStyle[] = [
  // --- 4/4 patterns ---
  {
    name: "Pop Rock",
    bpm: 120,
    beatsPerBar: 4,
    description: "Classic four-on-the-floor with driving energy",
    pattern: makeHits(
      ["0:0:0", "0:1:0", "0:2:0", "0:3:0"],
      ["0:1:0", "0:3:0"],
      ["0:0:0", "0:0:2", "0:1:0", "0:1:2", "0:2:0", "0:2:2", "0:3:0", "0:3:2"]
    ),
  },
  {
    name: "Lo-fi",
    bpm: 85,
    beatsPerBar: 4,
    description: "Laid-back beats with sparse feel",
    pattern: makeHits(
      ["0:0:0", "0:2:0"],
      ["0:1:0", "0:3:0"],
      ["0:0:0", "0:0:2", "0:1:0", "0:1:2", "0:2:0", "0:2:2", "0:3:0", "0:3:2"]
    ),
  },
  {
    name: "Hip-hop",
    bpm: 90,
    beatsPerBar: 4,
    description: "Boom-bap groove with swing",
    pattern: makeHits(
      ["0:0:0", "0:0:3", "0:2:0"],
      ["0:1:0", "0:3:0"],
      ["0:0:0", "0:0:2", "0:1:0", "0:1:2", "0:2:0", "0:2:2", "0:3:0", "0:3:2"]
    ),
  },
  {
    name: "Acoustic",
    bpm: 100,
    beatsPerBar: 4,
    description: "Simple and natural, singer-songwriter style",
    pattern: makeHits(
      ["0:0:0", "0:2:0"],
      ["0:1:0", "0:3:0"],
      ["0:0:0", "0:1:0", "0:2:0", "0:3:0"]
    ),
  },
  {
    name: "Electronic",
    bpm: 128,
    beatsPerBar: 4,
    description: "Pulsing four-on-the-floor with open hats",
    pattern: makeHits(
      ["0:0:0", "0:1:0", "0:2:0", "0:3:0"],
      ["0:1:0", "0:3:0"],
      ["0:0:0", "0:0:1", "0:0:2", "0:0:3", "0:1:0", "0:1:1", "0:1:2", "0:1:3", "0:2:0", "0:2:1", "0:2:2", "0:2:3", "0:3:0", "0:3:1", "0:3:2", "0:3:3"]
    ),
  },
  {
    name: "Funk",
    bpm: 110,
    beatsPerBar: 4,
    description: "Syncopated groove with ghost snares and busy hi-hats",
    pattern: makeHits(
      ["0:0:0", "0:1:2", "0:3:0"],
      ["0:1:0", "0:2:2", "0:3:0"],
      ["0:0:0", "0:0:1", "0:0:2", "0:0:3", "0:1:0", "0:1:1", "0:1:2", "0:1:3", "0:2:0", "0:2:1", "0:2:2", "0:2:3", "0:3:0", "0:3:1", "0:3:2", "0:3:3"]
    ),
  },
  {
    name: "Reggae",
    bpm: 80,
    beatsPerBar: 4,
    description: "One-drop kick with offbeat accents",
    pattern: makeHits(
      ["0:2:0"],
      ["0:1:0", "0:3:0"],
      ["0:0:2", "0:1:2", "0:2:2", "0:3:2"]
    ),
  },
  {
    name: "Shuffle",
    bpm: 115,
    beatsPerBar: 4,
    description: "Triplet-feel swing with driving backbeat",
    pattern: makeHits(
      ["0:0:0", "0:2:0"],
      ["0:1:0", "0:3:0"],
      ["0:0:0", "0:0:2", "0:1:0", "0:1:2", "0:2:0", "0:2:2", "0:3:0", "0:3:2"]
    ),
  },
  // --- 3/4 patterns ---
  {
    name: "Waltz",
    bpm: 100,
    beatsPerBar: 3,
    description: "Classic waltz: strong downbeat, snare on 2 & 3",
    pattern: makeHits(
      ["0:0:0"],
      ["0:1:0", "0:2:0"],
      ["0:0:0", "0:1:0", "0:2:0"]
    ),
  },
  {
    name: "Ballad 3/4",
    bpm: 80,
    beatsPerBar: 3,
    description: "Sparse and gentle with kick-snare on 1 and 3",
    pattern: makeHits(
      ["0:0:0"],
      ["0:2:0"],
      ["0:0:0", "0:0:2", "0:1:0", "0:1:2", "0:2:0", "0:2:2"]
    ),
  },
  {
    name: "Folk Waltz",
    bpm: 110,
    beatsPerBar: 3,
    description: "Lively folk feel with kick on 1 & 3, snare on 2",
    pattern: makeHits(
      ["0:0:0", "0:2:0"],
      ["0:1:0"],
      ["0:0:0", "0:0:2", "0:1:0", "0:1:2", "0:2:0", "0:2:2"]
    ),
  },
];
