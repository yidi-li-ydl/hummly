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
  {
    name: "Pop Rock",
    bpm: 120,
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
    description: "Pulsing four-on-the-floor with open hats",
    pattern: makeHits(
      ["0:0:0", "0:1:0", "0:2:0", "0:3:0"],
      ["0:1:0", "0:3:0"],
      ["0:0:0", "0:0:1", "0:0:2", "0:0:3", "0:1:0", "0:1:1", "0:1:2", "0:1:3", "0:2:0", "0:2:1", "0:2:2", "0:2:3", "0:3:0", "0:3:1", "0:3:2", "0:3:3"]
    ),
  },
];
