"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import type { MixOffsets } from "@/lib/types";

interface TimelineProps {
  voiceDuration: number;
  backingDuration: number;
  offsets: MixOffsets;
  onChange: (offsets: MixOffsets) => void;
  hasVoice: boolean;
  hasChords: boolean;
  hasDrums: boolean;
  disabled?: boolean;
}

type TrackKey = "voice" | "chords" | "drums";

const TRACK_COLORS: Record<TrackKey, { bg: string; border: string; text: string }> = {
  voice:  { bg: "bg-neon-purple/30", border: "border-neon-purple", text: "text-neon-purple" },
  chords: { bg: "bg-neon-cyan/30",   border: "border-neon-cyan",   text: "text-neon-cyan" },
  drums:  { bg: "bg-neon-green/30",  border: "border-neon-green",  text: "text-neon-green" },
};

const TRACK_LABELS: Record<TrackKey, string> = {
  voice: "Voice",
  chords: "Chords",
  drums: "Drums",
};

function snap(v: number): number {
  return Math.round(v * 10) / 10;
}

export default function Timeline({
  voiceDuration,
  backingDuration,
  offsets,
  onChange,
  hasVoice,
  hasChords,
  hasDrums,
  disabled,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    track: TrackKey;
    startX: number;
    startOffset: number;
    containerWidth: number;
    timelineEnd: number;
  } | null>(null);
  const [dragging, setDragging] = useState<TrackKey | null>(null);

  const tracks: { key: TrackKey; duration: number; enabled: boolean }[] = [
    { key: "voice",  duration: voiceDuration,   enabled: hasVoice },
    { key: "chords", duration: backingDuration,  enabled: hasChords },
    { key: "drums",  duration: backingDuration,  enabled: hasDrums },
  ];

  const enabledTracks = tracks.filter((t) => t.enabled);

  const timelineEnd = Math.max(
    hasVoice  ? offsets.voice  + voiceDuration   : 0,
    hasChords ? offsets.chords + backingDuration  : 0,
    hasDrums  ? offsets.drums  + backingDuration  : 0,
    10
  ) * 1.15;

  // Generate time ticks every 2 seconds
  const ticks: number[] = [];
  for (let t = 0; t <= timelineEnd; t += 2) {
    ticks.push(t);
  }

  const onPointerDown = useCallback(
    (track: TrackKey, e: React.PointerEvent) => {
      if (disabled) return;
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      dragRef.current = {
        track,
        startX: e.clientX,
        startOffset: offsets[track],
        containerWidth: rect.width,
        timelineEnd,
      };
      setDragging(track);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [disabled, offsets, timelineEnd]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const deltaX = e.clientX - drag.startX;
      const deltaSeconds = (deltaX / drag.containerWidth) * drag.timelineEnd;
      const raw = drag.startOffset + deltaSeconds;
      const clamped = Math.max(0, Math.min(raw, backingDuration));
      const snapped = snap(clamped);

      if (snapped !== offsets[drag.track]) {
        onChange({ ...offsets, [drag.track]: snapped });
      }
    },
    [offsets, onChange, backingDuration]
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    setDragging(null);
  }, []);

  // Clean up drag on unmount
  useEffect(() => {
    return () => {
      dragRef.current = null;
    };
  }, []);

  if (enabledTracks.length === 0) return null;

  return (
    <div className="w-full max-w-md mx-auto select-none">
      <p className="text-text-secondary text-xs mb-2 text-center">
        Drag tracks to adjust start times
      </p>

      <div
        ref={containerRef}
        className="relative bg-surface-card rounded-lg border border-white/5 p-3 pt-6"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Time scale */}
        <div className="relative h-4 mb-2">
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: `${(t / timelineEnd) * 100}%` }}
            >
              <span className="text-[9px] text-text-secondary/60 font-mono">
                {t}s
              </span>
              <div className="w-px h-1.5 bg-white/10 mt-0.5" />
            </div>
          ))}
        </div>

        {/* Tracks */}
        <div className="flex flex-col gap-2">
          {enabledTracks.map(({ key, duration }) => {
            const color = TRACK_COLORS[key];
            const offsetPct = (offsets[key] / timelineEnd) * 100;
            const widthPct = (duration / timelineEnd) * 100;
            const isDragging = dragging === key;

            return (
              <div key={key} className="flex items-center gap-2">
                {/* Label */}
                <span
                  className={`text-[10px] font-medium w-12 text-right shrink-0 ${color.text}`}
                >
                  {TRACK_LABELS[key]}
                </span>

                {/* Track lane */}
                <div className="relative flex-1 h-7 rounded bg-white/5">
                  {/* Draggable block */}
                  <div
                    onPointerDown={(e) => onPointerDown(key, e)}
                    className={`absolute top-0.5 bottom-0.5 rounded border ${color.bg} ${color.border} ${
                      disabled
                        ? "cursor-default opacity-50"
                        : isDragging
                        ? "cursor-grabbing opacity-100"
                        : "cursor-grab opacity-80 hover:opacity-100"
                    } transition-opacity flex items-center justify-center`}
                    style={{
                      left: `${offsetPct}%`,
                      width: `${widthPct}%`,
                      minWidth: "12px",
                    }}
                  >
                    <span className="text-[8px] font-mono text-white/50 pointer-events-none truncate px-1">
                      {duration.toFixed(1)}s
                    </span>
                  </div>
                </div>

                {/* Offset value */}
                <span className="text-[10px] font-mono text-text-secondary w-10 shrink-0">
                  {offsets[key] > 0 ? `+${offsets[key].toFixed(1)}s` : "0s"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
