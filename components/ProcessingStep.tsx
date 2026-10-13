"use client";

import { useEffect, useState, useMemo } from "react";
import { quantizeNotes } from "@/lib/audio/noteQuantizer";
import { detectKey } from "@/lib/audio/keyDetector";
import { generateChordProgressions } from "@/lib/audio/chordGenerator";
import { detectBpmFromNotes, detectBeatOffset } from "@/lib/audio/bpmDetector";
import { DRUM_STYLES } from "@/lib/audio/drumPatterns";
import { computePeaks } from "@/lib/audio/waveformOps";
import Hummi from "./Hummi";
import Surface from "./ui/Surface";
import MusicalBlock from "./ui/MusicalBlock";
import { chordVisual } from "@/lib/musicVisuals";
import type { PitchReading, QuantizedNote, KeyResult, ChordProgression, DrumStyle, VoicePcm } from "@/lib/types";

interface Props {
  readings: PitchReading[];
  voicePcm: VoicePcm | null;
  onComplete: (notes: QuantizedNote[], key: KeyResult, chordOptions: ChordProgression[], drumOptions: DrumStyle[], detectedBpm: number, beatOffset: number) => void;
  onError: (error: string) => void;
}
const STAGES = ["Finding your melody", "Finding its key", "Finding its tempo", "Lining up the beat", "Finding its chords", "Preparing rhythm choices"];

// Yield a paint opportunity, without inventing a minimum processing duration.
function nextPaint() {
  return new Promise<void>((resolve) => {
    if (document.visibilityState === "hidden") setTimeout(resolve, 0);
    else requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export default function ProcessingStep({ readings, voicePcm, onComplete, onError }: Props) {
  const [stage, setStage] = useState(0);
  const [notes, setNotes] = useState<QuantizedNote[]>([]);
  const [detectedKey, setDetectedKey] = useState<KeyResult | null>(null);
  const [chords, setChords] = useState<ChordProgression | null>(null);
  const [rhythmReady, setRhythmReady] = useState(false);
  const peaks = useMemo(() => voicePcm ? computePeaks(voicePcm.channels[0], 0, voicePcm.channels[0].length, 80) : [], [voicePcm]);

  useEffect(() => {
    let cancelled = false;
    async function process() {
      try {
        await nextPaint();
        if (cancelled) return;
        const extracted = quantizeNotes(readings);
        if (!extracted.length) {
          onError("We didn’t catch a clear melody yet. Your recording is still here. Try again, or hum a little closer to the microphone.");
          return;
        }
        setNotes(extracted);
        setStage(1);
        await nextPaint();
        if (cancelled) return;
        const key = detectKey(extracted);
        setDetectedKey(key);
        setStage(2);
        await nextPaint();
        if (cancelled) return;
        const bpm = detectBpmFromNotes(extracted);
        setStage(3);
        await nextPaint();
        if (cancelled) return;
        const offset = detectBeatOffset(extracted, bpm);
        setStage(4);
        await nextPaint();
        if (cancelled) return;
        const options = generateChordProgressions(key);
        setChords(options[0] ?? null);
        setStage(5);
        await nextPaint();
        if (cancelled) return;
        const drums = DRUM_STYLES;
        setRhythmReady(true);
        setStage(6);
        await nextPaint();
        if (!cancelled) onComplete(extracted, key, options, drums, bpm, offset);
      } catch {
        if (!cancelled) onError("That melody needs another listen. Your recording is safe—try the analysis again.");
      }
    }
    void process();
    return () => { cancelled = true; };
  }, [readings, onComplete, onError]);

  const minPitch = notes.length ? Math.min(...notes.map((n) => n.midiNote)) : 0;
  return (
    <section className="transform-layout" aria-labelledby="transform-title" aria-busy="true">
      <p className="eyebrow" style={{ justifyContent: "center" }}>A little hum becomes something</p>
      <h1 id="transform-title">Finding your melody’s magic.</h1>
      <p className="transform-status" role="status">{stage === 6 ? "Your musical choices are ready" : `${STAGES[stage]}…`}</p>
      <Hummi state="singing" size="small" />
      <Surface className="transform-stage">
        {notes.length ? <div className="transform-notes" aria-label={`${notes.length} notes found`}>
          {notes.slice(0, 24).map((note, i) => <div key={i} style={{ width: `${Math.min(92, 44 + note.duration * 24)}px`, marginBottom: `${Math.min(36, (note.midiNote - minPitch) * 3)}px` }}><MusicalBlock className="transform-note" color={detectedKey ? chordVisual({ name: note.name, symbol: note.name, notes: [note.midiNote] }, detectedKey).color : "lavender"}>{note.name}</MusicalBlock></div>)}
          {notes.length > 24 && <span className="text-xs">+{notes.length - 24} notes</span>}
        </div> : <svg viewBox="0 0 600 100" className="w-full h-20" role="img" aria-label="Your captured waveform">
          {Array.from("max" in peaks ? peaks.max : [], (peak, i) => <path key={i} d={`M${i * 7.5 + 3} ${50 - Math.max(2, peak * 46)}v${Math.max(4, peak * 92)}`} stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />)}
        </svg>}
        {chords && <div className="transform-harmony" aria-label="Suggested chords">{chords.chords.map((chord, i) => <span key={i}>{chord.name}</span>)}</div>}
        {rhythmReady && <p className="text-xs text-text-secondary">Rhythm choices ready to try</p>}
      </Surface>
      <details className="transform-details"><summary>What’s happening?</summary><ol>{STAGES.map((label, i) => <li key={label}>{i < stage ? "✓ " : i === stage ? "Now: " : "Next: "}{label}</li>)}</ol></details>
    </section>
  );
}
