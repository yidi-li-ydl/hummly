import type { PitchReading, KeyResult } from "../types";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

function buildScalePcs(key: KeyResult): number[] {
  const rootPc = NOTE_NAMES.indexOf(key.key);
  const intervals = key.mode === "major" ? MAJOR_SCALE : MINOR_SCALE;
  return intervals.map((i) => (rootPc + i) % 12);
}

function snapMidiToScale(midi: number, scalePcs: number[]): number {
  for (let offset = 0; offset <= 6; offset++) {
    const up = midi + offset;
    const down = midi - offset;
    if (scalePcs.includes(((up % 12) + 12) % 12)) return up;
    if (offset > 0 && scalePcs.includes(((down % 12) + 12) % 12)) return down;
  }
  return midi;
}

/** Binary search for the nearest pitch reading within 100ms of the given time. */
function findNearestReading(readings: PitchReading[], time: number): PitchReading | null {
  if (readings.length === 0) return null;

  let lo = 0;
  let hi = readings.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (readings[mid].time < time) lo = mid + 1;
    else hi = mid;
  }

  let best = readings[lo];
  if (lo > 0 && Math.abs(readings[lo - 1].time - time) < Math.abs(best.time - time)) {
    best = readings[lo - 1];
  }

  return Math.abs(best.time - time) < 0.1 ? best : null;
}

/**
 * Autotune voice audio using granular pitch correction.
 *
 * Splits the voice into short overlapping grains (30ms, 50% overlap with Hann window).
 * For each grain, the detected pitch is snapped to the nearest scale tone and the grain
 * is resampled at the corrected rate. Overlap-add reconstruction produces a smooth,
 * continuous output — which also fixes choppy/discontinuous recordings.
 */
export function autotuneVoice(
  voiceChannels: Float32Array[],
  voiceSampleRate: number,
  pitchReadings: PitchReading[],
  key: KeyResult
): Float32Array[] {
  const grainDuration = 0.03; // 30ms grains
  const hopDuration = 0.015; // 15ms hop → 50% overlap (Hann sums to 1.0)
  const grainSamples = Math.floor(grainDuration * voiceSampleRate);
  const hopSamples = Math.floor(hopDuration * voiceSampleRate);
  const totalSamples = voiceChannels[0].length;
  const numChannels = voiceChannels.length;

  // Periodic Hann window — with 50% overlap, consecutive windows sum to exactly 1.0.
  // Must use /N (periodic) not /(N-1) (symmetric); the symmetric version does NOT
  // sum to unity and causes audible amplitude modulation (choppy sound).
  const hann = new Float32Array(grainSamples);
  for (let i = 0; i < grainSamples; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / grainSamples));
  }

  const scalePcs = buildScalePcs(key);

  // Allocate output (same length as input)
  const output: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    output.push(new Float32Array(totalSamples));
  }

  for (let start = 0; start + grainSamples <= totalSamples; start += hopSamples) {
    const grainTime = start / voiceSampleRate;
    const reading = findNearestReading(pitchReadings, grainTime);

    let rate = 1.0;
    if (reading && reading.frequency > 60) {
      const detectedMidi = 12 * Math.log2(reading.frequency / 440) + 69;
      const targetMidi = snapMidiToScale(Math.round(detectedMidi), scalePcs);
      const targetFreq = 440 * Math.pow(2, (targetMidi - 69) / 12);
      rate = targetFreq / reading.frequency;
      // Clamp to prevent extreme artifacts (allow up to ~3 semitones shift)
      rate = Math.max(0.75, Math.min(1.35, rate));
    }

    // Resample grain with linear interpolation + Hann window → overlap-add
    for (let ch = 0; ch < numChannels; ch++) {
      const src = voiceChannels[ch];
      const dst = output[ch];
      for (let i = 0; i < grainSamples; i++) {
        const srcPos = start + i * rate;
        const srcIdx = Math.floor(srcPos);
        const frac = srcPos - srcIdx;

        if (srcIdx + 1 < totalSamples) {
          const sample = src[srcIdx] * (1 - frac) + src[srcIdx + 1] * frac;
          const outPos = start + i;
          if (outPos < totalSamples) {
            dst[outPos] += sample * hann[i];
          }
        }
      }
    }
  }

  return output;
}
