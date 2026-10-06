"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import WaveformVisualizer from "./WaveformVisualizer";
import { createRecorder, type RecorderHandle } from "@/lib/audio/recorder";
import { startPitchTracking, detectPitchOffline } from "@/lib/audio/pitchDetector";
import type { PitchReading, VoicePcm } from "@/lib/types";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MAX_RECORDING_SECONDS = 30;

function freqToNoteName(freq: number): string {
  const midi = Math.round(12 * Math.log2(freq / 440) + 69);
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pitchClass]}${octave}`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface Props {
  onComplete: (pcm: VoicePcm, readings: PitchReading[]) => void;
}

export default function RecordStep({ onComplete }: Props) {
  const [phase, setPhase] = useState<"idle" | "recording" | "uploading">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [currentNote, setCurrentNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const readingsRef = useRef<PitchReading[]>([]);
  const stopPitchRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (stopPitchRef.current) {
      stopPitchRef.current();
      stopPitchRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
      recorderRef.current?.cleanup();
    };
  }, [cleanup]);

  const stopRecordingRef = useRef<(() => void) | null>(null);

  const startRecording = async () => {
    try {
      setError(null);
      readingsRef.current = [];
      setCurrentNote(null);
      setElapsed(0);

      const recorder = await createRecorder();
      recorderRef.current = recorder;

      setPhase("recording");

      stopPitchRef.current = startPitchTracking(
        recorder.analyserNode,
        recorder.audioContext,
        (reading) => {
          readingsRef.current.push(reading);
          setCurrentNote(freqToNoteName(reading.frequency));
        }
      );

      recorder.startRecording();

      const start = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed((Date.now() - start) / 1000);
      }, 100);

      autoStopTimerRef.current = setTimeout(() => {
        stopRecordingRef.current?.();
      }, MAX_RECORDING_SECONDS * 1000);
    } catch {
      setError("Microphone access denied. Please allow microphone permissions.");
      setPhase("idle");
    }
  };

  const stopRecording = useCallback(() => {
    if (!recorderRef.current) return;
    cleanup();
    setPhase("idle");

    const pcm = recorderRef.current.stopRecording();
    recorderRef.current.cleanup();
    recorderRef.current = null;

    onComplete(pcm, readingsRef.current);
  }, [cleanup, onComplete]);

  stopRecordingRef.current = stopRecording;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      setError(null);
      setPhase("uploading");

      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = new AudioContext();
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);

      let mono: Float32Array;
      if (decoded.numberOfChannels === 1) {
        mono = decoded.getChannelData(0);
      } else {
        const ch0 = decoded.getChannelData(0);
        const ch1 = decoded.getChannelData(1);
        mono = new Float32Array(ch0.length);
        for (let i = 0; i < ch0.length; i++) {
          mono[i] = (ch0[i] + ch1[i]) / 2;
        }
      }

      const pcm: VoicePcm = { channels: [mono], sampleRate: decoded.sampleRate };
      const readings = detectPitchOffline(mono, decoded.sampleRate);

      await audioCtx.close();
      setPhase("idle");
      onComplete(pcm, readings);
    } catch {
      setError("Could not decode audio file. Try a different .mp3 or .wav file.");
      setPhase("idle");
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {phase !== "idle" && (
        <WaveformVisualizer
          analyserNode={recorderRef.current?.analyserNode ?? null}
          isActive={phase === "recording"}
        />
      )}

      {/* Uploading spinner */}
      {phase === "uploading" && (
        <div className="flex flex-col items-center gap-2">
          <svg className="w-10 h-10 text-neon-purple animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-text-secondary text-xs">Decoding & analyzing...</p>
        </div>
      )}

      {/* Recording display: elapsed time + detected note */}
      {phase === "recording" && (
        <div className="flex flex-col items-center gap-3">
          <div className="text-2xl font-bold text-neon-cyan tabular-nums">
            {formatTime(elapsed)}
          </div>
          <div className="h-8 flex items-center justify-center">
            {currentNote ? (
              <span className="text-xl font-bold text-neon-cyan">{currentNote}</span>
            ) : (
              <span className="text-text-secondary text-sm">Listening...</span>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input for upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Record / Stop button + Upload */}
      <div className="flex items-center gap-6">
        <button
          onClick={
            phase === "idle"
              ? startRecording
              : phase === "recording"
              ? stopRecording
              : undefined
          }
          disabled={phase === "uploading"}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
            phase === "recording"
              ? "bg-red-500 hover:bg-red-400 animate-recording-pulse"
              : "bg-neon-purple hover:bg-neon-purple/80 animate-pulse-neon"
          } ${phase === "uploading" ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {phase === "recording" ? (
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

        {phase === "idle" && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-20 h-20 rounded-full flex items-center justify-center transition-all bg-surface-card hover:bg-surface-secondary border border-text-secondary/30"
          >
            <svg className="w-8 h-8 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" />
            </svg>
          </button>
        )}
      </div>

      <p className="text-text-secondary text-xs">
        {phase === "uploading"
          ? "Analyzing audio file..."
          : phase === "recording"
          ? "Hum your melody... tap stop when done"
          : "Tap to record or upload an audio file"}
      </p>

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
