"use client";

import { useState, useCallback, useEffect } from "react";
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
  const [pixelsPerSecond, setPixelsPerSecond] = useState(100);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync when parent provides a new voicePcm (e.g. initial load)
  useEffect(() => {
    setCurrentPcm(voicePcm);
    setHistory([]);
    setSelection(null);
  }, [voicePcm]);

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
      if (!selection) return;
      const { start, end } = selToSamples(selection);
      setIsProcessing(true);
      try {
        const newPcm = await stretchSelection(currentPcm, start, end, ratio);
        applyEdit(newPcm);
      } finally {
        setIsProcessing(false);
      }
    },
    [selection, selToSamples, currentPcm, applyEdit]
  );

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
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
        onStretch={handleStretch}
        onUndo={handleUndo}
      />
      <WaveformCanvas
        pcm={currentPcm}
        bpm={bpm}
        beatsPerBar={beatsPerBar}
        beatOffset={beatOffset}
        selection={selection}
        onSelectionChange={setSelection}
        pixelsPerSecond={pixelsPerSecond}
        disabled={isProcessing}
        currentTime={currentTime}
      />
    </div>
  );
}
