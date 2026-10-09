"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { VoicePcm } from "@/lib/types";
import { cutSelection, silenceSelection, stretchSelection } from "@/lib/audio/waveformOps";
import WaveformCanvas from "./WaveformCanvas";
import WaveformToolbar from "./WaveformToolbar";

type TrackId = "voice" | "chords" | "drums";

interface TrackData {
  id: TrackId;
  label: string;
  icon: string;
  pcm: VoicePcm;
  onPcmChange: (pcm: VoicePcm) => void;
}

interface MultiTrackEditorProps {
  tracks: TrackData[];
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
  bpm,
  beatsPerBar,
  beatOffset,
  currentTime,
}: MultiTrackEditorProps) {
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
        next[t.id] = initTrackState(t.pcm);
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
      updateTrack(id, (s) => ({ ...s, selection: sel }));
    },
    [updateTrack]
  );

  const applyEdit = useCallback(
    (newPcm: VoicePcm) => {
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
      if (!activeState?.selection) return;
      const id = activeTrackId;
      const pcm = activeState.currentPcm;
      const sel = activeState.selection;
      const start = Math.round(sel.startSec * pcm.sampleRate);
      const end = Math.round(sel.endSec * pcm.sampleRate);
      updateTrack(id, (s) => ({ ...s, isProcessing: true }));
      try {
        const newPcm = await stretchSelection(pcm, start, end, ratio);
        applyEdit(newPcm);
      } finally {
        updateTrack(id, (s) => ({ ...s, isProcessing: false }));
      }
    },
    [activeState, activeTrackId, updateTrack, applyEdit]
  );

  const handleUndo = useCallback(() => {
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
    <div className="w-full flex flex-col gap-2">
      <WaveformToolbar
        hasSelection={activeState?.selection !== null}
        hasHistory={(activeState?.history.length ?? 0) > 0}
        isProcessing={activeState?.isProcessing ?? false}
        pixelsPerSecond={pixelsPerSecond}
        onPixelsPerSecondChange={setPixelsPerSecond}
        onCut={handleCut}
        onSilence={handleSilence}
        onStretch={handleStretch}
        onUndo={handleUndo}
      />

      <div className="rounded-lg border border-surface-card overflow-hidden">
        <div className="flex">
          {/* Track headers */}
          <div className="flex flex-col shrink-0" style={{ width: 80 }}>
            {tracks.map((track) => {
              const isActive = track.id === activeTrackId;
              return (
                <div
                  key={track.id}
                  onClick={() => setActiveTrackId(track.id)}
                  className={`h-[120px] flex items-center gap-1.5 px-2 cursor-pointer select-none transition-colors ${
                    isActive
                      ? "bg-neon-purple/10 text-neon-purple border-r-2 border-r-neon-purple"
                      : "bg-surface-card/30 text-text-secondary hover:bg-surface-card/50 border-r-2 border-r-transparent"
                  }`}
                >
                  <span>{track.icon}</span>
                  <span className="text-xs font-medium">{track.label}</span>
                </div>
              );
            })}
          </div>

          {/* Shared scroll area */}
          <div className="flex-1 overflow-x-auto" ref={scrollContainerRef}>
            <div className="flex flex-col">
              {tracks.map((track) => {
                const state = trackStates[track.id];
                const isActive = track.id === activeTrackId;
                if (!state) return null;
                return (
                  <div
                    key={track.id}
                    onPointerDown={() => {
                      if (!isActive) setActiveTrackId(track.id);
                    }}
                    className={isActive ? "" : "opacity-60"}
                  >
                    <WaveformCanvas
                      bare
                      scrollContainerRef={scrollContainerRef}
                      pcm={state.currentPcm}
                      selection={isActive ? state.selection : null}
                      onSelectionChange={(sel) => handleSelectionChange(track.id, sel)}
                      disabled={!isActive || state.isProcessing}
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
