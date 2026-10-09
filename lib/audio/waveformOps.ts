import type { VoicePcm } from "../types";
import { getRubberBandApi, stretchSegment } from "./autotune";

export interface WaveformPeaks {
  min: Float32Array; // one value per pixel column
  max: Float32Array;
  samplesPerPixel: number;
}

/** Compute min/max peaks for waveform rendering. */
export function computePeaks(
  channel: Float32Array,
  startSample: number,
  endSample: number,
  numBuckets: number
): WaveformPeaks {
  const len = endSample - startSample;
  const samplesPerPixel = Math.max(1, Math.floor(len / numBuckets));
  const min = new Float32Array(numBuckets);
  const max = new Float32Array(numBuckets);

  for (let b = 0; b < numBuckets; b++) {
    const bStart = startSample + b * samplesPerPixel;
    const bEnd = Math.min(bStart + samplesPerPixel, endSample);
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = bStart; i < bEnd; i++) {
      const v = channel[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    min[b] = lo === Infinity ? 0 : lo;
    max[b] = hi === -Infinity ? 0 : hi;
  }

  return { min, max, samplesPerPixel };
}

/** Delete selection (total duration shrinks). */
export function cutSelection(
  pcm: VoicePcm,
  startSample: number,
  endSample: number
): VoicePcm {
  const total = pcm.channels[0].length;
  const newLen = total - (endSample - startSample);
  const channels = pcm.channels.map((ch) => {
    const out = new Float32Array(newLen);
    out.set(ch.subarray(0, startSample), 0);
    out.set(ch.subarray(endSample), startSample);
    return out;
  });
  return { channels, sampleRate: pcm.sampleRate };
}

/** Silence selection (total duration unchanged). */
export function silenceSelection(
  pcm: VoicePcm,
  startSample: number,
  endSample: number
): VoicePcm {
  const channels = pcm.channels.map((ch) => {
    const out = new Float32Array(ch.length);
    out.set(ch);
    out.fill(0, startSample, endSample);
    return out;
  });
  return { channels, sampleRate: pcm.sampleRate };
}

/** Time-stretch selection using rubberband (async). */
export async function stretchSelection(
  pcm: VoicePcm,
  startSample: number,
  endSample: number,
  ratio: number
): Promise<VoicePcm> {
  const rb = await getRubberBandApi();

  // Extract selection
  const segChannels = pcm.channels.map((ch) =>
    ch.slice(startSample, endSample)
  );

  const stretched = stretchSegment(rb, segChannels, pcm.sampleRate, ratio);
  const stretchedLen = stretched[0].length;
  const tailLen = pcm.channels[0].length - endSample;
  const newLen = startSample + stretchedLen + tailLen;

  const channels = pcm.channels.map((ch, i) => {
    const out = new Float32Array(newLen);
    out.set(ch.subarray(0, startSample), 0);
    out.set(stretched[i], startSample);
    out.set(ch.subarray(endSample), startSample + stretchedLen);
    return out;
  });

  return { channels, sampleRate: pcm.sampleRate };
}
