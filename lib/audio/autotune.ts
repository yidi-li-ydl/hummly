import type { PitchReading, KeyResult, QuantizedNote } from "../types";
import { RubberBandInterface } from "rubberband-wasm";

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

/** Cached rubberband WASM module — loaded once, reused across calls. */
let rbWasmModule: WebAssembly.Module | null = null;

export async function getRubberBandApi(): Promise<RubberBandInterface> {
  if (!rbWasmModule) {
    const resp = await fetch("/rubberband.wasm");
    rbWasmModule = await WebAssembly.compileStreaming(resp);
  }
  return RubberBandInterface.initialize(rbWasmModule);
}

/**
 * Time-stretch a single audio segment using rubberband (pitch-preserving).
 *
 * @param rb       Initialized RubberBandInterface
 * @param channels Input audio per channel
 * @param sr       Sample rate
 * @param ratio    Time ratio: >1 = slower (stretch), <1 = faster (compress)
 * @returns        Stretched audio per channel
 */
export function stretchSegment(
  rb: RubberBandInterface,
  channels: Float32Array[],
  sr: number,
  ratio: number
): Float32Array[] {
  const numCh = channels.length;
  const inputLen = channels[0].length;

  // Skip trivial identity stretches
  if (Math.abs(ratio - 1.0) < 0.001) {
    return channels.map((ch) => ch.slice());
  }

  // Clamp extreme ratios to avoid artifacts
  const clampedRatio = Math.max(0.25, Math.min(4.0, ratio));

  const state = rb.rubberband_new(sr, numCh, 0, clampedRatio, 1.0);
  rb.rubberband_set_expected_input_duration(state, inputLen);

  const blockSize = rb.rubberband_get_samples_required(state);
  const outputLen = Math.ceil(inputLen * clampedRatio) + blockSize;

  // Allocate WASM memory: pointer array for channels + per-channel buffer
  const channelArrayPtr = rb.malloc(numCh * 4);
  const channelPtrs: number[] = [];
  for (let ch = 0; ch < numCh; ch++) {
    const ptr = rb.malloc(Math.max(blockSize, outputLen) * 4);
    channelPtrs.push(ptr);
    rb.memWritePtr(channelArrayPtr + ch * 4, ptr);
  }

  // --- Study phase (required for offline mode) ---
  let read = 0;
  while (read < inputLen) {
    const remaining = Math.min(blockSize, inputLen - read);
    for (let ch = 0; ch < numCh; ch++) {
      rb.memWrite(channelPtrs[ch], channels[ch].subarray(read, read + remaining));
    }
    read += remaining;
    rb.rubberband_study(state, channelArrayPtr, remaining, read >= inputLen ? 1 : 0);
  }

  // --- Process phase ---
  read = 0;
  const outputChunks: Float32Array[][] = Array.from({ length: numCh }, () => []);
  let totalWritten = 0;

  const retrieve = (final: boolean) => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const available = rb.rubberband_available(state);
      if (available < 1) break;
      if (!final && available < blockSize) break;
      const toRead = Math.min(blockSize, available);
      const got = rb.rubberband_retrieve(state, channelArrayPtr, toRead);
      for (let ch = 0; ch < numCh; ch++) {
        outputChunks[ch].push(rb.memReadF32(channelPtrs[ch], got).slice());
      }
      totalWritten += got;
    }
  };

  while (read < inputLen) {
    const remaining = Math.min(blockSize, inputLen - read);
    for (let ch = 0; ch < numCh; ch++) {
      rb.memWrite(channelPtrs[ch], channels[ch].subarray(read, read + remaining));
    }
    read += remaining;
    rb.rubberband_process(state, channelArrayPtr, remaining, read >= inputLen ? 1 : 0);
    retrieve(false);
  }
  retrieve(true);

  // --- Cleanup WASM resources ---
  rb.rubberband_delete(state);
  for (const ptr of channelPtrs) rb.free(ptr);
  rb.free(channelArrayPtr);

  // --- Concat output chunks ---
  const result: Float32Array[] = [];
  for (let ch = 0; ch < numCh; ch++) {
    const out = new Float32Array(totalWritten);
    let offset = 0;
    for (const chunk of outputChunks[ch]) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    result.push(out);
  }
  return result;
}

/**
 * Time-warp voice audio so note onsets align with a beat grid.
 *
 * Uses rubberband-wasm for professional-quality time-stretching that
 * preserves pitch. The audio is split into segments between anchor points
 * (note onsets), and each segment is independently stretched/compressed
 * to match the target timing.
 */
export async function beatAlignVoice(
  voiceChannels: Float32Array[],
  voiceSampleRate: number,
  originalNotes: QuantizedNote[],
  snappedNotes: QuantizedNote[]
): Promise<Float32Array[]> {
  if (originalNotes.length === 0 || snappedNotes.length === 0) return voiceChannels;

  const inputLen = voiceChannels[0].length;
  const numChannels = voiceChannels.length;

  // Build anchor points: input time → output time
  interface Anchor { inTime: number; outTime: number }
  const anchors: Anchor[] = [];

  // Anchor at t=0 (identity before first note)
  anchors.push({ inTime: 0, outTime: 0 });

  // Anchor for each note onset
  for (let i = 0; i < originalNotes.length; i++) {
    anchors.push({
      inTime: originalNotes[i].startTime,
      outTime: snappedNotes[i].startTime,
    });
  }

  // Final anchor: end of last note
  const lastOrig = originalNotes[originalNotes.length - 1];
  const lastSnap = snappedNotes[snappedNotes.length - 1];
  anchors.push({
    inTime: lastOrig.startTime + lastOrig.duration,
    outTime: lastSnap.startTime + lastSnap.duration,
  });

  // Tail anchor: end of audio maps to proportionally shifted end
  const inputDuration = inputLen / voiceSampleRate;
  const lastInTime = anchors[anchors.length - 1].inTime;
  const lastOutTime = anchors[anchors.length - 1].outTime;
  if (lastInTime < inputDuration) {
    anchors.push({
      inTime: inputDuration,
      outTime: lastOutTime + (inputDuration - lastInTime),
    });
  }

  // Sort by input time and deduplicate (ensure monotonic in both dimensions)
  anchors.sort((a, b) => a.inTime - b.inTime);
  const pts: Anchor[] = [anchors[0]];
  for (let i = 1; i < anchors.length; i++) {
    const prev = pts[pts.length - 1];
    if (anchors[i].inTime - prev.inTime > 0.001 && anchors[i].outTime > prev.outTime) {
      pts.push(anchors[i]);
    }
  }

  if (pts.length < 2) return voiceChannels;

  // Initialize rubberband
  const rb = await getRubberBandApi();

  // Process each segment between consecutive anchor points
  const outputSegments: { data: Float32Array[]; outStart: number }[] = [];

  for (let i = 0; i < pts.length - 1; i++) {
    const inStart = Math.round(pts[i].inTime * voiceSampleRate);
    const inEnd = Math.round(pts[i + 1].inTime * voiceSampleRate);
    const segLen = inEnd - inStart;

    if (segLen <= 0) continue;

    const inDuration = (inEnd - inStart) / voiceSampleRate;
    const outDuration = pts[i + 1].outTime - pts[i].outTime;

    if (outDuration <= 0) continue;

    // timeRatio = output duration / input duration
    const timeRatio = outDuration / inDuration;

    // Extract segment from each channel
    const segChannels: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      segChannels.push(voiceChannels[ch].subarray(
        Math.max(0, inStart),
        Math.min(inputLen, inEnd)
      ));
    }

    const stretched = stretchSegment(rb, segChannels, voiceSampleRate, timeRatio);
    outputSegments.push({ data: stretched, outStart: pts[i].outTime });
  }

  // Calculate total output length
  let totalOutSamples = 0;
  for (const seg of outputSegments) {
    const endSample = Math.round(seg.outStart * voiceSampleRate) + seg.data[0].length;
    if (endSample > totalOutSamples) totalOutSamples = endSample;
  }
  // At minimum, match input length
  totalOutSamples = Math.max(totalOutSamples, inputLen);

  // Assemble output
  const output: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    output.push(new Float32Array(totalOutSamples));
  }

  for (const seg of outputSegments) {
    const outOffset = Math.round(seg.outStart * voiceSampleRate);
    for (let ch = 0; ch < numChannels; ch++) {
      const dst = output[ch];
      const src = seg.data[ch];
      const copyLen = Math.min(src.length, dst.length - outOffset);
      for (let j = 0; j < copyLen; j++) {
        dst[outOffset + j] = src[j];
      }
    }
  }

  return output;
}
