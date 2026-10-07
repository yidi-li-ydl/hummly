"use client";

import { useRef, useCallback, useEffect, useState } from "react";

interface AlignTimelineProps {
  voiceDuration: number;
  bpm: number;
  beatsPerBar: number;
  beatOffset: number;
  onChange: (beatOffset: number) => void;
  disabled?: boolean;
}

function snap50ms(v: number): number {
  return Math.round(v * 20) / 20;
}

type DragTarget = "voice" | "beats";

export default function AlignTimeline({
  voiceDuration,
  bpm,
  beatsPerBar,
  beatOffset,
  onChange,
  disabled,
}: AlignTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    target: DragTarget;
    startX: number;
    startPos: number;
    containerWidth: number;
  } | null>(null);
  const [dragging, setDragging] = useState<DragTarget | null>(null);

  const beatPeriod = 60 / bpm;
  const barDuration = beatsPerBar * beatPeriod;

  // Timeline has padding so blocks can be dragged beyond voice edges
  const padding = barDuration * 2;
  const timelineLength = voiceDuration + padding * 2;

  // Voice position — internal state so both blocks can move independently
  const [voicePos, setVoicePos] = useState(padding);
  const voicePosRef = useRef(voicePos);
  useEffect(() => { voicePosRef.current = voicePos; }, [voicePos]);

  // Beats position is derived from voice position + offset
  const beatsPos = voicePos + beatOffset;

  // Beat ticks inside the beats block (relative to block, not timeline)
  const beatTicks: { pct: number; isDownbeat: boolean }[] = [];
  for (let i = 0; i * beatPeriod < voiceDuration; i++) {
    beatTicks.push({
      pct: (i * beatPeriod) / voiceDuration * 100,
      isDownbeat: i % beatsPerBar === 0,
    });
  }

  // Time ruler — pick a sensible interval
  const rulerInterval = timelineLength > 30 ? 10 : timelineLength > 10 ? 5 : barDuration;
  const rulerTicks: { pct: number; label: string }[] = [];
  for (let t = 0; t <= timelineLength; t += rulerInterval) {
    rulerTicks.push({
      pct: (t / timelineLength) * 100,
      label: `${Math.round(t)}s`,
    });
  }

  const onPointerDown = useCallback(
    (target: DragTarget, e: React.PointerEvent) => {
      if (disabled) return;
      const container = containerRef.current;
      if (!container) return;

      const currentPos = target === "voice"
        ? voicePosRef.current
        : voicePosRef.current + beatOffset;

      dragRef.current = {
        target,
        startX: e.clientX,
        startPos: currentPos,
        containerWidth: container.getBoundingClientRect().width,
      };
      setDragging(target);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [disabled, beatOffset]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const deltaX = e.clientX - drag.startX;
      const deltaSeconds = (deltaX / drag.containerWidth) * timelineLength;
      const raw = drag.startPos + deltaSeconds;
      const clamped = Math.max(0, Math.min(raw, timelineLength - voiceDuration));
      const snapped = snap50ms(clamped);

      if (drag.target === "voice") {
        // Move voice, keep beats visually in place → offset changes
        const currentBeatsPos = voicePosRef.current + beatOffset;
        const newOffset = snap50ms(currentBeatsPos - snapped);
        setVoicePos(snapped);
        voicePosRef.current = snapped;
        onChange(newOffset);
      } else {
        // Move beats, voice stays → offset changes
        const newOffset = snap50ms(snapped - voicePosRef.current);
        onChange(newOffset);
      }
    },
    [beatOffset, timelineLength, voiceDuration, onChange]
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    setDragging(null);
  }, []);

  useEffect(() => {
    return () => { dragRef.current = null; };
  }, []);

  if (voiceDuration <= 0) return null;

  const blockWidthPct = (voiceDuration / timelineLength) * 100;
  const voiceLeftPct = (voicePos / timelineLength) * 100;
  const beatsLeftPct = (beatsPos / timelineLength) * 100;

  return (
    <div className="w-full max-w-md mx-auto select-none">
      <p className="text-text-secondary text-xs mb-2 text-center">
        Drag to align voice and beats
      </p>

      <div
        ref={containerRef}
        className="relative bg-surface-card rounded-lg border border-white/5 p-3 pt-6"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Time ruler */}
        <div className="relative h-4 mb-2">
          {rulerTicks.map((tick, i) => (
            <div
              key={i}
              className="absolute top-0 flex flex-col items-center -translate-x-1/2"
              style={{ left: `${tick.pct}%` }}
            >
              <span className="text-[9px] text-text-secondary/60 font-mono">
                {tick.label}
              </span>
              <div className="w-px h-1.5 bg-white/10 mt-0.5" />
            </div>
          ))}
        </div>

        {/* Tracks */}
        <div className="flex flex-col gap-2">
          {/* Voice track */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium w-10 text-right shrink-0 text-neon-purple">
              Voice
            </span>
            <div className="relative flex-1 h-8 rounded bg-white/5">
              <div
                onPointerDown={(e) => onPointerDown("voice", e)}
                className={`absolute top-0.5 bottom-0.5 rounded border bg-neon-purple/30 border-neon-purple ${
                  disabled
                    ? "cursor-default opacity-50"
                    : dragging === "voice"
                    ? "cursor-grabbing opacity-100"
                    : "cursor-grab opacity-80 hover:opacity-100"
                } transition-opacity flex items-center justify-center`}
                style={{
                  left: `${voiceLeftPct}%`,
                  width: `${blockWidthPct}%`,
                  minWidth: "12px",
                }}
              >
                <span className="text-[8px] font-mono text-white/50 pointer-events-none truncate px-1">
                  {voiceDuration.toFixed(1)}s
                </span>
              </div>
            </div>
          </div>

          {/* Beats track */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium w-10 text-right shrink-0 text-neon-cyan">
              Beats
            </span>
            <div className="relative flex-1 h-8 rounded bg-white/5">
              <div
                onPointerDown={(e) => onPointerDown("beats", e)}
                className={`absolute top-0.5 bottom-0.5 rounded border bg-neon-cyan/15 border-neon-cyan/50 ${
                  disabled
                    ? "cursor-default opacity-50"
                    : dragging === "beats"
                    ? "cursor-grabbing opacity-100"
                    : "cursor-grab opacity-80 hover:opacity-100"
                } transition-opacity overflow-hidden`}
                style={{
                  left: `${beatsLeftPct}%`,
                  width: `${blockWidthPct}%`,
                  minWidth: "12px",
                }}
              >
                {/* Beat tick marks */}
                {beatTicks.map((tick, i) => (
                  <div
                    key={i}
                    className={`absolute top-0 ${
                      tick.isDownbeat
                        ? "h-full w-0.5 bg-neon-cyan"
                        : "h-1/2 w-px bg-neon-cyan/50 mt-auto"
                    }`}
                    style={{ left: `${tick.pct}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Offset display */}
        <p className="text-center mt-3 text-[10px] tabular-nums text-text-secondary/60">
          offset{" "}
          <span className="text-neon-cyan font-mono">
            {beatOffset === 0 ? "0" : (beatOffset > 0 ? "+" : "") + beatOffset.toFixed(2)}s
          </span>
        </p>
      </div>
    </div>
  );
}
