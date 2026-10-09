"use client";

import { useState, useMemo, useEffect } from "react";
import { previewChords, stopPreview } from "@/lib/audio/mixer";
import { rankBProgressions } from "@/lib/audio/chordGenerator";
import { CHORD_PATTERNS } from "@/lib/audio/chordPatterns";
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

export default function ChordStep({ options, detectedKey, bpm, beatsPerBar, onSelect, onSkip }: Props) {
  const [phase, setPhase] = useState<Phase>("pick-a");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [selectedA, setSelectedA] = useState<number | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<ChordInstrument>("piano");
  const [filter, setFilter] = useState<"all" | "major" | "minor">("all");

  const availablePatterns = useMemo(
    () => CHORD_PATTERNS.filter((p) => p.beatsPerBar === beatsPerBar),
    [beatsPerBar]
  );
  const [selectedPattern, setSelectedPattern] = useState<ChordPattern>(
    () => CHORD_PATTERNS.find((p) => p.beatsPerBar === beatsPerBar) ?? CHORD_PATTERNS[0]
  );

  // Stop preview audio on unmount
  useEffect(() => {
    return () => stopPreview();
  }, []);

  const filteredOptions = useMemo(() => {
    if (filter === "all") return options;
    return options.filter((p) => p.description.includes(` ${filter}:`));
  }, [options, filter]);

  // In pick-b phase, rank B candidates by music-theory compatibility with A
  const displayOptions = useMemo(() => {
    if (phase !== "pick-b" || selectedA === null) return filteredOptions;
    return [
      filteredOptions[selectedA], // keep A in place at index 0
      ...rankBProgressions(filteredOptions[selectedA], filteredOptions),
    ];
  }, [phase, selectedA, filteredOptions]);

  // Track which B candidates are "recommended" (top 2 in ranked list)
  const recommendedNames = useMemo(() => {
    if (phase !== "pick-b" || selectedA === null) return new Set<string>();
    const ranked = rankBProgressions(filteredOptions[selectedA], filteredOptions);
    return new Set(ranked.slice(0, 2).map((p) => p.name));
  }, [phase, selectedA, options]);

  const handlePreview = async (prog: ChordProgression) => {
    const idx = filteredOptions.findIndex((p) => p.name === prog.name);
    if (previewIndex === idx) {
      stopPreview();
      setPreviewIndex(null);
      return;
    }
    setPreviewIndex(idx);
    await previewChords(prog, selectedInstrument, bpm, beatsPerBar, selectedPattern);
    setPreviewIndex(null);
  };

  const handlePickA = (prog: ChordProgression) => {
    const idx = filteredOptions.findIndex((p) => p.name === prog.name);
    setSelectedA(idx);
    stopPreview();
    setPhase("pick-b");
  };

  const handlePickB = (prog: ChordProgression) => {
    if (selectedA === null) return;
    stopPreview();
    onSelect(filteredOptions[selectedA], prog, selectedInstrument, selectedPattern);
  };

  const handleSkipB = () => {
    if (selectedA === null) return;
    stopPreview();
    onSelect(filteredOptions[selectedA], null, selectedInstrument, selectedPattern);
  };

  const handleFilterChange = (newFilter: "all" | "major" | "minor") => {
    if (newFilter === filter) return;
    setFilter(newFilter);
    setSelectedA(null);
    setPhase("pick-a");
    setPreviewIndex(null);
    stopPreview();
  };

  const handleBackToA = () => {
    setPhase("pick-a");
    setSelectedA(null);
    stopPreview();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <p className="text-text-secondary text-sm">
          Detected key:{" "}
          <span className="text-neon-cyan font-semibold">
            {detectedKey.key} {detectedKey.mode}
          </span>
        </p>
        <div className="flex justify-center gap-2 mt-2">
          {(["all", "major", "minor"] as const).map((f) => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-neon-cyan/20 border border-neon-cyan text-neon-cyan"
                  : "bg-surface-card border border-surface-card hover:border-neon-cyan/40 text-text-secondary"
              }`}
            >
              {f === "all" ? "Both" : f === "major" ? "Major" : "Minor"}
            </button>
          ))}
        </div>
        <p className="text-text-secondary text-xs mt-3">
          {phase === "pick-a"
            ? "Pick a chord progression (A section / verse)"
            : "Now pick a B section (chorus) for variety, or skip"}
        </p>
        {phase === "pick-b" && selectedA !== null && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-xs text-neon-purple">
              A: {filteredOptions[selectedA].name}
            </span>
            <button
              onClick={handleBackToA}
              className="text-xs text-text-secondary hover:text-text-primary underline"
            >
              change
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-center gap-2">
        {INSTRUMENTS.map((inst) => (
          <button
            key={inst.id}
            onClick={() => setSelectedInstrument(inst.id)}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              selectedInstrument === inst.id
                ? "bg-neon-cyan/20 border border-neon-cyan text-neon-cyan"
                : "bg-surface-card border border-surface-card hover:border-neon-cyan/40 text-text-secondary hover:text-text-primary"
            }`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d={inst.icon} />
            </svg>
            {inst.label}
          </button>
        ))}
      </div>

      <div className="flex justify-center gap-2 flex-wrap">
        {availablePatterns.map((pat) => (
          <button
            key={pat.name}
            onClick={() => setSelectedPattern(pat)}
            title={pat.description}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedPattern.name === pat.name
                ? "bg-neon-cyan/20 border border-neon-cyan text-neon-cyan"
                : "bg-surface-card border border-surface-card hover:border-neon-cyan/40 text-text-secondary hover:text-text-primary"
            }`}
          >
            {pat.name}
          </button>
        ))}
      </div>

      <div className="flex justify-center gap-2">
        <button
          onClick={() => { stopPreview(); onSkip(); }}
          className="px-4 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary bg-surface-card hover:bg-surface-secondary transition-colors"
        >
          Skip — no chords
        </button>
        {phase === "pick-b" && (
          <button
            onClick={handleSkipB}
            className="px-4 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary bg-surface-card hover:bg-surface-secondary transition-colors"
          >
            Skip B — use A only
          </button>
        )}
      </div>

      <div className="grid gap-3">
        {displayOptions.map((prog, index) => {
          const originalIdx = filteredOptions.findIndex((p) => p.name === prog.name);
          const isSelectedA = phase === "pick-b" && selectedA === originalIdx;
          const isRecommended = phase === "pick-b" && !isSelectedA && recommendedNames.has(prog.name);
          const isFirstRelative =
            phase === "pick-a" &&
            index > 0 &&
            prog.description.includes("(relative") &&
            !displayOptions[index - 1].description.includes("(relative");
          return (
            <div key={prog.name}>
            {isFirstRelative && (
              <div className="text-xs text-text-secondary mt-2 mb-3 flex items-center gap-2">
                <div className="flex-1 h-px bg-white/10" />
                <span>Relative {prog.description.includes("(relative minor)") ? "minor" : "major"}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            )}
            <div
              className={`relative p-4 rounded-xl border transition-all cursor-pointer ${
                isSelectedA
                  ? "border-neon-green bg-neon-green/10 opacity-60 cursor-default"
                  : "border-surface-card bg-surface-card hover:border-neon-purple/50"
              }`}
              onClick={() => {
                if (isSelectedA) return;
                if (phase === "pick-a") handlePickA(prog);
                else handlePickB(prog);
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{prog.name}</h3>
                    {isSelectedA && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-neon-green/20 text-neon-green">
                        A
                      </span>
                    )}
                    {isRecommended && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-neon-purple/20 text-neon-purple">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-text-secondary text-xs mt-0.5">{prog.description}</p>
                  <div className="flex gap-2 mt-2">
                    {prog.chords.map((chord, j) => (
                      <span
                        key={j}
                        className="px-2 py-0.5 rounded bg-surface-secondary text-xs text-neon-cyan font-mono"
                      >
                        {chord.name}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreview(prog);
                  }}
                  className="w-10 h-10 rounded-full bg-surface-secondary hover:bg-neon-purple/30 flex items-center justify-center flex-shrink-0 transition-colors"
                >
                  {previewIndex === originalIdx ? (
                    <svg className="w-4 h-4 text-neon-purple" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-text-primary" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
