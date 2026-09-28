import { PitchDetector } from "pitchy";
import type { PitchReading } from "../types";

const CLARITY_THRESHOLD = 0.65;
const POLL_INTERVAL_MS = 50;
const WINDOW_SIZE = 2048;

/**
 * Offline pitch detection — processes a complete PCM buffer and returns all
 * detected pitch readings synchronously.  Uses the same clarity threshold and
 * frequency range as the real-time version.
 */
export function detectPitchOffline(
  pcm: Float32Array,
  sampleRate: number,
): PitchReading[] {
  const detector = PitchDetector.forFloat32Array(WINDOW_SIZE);
  const hopSamples = Math.round((POLL_INTERVAL_MS / 1000) * sampleRate);
  const readings: PitchReading[] = [];

  for (let offset = 0; offset + WINDOW_SIZE <= pcm.length; offset += hopSamples) {
    const window = pcm.subarray(offset, offset + WINDOW_SIZE);
    const [frequency, clarity] = detector.findPitch(window, sampleRate);

    if (clarity >= CLARITY_THRESHOLD && frequency > 60 && frequency < 2000) {
      readings.push({
        time: offset / sampleRate,
        frequency,
        clarity,
      });
    }
  }

  return readings;
}

export function startPitchTracking(
  analyserNode: AnalyserNode,
  audioContext: AudioContext,
  onReading: (reading: PitchReading) => void
): () => void {
  const bufferLength = analyserNode.fftSize;
  const buffer = new Float32Array(bufferLength);
  const detector = PitchDetector.forFloat32Array(bufferLength);
  const startTime = audioContext.currentTime;

  const interval = setInterval(() => {
    analyserNode.getFloatTimeDomainData(buffer);
    const [frequency, clarity] = detector.findPitch(buffer, audioContext.sampleRate);

    if (clarity >= CLARITY_THRESHOLD && frequency > 60 && frequency < 2000) {
      onReading({
        time: audioContext.currentTime - startTime,
        frequency,
        clarity,
      });
    }
  }, POLL_INTERVAL_MS);

  return () => clearInterval(interval);
}
