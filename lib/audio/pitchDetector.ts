import { PitchDetector } from "pitchy";
import type { PitchReading } from "../types";

const CLARITY_THRESHOLD = 0.65;
const POLL_INTERVAL_MS = 50;

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
