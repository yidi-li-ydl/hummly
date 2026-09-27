/**
 * Loads and caches instrument samples for realistic playback.
 * Piano: Salamander Grand Piano samples from tonejs.github.io CDN
 * Drums: Real samples from tonejs.github.io/audio/drum-samples CDN
 */

import type { DrumKit } from "../types";

export interface DecodedSample {
  channels: Float32Array[];
  sampleRate: number;
  length: number;
  midiNote: number;
}

export interface DrumSamples {
  kick: DecodedSample;
  snare: DecodedSample;
  hihat: DecodedSample;
}

export interface SampleBank {
  piano: DecodedSample[];
  kick: DecodedSample;
  snare: DecodedSample;
  hihat: DecodedSample;
}

const PIANO_NOTES = [
  { name: "C3", midi: 48 },
  { name: "Ds3", midi: 51 },
  { name: "Fs3", midi: 54 },
  { name: "A3", midi: 57 },
  { name: "C4", midi: 60 },
  { name: "Ds4", midi: 63 },
  { name: "Fs4", midi: 66 },
  { name: "A4", midi: 69 },
];

const SALAMANDER_URL = "https://tonejs.github.io/audio/salamander/";
const DRUM_SAMPLES_URL = "https://tonejs.github.io/audio/drum-samples/";

let cachedPiano: DecodedSample[] | null = null;
const cachedDrumKits = new Map<DrumKit, DrumSamples>();

function extractChannels(buf: AudioBuffer): Float32Array[] {
  const chs: Float32Array[] = [];
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    chs.push(new Float32Array(buf.getChannelData(ch)));
  }
  return chs;
}

async function loadDrumKit(kit: DrumKit): Promise<DrumSamples> {
  const existing = cachedDrumKits.get(kit);
  if (existing) return existing;

  const ctx = new AudioContext();
  const instruments = ["kick", "snare", "hihat"] as const;
  const results = await Promise.all(
    instruments.map(async (inst) => {
      const res = await fetch(`${DRUM_SAMPLES_URL}${kit}/${inst}.mp3`);
      const ab = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab);
      return {
        channels: extractChannels(buf),
        sampleRate: buf.sampleRate,
        length: buf.length,
        midiNote: 0,
      } as DecodedSample;
    })
  );
  await ctx.close();

  const samples: DrumSamples = {
    kick: results[0],
    snare: results[1],
    hihat: results[2],
  };
  cachedDrumKits.set(kit, samples);
  return samples;
}

export async function loadSampleBank(drumKit: DrumKit = "acoustic-kit"): Promise<SampleBank> {
  const [piano, drums] = await Promise.all([
    loadPiano(),
    loadDrumKit(drumKit),
  ]);

  return { piano, ...drums };
}

async function loadPiano(): Promise<DecodedSample[]> {
  if (cachedPiano) return cachedPiano;

  const ctx = new AudioContext();
  const pianoPromises = PIANO_NOTES.map(async (n) => {
    const res = await fetch(`${SALAMANDER_URL}${n.name}.mp3`);
    const ab = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(ab);
    return {
      channels: extractChannels(buf),
      sampleRate: buf.sampleRate,
      length: buf.length,
      midiNote: n.midi,
    } as DecodedSample;
  });

  cachedPiano = await Promise.all(pianoPromises);
  await ctx.close();
  return cachedPiano;
}

export { loadDrumKit };

export function findNearestPianoSample(
  bank: SampleBank,
  midiNote: number
): { sample: DecodedSample; rate: number } {
  let nearest = bank.piano[0];
  let minDist = Math.abs(midiNote - nearest.midiNote);
  for (const s of bank.piano) {
    const d = Math.abs(midiNote - s.midiNote);
    if (d < minDist) {
      minDist = d;
      nearest = s;
    }
  }
  return {
    sample: nearest,
    rate: Math.pow(2, (midiNote - nearest.midiNote) / 12),
  };
}
