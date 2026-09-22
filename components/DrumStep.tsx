"use client";

import { useState } from "react";
import { previewDrums, stopPreview } from "@/lib/audio/mixer";
import type { DrumStyle } from "@/lib/types";

interface Props {
  options: DrumStyle[];
  onSelect: (style: DrumStyle) => void;
}

export default function DrumStep({ options, onSelect }: Props) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const handlePreview = async (index: number) => {
    if (previewIndex === index) {
      stopPreview();
      setPreviewIndex(null);
      return;
    }
    setPreviewIndex(index);
    await previewDrums(options[index]);
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
        <p className="text-text-secondary text-xs">Choose a drum style</p>
      </div>

      <div className="grid gap-3">
        {options.map((style, i) => (
          <div
            key={i}
            className={`relative p-4 rounded-xl border transition-all cursor-pointer ${
              selected === i
                ? "border-neon-pink bg-neon-pink/10"
                : "border-surface-card bg-surface-card hover:border-neon-pink/50"
            }`}
            onClick={() => handleSelect(i)}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">{style.name}</h3>
                <p className="text-text-secondary text-xs mt-0.5">{style.description}</p>
                <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-surface-secondary text-xs text-neon-pink font-mono">
                  {style.bpm} BPM
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreview(i);
                }}
                className="w-10 h-10 rounded-full bg-surface-secondary hover:bg-neon-pink/30 flex items-center justify-center flex-shrink-0 transition-colors"
              >
                {previewIndex === i ? (
                  <svg className="w-4 h-4 text-neon-pink" fill="currentColor" viewBox="0 0 24 24">
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
