export interface PitchReading {
  time: number;
  frequency: number;
  clarity: number;
}

export interface QuantizedNote {
  midiNote: number;
  name: string;
  pitchClass: number;
  octave: number;
  startTime: number;
  duration: number;
}

export interface KeyResult {
  key: string;
  mode: "major" | "minor";
  correlation: number;
}

export interface Chord {
  name: string;
  symbol: string;
  notes: number[]; // MIDI note numbers
}

export interface ChordProgression {
  name: string;
  description: string;
  chords: Chord[];
}

export interface DrumHit {
  time: string; // Tone.js time notation e.g. "0:0:0"
  instrument: "kick" | "snare" | "hihat";
}

export interface DrumStyle {
  name: string;
  bpm: number;
  beatsPerBar: number;
  description: string;
  pattern: DrumHit[];
}

export type WizardStep = "record" | "processing" | "chords" | "drums" | "mix";

export type ChordInstrument = "piano" | "guitar" | "strings" | "synth-pad";

export type MelodyVoice = "real" | "piano";

export interface MixVolumes {
  melody: number;
  chords: number;
  drums: number;
}

/** Raw PCM voice data — avoids lossy WebM encode/decode roundtrip. */
export interface VoicePcm {
  channels: Float32Array[];
  sampleRate: number;
}

export interface HummlyState {
  step: WizardStep;
  bpm: number;
  beatsPerBar: number;
  voicePcm: VoicePcm | null;
  pitchReadings: PitchReading[];
  notes: QuantizedNote[];
  detectedKey: KeyResult | null;
  chordOptions: ChordProgression[];
  selectedChords: ChordProgression | null;
  chordInstrument: ChordInstrument;
  melodyVoice: MelodyVoice;
  drumOptions: DrumStyle[];
  selectedDrums: DrumStyle | null;
  mixBuffer: AudioBuffer | null;
  mixUrl: string | null;
  error: string | null;
}

export type HummlyAction =
  | { type: "SET_STEP"; step: WizardStep }
  | { type: "SET_BPM"; bpm: number }
  | { type: "SET_BEATS_PER_BAR"; beatsPerBar: number }
  | { type: "SET_VOICE_PCM"; pcm: VoicePcm }
  | { type: "ADD_PITCH_READING"; reading: PitchReading }
  | { type: "SET_PITCH_READINGS"; readings: PitchReading[] }
  | { type: "SET_NOTES"; notes: QuantizedNote[] }
  | { type: "SET_KEY"; key: KeyResult }
  | { type: "SET_CHORD_OPTIONS"; options: ChordProgression[] }
  | { type: "SELECT_CHORDS"; progression: ChordProgression }
  | { type: "SET_CHORD_INSTRUMENT"; instrument: ChordInstrument }
  | { type: "SET_DRUM_OPTIONS"; options: DrumStyle[] }
  | { type: "SELECT_DRUMS"; style: DrumStyle }
  | { type: "SET_MIX"; buffer: AudioBuffer; url: string }
  | { type: "SET_MELODY_VOICE"; voice: MelodyVoice }
  | { type: "SET_ERROR"; error: string }
  | { type: "RESET" };
