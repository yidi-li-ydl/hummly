"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { renderMix, downloadWav } from "@/lib/audio/mixer";
import { snapToGrid } from "@/lib/audio/noteQuantizer";
import { suggestNextPhrase } from "@/lib/audio/melodySuggester";
import type { QuantizedNote, ChordProgression, DrumStyle, KeyResult } from "@/lib/types";

interface Props {
  notes: QuantizedNote[];
  chords: ChordProgression;
  drums: DrumStyle;
  detectedKey: KeyResult;
  onStartOver: () => void;
}

export default function MixStep({ notes, chords, drums, detectedKey, onStartOver }: Props) {
  const [status, setStatus] = useState<"rendering" | "ready" | "error">("rendering");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mixUrl, setMixUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasRendered = useRef(false);

  // Snap melody to beat grid and generate suggested continuation
  const snappedNotes = useMemo(() => snapToGrid(notes, drums.bpm), [notes, drums.bpm]);
  const suggested = useMemo(
    () => suggestNextPhrase(snappedNotes, detectedKey, drums.bpm),
    [snappedNotes, detectedKey, drums.bpm]
  );

  useEffect(() => {
    if (hasRendered.current) return;
    hasRendered.current = true;

    async function render() {
      try {
        const { url } = await renderMix(snappedNotes, chords, drums, suggested);
        setMixUrl(url);
        setStatus("ready");
      } catch (err) {
        console.error("Mix rendering failed:", err);
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    }

    render();
  }, [snappedNotes, chords, drums, suggested]);

  useEffect(() => {
    return () => {
      if (mixUrl) URL.revokeObjectURL(mixUrl);
    };
  }, [mixUrl]);

  const togglePlay = () => {
    if (!mixUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(mixUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleDownload = () => {
    if (mixUrl) downloadWav(mixUrl);
  };

  if (status === "rendering") {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="w-16 h-16 rounded-full border-4 border-neon-cyan border-t-transparent animate-spin" />
        <p className="text-text-secondary text-sm">Rendering your demo...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <p className="text-red-400 text-sm">Rendering failed. Please try again.</p>
        {errorMsg && (
          <p className="text-red-400/70 text-xs font-mono max-w-md break-all">{errorMsg}</p>
        )}
        <button
          onClick={onStartOver}
          className="px-6 py-2 rounded-lg bg-surface-card hover:bg-surface-secondary text-sm transition-colors"
        >
          Start Over
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="text-center mb-2">
        <h2 className="text-lg font-semibold gradient-text">Your Demo is Ready!</h2>
        <p className="text-text-secondary text-xs mt-1">
          {chords.name} chords + {drums.name} drums @ {drums.bpm} BPM
        </p>
      </div>

      {/* Play button */}
      <button
        onClick={togglePlay}
        className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
          isPlaying
            ? "bg-neon-cyan animate-pulse-neon"
            : "bg-neon-purple hover:bg-neon-purple/80 animate-pulse-neon"
        }`}
      >
        {isPlaying ? (
          <svg className="w-10 h-10 text-black" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Melody display: what you hummed + suggested next */}
      <div className="w-full rounded-xl bg-surface-card border border-surface-card p-4">
        <div className="mb-3">
          <p className="text-xs text-text-secondary mb-2">Your melody (snapped to beat)</p>
          <div className="flex flex-wrap gap-1.5">
            {snappedNotes.map((note, i) => (
              <span
                key={i}
                className="px-2 py-1 rounded bg-neon-purple/20 text-neon-purple text-xs font-mono"
              >
                {note.name}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-text-secondary mb-2">
            Suggested next phrase
            <span className="text-neon-green ml-1">(try singing this!)</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggested.map((note, i) => (
              <span
                key={i}
                className="px-2 py-1 rounded bg-neon-green/20 text-neon-green text-xs font-mono"
              >
                {note.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-2">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-neon-green/20 hover:bg-neon-green/30 text-neon-green text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download WAV
        </button>
        <button
          onClick={onStartOver}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface-card hover:bg-surface-secondary text-text-secondary hover:text-text-primary text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Start Over
        </button>
      </div>
    </div>
  );
}
