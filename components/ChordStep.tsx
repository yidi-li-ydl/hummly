"use client";

import { useState } from "react";
import { previewChords, stopPreview } from "@/lib/audio/mixer";
import type { ChordInstrument, ChordProgression, KeyResult } from "@/lib/types";

const INSTRUMENTS: { id: ChordInstrument; label: string; icon: string }[] = [
  { id: "piano", label: "Piano", icon: "M3 5h18v14H3V5zm2 2v4h2V7H5zm4 0v4h2V7H9zm4 0v4h2V7h-2zm4 0v4h2V7h-2zM5 13v4h3v-4H5zm5 0v4h4v-4h-4zm6 0v4h3v-4h-3z" },
  { id: "guitar", label: "Guitar", icon: "M19.59 3.41a2 2 0 00-2.83 0l-1.53 1.53a1 1 0 01-.38.25l-1.42.47a1 1 0 00-.57.57l-.47 1.42a1 1 0 01-.25.38L8.3 11.87a4.5 4.5 0 00-4.13 1.3 4.5 4.5 0 000 6.36 4.5 4.5 0 006.36 0 4.5 4.5 0 001.3-4.13l3.84-3.84a1 1 0 01.38-.25l1.42-.47a1 1 0 00.57-.57l.47-1.42a1 1 0 01.25-.38l1.53-1.53a2 2 0 000-2.83zM8.12 17.88a1.5 1.5 0 11-2.12-2.12 1.5 1.5 0 012.12 2.12z" },
  { id: "strings", label: "Strings", icon: "M9 3v12.26A3.5 3.5 0 107 19.5V7h8v8.26A3.5 3.5 0 1013 19.5V5h-4z" },
  { id: "synth-pad", label: "Synth Pad", icon: "M3 6h2v12H3V6zm4 2h2v8H7V8zm4-3h2v14h-2V5zm4 4h2v6h-2V9zm4-2h2v10h-2V7z" },
];

interface Props {
  options: ChordProgression[];
  detectedKey: KeyResult;
  onSelect: (progression: ChordProgression, instrument: ChordInstrument) => void;
}

export default function ChordStep({ options, detectedKey, onSelect }: Props) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<ChordInstrument>("piano");

  const handlePreview = async (index: number) => {
    if (previewIndex === index) {
      stopPreview();
      setPreviewIndex(null);
      return;
    }
    setPreviewIndex(index);
    await previewChords(options[index], selectedInstrument);
    setPreviewIndex(null);
  };

  const handleSelect = (index: number) => {
    setSelected(index);
    stopPreview();
    onSelect(options[index], selectedInstrument);
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
        <p className="text-text-secondary text-xs mt-1">Choose a chord progression</p>
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

      <div className="grid gap-3">
        {options.map((prog, i) => (
          <div
            key={i}
            className={`relative p-4 rounded-xl border transition-all cursor-pointer ${
              selected === i
                ? "border-neon-purple bg-neon-purple/10"
                : "border-surface-card bg-surface-card hover:border-neon-purple/50"
            }`}
            onClick={() => handleSelect(i)}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">{prog.name}</h3>
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
                  handlePreview(i);
                }}
                className="w-10 h-10 rounded-full bg-surface-secondary hover:bg-neon-purple/30 flex items-center justify-center flex-shrink-0 transition-colors"
              >
                {previewIndex === i ? (
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
            {selected === i && (
              <div className="absolute top-2 right-2">
                <div className="w-5 h-5 rounded-full bg-neon-green flex items-center justify-center">
                  <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
