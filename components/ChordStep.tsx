"use client";

import { useState, useMemo } from "react";
import { previewChord, previewChords } from "@/lib/audio/mixer";
import { rankBProgressions } from "@/lib/audio/chordGenerator";
import { CHORD_PATTERNS } from "@/lib/audio/chordPatterns";
import useAudioPreview from "@/hooks/useAudioPreview";
import ProgressionModule from "./ProgressionModule";
import SelectionGroup from "./ui/SelectionGroup";
import SecondaryButton from "./ui/SecondaryButton";
import type { ChordInstrument, ChordPattern, ChordProgression, KeyResult } from "@/lib/types";

const INSTRUMENTS: { id: ChordInstrument; label: string; icon: string }[] = [
  { id: "piano", label: "Piano", icon: "M3 5h18v14H3V5zm2 2v4h2V7H5zm4 0v4h2V7H9zm4 0v4h2V7h-2zm4 0v4h2V7h-2zM5 13v4h3v-4H5zm5 0v4h4v-4h-4zm6 0v4h3v-4h-3z" },
  { id: "guitar", label: "Guitar", icon: "M19.59 3.41a2 2 0 00-2.83 0l-1.53 1.53a1 1 0 01-.38.25l-1.42.47a1 1 0 00-.57.57l-.47 1.42a1 1 0 01-.25.38L8.3 11.87a4.5 4.5 0 00-4.13 1.3 4.5 4.5 0 000 6.36 4.5 4.5 0 006.36 0 4.5 4.5 0 001.3-4.13l3.84-3.84a1 1 0 01.38-.25l1.42-.47a1 1 0 00.57-.57l.47-1.42a1 1 0 01.25-.38l1.53-1.53a2 2 0 000-2.83zM8.12 17.88a1.5 1.5 0 11-2.12-2.12 1.5 1.5 0 012.12 2.12z" },
  { id: "strings", label: "Strings", icon: "M9 3v12.26A3.5 3.5 0 107 19.5V7h8v8.26A3.5 3.5 0 1013 19.5V5h-4z" },
  { id: "synth-pad", label: "Synth Pad", icon: "M3 6h2v12H3V6zm4 2h2v8H7V8zm4-3h2v14h-2V5zm4 4h2v6h-2V9zm4-2h2v10h-2V7z" },
];

interface Props {
  options: ChordProgression[];
  detectedKey: KeyResult;
  bpm: number;
  beatsPerBar: number;
  onSelect: (a: ChordProgression, b: ChordProgression | null, instrument: ChordInstrument, pattern: ChordPattern) => void;
  onSkip: () => void;
}

type Phase = "pick-a" | "pick-b";
const progressionKey = (name: string) => `progression:${name}`;
const chordKey = (name: string, index: number) => `chord:${name}:${index}`;

export default function ChordStep({ options, detectedKey, bpm, beatsPerBar, onSelect, onSkip }: Props) {
  const [phase, setPhase] = useState<Phase>("pick-a");
  const [showAll, setShowAll] = useState(false);
  const [selectedA, setSelectedA] = useState<ChordProgression | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<ChordInstrument>("piano");
  const [filter, setFilter] = useState<"all" | "major" | "minor">("all");
  const [auditioned, setAuditioned] = useState<{ name: string; index: number } | null>(null);
  const preview = useAudioPreview();
  const availablePatterns = useMemo(() => CHORD_PATTERNS.filter((p) => p.beatsPerBar === beatsPerBar), [beatsPerBar]);
  const [selectedPattern, setSelectedPattern] = useState<ChordPattern>(() => availablePatterns[0] ?? CHORD_PATTERNS[0]);
  const filteredOptions = useMemo(() => filter === "all" ? options : options.filter((p) => p.description.includes(` ${filter}:`)), [options, filter]);
  const ranked = useMemo(() => selectedA ? rankBProgressions(selectedA, filteredOptions) : [], [selectedA, filteredOptions]);
  const displayOptions = phase === "pick-b" && selectedA ? [selectedA, ...ranked] : filteredOptions;
  const recommended = new Set(ranked.slice(0, 2).map((p) => p.name));

  const handlePreview = (prog: ChordProgression) => {
    const playingHere = preview.state?.key === progressionKey(prog.name) || prog.chords.some((_, index) => preview.state?.key === chordKey(prog.name, index));
    if (playingHere) { preview.stop(); return; }
    setAuditioned(null);
    void preview.start(progressionKey(prog.name), (observer) => previewChords(prog, selectedInstrument, bpm, beatsPerBar, selectedPattern, observer));
  };
  const handleAudition = (prog: ChordProgression, index: number) => {
    setAuditioned({ name: prog.name, index });
    if (preview.state?.key === chordKey(prog.name, index)) { preview.stop(); return; }
    void preview.start(chordKey(prog.name, index), (observer) => previewChord(prog.chords[index], selectedInstrument, bpm, observer));
  };
  const handleSelect = (prog: ChordProgression) => {
    preview.stop();
    if (phase === "pick-a") { setSelectedA(prog); setPhase("pick-b"); }
    else if (selectedA) onSelect(selectedA, prog, selectedInstrument, selectedPattern);
  };

  return (
    <div className="settings-stack">
      <p className="key-summary">Detected key: <strong>{detectedKey.key} {detectedKey.mode}</strong></p>
      <SelectionGroup label="Choose your mood" value={filter} options={[{ value: "all", label: "Both" }, { value: "major", label: "Major" }, { value: "minor", label: "Minor" }]} onChange={(value) => {
        preview.stop(); setFilter(value); setSelectedA(null); setAuditioned(null); setPhase("pick-a");
      }} />
      <p className="phase-hint">{phase === "pick-a" ? "Choose a progression for your verse." : "Add a chorus for variety, or keep your verse only."}</p>
      {phase === "pick-b" && selectedA && <div className="quiet-actions">
        <span className="phase-hint">Verse: {selectedA.name}</span>
        <SecondaryButton onClick={() => { preview.stop(); setPhase("pick-a"); setSelectedA(null); }}>Change verse</SecondaryButton>
      </div>}
      <details className="precision-details"><summary>Instruments & playing style</summary><div className="settings-stack">
        <SelectionGroup label="Instrument" value={selectedInstrument} options={INSTRUMENTS.map((inst) => ({ value: inst.id, label: inst.label, icon: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={inst.icon} /></svg> }))} onChange={(value) => { preview.stop(); setSelectedInstrument(value); }} />
        <SelectionGroup label="Playing style" value={selectedPattern.name} options={availablePatterns.map((pattern) => ({ value: pattern.name, label: pattern.name }))} onChange={(name) => {
          const pattern = availablePatterns.find((p) => p.name === name);
          if (pattern) { preview.stop(); setSelectedPattern(pattern); }
        }} />
      </div></details>
      <div className="quiet-actions">
        <SecondaryButton onClick={() => { preview.stop(); onSkip(); }}>Skip — no chords</SecondaryButton>
        {phase === "pick-b" && selectedA && <SecondaryButton onClick={() => { preview.stop(); onSelect(selectedA, null, selectedInstrument, selectedPattern); }}>Skip B — use A only</SecondaryButton>}
      </div>
      {preview.error && <p className="recovery-message" role="alert">{preview.error}</p>}
      <div className="progression-list">
        {(showAll ? displayOptions : displayOptions.slice(0, 3)).map((prog) => {
          const fullPreview = preview.state?.key === progressionKey(prog.name);
          const singleIndex = prog.chords.findIndex((_, index) => preview.state?.key === chordKey(prog.name, index));
          const previewHere = fullPreview || singleIndex >= 0;
          const playing = previewHere && preview.state?.phase === "playing";
          return <ProgressionModule
            key={prog.name}
            progression={prog}
            detectedKey={detectedKey}
            selected={selectedA?.name === prog.name}
            recommended={phase === "pick-b" && selectedA?.name !== prog.name && recommended.has(prog.name)}
            phase={phase}
            bpm={bpm}
            previewPhase={previewHere ? preview.state?.phase ?? null : null}
            playingChord={playing && preview.state?.step !== null ? fullPreview ? preview.state?.step ?? null : singleIndex : null}
            auditionedChord={auditioned?.name === prog.name ? auditioned.index : null}
            onPreview={() => handlePreview(prog)}
            onAudition={(index) => handleAudition(prog, index)}
            onSelect={() => handleSelect(prog)}
          />;
        })}
      </div>
      {displayOptions.length > 3 && <SecondaryButton aria-expanded={showAll} onClick={() => { if (showAll) preview.stop(); setShowAll((value) => !value); }}>{showAll ? "Show fewer ideas" : "More chord ideas"}</SecondaryButton>}
    </div>
  );
}
