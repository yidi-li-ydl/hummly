"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import type { VoicePcm } from "@/lib/types";
import { computePeaks } from "@/lib/audio/waveformOps";

export interface WaveformCanvasProps {
  trackColor?: "lavender" | "pink" | "mint";
  stretchMode?: boolean;
  onStretch?: (ratio: number) => void;
  pcm: VoicePcm;
  bpm: number;
  beatsPerBar: number;
  beatOffset: number;
  selection: { startSec: number; endSec: number } | null;
  onSelectionChange: (sel: { startSec: number; endSec: number } | null) => void;
  pixelsPerSecond: number;
  disabled?: boolean;
  currentTime?: number;
  bare?: boolean;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export default function WaveformCanvas({
  trackColor,
  stretchMode = false,
  onStretch,
  pcm,
  bpm,
  beatsPerBar,
  beatOffset,
  selection,
  onSelectionChange,
  pixelsPerSecond,
  disabled,
  currentTime,
  bare,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragStart = useRef<number | null>(null);
  const dragStartPx = useRef<number>(0);

  const [stretchRatio, setStretchRatio] = useState<number | null>(null);
  const stretchDrag = useRef<{ x: number; pointer: number; ratio: number } | null>(null);
  const selectionHandle = useRef<{ edge: "start" | "end"; pointer: number } | null>(null);
  const totalSamples = pcm.channels[0].length;
  const duration = totalSamples / pcm.sampleRate;
  const rangeStart = selection?.startSec ?? 0;
  const rangeEnd = selection?.endSec ?? duration;
  const rangeDuration = rangeEnd - rangeStart;
  const ratio = stretchRatio ?? 1;
  const previewEnd = rangeStart + rangeDuration * ratio;
  const previewDuration = duration + rangeDuration * (ratio - 1);
  const sourceWidth = Math.ceil(duration * pixelsPerSecond);
  const logicalWidth = Math.ceil(previewDuration * pixelsPerSecond);
  const logicalHeight = 120;

  const secToX = useCallback(
    (sec: number) => sec * pixelsPerSecond,
    [pixelsPerSecond]
  );

  const xToSec = useCallback(
    (x: number) => Math.max(0, Math.min(duration, x / pixelsPerSecond)),
    [duration, pixelsPerSecond]
  );

  // Peak calculation scans the PCM data. Cache it so moving the playhead only
  // redraws the canvas instead of rescanning the entire recording for every track.
  const peaks = useMemo(
    () => computePeaks(pcm.channels[0], 0, totalSamples, sourceWidth),
    [pcm, totalSamples, sourceWidth]
  );

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = getComputedStyle(canvas);
    const ink = colors.getPropertyValue("--ink").trim();
    const lavender = colors.getPropertyValue(`--${trackColor ?? "lavender"}`).trim();
    const lime = colors.getPropertyValue("--lime").trim();
    const grid = colors.getPropertyValue("--text-muted").trim();

    // 1. Background
    ctx.fillStyle = trackColor ? colors.getPropertyValue("--cream").trim() : ink;
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    if (trackColor) { ctx.fillStyle = lavender; ctx.fillRect(0, 8, logicalWidth, logicalHeight - 16);  }

    // 2. Beat grid
    const beatDuration = 60 / bpm;
    const firstBeatSec = beatOffset;
    const mid = logicalHeight / 2;
    for (let sec = firstBeatSec; sec < duration; sec += beatDuration) {
      const x = secToX(sec);
      const beatIndex = Math.round((sec - firstBeatSec) / beatDuration);
      const isDownbeat = beatIndex % beatsPerBar === 0;
      ctx.strokeStyle = trackColor ? "#e5ddd4" : isDownbeat ? lavender : grid;
      ctx.lineWidth = isDownbeat ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, logicalHeight);
      ctx.stroke();
    }



    // 3. Waveform
    ctx.strokeStyle = trackColor ? "#51475c" : lavender;
    ctx.lineWidth = 1;
    for (let px = 0; px < logicalWidth; px++) {
      const time = px / pixelsPerSecond;
      const sourceTime = time < rangeStart ? time : time < previewEnd
        ? rangeStart + (time - rangeStart) / ratio : time - rangeDuration * (ratio - 1);
      const sourcePx = Math.min(sourceWidth - 1, Math.max(0, Math.floor(sourceTime * pixelsPerSecond)));
      const yMin = mid - peaks.max[sourcePx] * mid;
      const yMax = mid - peaks.min[sourcePx] * mid;
      ctx.beginPath();
      ctx.moveTo(px + 0.5, yMin);
      ctx.lineTo(px + 0.5, yMax);
      ctx.stroke();
    }

    // 4. Selection overlay
    if (selection) {
      const x0 = secToX(selection.startSec);
      const x1 = secToX(previewEnd);
      ctx.fillStyle = lavender;
      ctx.globalAlpha = .15;
      ctx.fillRect(x0, 0, x1 - x0, logicalHeight);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = lime;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0, logicalHeight);
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, logicalHeight);
      ctx.stroke();
    }

    // 5. Playhead
    if (currentTime !== undefined && currentTime >= 0) {
      const x = secToX(currentTime);
      ctx.strokeStyle = lime;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, logicalHeight);
      ctx.stroke();
    }
  }, [bpm, beatsPerBar, beatOffset, selection, logicalWidth, duration, secToX, currentTime, peaks, pixelsPerSecond, rangeStart, rangeDuration, previewEnd, ratio, sourceWidth, trackColor]);

  // Pointer events for selection drag
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled || stretchMode) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);
      const rect = canvas.getBoundingClientRect();
      // `rect.left` already reflects the canvas position after its container
      // has scrolled. Adding scrollLeft again double-counts the offset and
      // makes the selection appear to the right of the pointer.
      const x = e.clientX - rect.left;
      dragStart.current = xToSec(x);
      dragStartPx.current = e.clientX;
    },
    [disabled, stretchMode, xToSec]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (dragStart.current === null || disabled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const sec = xToSec(x);
      const s = Math.min(dragStart.current, sec);
      const end = Math.max(dragStart.current, sec);
      onSelectionChange({ startSec: s, endSec: end });
    },
    [disabled, xToSec, onSelectionChange]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (dragStart.current === null) return;
      const pxDelta = Math.abs(e.clientX - dragStartPx.current);
      if (pxDelta < 3) {
        // Click — cancel selection
        onSelectionChange(null);
      }
      dragStart.current = null;
    },
    [onSelectionChange]
  );

  function selectionEdgeDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    selectionHandle.current = { edge: e.currentTarget.dataset.edge as "start" | "end", pointer: e.pointerId };
  }

  function selectionEdgeMove(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = selectionHandle.current;
    if (!drag || drag.pointer !== e.pointerId || !canvasRef.current || !selection) return;
    const time = xToSec(e.clientX - canvasRef.current.getBoundingClientRect().left);
    onSelectionChange(drag.edge === "start" ? { ...selection, startSec: Math.min(selection.endSec - .02, time) }
      : { ...selection, endSec: Math.max(selection.startSec + .02, time) });
  }

  function selectionEdgeEnd() { selectionHandle.current = null; }

  const canvasEl = (
    <div className="relative" style={{ width: logicalWidth, height: logicalHeight }}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { dragStart.current = null; }}
        className={stretchMode ? "block" : "block cursor-crosshair"}
        style={{ width: logicalWidth, height: logicalHeight, touchAction: disabled ? "pan-x" : "none" }}
      />
      {selection && !stretchMode && !disabled && (["start", "end"] as const).map(edge => <button
        key={edge} type="button" className="wave-selection-handle"
        aria-label={`Adjust selection ${edge}`}
        style={{ left: Math.max(0, (edge === "start" ? selection.startSec : selection.endSec) * pixelsPerSecond - 14) }}
        onKeyDown={e => {
          if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
          e.preventDefault();
          const delta = (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 60 / bpm : .05);
          const value = (edge === "start" ? selection.startSec : selection.endSec) + delta;
          onSelectionChange(edge === "start" ? { ...selection, startSec: Math.max(0, Math.min(selection.endSec - .02, value)) }
            : { ...selection, endSec: Math.min(duration, Math.max(selection.startSec + .02, value)) });
        }}
        data-edge={edge}
        onPointerDown={selectionEdgeDown}
        onPointerMove={selectionEdgeMove}
        onPointerUp={selectionEdgeEnd}
        onPointerCancel={selectionEdgeEnd}
        onLostPointerCapture={selectionEdgeEnd}
      ><span aria-hidden="true" /></button>)}
      {stretchMode && rangeDuration > .02 && <>
        <span className="stretch-duration" style={{ left: rangeStart * pixelsPerSecond + 6 }}>
          {(rangeDuration * ratio).toFixed(2)}s
        </span>
        <button
          type="button"
          className="stretch-edge"
          style={{ left: Math.max(0, previewEnd * pixelsPerSecond - 22) }}
          disabled={disabled}
          aria-label="Drag to stretch selected audio; arrow keys adjust by one beat"
          onKeyDown={e => {
            if (disabled || !onStretch || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
            e.preventDefault();
            const next = Math.max(.5, Math.min(2, 1 + (e.key === "ArrowRight" ? 1 : -1) * (60 / bpm) / rangeDuration));
            void onStretch(next);
          }}
          onPointerDown={e => {
            if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            stretchDrag.current = { x: e.clientX, pointer: e.pointerId, ratio: 1 };
          }}
          onPointerMove={e => {
            const drag = stretchDrag.current;
            if (!drag || drag.pointer !== e.pointerId) return;
            const end = rangeEnd + (e.clientX - drag.x) / pixelsPerSecond;
            const beat = 60 / bpm;
            const snapped = beatOffset + Math.round((end - beatOffset) / beat) * beat;
            const target = Math.abs(snapped - end) * pixelsPerSecond <= 8 ? snapped : end;
            drag.ratio = Math.max(.5, Math.min(2, (target - rangeStart) / rangeDuration));
            setStretchRatio(drag.ratio);
          }}
          onPointerUp={e => {
            const drag = stretchDrag.current;
            if (!drag || drag.pointer !== e.pointerId) return;
            stretchDrag.current = null;
            setStretchRatio(null);
            if (Math.abs(e.clientX - drag.x) >= 3 && Math.abs(drag.ratio - 1) > .001) void onStretch?.(drag.ratio);
          }}
          onPointerCancel={() => { stretchDrag.current = null; setStretchRatio(null); }}
          onLostPointerCapture={() => { stretchDrag.current = null; setStretchRatio(null); }}
        >↔</button>
      </>}
    </div>
  );

  if (bare) return canvasEl;

  return (
    <div className="overflow-x-auto w-full rounded-lg border border-surface-soft">
      {canvasEl}
    </div>
  );
}
