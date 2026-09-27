import type { PitchReading, KeyResult, QuantizedNote } from "../types";

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

/**
 * Time-warp voice audio so note onsets align with a beat grid.
 *
 * Uses continuous sample-by-sample resampling with a piecewise-linear time map.
 * For each output sample, the corresponding input position is calculated via
 * linear interpolation between anchor points (note onsets). No cutting, no
 * windowing, no grains — just reads the original samples at slightly shifted
 * positions. For typical timing corrections (<2%), the pitch change is
 * imperceptible.
 */
export function beatAlignVoice(
  voiceChannels: Float32Array[],
  voiceSampleRate: number,
  originalNotes: QuantizedNote[],
  snappedNotes: QuantizedNote[]
): Float32Array[] {
  if (originalNotes.length === 0 || snappedNotes.length === 0) return voiceChannels;

  const inputLen = voiceChannels[0].length;
  const numChannels = voiceChannels.length;

  // Build anchor points: output time → input time
  interface Anchor { out: number; in_: number }
  const anchors: Anchor[] = [];

  // First anchor: start of audio (identity before first note)
  const firstOrigT = originalNotes[0].startTime;
  const firstSnapT = snappedNotes[0].startTime;
  const preOffset = firstSnapT - firstOrigT;

  // Anchor at t=0: if voice needs to shift right, output t=0 maps to input t=0
  anchors.push({ out: 0, in_: Math.max(0, -preOffset) });

  // Anchor for each note onset
  for (let i = 0; i < originalNotes.length; i++) {
    anchors.push({
      out: snappedNotes[i].startTime,
      in_: originalNotes[i].startTime,
    });
  }

  // Final anchor: end of audio
  const lastOrig = originalNotes[originalNotes.length - 1];
  const lastSnap = snappedNotes[snappedNotes.length - 1];
  const lastOrigEnd = lastOrig.startTime + lastOrig.duration;
  const lastSnapEnd = lastSnap.startTime + lastSnap.duration;
  anchors.push({ out: lastSnapEnd, in_: lastOrigEnd });

  // Sort and deduplicate
  anchors.sort((a, b) => a.out - b.out);
  const pts: Anchor[] = [anchors[0]];
  for (let i = 1; i < anchors.length; i++) {
    if (anchors[i].out - pts[pts.length - 1].out > 0.0005) {
      // Ensure input times are monotonically non-decreasing
      if (anchors[i].in_ >= pts[pts.length - 1].in_) {
        pts.push(anchors[i]);
      }
    }
  }

  // If we couldn't build a valid monotonic map, return original
  if (pts.length < 2) return voiceChannels;

  // Output length
  const outputDuration = Math.max(
    inputLen / voiceSampleRate,
    lastSnapEnd + 0.5
  );
  const outputLen = Math.ceil(outputDuration * voiceSampleRate);

  // Time map function: output time → input time (piecewise linear)
  function mapTime(t: number): number {
    if (t <= pts[0].out) return pts[0].in_ + (t - pts[0].out);
    if (t >= pts[pts.length - 1].out) {
      const last = pts[pts.length - 1];
      return last.in_ + (t - last.out);
    }
    let lo = 0;
    let hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].out <= t) lo = mid;
      else hi = mid;
    }
    const p0 = pts[lo];
    const p1 = pts[hi];
    const ratio = (t - p0.out) / (p1.out - p0.out);
    return p0.in_ + ratio * (p1.in_ - p0.in_);
  }

  // Resample: for each output sample, read from the mapped input position
  const output: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    const src = voiceChannels[ch];
    const dst = new Float32Array(outputLen);

    for (let i = 0; i < outputLen; i++) {
      const outTime = i / voiceSampleRate;
      const inTime = mapTime(outTime);
      const inPos = inTime * voiceSampleRate;

      // Linear interpolation
      const idx = Math.floor(inPos);
      const frac = inPos - idx;
      if (idx >= 0 && idx + 1 < inputLen) {
        dst[i] = src[idx] * (1 - frac) + src[idx + 1] * frac;
      } else if (idx >= 0 && idx < inputLen) {
        dst[i] = src[idx];
      }
    }

    output.push(dst);
  }

  return output;
}
