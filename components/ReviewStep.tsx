"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { analyzeAudioBeats } from "@/lib/audio/beatDetector";
import AlignTimeline from "./AlignTimeline";
import Icon from "./Icon";
import ActionButton from "./ui/ActionButton";
import SecondaryButton from "./ui/SecondaryButton";
import SelectionGroup from "./ui/SelectionGroup";
import Surface from "./ui/Surface";
import type { KeyResult, VoicePcm } from "@/lib/types";

interface Props {
  detectedKey: KeyResult;
  bpm: number;
  beatsPerBar: number;
  beatOffset: number;
  voicePcm: VoicePcm | null;
  onBpmChange: (bpm: number) => void;
  onBeatsPerBarChange: (beatsPerBar: number) => void;
  onBeatOffsetChange: (offset: number) => void;
  onContinue: () => void;
}

export default function ReviewStep({
  detectedKey,
  bpm,
  beatsPerBar,
  beatOffset,
  voicePcm,
  onBpmChange,
  onBeatsPerBarChange,
  onBeatOffsetChange,
  onContinue,
}: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioBeats = useMemo(() => voicePcm ? analyzeAudioBeats(voicePcm) : null, [voicePcm]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const voiceSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [bpmDraft, setBpmDraft] = useState(String(bpm));
  const [bpmFocused, setBpmFocused] = useState(false);

  // Refs so the click scheduler always reads fresh values
  const beatOffsetRef = useRef(beatOffset);
  const beatsPerBarRef = useRef(beatsPerBar);
  useEffect(() => { beatOffsetRef.current = beatOffset; }, [beatOffset]);
  useEffect(() => { beatsPerBarRef.current = beatsPerBar; }, [beatsPerBar]);

  const stopPlayback = useCallback(() => {
    if (voiceSourceRef.current) {
      try { voiceSourceRef.current.stop(); } catch { /* already stopped */ }
      voiceSourceRef.current = null;
    }
    if (clickTimerRef.current) {
      clearInterval(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setIsPlaying(false);
    setCurrentBeat(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPlayback();
  }, [stopPlayback]);

  const startPlayback = useCallback(() => {
    if (!voicePcm) return;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    // Create voice buffer
    const voiceBuf = ctx.createBuffer(
      voicePcm.channels.length,
      voicePcm.channels[0].length,
      voicePcm.sampleRate
    );
    for (let ch = 0; ch < voicePcm.channels.length; ch++) {
      voiceBuf.getChannelData(ch).set(voicePcm.channels[ch]);
    }

    // Play voice
    const source = ctx.createBufferSource();
    source.buffer = voiceBuf;
    source.connect(ctx.destination);
    source.start();
    source.onended = () => stopPlayback();
    voiceSourceRef.current = source;

    // Click scheduling that reads beatOffset from ref for live updates.
    // We track which absolute beat times we've already scheduled to avoid
    // double-scheduling when beatOffset changes mid-playback.
    const beatInterval = 60 / bpm;
    const startTime = ctx.currentTime;
    const scheduled = new Set<string>();

    function scheduleClicks() {
      const now = ctx.currentTime;
      const offset = beatOffsetRef.current;
      const bpb = beatsPerBarRef.current;

      // Schedule clicks for the next 0.3s window
      // Find the first beat index that could be in our window
      const windowStart = now - startTime - 0.01;
      const windowEnd = now - startTime + 0.3;
      const firstBeat = Math.max(0, Math.floor((windowStart - offset) / beatInterval));

      for (let i = firstBeat; ; i++) {
        const relT = offset + i * beatInterval;
        const absT = startTime + relT;
        if (relT > windowEnd) break;
        if (relT < windowStart) continue;

        // Unique key to avoid double-scheduling
        const key = `${i}-${offset.toFixed(3)}`;
        if (scheduled.has(key)) continue;
        scheduled.add(key);

        const isDownbeat = i % bpb === 0;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = isDownbeat ? 1000 : 800;
        gain.gain.setValueAtTime(isDownbeat ? 0.4 : 0.25, absT);
        gain.gain.exponentialRampToValueAtTime(0.001, absT + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(absT);
        osc.stop(absT + 0.06);
      }

      // Update visual beat counter
      const elapsed = now - startTime - offset;
      if (elapsed < 0) {
        setCurrentBeat(0);
      } else {
        setCurrentBeat((Math.floor(elapsed / beatInterval) % bpb) + 1);
      }

      // Prune old keys to prevent memory buildup
      if (scheduled.size > 200) {
        const cutoff = now - startTime - 1;
        for (const k of scheduled) {
          const beatIdx = parseInt(k.split("-")[0]);
          if (offset + beatIdx * beatInterval < cutoff) {
            scheduled.delete(k);
          }
        }
      }
    }

    scheduleClicks();
    clickTimerRef.current = setInterval(scheduleClicks, 100);

    setIsPlaying(true);
  }, [voicePcm, bpm, stopPlayback]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }, [isPlaying, stopPlayback, startPlayback]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center"><p className="field-label">Detected key</p><p className="music-data">{detectedKey.key} {detectedKey.mode}</p></div>
      <p className="phase-hint">{bpm} BPM · {beatsPerBar} beats per bar</p>
      {voicePcm && <div className="flex flex-col items-center gap-3">
        <SecondaryButton variant="soft" className="icon-action review-preview" aria-label={isPlaying ? "Stop recording preview" : "Play recording with beat"} aria-pressed={isPlaying} onClick={togglePlayback}><Icon name={isPlaying ? "stop" : "play"} /></SecondaryButton>
        {isPlaying && <div className="flex gap-2" aria-hidden="true">{Array.from({ length: beatsPerBar }, (_, i) => <span key={i} className={`review-beat ${currentBeat === i + 1 ? "is-playing" : ""}`} />)}</div>}
        <p className="phase-hint text-center">{isPlaying ? "Listening… adjust timing if the clicks need a nudge." : "Play to hear your recording with the beat."}</p>
      </div>}
      <section className="review-timing" aria-label="Adjust timing"><Surface className="settings-stack timing-settings">
        <section className="timing-task" aria-labelledby="tempo-task-title">
        <h2 id="tempo-task-title" className="timing-task-title"><span aria-hidden="true">1</span>Adjust tempo</h2>
        <div className="tempo-controls">
          <SecondaryButton variant="quiet" className="icon-action" aria-label="Decrease tempo" onClick={() => { stopPlayback(); onBpmChange(Math.max(40, bpm - 1)); }}>−</SecondaryButton>
          <label className="tempo-value">
            <input
              type="text"
              inputMode="decimal"
              aria-label="Tempo in beats per minute"
              value={bpmFocused ? bpmDraft : String(bpm)}
              onFocus={(e) => { setBpmDraft(String(bpm)); setBpmFocused(true); e.target.select(); }}
              onChange={(e) => setBpmDraft(e.target.value.replace(/[^0-9.]/g, ""))}
              onBlur={() => { setBpmFocused(false); const value = parseFloat(bpmDraft); if (!isNaN(value)) { stopPlayback(); onBpmChange(Math.max(40, Math.min(200, value))); } }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            /><span>BPM</span>
          </label>
          <SecondaryButton variant="quiet" className="icon-action" aria-label="Increase tempo" onClick={() => { stopPlayback(); onBpmChange(Math.min(200, bpm + 1)); }}>+</SecondaryButton>
        </div>
        <SelectionGroup label="Beats per bar" value={String(beatsPerBar)} options={[{ value: "3", label: "3 beats" }, { value: "4", label: "4 beats" }]} onChange={(value) => { stopPlayback(); onBeatsPerBarChange(Number(value)); }} />
        </section>
        {voicePcm && <section className="timing-task timing-task--alignment" aria-labelledby="alignment-task-title">
          <h2 id="alignment-task-title" className="timing-task-title"><span aria-hidden="true">2</span>Fine-tune timing</h2>
          <AlignTimeline voicePcm={voicePcm} bpm={bpm} beatsPerBar={beatsPerBar} beatOffset={beatOffset} onChange={onBeatOffsetChange} onsets={audioBeats?.onsets} />
        </section>}
      </Surface></section>
      <ActionButton onClick={() => { stopPlayback(); onContinue(); }}>Play with chords<Icon name="arrow" /></ActionButton>
    </div>
  );
}
