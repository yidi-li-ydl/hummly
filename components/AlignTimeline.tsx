"use client";

import { useRef, useMemo, useState } from "react";
import { computePeaks } from "@/lib/audio/waveformOps";
import type { VoicePcm } from "@/lib/types";

interface AlignTimelineProps {
  voicePcm: VoicePcm;
  bpm: number;
  beatsPerBar: number;
  beatOffset: number;
  onChange: (beatOffset: number) => void;
  disabled?: boolean;
  onsets?: { time: number; strength: number }[];
}
type DragTarget = "voice" | "beats";
const snap = (value: number) => Math.round(value * 20) / 20;

export default function AlignTimeline({ voicePcm, bpm, beatsPerBar, beatOffset, onChange, disabled, onsets = [] }: AlignTimelineProps) {
  const duration = voicePcm.channels[0].length / voicePcm.sampleRate;
  const beatPeriod = 60 / bpm;
  const padding = beatsPerBar * beatPeriod * 2;
  const length = duration + padding * 2;
  const [showFullTrack, setShowFullTrack] = useState(false);
  // Store displacement from the default position so tempo changes keep the
  // voice centered without resetting an alignment the user has adjusted.
  const [voiceShift, setVoiceShift] = useState(0);
  const voicePos = Math.max(0, Math.min(padding + voiceShift, padding * 2));
  const beatsPos = voicePos + beatOffset;
  const viewStart = showFullTrack ? 0 : Math.max(0, Math.min(voicePos, beatsPos) - beatPeriod);
  const viewLength = showFullTrack ? length : Math.min(length, beatPeriod * (beatsPerBar * 4 + 2));
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ target: DragTarget; x: number; voice: number; beats: number; width: number; pointer: number } | null>(null);
  const [dragging, setDragging] = useState<DragTarget | null>(null);
  const peakCount = Math.max(180, Math.min(12000, Math.ceil(duration / (beatPeriod * beatsPerBar) * 160)));
  const peaks = useMemo(() => computePeaks(voicePcm.channels[0], 0, voicePcm.channels[0].length, peakCount), [voicePcm, peakCount]);
  const path = useMemo(() => {
    const peak = Math.max(0.01, ...peaks.max, ...Array.from(peaks.min, v => -v));
    return Array.from(peaks.max, (value, i) => `M${i + .5} ${24 - value / peak * 20}V${24 - peaks.min[i] / peak * 20}`).join(" ");
  }, [peaks]);

  if (duration <= 0) return null;

  function move(target: DragTarget, position: number, fixedVoice = voicePos, fixedBeats = beatsPos) {
    const next = snap(Math.max(0, Math.min(position, padding * 2)));
    if (target === "voice") {
      setVoiceShift(next - padding);
      onChange(snap(fixedBeats - next));
    } else onChange(snap(next - fixedVoice));
  }

  function start(target: DragTarget, e: React.PointerEvent<HTMLDivElement>) {
    if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    const width = trackRef.current?.getBoundingClientRect().width;
    if (!width) return;
    dragRef.current = { target, x: e.clientX, voice: voicePos, beats: beatsPos, width, pointer: e.pointerId };
    setDragging(target);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function end() { dragRef.current = null; setDragging(null); }

  function keyboard(target: DragTarget, e: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const current = target === "voice" ? voicePos : beatsPos;
    const step = e.shiftKey ? beatPeriod : .05;
    const next = e.key === "ArrowLeft" || e.key === "ArrowDown" ? current - step
      : e.key === "ArrowRight" || e.key === "ArrowUp" ? current + step
      : e.key === "Home" ? 0 : e.key === "End" ? padding * 2 : null;
    if (next === null) return;
    e.preventDefault();
    move(target, next);
  }

  const interval = showFullTrack ? (length > 30 ? 10 : length > 10 ? 5 : 1) : beatPeriod * beatsPerBar;
  const firstTick = Math.ceil(viewStart / interval) * interval;
  const ticks = Array.from({ length: Math.max(0, Math.floor((viewStart + viewLength - firstTick) / interval) + 1) }, (_, i) => firstTick + i * interval);
  const beats = Array.from({ length: Math.ceil(duration / beatPeriod) }, (_, i) => i);

  return (
    <div className="alignment-workspace">
      <p className="phase-hint">Match the Beats start to Voice in the first row. Drag either track to adjust.</p>
      <div className="alignment-zoom" role="group" aria-label="Waveform zoom">
        <button type="button" className="secondary-button" aria-pressed={!showFullTrack} onClick={() => setShowFullTrack(false)}>First 4 bars</button>
        <button type="button" className="secondary-button" aria-pressed={showFullTrack} onClick={() => setShowFullTrack(true)}>Full waveform</button>
      </div>
      <div className="alignment-grid">
        <div aria-hidden="true" />
        <div className="alignment-ruler" aria-hidden="true">
          {ticks.map(t => <span key={t} style={{ left: `${(t - viewStart) / viewLength * 100}%` }}>{Number(t.toFixed(1))}s</span>)}
        </div>
        {(["voice", "beats"] as const).map(target => {
          const position = target === "voice" ? voicePos : beatsPos;
          return <div className="alignment-row" key={target}>
            <span className="alignment-label">{target === "voice" ? "Voice" : "Beats"}</span>
            <div className="alignment-track" ref={target === "voice" ? trackRef : undefined}>
              <div
                className={`alignment-clip alignment-clip--${target}${dragging === target ? " is-dragging" : ""}`}
                style={{ left: `${(position - viewStart) / viewLength * 100}%`, width: `${duration / viewLength * 100}%` }}
                role="slider" tabIndex={disabled ? -1 : 0} aria-disabled={disabled}
                aria-label={target === "voice" ? "Voice waveform alignment" : "Beat track alignment"}
                aria-valuemin={0} aria-valuemax={padding * 2} aria-valuenow={position}
                aria-valuetext={`${target === "voice" ? "Voice" : "Beats"} starts at ${position.toFixed(2)} seconds; beat offset ${beatOffset.toFixed(2)} seconds`}
                onKeyDown={e => keyboard(target, e)}
                onPointerDown={e => start(target, e)}
                onPointerMove={e => {
                  const drag = dragRef.current;
                  if (!drag || drag.pointer !== e.pointerId) return;
                  const initial = drag.target === "voice" ? drag.voice : drag.beats;
                  move(drag.target, initial + (e.clientX - drag.x) / drag.width * viewLength, drag.voice, drag.beats);
                }}
                onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
              >
                {target === "voice" && onsets.map((onset, i) => <span key={i} className="alignment-onset" style={{ left: `${onset.time / duration * 100}%` }} aria-hidden="true" />)}
                <span className="alignment-start" aria-hidden="true" />
                {target === "voice" ? <svg viewBox={`0 0 ${peakCount} 48`} preserveAspectRatio="none" aria-hidden="true"><path d={path} fill="none" stroke="currentColor" strokeWidth=".85" /></svg>
                  : beats.map(i => <span key={i} className={`alignment-beat${i % beatsPerBar === 0 ? " is-downbeat" : ""}`} style={{ left: `${i * beatPeriod / duration * 100}%` }} aria-hidden="true" />)}
              </div>
            </div>
          </div>;
        })}
      </div>
      <p className="phase-hint">Orange marks show detected sound starts; the Beats row shows the regular beat grid.</p>
      <p className="alignment-offset">Beats {beatOffset === 0 ? "aligned with voice" : `${Math.abs(beatOffset).toFixed(2)}s ${beatOffset > 0 ? "after" : "before"} voice`}</p>
    </div>
  );
}
