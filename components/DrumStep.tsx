"use client";

import { useState, useEffect, useRef } from "react";
import { previewDrums, renderMix, ensureToneStarted } from "@/lib/audio/mixer";
import useAudioPreview from "@/hooks/useAudioPreview";
import MiniBeatBars from "./MiniBeatBars";
import ActionButton from "./ui/ActionButton";
import Icon from "./Icon";
import Surface from "./ui/Surface";
import CompactSelect from "./ui/CompactSelect";
import SecondaryButton from "./ui/SecondaryButton";
import type { DrumKit, DrumStyle, HummlyState } from "@/lib/types";

const DRUM_KITS: { id: DrumKit; label: string; description: string }[] = [
  { id: "acoustic-kit", label: "Acoustic", description: "Natural drum kit" },
  { id: "LINN", label: "LinnDrum", description: "Classic 80s" },
  { id: "CR78", label: "CR-78", description: "Vintage analog" },
  { id: "Kit3", label: "Studio", description: "Clean studio kit" },
  { id: "Kit8", label: "Punchy", description: "Tight & punchy" },
];

interface Props {
  options: DrumStyle[];
  beatsPerBar: number;
  bpm: number;
  onSelect: (style: DrumStyle, kit: DrumKit) => void;
  onSkip: () => void;
  savedStyle?: DrumStyle | null;
  savedKit?: DrumKit;
  previewSong?: Pick<HummlyState, "notes" | "selectedChords" | "selectedChordsB" | "voicePcm" | "pitchReadings" | "detectedKey" | "chordInstrument" | "chordPattern" | "melodyVoice" | "beatOffset">;
}

export default function DrumStep({ options, beatsPerBar, bpm, onSelect, onSkip, savedStyle, savedKit, previewSong }: Props) {
  const filtered = options.filter(s => s.beatsPerBar === beatsPerBar);
  const [selectedStyle, setSelectedStyle] = useState<DrumStyle | null>(() => filtered.find(s => s.name === savedStyle?.name) ?? null);
  const [selectedKit, setSelectedKit] = useState<DrumKit>(savedKit ?? "acoustic-kit");
  const preview = useAudioPreview();
  const request = useRef(0);
  // Reuse the existing song renderer once; all beat auditions share this accompaniment.
  const accompanimentCache = useRef<{ song: Props["previewSong"]; bpm: number; beatsPerBar: number; pending: Promise<AudioBuffer> } | null>(null);
  useEffect(() => () => { request.current++; }, []);
  const getAccompaniment = () => {
      if (!previewSong) return Promise.resolve(undefined);
      const cached = accompanimentCache.current;
      if (cached && cached.song === previewSong && cached.bpm === bpm && cached.beatsPerBar === beatsPerBar) return cached.pending;
      const pending = renderMix(
        previewSong.notes, previewSong.selectedChords ?? undefined, previewSong.selectedChordsB ?? undefined,
        undefined, undefined, bpm, previewSong.voicePcm ?? undefined, previewSong.pitchReadings,
        previewSong.detectedKey ?? undefined, previewSong.chordInstrument, beatsPerBar, previewSong.melodyVoice,
        undefined, undefined, previewSong.notes, "acoustic-kit",
        { voice: Math.max(0, -previewSong.beatOffset), chords: Math.max(0, previewSong.beatOffset), drums: Math.max(0, previewSong.beatOffset) }, previewSong.chordPattern ?? undefined,
      ).then(({ buffer, url }) => { URL.revokeObjectURL(url); return buffer; }).catch(error => { if (accompanimentCache.current?.pending === pending) accompanimentCache.current = null; throw error; });
      accompanimentCache.current = { song: previewSong, bpm, beatsPerBar, pending };
      return pending;
  };
  const stop = () => { request.current++; preview.stop(); };
  const handlePreview = (style: DrumStyle) => {
    if (preview.state?.key === style.name) {
      if (preview.state.phase === "paused") void preview.resume();
      else if (preview.state.phase === "playing") void preview.pause();
      else stop();
      return;
    }
    const run = ++request.current;
    void preview.start(style.name, async observer => {
      await ensureToneStarted();
      const accompaniment = await getAccompaniment();
      if (run !== request.current) return;
      await previewDrums(style, selectedKit, bpm, observer, accompaniment, previewSong?.beatOffset ?? 0);
    }, true);
  };
  return (
    <div className="settings-stack beat-discovery">
      <div className="beat-exploration-header">
        <h2 className="chord-section-title">Try these beats</h2>
        <CompactSelect hideLabel label="Drum sound" value={selectedKit} options={DRUM_KITS.map(kit => ({ value: kit.id, label: kit.label }))}
          onChange={value => { stop(); setSelectedKit(value); }} />
      </div>
      {preview.error && <p className="recovery-message" role="alert">{preview.error}</p>}
      <div className="progression-list">
        {filtered.map(style => {
          const previewHere = preview.state?.key === style.name;
          const playing = previewHere && preview.state?.phase === "playing";
          const paused = previewHere && preview.state?.phase === "paused";
          const selected = selectedStyle?.name === style.name;
          const activeStep = previewHere ? preview.state?.step ?? null : null;
          return <Surface as="article" level="soft" className={`beat-card${selected ? " is-selected" : ""}`} key={style.name} aria-label={`${style.name} rhythm`}>
            <button type="button" className="progression-card-select" aria-label={`Choose ${style.name} beat`} aria-pressed={selected} onClick={() => setSelectedStyle(style)}>
              <span className="progression-selection-indicator" aria-hidden="true">{selected && <svg viewBox="0 0 16 16" fill="none"><path d="m4 8 2.5 2.5L12 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>
            </button>
            <div className="beat-card-header">
              <div className="beat-card-copy">
                <h3 className="progression-name">{style.name}</h3>
              </div>
              <SecondaryButton variant="soft" className="icon-action beat-preview" aria-label={previewHere ? paused ? `Resume ${style.name} preview` : playing ? `Pause ${style.name} preview` : `Cancel ${style.name} preview` : `Preview ${style.name} with your song`}
                aria-busy={previewHere && preview.state?.phase === "loading"} aria-pressed={playing || paused}
                onClick={event => { event.stopPropagation(); handlePreview(style); }}>
                <Icon name={previewHere ? playing ? "pause" : paused ? "play" : "wave" : "play"} />
              </SecondaryButton>
            </div>
            <MiniBeatBars pattern={style} playbackStep={activeStep} paused={paused} />
            {previewHere && <span className="sr-only" role="status">{paused ? "Preview paused" : playing ? "Playing with your song" : "Loading sounds"}</span>}
          </Surface>;
        })}
      </div>
      <div className="beat-sticky-action">
        <ActionButton disabled={!selectedStyle} onClick={() => { if (selectedStyle) { stop(); onSelect(selectedStyle, selectedKit); } }}>Continue to Mix<Icon name="arrow" /></ActionButton>
        <SecondaryButton onClick={() => { stop(); onSkip(); }}>Continue without drums</SecondaryButton>
      </div>
    </div>
  );
}
