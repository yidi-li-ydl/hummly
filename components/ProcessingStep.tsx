"use client";

import { useEffect } from "react";
import { quantizeNotes } from "@/lib/audio/noteQuantizer";
import { detectKey } from "@/lib/audio/keyDetector";
import { generateChordProgressions } from "@/lib/audio/chordGenerator";
import { detectBpmFromNotes, detectBeatOffset } from "@/lib/audio/bpmDetector";
import { DRUM_STYLES } from "@/lib/audio/drumPatterns";
import type { PitchReading, QuantizedNote, KeyResult, ChordProgression, DrumStyle } from "@/lib/types";

interface Props {
  readings: PitchReading[];
  onComplete: (notes: QuantizedNote[], key: KeyResult, chordOptions: ChordProgression[], drumOptions: DrumStyle[], detectedBpm: number, beatOffset: number) => void;
  onError: (error: string) => void;
}

// Yield a paint opportunity, without inventing a minimum processing duration.
function nextPaint() {
  return new Promise<void>((resolve) => {
    if (document.visibilityState === "hidden") setTimeout(resolve, 0);
    else requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export default function ProcessingStep({ readings, onComplete, onError }: Props) {
  useEffect(() => {
    let cancelled = false;
    async function process() {
      try {
        await nextPaint();
        if (cancelled) return;
        const extracted = quantizeNotes(readings);
        if (!extracted.length) {
          onError("We didn’t catch a clear melody yet. Your recording is still here. Try again, or hum a little closer to the microphone.");
          return;
        }
        const key = detectKey(extracted);
        const bpm = detectBpmFromNotes(extracted);
        const offset = detectBeatOffset(extracted, bpm);
        const options = generateChordProgressions(key);
        if (!cancelled) onComplete(extracted, key, options, DRUM_STYLES, bpm, offset);
      } catch {
        if (!cancelled) onError("That melody needs another listen. Your recording is safe—try the analysis again.");
      }
    }
    void process();
    return () => {
      cancelled = true;
    };
  }, [readings, onComplete, onError]);

  return null;
}
