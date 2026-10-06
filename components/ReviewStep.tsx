"use client";

import { useRef, useState, useCallback, useEffect } from "react";
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

const TIME_SIG_OPTIONS: { label: string; value: number }[] = [
  { label: "4/4", value: 4 },
  { label: "3/4", value: 3 },
];

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
  const audioCtxRef = useRef<AudioContext | null>(null);
  const voiceSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [bpmDraft, setBpmDraft] = useState(String(bpm));
  const [bpmFocused, setBpmFocused] = useState(false);

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

  // Stop playback when BPM, beatsPerBar, or beatOffset changes
  useEffect(() => {
    if (isPlaying) stopPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, beatsPerBar, beatOffset]);

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

    // Schedule click track — offset by beatOffset so clicks align with the melody
    const beatInterval = 60 / bpm;
    let beatCount = 0;
    const startTime = ctx.currentTime;

    function scheduleClicks() {
      const now = ctx.currentTime;
      while (startTime + beatOffset + beatCount * beatInterval < now + 0.3) {
        const t = startTime + beatOffset + beatCount * beatInterval;
        if (t >= now - 0.01) {
          const isDownbeat = beatCount % beatsPerBar === 0;

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = isDownbeat ? 1000 : 800;
          gain.gain.setValueAtTime(isDownbeat ? 0.4 : 0.25, Math.max(t, now));
          gain.gain.exponentialRampToValueAtTime(0.001, Math.max(t, now) + 0.05);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(Math.max(t, now));
          osc.stop(Math.max(t, now) + 0.06);
        }
        beatCount++;
      }
    }

    scheduleClicks();
    clickTimerRef.current = setInterval(scheduleClicks, 150);

    // Visual beat counter
    const visualTimer = setInterval(() => {
      if (!audioCtxRef.current) return;
      const elapsed = audioCtxRef.current.currentTime - startTime;
      const beat = (Math.floor(elapsed / beatInterval) % beatsPerBar) + 1;
      setCurrentBeat(beat);
    }, 50);

    // Store the visual timer to clean up
    const origTimer = clickTimerRef.current;
    clickTimerRef.current = setInterval(() => {
      scheduleClicks();
      if (!audioCtxRef.current) return;
      const elapsed = audioCtxRef.current.currentTime - startTime - beatOffset;
      if (elapsed < 0) { setCurrentBeat(0); return; }
      const beat = (Math.floor(elapsed / beatInterval) % beatsPerBar) + 1;
      setCurrentBeat(beat);
    }, 100);
    clearInterval(origTimer);
    clearInterval(visualTimer);

    setIsPlaying(true);
  }, [voicePcm, bpm, beatsPerBar, beatOffset, stopPlayback]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }, [isPlaying, stopPlayback, startPlayback]);

  return (
    <div className="flex flex-col items-center gap-8 py-4">
      <h2 className="text-lg font-semibold gradient-text">Analysis Complete</h2>

      {/* Detected Key */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-text-secondary text-xs uppercase tracking-wider">Key</p>
        <span className="text-3xl font-bold text-neon-cyan">
          {detectedKey.key} {detectedKey.mode}
        </span>
      </div>

      {/* Detected BPM */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-text-secondary text-xs uppercase tracking-wider">Tempo</p>
        <div className="flex items-center gap-4">
          <button
            onClick={() => onBpmChange(Math.max(40, bpm - 1))}
            className="w-10 h-10 rounded-full bg-surface-card hover:bg-surface-secondary flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors text-lg font-bold"
          >
            -
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={bpmFocused ? bpmDraft : String(bpm)}
            onFocus={(e) => { setBpmDraft(String(bpm)); setBpmFocused(true); e.target.select(); }}
            onChange={(e) => setBpmDraft(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={() => {
              setBpmFocused(false);
              const v = parseInt(bpmDraft, 10);
              if (!isNaN(v)) onBpmChange(Math.max(40, Math.min(200, v)));
            }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className="text-3xl font-bold text-neon-purple tabular-nums w-24 text-center bg-transparent border-b-2 border-neon-purple/30 focus:border-neon-purple outline-none transition-colors"
          />
          <button
            onClick={() => onBpmChange(Math.min(200, bpm + 1))}
            className="w-10 h-10 rounded-full bg-surface-card hover:bg-surface-secondary flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors text-lg font-bold"
          >
            +
          </button>
        </div>
        <p className="text-text-secondary text-xs">BPM</p>
      </div>

      {/* Preview: voice + click track */}
      {voicePcm && (
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={togglePlayback}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isPlaying
                ? "bg-red-500 hover:bg-red-400"
                : "bg-neon-purple hover:bg-neon-purple/80"
            }`}
          >
            {isPlaying ? (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Beat dots */}
          {isPlaying && (
            <div className="flex items-center gap-2">
              {Array.from({ length: beatsPerBar }, (_, i) => {
                const beatNum = i + 1;
                const isActive = currentBeat === beatNum;
                const isDownbeat = beatNum === 1;
                return (
                  <div
                    key={i}
                    className={`rounded-full transition-all duration-75 ${
                      isActive
                        ? isDownbeat
                          ? "w-4 h-4 bg-neon-cyan shadow-[0_0_10px_rgba(34,211,238,0.7)]"
                          : "w-3.5 h-3.5 bg-neon-purple shadow-[0_0_8px_rgba(168,85,247,0.6)]"
                        : "w-2.5 h-2.5 bg-surface-card border border-text-secondary/30"
                    }`}
                  />
                );
              })}
            </div>
          )}

          <p className="text-text-secondary text-xs">
            {isPlaying ? "Listening... adjust BPM until the clicks match your rhythm" : "Play to hear your recording with click track"}
          </p>
        </div>
      )}

      {/* Beat Offset — shift when the first click lands */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-text-secondary text-xs uppercase tracking-wider">Beat Alignment</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const step = 0.01;
              const beatPeriod = 60 / bpm;
              const next = ((beatOffset - step) % beatPeriod + beatPeriod) % beatPeriod;
              onBeatOffsetChange(next);
            }}
            className="w-8 h-8 rounded-full bg-surface-card hover:bg-surface-secondary flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors text-sm font-bold"
          >
            -
          </button>
          <span className="text-sm font-mono text-neon-cyan tabular-nums w-16 text-center">
            {Math.round(beatOffset * 1000)}ms
          </span>
          <button
            onClick={() => {
              const step = 0.01;
              const beatPeriod = 60 / bpm;
              const next = (beatOffset + step) % beatPeriod;
              onBeatOffsetChange(next);
            }}
            className="w-8 h-8 rounded-full bg-surface-card hover:bg-surface-secondary flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors text-sm font-bold"
          >
            +
          </button>
        </div>
        <p className="text-text-secondary text-xs text-center max-w-xs">
          Shift when the clicks start — adjust if they don&apos;t land on your beats
        </p>
      </div>

      {/* Time Signature */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-text-secondary text-xs uppercase tracking-wider">Time Signature</p>
        <div className="flex gap-2">
          {TIME_SIG_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onBeatsPerBarChange(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium font-mono transition-colors ${
                beatsPerBar === opt.value
                  ? "bg-neon-purple text-white"
                  : "bg-surface-card hover:bg-surface-secondary text-text-secondary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Continue button */}
      <button
        onClick={() => { stopPlayback(); onContinue(); }}
        className="mt-2 px-8 py-3 rounded-xl bg-neon-purple hover:bg-neon-purple/80 text-white font-medium transition-colors flex items-center gap-2"
      >
        Continue
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
