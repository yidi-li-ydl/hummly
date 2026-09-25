import * as Tone from "tone";
import toWav from "audiobuffer-to-wav";
import type { ChordInstrument, ChordProgression, DrumStyle, KeyResult, MelodyVoice, MixVolumes, PitchReading, QuantizedNote, VoiceEQ, VoicePcm } from "../types";
import { playGuitarChord, playStringsChord, playSynthPadChord } from "./chordSynths";
import { beatAlignVoice } from "./autotune";

import { loadSampleBank, findNearestPianoSample, type SampleBank, type DecodedSample } from "./sampleLoader";

let activeSynths: Tone.ToneAudioNode[] = [];
let cleanupTimers: ReturnType<typeof setTimeout>[] = [];
let activeSourceNodes: AudioBufferSourceNode[] = [];

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
  activeSourceNodes.forEach((s) => {
    try { s.stop(); s.disconnect(); } catch { /* */ }
  });
  activeSourceNodes = [];
}

export function stopPreview() {
  disposeActiveSynths();
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function timeToSeconds(timeStr: string, bpm: number, beatsPerBar = 4): number {
  const [bar, beat, sixteenth] = timeStr.split(":").map(Number);
  const totalBeats = bar * beatsPerBar + beat + sixteenth / 4;
  return (totalBeats * 60) / bpm;
}

function buildDrumSchedule(
  pattern: DrumStyle["pattern"],
  bpm: number,
  numBars: number,
  baseTime: number,
  beatsPerBar = 4
): { kick: number[]; snare: number[]; hihat: number[] } {
  const barDuration = (beatsPerBar * 60) / bpm;
  const kick: number[] = [];
  const snare: number[] = [];
  const hihat: number[] = [];

  for (let bar = 0; bar < numBars; bar++) {
    const barOffset = bar * barDuration;
    for (const hit of pattern) {
      const t = baseTime + barOffset + timeToSeconds(hit.time, bpm, beatsPerBar);
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
      if (arr[i] <= arr[i - 1]) arr[i] = arr[i - 1] + 0.005;
    }
    return arr;
  }

  return { kick: dedup(kick), snare: dedup(snare), hihat: dedup(hihat) };
}

// ---------------------------------------------------------------------------
//  Helpers for raw Web Audio sample playback
// ---------------------------------------------------------------------------

/** Create an AudioBuffer in the given context from pre-decoded sample data. */
function makeBuf(ctx: BaseAudioContext, sample: DecodedSample): AudioBuffer {
  const buf = ctx.createBuffer(sample.channels.length, sample.length, sample.sampleRate);
  for (let ch = 0; ch < sample.channels.length; ch++) {
    buf.getChannelData(ch).set(sample.channels[ch]);
  }
  return buf;
}

/** Create a simple exponential-decay impulse response for convolution reverb. */
function createReverbIR(ctx: BaseAudioContext, duration: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * duration);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return ir;
}

/** Play a piano sample at the given MIDI note, with envelope, into dry + reverb buses. */
function playPianoNote(
  ctx: BaseAudioContext,
  pianoBuffers: Map<number, AudioBuffer>,
  bank: SampleBank,
  midi: number,
  time: number,
  duration: number,
  dryDest: AudioNode,
  reverbDest: AudioNode,
  volume = 0.25
) {
  const { sample, rate } = findNearestPianoSample(bank, midi);
  const buf = pianoBuffers.get(sample.midiNote)!;

  const source = ctx.createBufferSource();
  source.buffer = buf;
  source.playbackRate.value = rate;

  const gain = ctx.createGain();
  const safeEnd = Math.max(time + duration * 0.7, time + 0.05);
  gain.gain.setValueAtTime(volume, time);
  gain.gain.setValueAtTime(volume, safeEnd);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration + 0.3);

  source.connect(gain);
  gain.connect(dryDest);
  gain.connect(reverbDest);
  source.start(time);
  source.stop(time + duration + 2);
}

/** Play a one-shot sample (drum hit). */
function playSample(
  ctx: BaseAudioContext,
  buf: AudioBuffer,
  time: number,
  dest: AudioNode,
  volume: number
) {
  const source = ctx.createBufferSource();
  source.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(dest);
  source.start(time);
}

// ---------------------------------------------------------------------------
//  Preview functions (real-time playback using Tone.js + sample bank)
// ---------------------------------------------------------------------------

export async function previewMelody(notes: QuantizedNote[]): Promise<void> {
  if (notes.length === 0) return;
  await ensureToneStarted();
  disposeActiveSynths();

  const bank = await loadSampleBank();
  const ctx = Tone.getContext().rawContext as AudioContext;

  // Create piano buffers in current context
  const pianoBuffers = new Map<number, AudioBuffer>();
  for (const s of bank.piano) pianoBuffers.set(s.midiNote, makeBuf(ctx, s));

  const baseTime = notes[0].startTime;
  const now = ctx.currentTime + 0.1;

  for (const n of notes) {
    const t = now + (n.startTime - baseTime);
    const dur = Math.min(n.duration, 2);
    const { sample, rate } = findNearestPianoSample(bank, n.midiNote);
    const buf = pianoBuffers.get(sample.midiNote)!;

    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.playbackRate.value = rate;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.setValueAtTime(0.3, t + dur * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(t);
    source.stop(t + dur + 1);
    activeSourceNodes.push(source);
  }

  const lastNote = notes[notes.length - 1];
  const totalMs = ((lastNote.startTime - baseTime) + lastNote.duration) * 1000 + 1500;
  const timer = setTimeout(() => disposeActiveSynths(), totalMs);
  cleanupTimers.push(timer);
}

export async function previewChords(
  progression: ChordProgression,
  instrument: ChordInstrument = "piano"
): Promise<void> {
  await ensureToneStarted();
  disposeActiveSynths();

  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime + 0.1;

  if (instrument === "piano") {
    const bank = await loadSampleBank();
    const pianoBuffers = new Map<number, AudioBuffer>();
    for (const s of bank.piano) pianoBuffers.set(s.midiNote, makeBuf(ctx, s));

    progression.chords.forEach((chord, i) => {
      const t = now + i * 1;
      for (const midi of chord.notes) {
        const { sample, rate } = findNearestPianoSample(bank, midi);
        const buf = pianoBuffers.get(sample.midiNote)!;

        const source = ctx.createBufferSource();
        source.buffer = buf;
        source.playbackRate.value = rate;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.setValueAtTime(0.3, t + 0.7);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.95);

        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(t);
        source.stop(t + 2);
        activeSourceNodes.push(source);
      }
    });
  } else {
    const playFn =
      instrument === "guitar" ? playGuitarChord :
      instrument === "strings" ? playStringsChord :
      playSynthPadChord;

    progression.chords.forEach((chord, i) => {
      const t = now + i * 1;
      playFn(ctx, chord.notes, t, 0.9, ctx.destination, ctx.destination, 0.3);
    });
  }

  const timer = setTimeout(() => disposeActiveSynths(), progression.chords.length * 1000 + 1500);
  cleanupTimers.push(timer);
}

export async function previewDrums(style: DrumStyle): Promise<void> {
  await ensureToneStarted();
  disposeActiveSynths();

  const bank = await loadSampleBank();
  const ctx = Tone.getContext().rawContext as AudioContext;

  const kickBuf = makeBuf(ctx, bank.kick);
  const snareBuf = makeBuf(ctx, bank.snare);
  const hihatBuf = makeBuf(ctx, bank.hihat);

  const now = ctx.currentTime + 0.1;
  const bpb = style.beatsPerBar ?? 4;
  const schedule = buildDrumSchedule(style.pattern, style.bpm, 2, now, bpb);

  schedule.kick.forEach((t) => {
    const s = ctx.createBufferSource();
    s.buffer = kickBuf;
    const g = ctx.createGain();
    g.gain.value = 0.8;
    s.connect(g);
    g.connect(ctx.destination);
    s.start(t);
    activeSourceNodes.push(s);
  });

  schedule.snare.forEach((t) => {
    const s = ctx.createBufferSource();
    s.buffer = snareBuf;
    const g = ctx.createGain();
    g.gain.value = 0.7;
    s.connect(g);
    g.connect(ctx.destination);
    s.start(t);
    activeSourceNodes.push(s);
  });

  schedule.hihat.forEach((t) => {
    const s = ctx.createBufferSource();
    s.buffer = hihatBuf;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    s.connect(g);
    g.connect(ctx.destination);
    s.start(t);
    activeSourceNodes.push(s);
  });

  const barDuration = (bpb * 60) / style.bpm;
  const timer = setTimeout(() => disposeActiveSynths(), barDuration * 2 * 1000 + 1000);
  cleanupTimers.push(timer);
}

// ---------------------------------------------------------------------------
//  Offline mix render — all raw Web Audio, no Tone.js synths
// ---------------------------------------------------------------------------

export async function renderMix(
  notes: QuantizedNote[],
  progression: ChordProgression,
  drumStyle: DrumStyle,
  suggestedNotes?: QuantizedNote[],
  bpmOverride?: number,
  voicePcm?: VoicePcm,
  pitchReadings?: PitchReading[],
  detectedKey?: KeyResult,
  chordInstrument: ChordInstrument = "piano",
  beatsPerBar = 4,
  melodyVoice: MelodyVoice = "real",
  volumes?: MixVolumes,
  voiceEq?: VoiceEQ,
  originalNotes?: QuantizedNote[]
): Promise<{ buffer: AudioBuffer; url: string }> {
  const vol = volumes ?? { melody: 1, chords: 1, drums: 1 };
  const eq = voiceEq ?? { lowCut: 80, presence: 0 };
  const bpm = bpmOverride ?? drumStyle.bpm;
  const barDuration = (beatsPerBar * 60) / bpm;
  const totalBars = 4;
  const renderDuration = barDuration * totalBars + 2;

  // Load instrument samples
  const bank = await loadSampleBank();

  // Use raw PCM voice data directly
  let voiceChannels: Float32Array[] | null = null;
  let voiceSampleRate = 44100;
  let voiceLength = 0;
  if (voicePcm) {
    voiceSampleRate = voicePcm.sampleRate;
    voiceLength = voicePcm.channels[0].length;
    voiceChannels = voicePcm.channels;
  }

  // Render using raw OfflineAudioContext (no Tone.js synths)
  const sampleRate = 44100;
  const offCtx = new OfflineAudioContext(2, Math.ceil(renderDuration * sampleRate), sampleRate);

  // --- Reverb bus ---
  const ir = createReverbIR(offCtx, 1.8, 3.0);
  const convolver = offCtx.createConvolver();
  convolver.buffer = ir;
  const reverbWet = offCtx.createGain();
  reverbWet.gain.value = 0.12;
  convolver.connect(reverbWet);
  reverbWet.connect(offCtx.destination);

  // --- Create reusable AudioBuffers from sample bank ---
  const pianoBuffers = new Map<number, AudioBuffer>();
  for (const s of bank.piano) pianoBuffers.set(s.midiNote, makeBuf(offCtx, s));

  const kickBuf = makeBuf(offCtx, bank.kick);
  const snareBuf = makeBuf(offCtx, bank.snare);
  const hihatBuf = makeBuf(offCtx, bank.hihat);

  // --- Autotuned voice ---
  if (melodyVoice === "real" && voiceChannels && voiceLength > 0) {
    // Beat-align voice when original (pre-snap) notes are available
    let finalChannels = voiceChannels;
    if (originalNotes && originalNotes.length > 0 && notes.length === originalNotes.length) {
      finalChannels = beatAlignVoice(voiceChannels, voiceSampleRate, originalNotes, notes);
    }

    const voiceBuf = offCtx.createBuffer(finalChannels.length, finalChannels[0].length, voiceSampleRate);
    for (let ch = 0; ch < finalChannels.length; ch++) {
      voiceBuf.getChannelData(ch).set(finalChannels[ch]);
    }
    const voiceSource = offCtx.createBufferSource();
    voiceSource.buffer = voiceBuf;

    // Voice EQ: highpass (low cut) → peaking (presence)
    const highpass = offCtx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = eq.lowCut;

    const peaking = offCtx.createBiquadFilter();
    peaking.type = "peaking";
    peaking.frequency.value = 3000;
    peaking.Q.value = 1;
    peaking.gain.value = eq.presence;

    const voiceGain = offCtx.createGain();
    voiceGain.gain.value = 2.5 * vol.melody;
    voiceSource.connect(highpass);
    highpass.connect(peaking);
    peaking.connect(voiceGain);
    voiceGain.connect(offCtx.destination);
    voiceGain.connect(convolver); // slight reverb on voice
    voiceSource.start(0);
  }

  // --- Piano melody (replaces voice) ---
  if (melodyVoice === "piano" && notes.length > 0) {
    for (const note of notes) {
      if (note.startTime >= 0 && note.startTime < totalBars * barDuration) {
        playPianoNote(
          offCtx, pianoBuffers, bank,
          note.midiNote, note.startTime, Math.min(note.duration, 2),
          offCtx.destination, convolver, 0.35 * vol.melody
        );
      }
    }
  }

  // --- Chords (instrument-dependent) ---
  if (chordInstrument === "piano") {
    for (let bar = 0; bar < totalBars; bar++) {
      const chord = progression.chords[bar % progression.chords.length];
      const t = bar * barDuration;
      for (const midi of chord.notes) {
        playPianoNote(offCtx, pianoBuffers, bank, midi, t, barDuration * 0.9, offCtx.destination, convolver, 0.2 * vol.chords);
      }
    }
  } else {
    const playFn =
      chordInstrument === "guitar" ? playGuitarChord :
      chordInstrument === "strings" ? playStringsChord :
      playSynthPadChord;

    for (let bar = 0; bar < totalBars; bar++) {
      const chord = progression.chords[bar % progression.chords.length];
      const t = bar * barDuration;
      playFn(offCtx, chord.notes, t, barDuration * 0.9, offCtx.destination, convolver, 0.2 * vol.chords);
    }
  }

  // --- Piano melody for suggested continuation ---
  if (suggestedNotes && suggestedNotes.length > 0) {
    for (const note of suggestedNotes) {
      if (note.startTime >= 0 && note.startTime < totalBars * barDuration) {
        playPianoNote(
          offCtx, pianoBuffers, bank,
          note.midiNote, note.startTime, Math.min(note.duration, 2),
          offCtx.destination, convolver, 0.25
        );
      }
    }
  }

  // --- Drums (sample-based) ---
  const drumSchedule = buildDrumSchedule(drumStyle.pattern, bpm, totalBars, 0, beatsPerBar);
  drumSchedule.kick.forEach((t) => playSample(offCtx, kickBuf, t, offCtx.destination, 0.8 * vol.drums));
  drumSchedule.snare.forEach((t) => playSample(offCtx, snareBuf, t, offCtx.destination, 0.65 * vol.drums));
  drumSchedule.hihat.forEach((t) => playSample(offCtx, hihatBuf, t, offCtx.destination, 0.45 * vol.drums));

  // --- Render ---
  const renderedBuffer = await offCtx.startRendering();
  const wavArrayBuffer = toWav(renderedBuffer);
  const wavBlob = new Blob([wavArrayBuffer], { type: "audio/wav" });
  const url = URL.createObjectURL(wavBlob);

  return { buffer: renderedBuffer, url };
}

export function downloadWav(url: string, filename = "hummly-demo.wav") {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
