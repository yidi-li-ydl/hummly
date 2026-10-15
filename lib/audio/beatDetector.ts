import type { VoicePcm } from "../types";

export interface AudioBeatAnalysis {
  onsets: { time: number; strength: number }[];
  bpm: number;
  offset: number;
  confidence: number;
}

// Radix-2 FFT, used only for the short analysis windows.
function spectrum(real: Float64Array): Float64Array {
  const n = real.length;
  const imag = new Float64Array(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [real[i], real[j]] = [real[j], real[i]];
  }
  for (let size = 2; size <= n; size *= 2) {
    const angle = -2 * Math.PI / size;
    for (let base = 0; base < n; base += size) {
      for (let j = 0; j < size / 2; j++) {
        const a = base + j, b = a + size / 2;
        const c = Math.cos(angle * j), s = Math.sin(angle * j);
        const r = real[b] * c - imag[b] * s;
        const im = real[b] * s + imag[b] * c;
        real[b] = real[a] - r; imag[b] = imag[a] - im;
        real[a] += r; imag[a] += im;
      }
    }
  }
  return Float64Array.from(real.subarray(0, n / 2), (r, i) => Math.log1p(10 * Math.hypot(r, imag[i]) / n));
}

/** Detect attacks from spectral flux and rising energy, then fit a regular beat grid.
 * Attacks are evidence for beats, not an assertion that every syllable is a beat.
 */
export function analyzeAudioBeats(pcm: VoicePcm): AudioBeatAnalysis {
  const empty = { onsets: [], bpm: 100, offset: 0, confidence: 0 };
  if (!pcm.channels.length || pcm.sampleRate <= 0) return empty;
  const input = pcm.channels[0];
  const stride = Math.max(1, Math.floor(pcm.sampleRate / 11025));
  const rate = pcm.sampleRate / stride;
  const n = 512, hop = Math.round(rate * .01);
  const count = Math.ceil(input.length / stride / hop);
  const flux = new Float64Array(count), energy = new Float64Array(count);
  const window = Float64Array.from({ length: n }, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / (n - 1)));
  let previous: Float64Array = new Float64Array(n / 2);
  for (let frame = 0; frame < count; frame++) {
    const samples = new Float64Array(n);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      // Center the window on its timestamp; average samples when downsampling.
      const source = (frame * hop + i - n / 2) * stride;
      let value = 0;
      for (let j = 0; j < stride; j++) value += input[source + j] ?? 0;
      value /= stride;
      sum += value * value; samples[i] = value * window[i];
    }
    energy[frame] = Math.sqrt(sum / n);
    const current = spectrum(samples);
    for (let i = 1; i < current.length; i++) flux[frame] += Math.max(0, current[i] - previous[i]);
    previous = current;
  }
  const maxEnergy = energy.reduce((max, value) => Math.max(max, value), 0);
  const maxFlux = flux.reduce((max, value) => Math.max(max, value), 0);
  if (maxEnergy < .0001 || maxFlux === 0) return empty;
  const novelty = Float64Array.from(flux, (value, i) => value / maxFlux + .4 * Math.max(0, energy[i] - (energy[i - 2] ?? 0)) / maxEnergy);
  const onsets: AudioBeatAnalysis["onsets"] = [];
  for (let i = 1; i < count - 1; i++) {
    let mean = 0;
    const lo = Math.max(0, i - 20), hi = Math.min(count, i + 21);
    for (let j = lo; j < hi; j++) mean += novelty[j];
    mean /= hi - lo;
    if (energy[i] < maxEnergy * .04 || novelty[i] < Math.max(.06, mean * 1.5) || novelty[i] < novelty[i - 1] || novelty[i] <= novelty[i + 1]) continue;
    const onset = { time: i * hop / rate, strength: novelty[i] };
    const last = onsets.at(-1);
    if (last && onset.time - last.time < .12) {
      if (onset.strength > last.strength) onsets[onsets.length - 1] = onset;
    } else onsets.push(onset);
  }
  if (onsets.length < 4) return { ...empty, onsets };
  const total = onsets.reduce((sum, o) => sum + o.strength, 0);
  let best = { bpm: 100, offset: 0, score: -Infinity, alignment: 0 };
  for (let bpm = 50; bpm <= 180; bpm++) {
    const period = 60 / bpm;
    for (let offset = 0; offset < period; offset += .01) {
      let aligned = 0;
      const occupied = new Set<number>();
      for (const onset of onsets) {
        const beat = Math.round((onset.time - offset) / period);
        const error = Math.abs(onset.time - offset - beat * period);
        const weight = Math.exp(-.5 * (error / .055) ** 2);
        aligned += onset.strength * weight;
        if (error < .08) occupied.add(beat);
      }
      const first = Math.round((onsets[0].time - offset) / period);
      const last = Math.round((onsets.at(-1)!.time - offset) / period);
      const coverage = occupied.size / Math.max(1, last - first + 1);
      const alignment = aligned / total;
      const score = alignment * (.65 + .35 * coverage);
      if (score > best.score) best = { bpm, offset, score, alignment };
    }
  }
  return { onsets, bpm: best.bpm, offset: Number(best.offset.toFixed(2)), confidence: best.alignment * Math.min(1, onsets.length / 12) };
}
