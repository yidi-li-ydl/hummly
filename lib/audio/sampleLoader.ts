/**
 * Loads and caches instrument samples for realistic playback.
 * Piano: Salamander Grand Piano samples from tonejs.github.io CDN
 * Drums: Synthesized one-shot samples (high-quality synthesis)
 */

export interface DecodedSample {
  channels: Float32Array[];
  sampleRate: number;
  length: number;
  midiNote: number;
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

let cached: SampleBank | null = null;

function extractChannels(buf: AudioBuffer): Float32Array[] {
  const chs: Float32Array[] = [];
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    chs.push(new Float32Array(buf.getChannelData(ch)));
  }
  return chs;
}

function synthKick(): DecodedSample {
  const sr = 44100;
  const len = Math.floor(sr * 0.4);
  const data = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const freq = 40 + 110 * Math.exp(-t * 35);
    const env = Math.exp(-t * 7) * 0.85;
    const click = i < sr * 0.003 ? (1 - i / (sr * 0.003)) * 0.25 : 0;
    data[i] =
      Math.sin(2 * Math.PI * freq * t + Math.sin(2 * Math.PI * freq * 0.5 * t) * 0.3) * env +
      click;
  }
  return { channels: [data], sampleRate: sr, length: len, midiNote: 0 };
}

function synthSnare(): DecodedSample {
  const sr = 44100;
  const len = Math.floor(sr * 0.25);
  const data = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const body = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 25) * 0.3;
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 12) * 0.3;
    const snap = (Math.random() * 2 - 1) * Math.exp(-t * 60) * 0.25;
    data[i] = body + noise + snap;
  }
  return { channels: [data], sampleRate: sr, length: len, midiNote: 0 };
}

function synthHihat(): DecodedSample {
  const sr = 44100;
  const len = Math.floor(sr * 0.08);
  const data = new Float32Array(len);
  const freqs = [3500, 5000, 7500, 10000];
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let sum = 0;
    for (const f of freqs) {
      sum += Math.sin(2 * Math.PI * f * t + Math.random() * 0.1) * 0.12;
    }
    sum += (Math.random() * 2 - 1) * 0.12;
    data[i] = sum * Math.exp(-t * 55);
  }
  return { channels: [data], sampleRate: sr, length: len, midiNote: 0 };
}

export async function loadSampleBank(): Promise<SampleBank> {
  if (cached) return cached;

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

  const piano = await Promise.all(pianoPromises);
  await ctx.close();

  cached = { piano, kick: synthKick(), snare: synthSnare(), hihat: synthHihat() };
  return cached;
}

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
