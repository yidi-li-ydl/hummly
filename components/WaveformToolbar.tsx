"use client";

import { useState } from "react";

export interface WaveformToolbarProps {
  hasSelection: boolean;
  hasHistory: boolean;
  isProcessing: boolean;
  pixelsPerSecond: number;
  onPixelsPerSecondChange: (pps: number) => void;
  onCut: () => void;
  onSilence: () => void;
  onStretch: (ratio: number) => void;
  onUndo: () => void;
}

const MIN_PPS = 30;
const MAX_PPS = 400;

export default function WaveformToolbar({
  hasSelection,
  hasHistory,
  isProcessing,
  pixelsPerSecond,
  onPixelsPerSecondChange,
  onCut,
  onSilence,
  onStretch,
  onUndo,
}: WaveformToolbarProps) {
  const [stretchOpen, setStretchOpen] = useState(false);
  const [ratio, setRatio] = useState(1.0);

  const allDisabled = isProcessing;
  const opsDisabled = allDisabled || !hasSelection;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {/* Zoom slider */}
      <label className="flex items-center gap-1.5 text-text-secondary">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="range"
          min={MIN_PPS}
          max={MAX_PPS}
          value={pixelsPerSecond}
          onChange={(e) => onPixelsPerSecondChange(Number(e.target.value))}
          className="w-20 accent-neon-cyan"
          disabled={allDisabled}
        />
      </label>

      <span className="w-px h-5 bg-surface-card" />

      {/* Cut */}
      <button
        onClick={onCut}
        disabled={opsDisabled}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-surface-card hover:bg-surface-secondary text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <span>Cut</span>
      </button>

      {/* Silence */}
      <button
        onClick={onSilence}
        disabled={opsDisabled}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-surface-card hover:bg-surface-secondary text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <span>Silence</span>
      </button>

      {/* Stretch */}
      {!stretchOpen ? (
        <button
          onClick={() => setStretchOpen(true)}
          disabled={opsDisabled}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-surface-card hover:bg-surface-secondary text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <span>Stretch</span>
        </button>
      ) : (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-card border border-surface-card">
          <span className="text-text-secondary">Faster</span>
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.05}
            value={ratio}
            onChange={(e) => setRatio(Number(e.target.value))}
            className="w-24 accent-neon-cyan"
            disabled={allDisabled}
          />
          <span className="text-text-secondary">Slower</span>
          <span className="text-text-primary font-mono w-10 text-center">{ratio.toFixed(2)}x</span>
          <button
            onClick={() => {
              onStretch(ratio);
              setStretchOpen(false);
              setRatio(1.0);
            }}
            disabled={allDisabled}
            className="px-2 py-0.5 rounded bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-40 transition-colors"
          >
            Apply
          </button>
          <button
            onClick={() => {
              setStretchOpen(false);
              setRatio(1.0);
            }}
            className="px-2 py-0.5 rounded text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      <span className="w-px h-5 bg-surface-card" />

      {/* Undo */}
      <button
        onClick={onUndo}
        disabled={allDisabled || !hasHistory}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-surface-card hover:bg-surface-secondary text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
        </svg>
        <span>Undo</span>
      </button>

      {/* Spinner when processing */}
      {isProcessing && (
        <div className="w-4 h-4 rounded-full border-2 border-neon-cyan border-t-transparent animate-spin" />
      )}
    </div>
  );
}
