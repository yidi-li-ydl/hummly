"use client";

import Icon from "./Icon";
import SecondaryButton from "./ui/SecondaryButton";

export interface WaveformToolbarProps {
  hasSelection: boolean;
  canCut?: boolean;
  hasHistory: boolean;
  isProcessing: boolean;
  pixelsPerSecond: number;
  onPixelsPerSecondChange: (pps: number) => void;
  onCut: () => void;
  onSilence: () => void;
  stretchMode: boolean;
  onToggleStretch: () => void;
  onUndo: () => void;
}

const MIN_PPS = 30;
const MAX_PPS = 400;

export default function WaveformToolbar({
  hasSelection,
  canCut = hasSelection,
  hasHistory,
  isProcessing,
  pixelsPerSecond,
  onPixelsPerSecondChange,
  onCut,
  onSilence,
  stretchMode,
  onToggleStretch,
  onUndo,
}: WaveformToolbarProps) {
  const allDisabled = isProcessing;
  const opsDisabled = allDisabled || !hasSelection;

  return (
    <div className="waveform-toolbar">
      {/* Zoom slider */}
      <label className="waveform-zoom">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>Zoom</span>
        <input
          type="range"
          aria-label="Waveform zoom"
          min={MIN_PPS}
          max={MAX_PPS}
          value={pixelsPerSecond}
          onChange={(e) => onPixelsPerSecondChange(Number(e.target.value))}
          className="accent-ink"
          disabled={allDisabled}
        />
      </label>



      {/* Cut */}
      <SecondaryButton
        onClick={onCut}
        disabled={allDisabled || !canCut}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 12 12M8 16 20 4"/></svg>
        <span>Cut</span>
      </SecondaryButton>

      {/* Silence */}
      <SecondaryButton
        onClick={onSilence}
        disabled={opsDisabled}
      >
        <Icon name="wave" /><span>Silence</span>
      </SecondaryButton>

      <SecondaryButton onClick={onToggleStretch} disabled={opsDisabled} aria-pressed={stretchMode}>
        <span aria-hidden="true">↔</span>Stretch
      </SecondaryButton>



      {/* Undo */}
      <SecondaryButton
        onClick={onUndo}
        disabled={allDisabled || !hasHistory}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
        </svg>
        <span>Undo</span>
      </SecondaryButton>

      {/* Spinner when processing */}
      {isProcessing && (
        <div className="w-4 h-4 rounded-full border-2 border-ink border-t-transparent animate-spin" />
      )}
    </div>
  );
}
