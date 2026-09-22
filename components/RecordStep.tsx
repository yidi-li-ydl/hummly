"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import WaveformVisualizer from "./WaveformVisualizer";
import { createRecorder, type RecorderHandle } from "@/lib/audio/recorder";
import { startPitchTracking } from "@/lib/audio/pitchDetector";
import type { PitchReading, VoicePcm } from "@/lib/types";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const TOTAL_BARS = 4;

const BPM_PRESETS = [
  { label: "Slow", bpm: 80 },
  { label: "Medium", bpm: 100 },
  { label: "Fast", bpm: 120 },
];

const TIME_SIG_OPTIONS: { label: string; value: number }[] = [
  { label: "4/4", value: 4 },
  { label: "3/4", value: 3 },
];

function freqToNoteName(freq: number): string {
  const midi = Math.round(12 * Math.log2(freq / 440) + 69);
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pitchClass]}${octave}`;
}

/** Schedule a short click sound on the given AudioContext */
function scheduleClick(ctx: AudioContext, time: number, isDownbeat: boolean) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = isDownbeat ? 1000 : 800;
  gain.gain.setValueAtTime(isDownbeat ? 0.5 : 0.3, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.06);
}

interface Props {
  bpm: number;
  beatsPerBar: number;
  onBpmChange: (bpm: number) => void;
  onBeatsPerBarChange: (beatsPerBar: number) => void;
  onComplete: (pcm: VoicePcm, readings: PitchReading[]) => void;
}

export default function RecordStep({ bpm, beatsPerBar, onBpmChange, onBeatsPerBarChange, onComplete }: Props) {
  const [phase, setPhase] = useState<"idle" | "countin" | "recording">("idle");
  const [countBeat, setCountBeat] = useState(0);
  const [currentBar, setCurrentBar] = useState(0);
  const [currentNote, setCurrentNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const readingsRef = useRef<PitchReading[]>([]);
  const stopPitchRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    if (clickTimerRef.current) {
      clearInterval(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    if (countInTimerRef.current) {
      clearTimeout(countInTimerRef.current);
      countInTimerRef.current = null;
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

  /** Start the click track that plays throughout recording */
  function startClickTrack(ctx: AudioContext, bpmVal: number, bpb: number) {
    const beatInterval = 60 / bpmVal;
    let beatCount = 0;
    const startTime = ctx.currentTime;

    function tick() {
      const now = ctx.currentTime;
      while (startTime + beatCount * beatInterval < now + 0.5) {
        const t = startTime + beatCount * beatInterval;
        if (t >= now - 0.01) {
          scheduleClick(ctx, Math.max(t, now), beatCount % bpb === 0);
        }
        beatCount++;
      }
    }

    tick();
    clickTimerRef.current = setInterval(tick, 200);
  }

  const stopRecordingRef = useRef<(() => void) | null>(null);

  const startRecording = async () => {
    try {
      setError(null);
      readingsRef.current = [];
      setCurrentNote(null);
      setCurrentBar(0);

      const recorder = await createRecorder();
      recorderRef.current = recorder;

      // --- Count-in phase ---
      setPhase("countin");
      setCountBeat(0);

      const beatMs = (60 / bpm) * 1000;
      const ctx = recorder.audioContext;

      // Schedule beatsPerBar count-in clicks
      const now = ctx.currentTime + 0.05;
      for (let i = 0; i < beatsPerBar; i++) {
        scheduleClick(ctx, now + i * (60 / bpm), i === 0);
      }

      // Visual beat counter during count-in
      let beat = 1;
      setCountBeat(1);
      const countInterval = setInterval(() => {
        beat++;
        if (beat <= beatsPerBar) {
          setCountBeat(beat);
        }
      }, beatMs);

      // After beatsPerBar beats, start actual recording
      countInTimerRef.current = setTimeout(() => {
        clearInterval(countInterval);
        setCountBeat(0);
        setPhase("recording");

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

        // Start click track during recording
        startClickTrack(ctx, bpm, beatsPerBar);

        // Bar counter
        const barDuration = (beatsPerBar * 60) / bpm;
        const maxDuration = barDuration * TOTAL_BARS;
        const start = Date.now();

        timerRef.current = setInterval(() => {
          const sec = (Date.now() - start) / 1000;
          const bar = Math.min(Math.floor(sec / barDuration) + 1, TOTAL_BARS);
          setCurrentBar(bar);
        }, 100);

        // Auto-stop after 4 bars
        autoStopTimerRef.current = setTimeout(() => {
          stopRecordingRef.current?.();
        }, maxDuration * 1000);
      }, beatMs * beatsPerBar);
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

  // Keep ref in sync for the auto-stop timer
  stopRecordingRef.current = stopRecording;

  const cancelCountIn = () => {
    cleanup();
    setPhase("idle");
    setCountBeat(0);
    if (recorderRef.current) {
      recorderRef.current.cleanup();
      recorderRef.current = null;
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Settings — only shown when idle */}
      {phase === "idle" && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <p className="text-text-secondary text-xs">Tempo</p>
            <div className="flex gap-2">
              {BPM_PRESETS.map((preset) => (
                <button
                  key={preset.bpm}
                  onClick={() => onBpmChange(preset.bpm)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    bpm === preset.bpm
                      ? "bg-neon-purple text-white"
                      : "bg-surface-card hover:bg-surface-secondary text-text-secondary"
                  }`}
                >
                  {preset.label}
                  <span className="ml-1.5 text-xs opacity-70">{preset.bpm}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-text-secondary text-xs">Time Signature</p>
            <div className="flex gap-2">
              {TIME_SIG_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onBeatsPerBarChange(opt.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium font-mono transition-colors ${
                    beatsPerBar === opt.value
                      ? "bg-neon-purple text-white"
                      : "bg-surface-card hover:bg-surface-secondary text-text-secondary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <WaveformVisualizer
        analyserNode={recorderRef.current?.analyserNode ?? null}
        isActive={phase === "recording"}
      />

      {/* Count-in display */}
      {phase === "countin" && (
        <div className="flex flex-col items-center gap-2">
          <span className="text-5xl font-bold text-neon-cyan animate-pulse">{countBeat}</span>
          <p className="text-text-secondary text-xs">Get ready...</p>
        </div>
      )}

      {/* Live note display */}
      {phase === "recording" && (
        <div className="h-10 flex items-center justify-center">
          {currentNote ? (
            <span className="text-2xl font-bold text-neon-cyan">{currentNote}</span>
          ) : (
            <span className="text-text-secondary text-sm">Listening...</span>
          )}
        </div>
      )}

      {/* Bar counter */}
      {phase === "recording" && (
        <div className="text-text-secondary text-sm tabular-nums">
          Bar {currentBar} / {TOTAL_BARS}
        </div>
      )}

      {/* Record / Stop button */}
      <button
        onClick={
          phase === "idle"
            ? startRecording
            : phase === "countin"
            ? cancelCountIn
            : stopRecording
        }
        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
          phase === "recording"
            ? "bg-red-500 hover:bg-red-400 animate-recording-pulse"
            : phase === "countin"
            ? "bg-yellow-500 hover:bg-yellow-400"
            : "bg-neon-purple hover:bg-neon-purple/80 animate-pulse-neon"
        }`}
      >
        {phase === "recording" ? (
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : phase === "countin" ? (
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>

      <p className="text-text-secondary text-xs">
        {phase === "recording"
          ? "Hum your melody..."
          : phase === "countin"
          ? "Count-in — click to cancel"
          : `Tap to start recording (${bpm} BPM, ${beatsPerBar === 3 ? "3/4" : "4/4"}, ${TOTAL_BARS} bars)`}
      </p>

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
