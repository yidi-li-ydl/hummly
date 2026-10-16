"use client";

import { useState, useCallback } from "react";
import type { VoicePcm } from "@/lib/types";
import { cutSelection, silenceSelection, stretchSelection } from "@/lib/audio/waveformOps";
import WaveformCanvas from "./WaveformCanvas";
import WaveformToolbar from "./WaveformToolbar";

export interface WaveformEditorProps {
  voicePcm: VoicePcm;
  bpm: number;
  beatsPerBar: number;
  beatOffset: number;
  onPcmChange: (pcm: VoicePcm) => void;
  currentTime?: number;
}

const MAX_UNDO = 3;
const MIN_REMAINING_SEC = 0.5;

export default function WaveformEditor({
  voicePcm,
  bpm,
  beatsPerBar,
  beatOffset,
  onPcmChange,
  currentTime,
}: WaveformEditorProps) {
  const [currentPcm, setCurrentPcm] = useState<VoicePcm>(voicePcm);
  const [history, setHistory] = useState<VoicePcm[]>([]);
  const [selection, setSelection] = useState<{ startSec: number; endSec: number } | null>(null);
  const [stretchMode, setStretchMode] = useState(false);
  const [stretchError, setStretchError] = useState<string | null>(null);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(100);
  const [isProcessing, setIsProcessing] = useState(false);

  // Preserve the existing reset-on-new-input behavior before children render.
  const [previousPcm, setPreviousPcm] = useState(voicePcm);
  if (previousPcm !== voicePcm) {
    setPreviousPcm(voicePcm);
    setCurrentPcm(voicePcm);
    setHistory([]);
    setSelection(null);
  }

  const selToSamples = useCallback(
    (sel: { startSec: number; endSec: number }) => ({
      start: Math.round(sel.startSec * currentPcm.sampleRate),
      end: Math.round(sel.endSec * currentPcm.sampleRate),
    }),
    [currentPcm.sampleRate]
  );

  const pushHistory = useCallback(
    (pcm: VoicePcm) => {
      setHistory((h) => h.slice(-(MAX_UNDO - 1)).concat(pcm));
    },
    []
  );

  const applyEdit = useCallback(
    (newPcm: VoicePcm) => {
      setStretchMode(false);
      setPreviousPcm(newPcm);
      pushHistory(currentPcm);
      setCurrentPcm(newPcm);
      setSelection(null);
      onPcmChange(newPcm);
    },
    [currentPcm, pushHistory, onPcmChange]
  );

  const handleCut = useCallback(() => {
    if (!selection) return;
    const { start, end } = selToSamples(selection);
    const totalAfter = currentPcm.channels[0].length - (end - start);
    if (totalAfter / currentPcm.sampleRate < MIN_REMAINING_SEC) return;
    applyEdit(cutSelection(currentPcm, start, end));
  }, [selection, selToSamples, currentPcm, applyEdit]);

  const handleSilence = useCallback(() => {
    if (!selection) return;
    const { start, end } = selToSamples(selection);
    applyEdit(silenceSelection(currentPcm, start, end));
  }, [selection, selToSamples, currentPcm, applyEdit]);

  const handleStretch = useCallback(
    async (ratio: number) => {
      if (isProcessing) return;
      const { start, end } = selToSamples(selection ?? { startSec: 0, endSec: currentPcm.channels[0].length / currentPcm.sampleRate });
      setStretchError(null);
      setIsProcessing(true);
      try {
        const newPcm = await stretchSelection(currentPcm, start, end, ratio);
        applyEdit(newPcm);
      } catch {
        setStretchError("Couldn’t stretch this audio. Try again.");
      } finally {
        setIsProcessing(false);
      }
    },
    [selection, selToSamples, currentPcm, applyEdit, isProcessing]
  );

  const handleUndo = useCallback(() => {
    setStretchMode(false);
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setPreviousPcm(prev);
    setCurrentPcm(prev);
    setSelection(null);
    onPcmChange(prev);
  }, [history, onPcmChange]);

  return (
    <div className="w-full flex flex-col gap-2">
      <WaveformToolbar
        hasSelection={selection !== null}
        hasHistory={history.length > 0}
        isProcessing={isProcessing}
        pixelsPerSecond={pixelsPerSecond}
        onPixelsPerSecondChange={setPixelsPerSecond}
        onCut={handleCut}
        onSilence={handleSilence}
        stretchMode={stretchMode}
        onToggleStretch={() => setStretchMode(v => !v)}
        onUndo={handleUndo}
      />
      <p className="text-xs text-text-secondary" aria-live="polite">
        {!selection ? "Drag across the waveform to select a section." : stretchMode
          ? "Drag the right edge to stretch. Release to hear it with Play."
          : "Section selected. Choose Cut, Silence or Stretch."}
      </p>
      {stretchError && <p role="alert" className="text-xs">{stretchError}</p>}
      <WaveformCanvas
        stretchMode={stretchMode && !!selection}
        onStretch={handleStretch}
        pcm={currentPcm}
        bpm={bpm}
        beatsPerBar={beatsPerBar}
        beatOffset={beatOffset}
        selection={selection}
        onSelectionChange={(sel) => { setStretchMode(false); setSelection(sel); }}
        pixelsPerSecond={pixelsPerSecond}
        disabled={isProcessing}
        currentTime={currentTime}
      />
    </div>
  );
}
