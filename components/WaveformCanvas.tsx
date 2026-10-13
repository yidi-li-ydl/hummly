"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import type { VoicePcm } from "@/lib/types";
import { computePeaks } from "@/lib/audio/waveformOps";

export interface WaveformCanvasProps {
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

  const totalSamples = pcm.channels[0].length;
  const duration = totalSamples / pcm.sampleRate;
  const logicalWidth = Math.ceil(duration * pixelsPerSecond);
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
    () => computePeaks(pcm.channels[0], 0, totalSamples, logicalWidth),
    [pcm, totalSamples, logicalWidth]
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
    const lavender = colors.getPropertyValue("--lavender").trim();
    const lime = colors.getPropertyValue("--lime").trim();
    const grid = colors.getPropertyValue("--text-muted").trim();

    // 1. Background
    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    // 2. Beat grid
    const beatDuration = 60 / bpm;
    const firstBeatSec = beatOffset;
    const mid = logicalHeight / 2;
    for (let sec = firstBeatSec; sec < duration; sec += beatDuration) {
      const x = secToX(sec);
      const beatIndex = Math.round((sec - firstBeatSec) / beatDuration);
      const isDownbeat = beatIndex % beatsPerBar === 0;
      ctx.strokeStyle = isDownbeat ? lavender : grid;
      ctx.lineWidth = isDownbeat ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, logicalHeight);
      ctx.stroke();
    }

    // 3. Waveform
    ctx.strokeStyle = lavender;
    ctx.lineWidth = 1;
    for (let px = 0; px < logicalWidth; px++) {
      const yMin = mid - peaks.max[px] * mid;
      const yMax = mid - peaks.min[px] * mid;
      ctx.beginPath();
      ctx.moveTo(px + 0.5, yMin);
      ctx.lineTo(px + 0.5, yMax);
      ctx.stroke();
    }

    // 4. Selection overlay
    if (selection) {
      const x0 = secToX(selection.startSec);
      const x1 = secToX(selection.endSec);
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
  }, [bpm, beatsPerBar, beatOffset, selection, logicalWidth, duration, secToX, currentTime, peaks]);

  // Pointer events for selection drag
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;
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
    [disabled, xToSec]
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

  const canvasEl = (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="block cursor-crosshair"
      style={{ width: logicalWidth, height: logicalHeight }}
    />
  );

  if (bare) return canvasEl;

  return (
    <div className="overflow-x-auto w-full rounded-lg border border-surface-soft">
      {canvasEl}
    </div>
  );
}
