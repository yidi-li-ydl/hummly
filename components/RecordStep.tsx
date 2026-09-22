"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import WaveformVisualizer from "./WaveformVisualizer";
import { createRecorder, type RecorderHandle } from "@/lib/audio/recorder";
import { startPitchTracking } from "@/lib/audio/pitchDetector";
import type { PitchReading } from "@/lib/types";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MIN_DURATION = 3;
const MAX_DURATION = 15;

function freqToNoteName(freq: number): string {
  const midi = Math.round(12 * Math.log2(freq / 440) + 69);
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pitchClass]}${octave}`;
}

interface Props {
  onComplete: (blob: Blob, readings: PitchReading[]) => void;
}

export default function RecordStep({ onComplete }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [currentNote, setCurrentNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const readingsRef = useRef<PitchReading[]>([]);
  const stopPitchRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (stopPitchRef.current) {
      stopPitchRef.current();
      stopPitchRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
      recorderRef.current?.cleanup();
    };
  }, [cleanup]);

  const startRecording = async () => {
    try {
      setError(null);
      readingsRef.current = [];
      setCurrentNote(null);
      setElapsed(0);

      const recorder = await createRecorder();
      recorderRef.current = recorder;

      // Start pitch tracking
      stopPitchRef.current = startPitchTracking(
        recorder.analyserNode,
        recorder.audioContext,
        (reading) => {
          readingsRef.current.push(reading);
          setCurrentNote(freqToNoteName(reading.frequency));
        }
      );

      // Start recording
      recorder.startRecording();
      setIsRecording(true);

      // Timer
      const start = Date.now();
      timerRef.current = setInterval(() => {
        const sec = (Date.now() - start) / 1000;
        setElapsed(sec);
        if (sec >= MAX_DURATION) {
          stopRecording();
        }
      }, 100);
    } catch {
      setError("Microphone access denied. Please allow microphone permissions.");
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current || !isRecording) return;
    cleanup();
    setIsRecording(false);

    const blob = await recorderRef.current.stopRecording();
    recorderRef.current.cleanup();
    recorderRef.current = null;

    onComplete(blob, readingsRef.current);
  };

  const canStop = elapsed >= MIN_DURATION;

  return (
    <div className="flex flex-col items-center gap-6">
      <WaveformVisualizer
        analyserNode={recorderRef.current?.analyserNode ?? null}
        isActive={isRecording}
      />

      {/* Live note display */}
      <div className="h-10 flex items-center justify-center">
        {isRecording && currentNote && (
          <span className="text-2xl font-bold text-neon-cyan">{currentNote}</span>
        )}
        {isRecording && !currentNote && (
          <span className="text-text-secondary text-sm">Listening...</span>
        )}
      </div>

      {/* Timer */}
      {isRecording && (
        <div className="text-text-secondary text-sm tabular-nums">
          {elapsed.toFixed(1)}s / {MAX_DURATION}s
          {!canStop && (
            <span className="ml-2 text-neon-pink text-xs">
              (min {MIN_DURATION}s)
            </span>
          )}
        </div>
      )}

      {/* Record button */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isRecording && !canStop}
        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
          isRecording
            ? canStop
              ? "bg-red-500 hover:bg-red-400 animate-recording-pulse"
              : "bg-red-500/60 animate-recording-pulse cursor-not-allowed"
            : "bg-neon-purple hover:bg-neon-purple/80 animate-pulse-neon"
        }`}
      >
        {isRecording ? (
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>

      <p className="text-text-secondary text-xs">
        {isRecording ? "Hum your melody..." : "Tap to start recording"}
      </p>

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
