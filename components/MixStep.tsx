"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { renderMix, downloadWav } from "@/lib/audio/mixer";
import { snapToGrid } from "@/lib/audio/noteQuantizer";
import type { ChordInstrument, ChordPattern, DrumKit, MelodyVoice, MixOffsets, MixVolumes, QuantizedNote, ChordProgression, DrumStyle, KeyResult, PitchReading, VoiceEQ, VoicePcm } from "@/lib/types";
import MultiTrackEditor from "./MultiTrackEditor";

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
  beatOffset: number;
  onStartOver: () => void;
}

function audioBufferToVoicePcm(buf: AudioBuffer): VoicePcm {
  const channels: Float32Array[] = [];
  for (let i = 0; i < buf.numberOfChannels; i++) {
    channels.push(new Float32Array(buf.getChannelData(i)));
  }
  return { channels, sampleRate: buf.sampleRate };
}

function voicePcmToAudioBuffer(pcm: VoicePcm): AudioBuffer {
  const buf = new AudioBuffer({
    numberOfChannels: pcm.channels.length,
    length: pcm.channels[0].length,
    sampleRate: pcm.sampleRate,
  });
  for (let i = 0; i < pcm.channels.length; i++) {
    buf.copyToChannel(new Float32Array(pcm.channels[i]), i);
  }
  return buf;
}

export default function MixStep({ notes, chords, chordsB, drums, bpm, beatsPerBar, detectedKey, voicePcm, pitchReadings, chordInstrument, chordPattern, drumKit, beatOffset, onStartOver }: Props) {
  const [status, setStatus] = useState<"rendering" | "ready" | "error">("rendering");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const hasRendered = useRef(false);
  const [editedPcm, setEditedPcm] = useState<VoicePcm | null>(null);
  const effectivePcm = editedPcm ?? voicePcm;

  const [editedChordsPcm, setEditedChordsPcm] = useState<VoicePcm | null>(null);
  const [editedDrumsPcm, setEditedDrumsPcm] = useState<VoicePcm | null>(null);

  // 3-track AudioBuffers
  const [voiceBuffer, setVoiceBuffer] = useState<AudioBuffer | null>(null);
  const [chordsBuffer, setChordsBuffer] = useState<AudioBuffer | null>(null);
  const [drumsBuffer, setDrumsBuffer] = useState<AudioBuffer | null>(null);

  // Per-track volume + mute
  const [trackVolumes, setTrackVolumes] = useState({ voice: 1, chords: 1, drums: 1 });
  const [trackMutes, setTrackMutes] = useState({ voice: false, chords: false, drums: false });

  // Web Audio playback refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const gainsRef = useRef<GainNode[]>([]);
  const playStartRef = useRef<number>(0);

  // Playhead
  const [playheadTime, setPlayheadTime] = useState<number | undefined>(undefined);
  const playheadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const voiceEq: VoiceEQ = { lowCut: 80, presence: 0 };
  const snappedNotes = useMemo(() => snapToGrid(notes, bpm, 16, beatOffset), [notes, bpm, beatOffset]);

  const mixOffsets = useMemo<MixOffsets>(() => ({
    voice: 0,
    chords: beatOffset,
    drums: beatOffset,
  }), [beatOffset]);

  // Derived PCM for chords/drums tracks
  const chordsPcm = useMemo(() =>
    editedChordsPcm ?? (chordsBuffer ? audioBufferToVoicePcm(chordsBuffer) : null),
    [editedChordsPcm, chordsBuffer]
  );
  const drumsPcm = useMemo(() =>
    editedDrumsPcm ?? (drumsBuffer ? audioBufferToVoicePcm(drumsBuffer) : null),
    [editedDrumsPcm, drumsBuffer]
  );

  const renderThreeTracks = useCallback(async (pcm: VoicePcm | undefined, offsets: MixOffsets) => {
    const common = [
      snappedNotes, chords ?? undefined, chordsB ?? undefined, drums ?? undefined, undefined, bpm,
      pcm, pitchReadings, detectedKey,
      chordInstrument, beatsPerBar, "real" as const,
    ] as const;
    const tail = [voiceEq, notes, drumKit, offsets, chordPattern ?? undefined] as const;

    // Use near-zero instead of 0 to avoid exponentialRampToValueAtTime crash
    const OFF = 0.0001;
    const volVoice: MixVolumes = { melody: 1, chords: OFF, drums: OFF };
    const volChords: MixVolumes = { melody: OFF, chords: 1, drums: OFF };
    const volDrums: MixVolumes = { melody: OFF, chords: OFF, drums: 1 };

    const [voice, chor, drum] = await Promise.all([
      renderMix(...common, volVoice, ...tail),
      renderMix(...common, volChords, ...tail),
      renderMix(...common, volDrums, ...tail),
    ]);

    // Revoke blob URLs we don't need for Web Audio playback
    URL.revokeObjectURL(voice.url);
    URL.revokeObjectURL(chor.url);
    URL.revokeObjectURL(drum.url);

    return { voiceBuf: voice.buffer, chordsBuf: chor.buffer, drumsBuf: drum.buffer };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snappedNotes, chords, chordsB, drums, bpm, pitchReadings, detectedKey, chordInstrument, chordPattern, beatsPerBar, notes, drumKit]);

  // Initial render
  useEffect(() => {
    if (hasRendered.current) return;
    hasRendered.current = true;

    async function render() {
      try {
        const tracks = await renderThreeTracks(voicePcm ?? undefined, mixOffsets);
        setVoiceBuffer(tracks.voiceBuf);
        setChordsBuffer(tracks.chordsBuf);
        setDrumsBuffer(tracks.drumsBuf);
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

  // Sync volume/mute to GainNodes in real time
  useEffect(() => {
    const keys = ["voice", "chords", "drums"] as const;
    gainsRef.current.forEach((gain, i) => {
      const k = keys[i];
      gain.gain.value = trackMutes[k] ? 0 : trackVolumes[k];
    });
  }, [trackVolumes, trackMutes]);

  // Updating React state on every animation frame redraws all three full-size
  // canvases at ~60fps. A 20fps playhead is visually smooth without starving the
  // main thread while audio is playing.
  useEffect(() => {
    if (!isPlaying) return;
    playheadTimerRef.current = setInterval(() => {
      const ctx = audioCtxRef.current;
      if (ctx) {
        setPlayheadTime(ctx.currentTime - playStartRef.current);
      }
    }, 50);
    return () => {
      if (playheadTimerRef.current !== null) {
        clearInterval(playheadTimerRef.current);
        playheadTimerRef.current = null;
      }
    };
  }, [isPlaying]);

  const stopPlayback = useCallback(() => {
    for (const s of sourcesRef.current) {
      try { s.stop(); s.disconnect(); } catch { /* already stopped */ }
    }
    sourcesRef.current = [];
    gainsRef.current = [];
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setPlayheadTime(undefined);
    setIsPlaying(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPlayback();
  }, [stopPlayback]);

  const handlePcmChange = useCallback(async (pcm: VoicePcm) => {
    stopPlayback();
    setEditedPcm(pcm);
    setEditedChordsPcm(null);
    setEditedDrumsPcm(null);

    setStatus("rendering");
    try {
      const tracks = await renderThreeTracks(pcm, mixOffsets);
      setVoiceBuffer(tracks.voiceBuf);
      setChordsBuffer(tracks.chordsBuf);
      setDrumsBuffer(tracks.drumsBuf);
      setStatus("ready");
    } catch (err) {
      console.error("Re-render failed:", err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [stopPlayback, renderThreeTracks, mixOffsets]);

  const togglePlay = () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }
    if (!voiceBuffer || !chordsBuffer || !drumsBuffer) return;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const buffers = [voiceBuffer, chordsBuffer, drumsBuffer];
    const keys = ["voice", "chords", "drums"] as const;
    const sources: AudioBufferSourceNode[] = [];
    const gains: GainNode[] = [];

    for (let i = 0; i < 3; i++) {
      const source = ctx.createBufferSource();
      source.buffer = buffers[i];
      const gain = ctx.createGain();
      const k = keys[i];
      gain.gain.value = trackMutes[k] ? 0 : trackVolumes[k];
      source.connect(gain);
      gain.connect(ctx.destination);
      sources.push(source);
      gains.push(gain);
    }

    sources[0].onended = () => stopPlayback();

    playStartRef.current = ctx.currentTime;
    sources.forEach(s => s.start());

    sourcesRef.current = sources;
    gainsRef.current = gains;
    setIsPlaying(true);
  };

  const handleDownload = async () => {
    const common = [
      snappedNotes, chords ?? undefined, chordsB ?? undefined, drums ?? undefined, undefined, bpm,
      (editedPcm ?? voicePcm) ?? undefined, pitchReadings, detectedKey,
      chordInstrument, beatsPerBar, "real" as const,
    ] as const;
    const tail = [voiceEq, notes, drumKit, mixOffsets, chordPattern ?? undefined] as const;

    const OFF = 0.0001;
    const vol: MixVolumes = {
      melody: trackMutes.voice ? OFF : Math.max(OFF, trackVolumes.voice),
      chords: trackMutes.chords ? OFF : Math.max(OFF, trackVolumes.chords),
      drums: trackMutes.drums ? OFF : Math.max(OFF, trackVolumes.drums),
    };

    const { url } = await renderMix(...common, vol, ...tail);
    downloadWav(url);
    URL.revokeObjectURL(url);
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

  const mixerTracks = [
    { key: "voice" as const, label: "Voice", icon: "\u{1F3A4}" },
    { key: "chords" as const, label: "Chords", icon: "\u{1F3B9}" },
    { key: "drums" as const, label: "Drums", icon: "\u{1F941}" },
  ];

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="text-center mb-2">
        <h2 className="text-lg font-semibold gradient-text">Your Demo is Ready!</h2>
        <p className="text-text-secondary text-xs mt-1">
          {[chords && `${chords.name} chords`, drums && `${drums.name} drums`].filter(Boolean).join(" + ") || "Voice only"} @ {bpm} BPM
        </p>
      </div>

      {/* Multi-track waveform editor */}
      {effectivePcm && chordsPcm && drumsPcm && (
        <MultiTrackEditor
          tracks={[
            { id: "voice", label: "Voice", icon: "\u{1F3A4}", pcm: effectivePcm, onPcmChange: handlePcmChange },
            { id: "chords", label: "Chords", icon: "\u{1F3B9}", pcm: chordsPcm,
              onPcmChange: (pcm) => { stopPlayback(); setEditedChordsPcm(pcm); setChordsBuffer(voicePcmToAudioBuffer(pcm)); }},
            { id: "drums", label: "Drums", icon: "\u{1F941}", pcm: drumsPcm,
              onPcmChange: (pcm) => { stopPlayback(); setEditedDrumsPcm(pcm); setDrumsBuffer(voicePcmToAudioBuffer(pcm)); }},
          ]}
          bpm={bpm}
          beatsPerBar={beatsPerBar}
          beatOffset={beatOffset}
          currentTime={playheadTime}
        />
      )}

      {/* Track mixer */}
      <div className="w-full max-w-md flex flex-col gap-2 px-4 py-3 rounded-lg bg-surface-card border border-surface-card">
        {mixerTracks.map(({ key, label, icon }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-sm w-20 shrink-0">{icon} {label}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={trackVolumes[key]}
              onChange={(e) =>
                setTrackVolumes((v) => ({ ...v, [key]: parseFloat(e.target.value) }))
              }
              className="flex-1 h-1.5 accent-neon-purple cursor-pointer"
            />
            <button
              onClick={() => setTrackMutes((m) => ({ ...m, [key]: !m[key] }))}
              className={`w-8 h-8 flex items-center justify-center rounded text-xs transition-colors ${
                trackMutes[key]
                  ? "bg-red-500/20 text-red-400"
                  : "bg-surface-secondary text-text-secondary hover:text-text-primary"
              }`}
              title={trackMutes[key] ? "Unmute" : "Mute"}
            >
              {trackMutes[key] ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>
          </div>
        ))}
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
