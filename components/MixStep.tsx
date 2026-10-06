"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { renderMix, downloadWav } from "@/lib/audio/mixer";
import { snapToGrid } from "@/lib/audio/noteQuantizer";
import Timeline from "./Timeline";
import type { ChordInstrument, ChordPattern, DrumKit, MelodyVoice, MixOffsets, MixVolumes, QuantizedNote, ChordProgression, DrumStyle, KeyResult, PitchReading, VoiceEQ, VoicePcm } from "@/lib/types";

interface Props {
  notes: QuantizedNote[];
  chords: ChordProgression | null;
  chordsB: ChordProgression | null;
  drums: DrumStyle | null;
  bpm: number;
  beatsPerBar: number;
  detectedKey: KeyResult;
  voicePcm: VoicePcm | null;
  pitchReadings: PitchReading[];
  chordInstrument: ChordInstrument;
  chordPattern: ChordPattern | null;
  melodyVoice: MelodyVoice;
  drumKit: DrumKit;
  onMelodyVoiceChange: (voice: MelodyVoice) => void;
  onStartOver: () => void;
}

const ZERO_OFFSETS: MixOffsets = { voice: 0, chords: 0, drums: 0 };

export default function MixStep({ notes, chords, chordsB, drums, bpm, beatsPerBar, detectedKey, voicePcm, pitchReadings, chordInstrument, chordPattern, drumKit, onStartOver }: Props) {
  const [status, setStatus] = useState<"rendering" | "ready" | "error">("rendering");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [vocalUrl, setVocalUrl] = useState<string | null>(null);
  const [instrUrl, setInstrUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const vocalRef = useRef<HTMLAudioElement | null>(null);
  const instrRef = useRef<HTMLAudioElement | null>(null);
  const hasRendered = useRef(false);

  const [offsets, setOffsets] = useState<MixOffsets>(ZERO_OFFSETS);
  const [pendingOffsets, setPendingOffsets] = useState<MixOffsets>(ZERO_OFFSETS);

  const voiceEq: VoiceEQ = { lowCut: 80, presence: 0 };
  const snappedNotes = useMemo(() => snapToGrid(notes, bpm), [notes, bpm]);

  const barDuration = (beatsPerBar * 60) / bpm;
  const voiceDuration = voicePcm ? voicePcm.channels[0].length / voicePcm.sampleRate : 0;
  const baseBars = Math.max(4, Math.ceil(voiceDuration / barDuration));
  const backingDuration = baseBars * barDuration;

  const hasChanges =
    pendingOffsets.voice !== offsets.voice ||
    pendingOffsets.chords !== offsets.chords ||
    pendingOffsets.drums !== offsets.drums;

  const doRender = useCallback(async (mixOffsets: MixOffsets) => {
    const volWith: MixVolumes = { melody: 1, chords: 1, drums: 1 };
    const volWithout: MixVolumes = { melody: 0, chords: 1, drums: 1 };

    const [withVoice, withoutVoice] = await Promise.all([
      renderMix(
        snappedNotes, chords ?? undefined, chordsB ?? undefined, drums ?? undefined, undefined, bpm,
        voicePcm ?? undefined, pitchReadings, detectedKey,
        chordInstrument, beatsPerBar, "real", volWith, voiceEq, notes, drumKit,
        mixOffsets, chordPattern ?? undefined
      ),
      renderMix(
        snappedNotes, chords ?? undefined, chordsB ?? undefined, drums ?? undefined, undefined, bpm,
        voicePcm ?? undefined, pitchReadings, detectedKey,
        chordInstrument, beatsPerBar, "real", volWithout, voiceEq, notes, drumKit,
        mixOffsets, chordPattern ?? undefined
      ),
    ]);

    return { withVoice, withoutVoice };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snappedNotes, chords, chordsB, drums, bpm, voicePcm, pitchReadings, detectedKey, chordInstrument, chordPattern, beatsPerBar, notes, drumKit]);

  // Initial render
  useEffect(() => {
    if (hasRendered.current) return;
    hasRendered.current = true;

    async function render() {
      try {
        const { withVoice, withoutVoice } = await doRender(ZERO_OFFSETS);
        setVocalUrl(withVoice.url);
        setInstrUrl(withoutVoice.url);
        setStatus("ready");
      } catch (err) {
        console.error("Mix rendering failed:", err);
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    }

    render();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (vocalUrl) URL.revokeObjectURL(vocalUrl);
      if (instrUrl) URL.revokeObjectURL(instrUrl);
    };
  }, [vocalUrl, instrUrl]);

  // Keep voice toggle in sync without re-render
  useEffect(() => {
    if (vocalRef.current) vocalRef.current.volume = voiceOn ? 1 : 0;
    if (instrRef.current) instrRef.current.volume = voiceOn ? 0 : 1;
  }, [voiceOn]);

  const stopPlayback = useCallback(() => {
    if (vocalRef.current) {
      vocalRef.current.pause();
      vocalRef.current.currentTime = 0;
    }
    if (instrRef.current) {
      instrRef.current.pause();
      instrRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  }, []);

  const handleApply = useCallback(async () => {
    stopPlayback();
    vocalRef.current = null;
    instrRef.current = null;

    if (vocalUrl) URL.revokeObjectURL(vocalUrl);
    if (instrUrl) URL.revokeObjectURL(instrUrl);

    setStatus("rendering");
    setErrorMsg(null);

    try {
      const { withVoice, withoutVoice } = await doRender(pendingOffsets);
      setVocalUrl(withVoice.url);
      setInstrUrl(withoutVoice.url);
      setOffsets(pendingOffsets);
      setStatus("ready");
    } catch (err) {
      console.error("Re-render failed:", err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [stopPlayback, vocalUrl, instrUrl, doRender, pendingOffsets]);

  const togglePlay = () => {
    if (!vocalUrl || !instrUrl) return;

    // Init audio elements on first play
    if (!vocalRef.current) {
      vocalRef.current = new Audio(vocalUrl);
      instrRef.current = new Audio(instrUrl);

      vocalRef.current.volume = voiceOn ? 1 : 0;
      instrRef.current!.volume = voiceOn ? 0 : 1;

      vocalRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      vocalRef.current.pause();
      instrRef.current!.pause();
      vocalRef.current.currentTime = 0;
      instrRef.current!.currentTime = 0;
      setIsPlaying(false);
    } else {
      // Sync start
      vocalRef.current.currentTime = 0;
      instrRef.current!.currentTime = 0;
      vocalRef.current.play();
      instrRef.current!.play();
      setIsPlaying(true);
    }
  };

  const handleDownload = () => {
    const url = voiceOn ? vocalUrl : instrUrl;
    if (url) downloadWav(url);
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
          {[chords && `${chords.name} chords`, drums && `${drums.name} drums`].filter(Boolean).join(" + ") || "Voice only"} @ {bpm} BPM
        </p>
      </div>

      {/* Draggable timeline */}
      <Timeline
        voiceDuration={voiceDuration}
        backingDuration={backingDuration}
        offsets={pendingOffsets}
        onChange={setPendingOffsets}
        hasVoice={!!voicePcm}
        hasChords={!!chords}
        hasDrums={!!drums}
      />

      {/* Apply button — only visible when offsets changed */}
      {hasChanges && (
        <button
          onClick={handleApply}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-neon-green/20 hover:bg-neon-green/30 border border-neon-green/50 text-neon-green text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Apply Offsets
        </button>
      )}

      {/* Voice on/off toggle */}
      <button
        onClick={() => setVoiceOn((v) => !v)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          voiceOn
            ? "bg-neon-purple/20 border border-neon-purple text-neon-purple"
            : "bg-surface-card border border-surface-card text-text-secondary hover:text-text-primary"
        }`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {voiceOn ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          )}
        </svg>
        {voiceOn ? "Voice On" : "Voice Off"}
      </button>

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
