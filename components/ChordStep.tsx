"use client";

import { useState } from "react";
import { previewChords, stopPreview } from "@/lib/audio/mixer";
import type { ChordProgression, KeyResult } from "@/lib/types";

interface Props {
  options: ChordProgression[];
  detectedKey: KeyResult;
  onSelect: (progression: ChordProgression) => void;
}

export default function ChordStep({ options, detectedKey, onSelect }: Props) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const handlePreview = async (index: number) => {
    if (previewIndex === index) {
      stopPreview();
      setPreviewIndex(null);
      return;
    }
    setPreviewIndex(index);
    await previewChords(options[index]);
    setPreviewIndex(null);
  };

  const handleSelect = (index: number) => {
    setSelected(index);
    stopPreview();
    onSelect(options[index]);
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
