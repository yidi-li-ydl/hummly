"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { renderMix, downloadWav } from "@/lib/audio/mixer";
import { snapToGrid } from "@/lib/audio/noteQuantizer";
import type { ChordInstrument, ChordPattern, DrumKit, MelodyVoice, MixOffsets, MixVolumes, QuantizedNote, ChordProgression, DrumStyle, KeyResult, PitchReading, VoiceEQ, VoicePcm } from "@/lib/types";
import MultiTrackEditor from "./MultiTrackEditor";
import Hummi from "./Hummi";
import Icon from "./Icon";
import ActionButton from "./ui/ActionButton";
import SecondaryButton from "./ui/SecondaryButton";
import FineTuneAudioView from "./FineTuneAudioView";
import MixPlayer from "./MixPlayer";
import MiniMixer, { MIX_TRACKS, type MixTrackKey } from "./MiniMixer";
import { renderTrackMix } from "@/lib/audio/renderTrackMix";

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
  const [editorOpen, setEditorOpen] = useState(false);
  const [status, setStatus] = useState<"rendering" | "ready" | "error">("rendering");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
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
  const gainsRef = useRef<Partial<Record<MixTrackKey, GainNode>>>({});
  const positionRef = useRef(0);
  const playStartRef = useRef<number>(0);

  // Playhead
  const [playheadTime, setPlayheadTime] = useState(0);
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
    for (const { key } of MIX_TRACKS) {
      const gain = gainsRef.current[key];
      if (gain) gain.gain.value = trackMutes[key] ? 0 : trackVolumes[key];
    }
  }, [trackVolumes, trackMutes]);

  // Updating React state on every animation frame redraws all three full-size
  // canvases at ~60fps. A 20fps playhead is visually smooth without starving the
  // main thread while audio is playing.
  useEffect(() => {
    if (!isPlaying) return;
    playheadTimerRef.current = setInterval(() => {
      const ctx = audioCtxRef.current;
      if (ctx) {
        setPlayheadTime(Math.max(0, ctx.currentTime - playStartRef.current));
      }
    }, 50);
    return () => {
      if (playheadTimerRef.current !== null) {
        clearInterval(playheadTimerRef.current);
        playheadTimerRef.current = null;
      }
    };
  }, [isPlaying]);

  const stopPlayback = useCallback((reset = true) => {
    for (const s of sourcesRef.current) {
      s.onended = null;
      try { s.stop(); s.disconnect(); } catch { /* already stopped */ }
    }
    sourcesRef.current = [];
    gainsRef.current = {};
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (reset) { positionRef.current = 0; setPlayheadTime(0); }
    setIsPlaying(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPlayback();
  }, [stopPlayback]);

  const handlePcmChange = useCallback(async (pcm: VoicePcm) => {
    stopPlayback();
    setEditedPcm(pcm);

    setStatus("rendering");
    try {
      const tracks = await renderThreeTracks(pcm, mixOffsets);
      setVoiceBuffer(tracks.voiceBuf);
      if (!editedChordsPcm) setChordsBuffer(tracks.chordsBuf);
      if (!editedDrumsPcm) setDrumsBuffer(tracks.drumsBuf);
      setStatus("ready");
    } catch (err) {
      console.error("Re-render failed:", err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [stopPlayback, renderThreeTracks, mixOffsets, editedChordsPcm, editedDrumsPcm]);

  const availableTracks = MIX_TRACKS.filter(({ key }) => key === "voice" || (key === "chords" ? !!chords : !!drums));
  const buffers = { voice: voiceBuffer, chords: chordsBuffer, drums: drumsBuffer };
  const duration = Math.max(0, ...availableTracks.map(({ key }) => buffers[key]?.duration ?? 0));

  // Use the existing three-buffer transport, restarting sources at a real sample
  // offset for pause/resume and seeking. Both views share these same refs.
  const startPlayback = (offset: number) => {
    stopPlayback(false);
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    void ctx.resume().catch(() => {
      stopPlayback();
      setErrorMsg("Couldn’t play your song. Try again.");
    });
    let longest: AudioBufferSourceNode | null = null;
    let longestDuration = 0;
    for (const { key } of availableTracks) {
      const buffer = buffers[key];
      if (!buffer || offset >= buffer.duration) continue;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = trackMutes[key] ? 0 : trackVolumes[key];
      source.connect(gain);
      gain.connect(ctx.destination);
      sourcesRef.current.push(source);
      gainsRef.current[key] = gain;
      if (buffer.duration > longestDuration) { longest = source; longestDuration = buffer.duration; }
    }
    if (!longest) { stopPlayback(); return; }
    longest.onended = () => stopPlayback();
    const start = ctx.currentTime + .02;
    playStartRef.current = start - offset;
    positionRef.current = offset;
    setPlayheadTime(offset);
    sourcesRef.current.forEach(source => source.start(start, offset));
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (isPlaying) {
      const ctx = audioCtxRef.current;
      positionRef.current = Math.max(0, Math.min(duration, ctx ? ctx.currentTime - playStartRef.current : playheadTime));
      setPlayheadTime(positionRef.current);
      stopPlayback(false);
    } else if (status === "ready") startPlayback(positionRef.current >= duration ? 0 : positionRef.current);
  };

  const seek = (seconds: number) => {
    const position = Math.max(0, Math.min(duration, seconds));
    positionRef.current = position;
    setPlayheadTime(position);
    if (isPlaying) startPlayback(position);
  };

  const handleDownload = async () => {
    if (exporting || status !== "ready") return;
    setExporting(true);
    setExportError(null);
    try {
      const url = await renderTrackMix(availableTracks.flatMap(({ key }) => {
        const buffer = buffers[key];
        return buffer ? [{ buffer, volume: trackMutes[key] ? 0 : trackVolumes[key] }] : [];
      }));
      downloadWav(url);
      // Let the browser begin reading the download before releasing the URL.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportError("Your song is still here. We couldn’t export it this time—try downloading again.");
    } finally {
      setExporting(false);
    }
  };

  const requestStartOver = () => {
    if (window.confirm("Start a new song? Your current song and edits will be cleared. Download it first if you’d like to keep it.")) onStartOver();
  };

  if (status === "rendering" && !voiceBuffer) {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <Icon name="wave" className="w-14 h-14 text-ink" />
        <h1 className="demo-title">Bringing it all together.</h1>
        <p className="text-text-secondary text-sm" role="status">Preparing the sounds and rendering your demo…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <h1 className="demo-title">Let’s try that mix again.</h1>
        <p className="text-text-secondary text-sm">Your melody and choices are still here.</p>
        <ActionButton onClick={async () => {
          setStatus("rendering");
          try {
            const tracks = await renderThreeTracks(effectivePcm ?? undefined, mixOffsets);
            setVoiceBuffer(tracks.voiceBuf);
            if (!editedChordsPcm) setChordsBuffer(tracks.chordsBuf);
            if (!editedDrumsPcm) setDrumsBuffer(tracks.drumsBuf);
            setErrorMsg(null);
            setStatus("ready");
          } catch (err) { setErrorMsg(err instanceof Error ? err.message : String(err)); setStatus("error"); }
        }}>Retry rendering</ActionButton>
        {errorMsg && (
          <details className="text-xs max-w-md break-all"><summary>Error details</summary><p>{errorMsg}</p></details>
        )}
        <SecondaryButton
          onClick={requestStartOver}
        >
          Start Over
        </SecondaryButton>
      </div>
    );
  }

  const playerProps = { playing: isPlaying, position: Math.max(0, Math.min(duration, playheadTime)), duration,
    disabled: status !== "ready", onToggle: togglePlay, onSeek: seek };

  return (
    <>
      <div className="mix-home">
        <header className="mix-completion">
          <h1>Your song is ready!</h1>
          <p>That little hum became something magical.</p>
        </header>
        <div className={`mix-hero${isPlaying ? " is-playing" : ""}`} style={{ "--song-beat": `${60 / bpm}s` } as React.CSSProperties}>
          <span className="mix-music-note mix-music-note--one" aria-hidden="true">♪</span>
          <Hummi state="headphones" size="medium" animated={false} className="mix-hero-hummi" priority />
          <span className="mix-music-note mix-music-note--two" aria-hidden="true">♫</span>
        </div>
        <MixPlayer {...playerProps} />
        {errorMsg && <p className="recovery-message" role="alert">{errorMsg}</p>}
        <MiniMixer available={availableTracks.map(track => track.key)} volumes={trackVolumes} mutes={trackMutes}
          onVolume={(key, volume) => setTrackVolumes(previous => ({ ...previous, [key]: volume }))}
          onMute={key => setTrackMutes(previous => ({ ...previous, [key]: !previous[key] }))} />
        <button type="button" className="fine-tune-entry" onClick={() => setEditorOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 12 12M8 16 20 4"/></svg>
          <span>Fine-tune audio</span><Icon name="arrow" />
        </button>
        <ActionButton onClick={handleDownload} disabled={exporting || status !== "ready"} className="mix-download">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" /></svg>
          {exporting ? "Preparing WAV…" : "Download WAV"}
        </ActionButton>
        {exportError && <p className="recovery-message" role="alert">{exportError}</p>}
        <button type="button" className="mix-start-over" onClick={requestStartOver}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4v5h5M4.6 9a8 8 0 1 1-.6 6" /></svg>Start over
        </button>
      </div>
      <FineTuneAudioView open={editorOpen} onClose={() => setEditorOpen(false)} busy={status === "rendering"}
        player={<MixPlayer {...playerProps} compact />}>
        {effectivePcm && <MultiTrackEditor
          tracks={[
            { id: "voice", label: "Your hum", icon: <Icon name="mic" />, pcm: effectivePcm, onPcmChange: handlePcmChange },
            ...(chords && chordsPcm ? [{ id: "chords" as const, label: "Chords", icon: <Icon name="note" />, pcm: chordsPcm,
              onPcmChange: (pcm: VoicePcm) => { stopPlayback(); setEditedChordsPcm(pcm); setChordsBuffer(voicePcmToAudioBuffer(pcm)); } }] : []),
            ...(drums && drumsPcm ? [{ id: "drums" as const, label: "Beat", icon: <Icon name="beat" />, pcm: drumsPcm,
              onPcmChange: (pcm: VoicePcm) => { stopPlayback(); setEditedDrumsPcm(pcm); setDrumsBuffer(voicePcmToAudioBuffer(pcm)); } }] : []),
          ]}
          disabled={status !== "ready"}
          bpm={bpm} beatsPerBar={beatsPerBar} beatOffset={beatOffset} currentTime={editorOpen ? playheadTime : undefined}
        />}
      </FineTuneAudioView>
    </>
  );
}
