"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import WaveformVisualizer from "./WaveformVisualizer";
import Hummi from "./Hummi";
import Icon from "./Icon";
import ActionButton from "./ui/ActionButton";
import SecondaryButton from "./ui/SecondaryButton";
import Surface from "./ui/Surface";
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
  analyzing?: boolean;
}

export default function RecordStep({ onComplete, analyzing = false }: Props) {
  const [phase, setPhase] = useState<"idle" | "requesting" | "recording" | "uploading">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [currentNote, setCurrentNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const mountedRef = useRef(false);
  const busyRef = useRef(false);
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
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
      recorderRef.current?.cleanup();
    };
  }, [cleanup]);

  const stopRecordingRef = useRef<(() => void) | null>(null);
  const startRecording = async () => {
    if (busyRef.current || analyzing) return;
    busyRef.current = true;
    setPhase("requesting");
    setError(null);
    setElapsed(0);
    setCurrentNote(null);
    readingsRef.current = [];
    try {
      const recorder = await createRecorder();
      if (!mountedRef.current) { recorder.cleanup(); return; }
      recorderRef.current = recorder;
      setAnalyserNode(recorder.analyserNode);
      recorder.startRecording();
      stopPitchRef.current = startPitchTracking(recorder.analyserNode, recorder.audioContext, (reading) => {
        readingsRef.current.push(reading);
        setCurrentNote(freqToNoteName(reading.frequency));
      });
      setPhase("recording");
      const start = Date.now();
      timerRef.current = setInterval(() => setElapsed((Date.now() - start) / 1000), 100);
      autoStopTimerRef.current = setTimeout(() => stopRecordingRef.current?.(), MAX_RECORDING_SECONDS * 1000);
    } catch (err) {
      cleanup();
      recorderRef.current?.cleanup();
      recorderRef.current = null;
      if (!mountedRef.current) return;
      setAnalyserNode(null);
      const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
      setError(denied
        ? "Let’s give your melody a way in. Allow microphone access in your browser, then try again. You can also upload audio."
        : "We couldn’t connect to your microphone. Check that it’s available, or upload an audio file instead.");
      setPhase("idle");
      busyRef.current = false;
    }
  };

  const stopRecording = useCallback(() => {
    if (!recorderRef.current) return;
    cleanup();
    const pcm = recorderRef.current.stopRecording();
    recorderRef.current.cleanup();
    recorderRef.current = null;
    busyRef.current = false;
    setPhase("idle");
    setAnalyserNode(null);
    onComplete(pcm, readingsRef.current);
  }, [cleanup, onComplete]);

  useEffect(() => { stopRecordingRef.current = stopRecording; }, [stopRecording]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || busyRef.current || analyzing) return;
    e.target.value = "";
    busyRef.current = true;
    let audioCtx: AudioContext | null = null;
    try {
      setError(null);
      setPhase("uploading");
      const arrayBuffer = await file.arrayBuffer();
      if (!mountedRef.current) return;
      audioCtx = new AudioContext();
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);
      if (!mountedRef.current) return;
      const mono = new Float32Array(decoded.length);
      for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
        const channel = decoded.getChannelData(ch);
        for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / decoded.numberOfChannels;
      }
      const pcm: VoicePcm = { channels: [mono], sampleRate: decoded.sampleRate };
      const readings = detectPitchOffline(mono, decoded.sampleRate);
      onComplete(pcm, readings);
    } catch {
      if (mountedRef.current) {
        setError("That file couldn’t be opened. Try a WAV or MP3 with a clear melody, or hum a new one.");
        setPhase("idle");
      }
    } finally {
      if (audioCtx && audioCtx.state !== "closed") await audioCtx.close();
      busyRef.current = false;
    }
  };

  const recording = phase === "recording";
  const pending = analyzing || phase === "requesting" || phase === "uploading";
  return (
    <section className="record-layout" aria-labelledby="record-title" aria-busy={analyzing}>
      <div className="record-copy">
        <div className="record-intro">
          <h1 id="record-title">Got a tune<br />in your <em>head?</em></h1>
          <p className="record-description">Hum a little. Let’s see where it goes.<br />We’ll find its chords and rhythm together.</p>
        </div>
        <div className="record-controls">
          <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" aria-label="Choose an audio file" onChange={handleFileUpload} />
          <div className="record-actions">
            <ActionButton
              tone={recording ? "dark" : "lime"}
              onClick={recording ? stopRecording : startRecording}
              disabled={pending}
            >
              <Icon name={recording ? "stop" : "mic"} />
              <span role={analyzing ? "status" : undefined}>{analyzing ? "Analyzing…" : recording ? "Stop & hear it" : phase === "requesting" ? "Connecting microphone…" : phase === "uploading" ? "Opening your audio…" : "Start humming"}</span>
              {!recording && !pending && <Icon name="arrow" className="action-arrow" />}
            </ActionButton>
            {(phase === "idle" || analyzing) && <SecondaryButton variant="outline" disabled={analyzing} onClick={() => fileInputRef.current?.click()}><Icon name="upload" /> Upload audio</SecondaryButton>}
          </div>
          <p className="record-hint">{recording ? "Keep humming. Tap stop when you’re ready." : "Up to 30 seconds of recording. No music theory needed."}</p>
          {error && <p className="recovery-message" role="alert">{error}</p>}
        </div>
      </div>
      <div className={`music-stage ${recording ? "is-recording" : ""}`}>
        {phase !== "idle" && <div className="stage-caption" role="status">
          {recording && <span className="recording-dot" />}
          {recording ? "Recording · I’m listening" : phase === "requesting" ? "Waiting for microphone access" : "Reading your melody"}
        </div>}
        {recording && <span className="stage-counter">{formatTime(elapsed)} / 0:30</span>}
        <div className="stage-hummi"><Hummi state={recording || pending ? "headphones" : "singing"} size="large" priority /></div>
        <p className={`stage-message${phase === "idle" ? " stage-message--caption" : ""}`}>{recording ? "That’s it. Make it your own." : pending ? "Your little tune is on its way." : "Every hum deserves to become something."}</p>
        {recording ? <>
          <Surface className="recording-canvas"><WaveformVisualizer analyserNode={analyserNode} isActive /></Surface>
          <span className="note-detail">{currentNote ? `Pitch detected · ${currentNote}` : "Hum a clear, steady melody"}</span>
        </> : null}
      </div>
    </section>
  );
}
