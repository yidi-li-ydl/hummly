import * as Tone from "tone";
import toWav from "audiobuffer-to-wav";
import type { ChordProgression, DrumStyle, QuantizedNote } from "../types";

let activeSynths: Tone.ToneAudioNode[] = [];
let cleanupTimers: ReturnType<typeof setTimeout>[] = [];

export async function ensureToneStarted() {
  await Tone.start();
}

function disposeActiveSynths() {
  cleanupTimers.forEach(clearTimeout);
  cleanupTimers = [];
  activeSynths.forEach((s) => {
    try { s.dispose(); } catch { /* */ }
  });
  activeSynths = [];
}

export function stopPreview() {
  disposeActiveSynths();
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function timeToSeconds(timeStr: string, bpm: number): number {
  const [bar, beat, sixteenth] = timeStr.split(":").map(Number);
  const totalBeats = bar * 4 + beat + sixteenth / 4;
  return (totalBeats * 60) / bpm;
}

// Collect and sort drum events per instrument, ensuring strictly increasing times
function buildDrumSchedule(
  pattern: DrumStyle["pattern"],
  bpm: number,
  numBars: number,
  baseTime: number
): { kick: number[]; snare: number[]; hihat: number[] } {
  const barDuration = (4 * 60) / bpm;
  const kick: number[] = [];
  const snare: number[] = [];
  const hihat: number[] = [];

  for (let bar = 0; bar < numBars; bar++) {
    const barOffset = bar * barDuration;
    for (const hit of pattern) {
      const t = baseTime + barOffset + timeToSeconds(hit.time, bpm);
      switch (hit.instrument) {
        case "kick": kick.push(t); break;
        case "snare": snare.push(t); break;
        case "hihat": hihat.push(t); break;
      }
    }
  }

  function dedup(arr: number[]): number[] {
    arr.sort((a, b) => a - b);
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] <= arr[i - 1]) {
        arr[i] = arr[i - 1] + 0.005;
      }
    }
    return arr;
  }

  return { kick: dedup(kick), snare: dedup(snare), hihat: dedup(hihat) };
}

// Schedule hihat hits using raw Web Audio noise bursts through a highpass filter.
// This avoids MetalSynth's monophonic "start time" constraint entirely.
function scheduleHihats(
  times: number[],
  destination: AudioNode,
  audioContext: BaseAudioContext
) {
  for (const t of times) {
    // White noise burst → highpass filter → gain envelope
    const bufferSize = Math.floor(audioContext.sampleRate * 0.05);
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = audioContext.createBufferSource();
    source.buffer = noiseBuffer;

    const hp = audioContext.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;

    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    source.connect(hp);
    hp.connect(gain);
    gain.connect(destination);
    source.start(t);
    source.stop(t + 0.05);
  }
}

export async function previewChords(progression: ChordProgression): Promise<void> {
  await ensureToneStarted();
  disposeActiveSynths();

  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 },
    volume: -8,
  }).toDestination();
  activeSynths.push(synth);

  const now = Tone.now() + 0.1;
  progression.chords.forEach((chord, i) => {
    const freqs = chord.notes.map(midiToFreq);
    synth.triggerAttackRelease(freqs, 0.9, now + i * 1);
  });

  const timer = setTimeout(() => {
    if (activeSynths.includes(synth)) {
      try { synth.dispose(); } catch { /* */ }
      activeSynths = activeSynths.filter((s) => s !== synth);
    }
  }, progression.chords.length * 1000 + 1500);
  cleanupTimers.push(timer);
}

export async function previewDrums(style: DrumStyle): Promise<void> {
  await ensureToneStarted();
  disposeActiveSynths();

  const kick = new Tone.MembraneSynth({ volume: -4 }).toDestination();
  const snare = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
    volume: -8,
  }).toDestination();
  activeSynths.push(kick, snare);

  const now = Tone.now() + 0.1;
  const schedule = buildDrumSchedule(style.pattern, style.bpm, 2, now);

  schedule.kick.forEach((t) => kick.triggerAttackRelease("C1", 0.2, t));
  schedule.snare.forEach((t) => snare.triggerAttackRelease(0.1, t));

  // Hihat via raw Web Audio to avoid MetalSynth timing constraints
  const ctx = Tone.getContext().rawContext;
  if (ctx instanceof AudioContext) {
    scheduleHihats(schedule.hihat, ctx.destination, ctx);
  }

  const barDuration = (4 * 60) / style.bpm;
  const timer = setTimeout(() => {
    disposeActiveSynths();
  }, barDuration * 2 * 1000 + 1000);
  cleanupTimers.push(timer);
}

export async function renderMix(
  notes: QuantizedNote[],
  progression: ChordProgression,
  drumStyle: DrumStyle,
  suggestedNotes?: QuantizedNote[]
): Promise<{ buffer: AudioBuffer; url: string }> {
  const bpm = drumStyle.bpm;
  const barDuration = (4 * 60) / bpm;
  const totalBars = 8;
  const renderDuration = barDuration * totalBars + 2;

  // Combine original melody + suggested continuation into one sequence
  const allNotes = [...notes, ...(suggestedNotes || [])];

  const toneBuffer = await Tone.Offline((context) => {
    const rawCtx = context.rawContext as OfflineAudioContext;

    // --- Beat-snapped synth melody ---
    if (allNotes.length > 0) {
      const melodySynth = new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.6, release: 0.3 },
        volume: -6,
      }).toDestination();

      const melodyEnd = allNotes[allNotes.length - 1].startTime + allNotes[allNotes.length - 1].duration;
      const loopLength = melodyEnd + barDuration * 0.5; // half-bar gap before loop
      const melodyEvents: { t: number; freq: number; dur: number }[] = [];

      for (let offset = 0; offset < totalBars * barDuration; offset += loopLength) {
        for (const note of allNotes) {
          const t = offset + note.startTime;
          if (t >= 0 && t < totalBars * barDuration) {
            melodyEvents.push({
              t,
              freq: midiToFreq(note.midiNote),
              dur: Math.min(note.duration, 2),
            });
          }
        }
      }

      melodyEvents.sort((a, b) => a.t - b.t);
      for (let i = 1; i < melodyEvents.length; i++) {
        if (melodyEvents[i].t <= melodyEvents[i - 1].t) {
          melodyEvents[i].t = melodyEvents[i - 1].t + 0.005;
        }
      }

      for (const ev of melodyEvents) {
        melodySynth.triggerAttackRelease(ev.freq, ev.dur, ev.t);
      }
    }

    // --- Chords ---
    const chordSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 },
      volume: -14,
    }).toDestination();

    for (let bar = 0; bar < totalBars; bar++) {
      const chord = progression.chords[bar % progression.chords.length];
      const freqs = chord.notes.map(midiToFreq);
      const t = bar * barDuration;
      chordSynth.triggerAttackRelease(freqs, barDuration * 0.9, t);
    }

    // --- Kick drum ---
    const kick = new Tone.MembraneSynth({ volume: -4 }).toDestination();
    const kickSchedule = buildDrumSchedule(drumStyle.pattern, bpm, totalBars, 0);
    kickSchedule.kick.forEach((t) => kick.triggerAttackRelease("C1", 0.2, t));

    // --- Snare ---
    const snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
      volume: -8,
    }).toDestination();
    kickSchedule.snare.forEach((t) => snare.triggerAttackRelease(0.1, t));

    // --- Hihat via raw Web Audio nodes (avoids MetalSynth issues) ---
    scheduleHihats(kickSchedule.hihat, rawCtx.destination, rawCtx);
  }, renderDuration);

  const nativeBuffer = toneBuffer.get()!;
  const wavArrayBuffer = toWav(nativeBuffer);
  const wavBlob = new Blob([wavArrayBuffer], { type: "audio/wav" });
  const url = URL.createObjectURL(wavBlob);

  return { buffer: nativeBuffer, url };
}

export function downloadWav(url: string, filename = "hummly-demo.wav") {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
