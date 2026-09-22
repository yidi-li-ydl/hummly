"use client";

import { useEffect, useState, useRef } from "react";
import { quantizeNotes } from "@/lib/audio/noteQuantizer";
import { detectKey } from "@/lib/audio/keyDetector";
import { generateChordProgressions } from "@/lib/audio/chordGenerator";
import { DRUM_STYLES } from "@/lib/audio/drumPatterns";
import type { PitchReading, QuantizedNote, KeyResult, ChordProgression, DrumStyle } from "@/lib/types";

interface Props {
  readings: PitchReading[];
  onComplete: (
    notes: QuantizedNote[],
    key: KeyResult,
    chordOptions: ChordProgression[],
    drumOptions: DrumStyle[]
  ) => void;
  onError: (error: string) => void;
}

const STAGES = [
  "Extracting notes from pitch data...",
  "Detecting musical key...",
  "Generating chord progressions...",
  "Preparing drum patterns...",
];

export default function ProcessingStep({ readings, onComplete, onError }: Props) {
  const [stage, setStage] = useState(0);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    async function process() {
      try {
        // Stage 0: Quantize notes
        setStage(0);
        await delay(400);
        const notes = quantizeNotes(readings);

        if (notes.length === 0) {
          onError("No melody detected. Try humming louder and more clearly.");
          return;
        }

        // Stage 1: Detect key
        setStage(1);
        await delay(400);
        const key = detectKey(notes);

        // Stage 2: Generate chords
        setStage(2);
        await delay(400);
        const chordOptions = generateChordProgressions(key);

        // Stage 3: Prepare drums
        setStage(3);
        await delay(400);
        const drumOptions = DRUM_STYLES;

        onComplete(notes, key, chordOptions, drumOptions);
      } catch {
        onError("Analysis failed. Please try recording again.");
      }
    }

    process();
  }, [readings, onComplete, onError]);

  return (
    <div className="flex flex-col items-center gap-8 py-8">
      <div className="w-16 h-16 rounded-full border-4 border-neon-purple border-t-transparent animate-spin" />

      <div className="flex flex-col gap-3 w-full max-w-sm">
        {STAGES.map((label, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs transition-all ${
                i < stage
                  ? "bg-neon-green text-black"
                  : i === stage
                    ? "bg-neon-purple text-white animate-pulse"
                    : "bg-surface-card text-text-secondary"
              }`}
            >
              {i < stage ? "✓" : i + 1}
            </div>
            <span
              className={`text-sm transition-colors ${
                i <= stage ? "text-text-primary" : "text-text-secondary"
              }`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
