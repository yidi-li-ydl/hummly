import type { VoicePcm } from "../types";

/** First sustained sound in the waveform, preserving any leading silence. */
export function detectVoiceStart(pcm: VoicePcm): number {
  if (!pcm.channels.length || pcm.sampleRate <= 0) return 0;
  const samples = pcm.channels[0];
  const window = Math.max(1, Math.round(pcm.sampleRate * .01));
  const energy: number[] = [];
  let peak = 0;
  for (let start = 0; start < samples.length; start += window) {
    const end = Math.min(start + window, samples.length);
    let sum = 0;
    for (let i = start; i < end; i++) sum += samples[i] ** 2;
    const rms = Math.sqrt(sum / (end - start));
    energy.push(rms);
    peak = Math.max(peak, rms);
  }
  const threshold = Math.max(.001, peak * .08);
  for (let i = 0; i < energy.length - 1; i++) {
    // Two consecutive windows reject isolated clicks and low background noise.
    if (energy[i] >= threshold && energy[i + 1] >= threshold) {
      return i * window / pcm.sampleRate;
    }
  }
  return 0;
}
