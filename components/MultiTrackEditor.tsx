"use client";

import { useState, useCallback, useEffect, useRef, type CSSProperties } from "react";
import type { VoicePcm } from "@/lib/types";
import { cutSelection, silenceSelection, stretchSelection } from "@/lib/audio/waveformOps";
import WaveformCanvas from "./WaveformCanvas";
import WaveformToolbar from "./WaveformToolbar";

type TrackId = "voice" | "chords" | "drums";

interface TrackData {
  id: TrackId;
  label: string;
  icon: React.ReactNode;
  pcm: VoicePcm;
  onPcmChange: (pcm: VoicePcm) => void;
}

interface MultiTrackEditorProps {
  tracks: TrackData[];
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  bpm: number;
  beatsPerBar: number;
  beatOffset: number;
  currentTime?: number;
}

interface TrackState {
  currentPcm: VoicePcm;
  history: VoicePcm[];
  selection: { startSec: number; endSec: number } | null;
  isProcessing: boolean;
}

const MAX_UNDO = 3;
const MIN_REMAINING_SEC = 0.5;

function initTrackState(pcm: VoicePcm): TrackState {
  return { currentPcm: pcm, history: [], selection: null, isProcessing: false };
}

export default function MultiTrackEditor({
  tracks,
  disabled = false,
  onBusyChange,
  bpm,
  beatsPerBar,
  beatOffset,
  currentTime,
}: MultiTrackEditorProps) {
  const [stretchMode, setStretchMode] = useState(false);
  const [stretchError, setStretchError] = useState<string | null>(null);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(100);
  const [activeTrackId, setActiveTrackId] = useState<TrackId>(tracks[0]?.id ?? "voice");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const [trackStates, setTrackStates] = useState<Record<TrackId, TrackState>>(() => {
    const init = {} as Record<TrackId, TrackState>;
    for (const t of tracks) {
      init[t.id] = initTrackState(t.pcm);
    }
    return init;
  });

  // Keep a ref to tracks so callbacks can read current onPcmChange
  const tracksRef = useRef(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  // Sync when parent passes new pcm references
  // Keep the dependency list structurally stable. Passing a computed array as the
  // dependency list makes React treat the hook as malformed and can also create a
  // render loop when the parent recreates `tracks` on every render.
  const voicePcm = tracks.find((t) => t.id === "voice")?.pcm;
  const chordsPcm = tracks.find((t) => t.id === "chords")?.pcm;
  const drumsPcm = tracks.find((t) => t.id === "drums")?.pcm;
  const prevPcmRefs = useRef<Record<TrackId, VoicePcm | null>>({} as Record<TrackId, VoicePcm | null>);
  useEffect(() => {
    let changed = false;
    for (const t of tracks) {
      if (prevPcmRefs.current[t.id] !== t.pcm) {
        changed = true;
        break;
      }
    }
    for (const t of tracks) {
      prevPcmRefs.current[t.id] = t.pcm;
    }
    if (!changed) return;
    setTrackStates((prev) => {
      const next = { ...prev };
      for (const t of tracks) {
        if (next[t.id]?.currentPcm !== t.pcm) next[t.id] = initTrackState(t.pcm);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voicePcm, chordsPcm, drumsPcm]);

  const updateTrack = useCallback(
    (id: TrackId, updater: (s: TrackState) => TrackState) => {
      setTrackStates((prev) => ({ ...prev, [id]: updater(prev[id]) }));
    },
    []
  );

  const handleSelectionChange = useCallback(
    (id: TrackId, sel: { startSec: number; endSec: number } | null) => {
      setActiveTrackId(id);
      setStretchMode(false);
      updateTrack(id, (s) => ({ ...s, selection: sel }));
    },
    [updateTrack]
  );

  const applyEdit = useCallback(
    (newPcm: VoicePcm) => {
      setStretchMode(false);
      const id = activeTrackId;
      setTrackStates((prev) => {
        const s = prev[id];
        const newHistory = s.history.slice(-(MAX_UNDO - 1)).concat(s.currentPcm);
        return {
          ...prev,
          [id]: { ...s, currentPcm: newPcm, history: newHistory, selection: null },
        };
      });
      const track = tracksRef.current.find((t) => t.id === id);
      track?.onPcmChange(newPcm);
    },
    [activeTrackId]
  );

  const activeState = trackStates[activeTrackId];
  const processing = Object.values(trackStates).some(state => state.isProcessing);
  const locked = disabled || processing;
  useEffect(() => { onBusyChange?.(processing); }, [processing, onBusyChange]);
  const hasSelection = !!activeState?.selection && activeState.selection.endSec - activeState.selection.startSec >= .02;
  const canCut = hasSelection && !!activeState?.selection &&
    activeState.currentPcm.channels[0].length / activeState.currentPcm.sampleRate -
    (activeState.selection.endSec - activeState.selection.startSec) >= MIN_REMAINING_SEC;
  const timelineDuration = Math.max(0, ...Object.values(trackStates).map(state => state.currentPcm.channels[0].length / state.currentPcm.sampleRate));
  const barDuration = beatsPerBar * 60 / bpm;
  const ticks = Array.from({ length: Math.ceil(timelineDuration / barDuration) }, (_, i) => i * barDuration);

  const handleCut = useCallback(() => {
    if (!activeState?.selection) return;
    const pcm = activeState.currentPcm;
    const sel = activeState.selection;
    const start = Math.round(sel.startSec * pcm.sampleRate);
    const end = Math.round(sel.endSec * pcm.sampleRate);
    const totalAfter = pcm.channels[0].length - (end - start);
    if (totalAfter / pcm.sampleRate < MIN_REMAINING_SEC) return;
    applyEdit(cutSelection(pcm, start, end));
  }, [activeState, applyEdit]);

  const handleSilence = useCallback(() => {
    if (!activeState?.selection) return;
    const pcm = activeState.currentPcm;
    const sel = activeState.selection;
    const start = Math.round(sel.startSec * pcm.sampleRate);
    const end = Math.round(sel.endSec * pcm.sampleRate);
    applyEdit(silenceSelection(pcm, start, end));
  }, [activeState, applyEdit]);

  const handleStretch = useCallback(
    async (ratio: number) => {
      if (!activeState || activeState.isProcessing) return;
      const id = activeTrackId;
      const pcm = activeState.currentPcm;
      const sel = activeState.selection ?? { startSec: 0, endSec: pcm.channels[0].length / pcm.sampleRate };
      const start = Math.round(sel.startSec * pcm.sampleRate);
      const end = Math.round(sel.endSec * pcm.sampleRate);
      setStretchError(null);
      updateTrack(id, (s) => ({ ...s, isProcessing: true }));
      try {
        const newPcm = await stretchSelection(pcm, start, end, ratio);
        applyEdit(newPcm);
      } catch {
        setStretchError("Couldn’t stretch this audio. Try again.");
      } finally {
        updateTrack(id, (s) => ({ ...s, isProcessing: false }));
      }
    },
    [activeState, activeTrackId, updateTrack, applyEdit]
  );

  const handleUndo = useCallback(() => {
    setStretchMode(false);
    const id = activeTrackId;
    setTrackStates((prev) => {
      const s = prev[id];
      if (s.history.length === 0) return prev;
      const prevPcm = s.history[s.history.length - 1];
      const newState = {
        ...prev,
        [id]: { ...s, currentPcm: prevPcm, history: s.history.slice(0, -1), selection: null },
      };
      return newState;
    });
    // Also notify parent
    const s = trackStates[activeTrackId];
    if (s.history.length === 0) return;
    const prevPcm = s.history[s.history.length - 1];
    const track = tracksRef.current.find((t) => t.id === activeTrackId);
    track?.onPcmChange(prevPcm);
  }, [activeTrackId, trackStates]);

  return (
    <div className="multi-track-editor w-full min-w-0 flex flex-col gap-2" aria-busy={locked}>
      <WaveformToolbar
        hasSelection={hasSelection}
        canCut={canCut}
        hasHistory={(activeState?.history.length ?? 0) > 0}
        isProcessing={locked}
        pixelsPerSecond={pixelsPerSecond}
        onPixelsPerSecondChange={setPixelsPerSecond}
        onCut={handleCut}
        onSilence={handleSilence}
        stretchMode={stretchMode}
        onToggleStretch={() => setStretchMode(v => !v)}
        onUndo={handleUndo}
      />
      <p className="text-xs text-text-secondary" aria-live="polite">
        {!activeState?.selection ? "Drag across the waveform to select a section." : stretchMode
          ? "Drag the right edge to stretch. Release to hear it with Play."
          : "Section selected. Choose Cut, Silence or Stretch."}
      </p>
      {stretchError && <p role="alert" className="text-xs">{stretchError}</p>}

      <div className="editor-waveforms rounded-lg overflow-hidden bg-cream">
        <div className="flex">
          {/* Track headers */}
          <div className="flex flex-col shrink-0" style={{ width: 76 }}>
            <span className="editor-timeline-label" aria-hidden="true">Bars</span>
            {tracks.map((track) => {
              const isActive = track.id === activeTrackId;
              return (
                <div
                  key={track.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Edit ${track.label} track`}
                  aria-pressed={isActive}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!locked) setActiveTrackId(track.id); } }}
                  onClick={() => { if (!locked) setActiveTrackId(track.id); }}
                  style={{ "--track-color": `var(--${track.id === "voice" ? "lavender" : track.id === "chords" ? "pink" : "mint"})` } as CSSProperties}
                  className={`editor-track-label${isActive ? " is-active" : ""}`}
                >
                  <span className="shrink-0">{track.icon}</span>
                  <span className="text-xs font-medium">{track.label}</span>
                </div>
              );
            })}
          </div>

          {/* Shared scroll area */}
          <div className="editor-scroll flex-1 min-w-0 overflow-x-auto" ref={scrollContainerRef} tabIndex={0} role="region" aria-label="Waveform timeline, scroll horizontally">
            <div className="flex flex-col" style={{ width: Math.max(1, Math.ceil(timelineDuration * pixelsPerSecond)), minWidth: "100%" }}>
              <div className="editor-timeline" aria-label="Timeline in bars; swipe to scroll">
                {ticks.map((time, i) => <span key={time} style={{ left: time * pixelsPerSecond + 4 }}>{i + 1}<small>{time.toFixed(1)}s</small></span>)}
              </div>
              {tracks.map((track) => {
                const state = trackStates[track.id];
                const isActive = track.id === activeTrackId;
                if (!state) return null;
                return (
                  <div
                    key={track.id}
                    onPointerDown={() => {
                      if (!isActive && !locked) setActiveTrackId(track.id);
                    }}
                    style={{ "--track-color": `var(--${track.id === "voice" ? "lavender" : track.id === "chords" ? "pink" : "mint"})` } as CSSProperties}
                    className="editor-track-waveform"
                  >
                    <WaveformCanvas
                      stretchMode={isActive && stretchMode && !!state.selection}
                      onStretch={handleStretch}
                      bare
                      scrollContainerRef={scrollContainerRef}
                      pcm={state.currentPcm}
                      selection={isActive ? state.selection : null}
                      onSelectionChange={(sel) => handleSelectionChange(track.id, sel)}
                      disabled={locked}
                      trackColor={track.id === "voice" ? "lavender" : track.id === "chords" ? "pink" : "mint"}
                      pixelsPerSecond={pixelsPerSecond}
                      bpm={bpm}
                      beatsPerBar={beatsPerBar}
                      beatOffset={beatOffset}
                      currentTime={currentTime}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
