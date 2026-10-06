"use client";

import { useReducer, useCallback } from "react";
import StepIndicator from "./StepIndicator";
import RecordStep from "./RecordStep";
import ProcessingStep from "./ProcessingStep";
import ReviewStep from "./ReviewStep";
import ChordStep from "./ChordStep";
import DrumStep from "./DrumStep";
import MixStep from "./MixStep";
import type {
  HummlyState,
  HummlyAction,
  PitchReading,
  VoicePcm,
  QuantizedNote,
  KeyResult,
  ChordInstrument,
  ChordPattern,
  ChordProgression,
  DrumKit,
  DrumStyle,
  MelodyVoice,
} from "@/lib/types";

const initialState: HummlyState = {
  step: "record",
  bpm: 100,
  beatsPerBar: 4,
  beatOffset: 0,
  voicePcm: null,
  pitchReadings: [],
  notes: [],
  detectedKey: null,
  chordOptions: [],
  selectedChords: null,
  selectedChordsB: null,
  chordPattern: null,
  chordInstrument: "piano",
  melodyVoice: "real",
  drumKit: "acoustic-kit",
  drumOptions: [],
  selectedDrums: null,
  mixBuffer: null,
  mixUrl: null,
  error: null,
};

function reducer(state: HummlyState, action: HummlyAction): HummlyState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step, error: null };
    case "SET_BPM":
      return { ...state, bpm: action.bpm };
    case "SET_BEATS_PER_BAR":
      return { ...state, beatsPerBar: action.beatsPerBar };
    case "SET_VOICE_PCM":
      return { ...state, voicePcm: action.pcm };
    case "ADD_PITCH_READING":
      return { ...state, pitchReadings: [...state.pitchReadings, action.reading] };
    case "SET_PITCH_READINGS":
      return { ...state, pitchReadings: action.readings };
    case "SET_NOTES":
      return { ...state, notes: action.notes };
    case "SET_KEY":
      return { ...state, detectedKey: action.key };
    case "SET_CHORD_OPTIONS":
      return { ...state, chordOptions: action.options };
    case "SELECT_CHORDS":
      return { ...state, selectedChords: action.progression, selectedChordsB: action.progressionB };
    case "SET_CHORD_PATTERN":
      return { ...state, chordPattern: action.pattern };
    case "SET_CHORD_INSTRUMENT":
      return { ...state, chordInstrument: action.instrument };
    case "SET_DRUM_OPTIONS":
      return { ...state, drumOptions: action.options };
    case "SELECT_DRUMS":
      return { ...state, selectedDrums: action.style };
    case "SET_DRUM_KIT":
      return { ...state, drumKit: action.kit };
    case "SET_MELODY_VOICE":
      return { ...state, melodyVoice: action.voice };
    case "SET_BEAT_OFFSET":
      return { ...state, beatOffset: action.offset };
    case "SET_MIX":
      return { ...state, mixBuffer: action.buffer, mixUrl: action.url };
    case "SET_ERROR":
      return { ...state, error: action.error, step: "record" };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

export default function StepWizard() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleBpmChange = useCallback((bpm: number) => {
    dispatch({ type: "SET_BPM", bpm });
  }, []);

  const handleBeatsPerBarChange = useCallback((beatsPerBar: number) => {
    dispatch({ type: "SET_BEATS_PER_BAR", beatsPerBar });
  }, []);

  const handleRecordComplete = useCallback((pcm: VoicePcm, readings: PitchReading[]) => {
    dispatch({ type: "SET_VOICE_PCM", pcm });
    dispatch({ type: "SET_PITCH_READINGS", readings });
    dispatch({ type: "SET_STEP", step: "processing" });
  }, []);

  const handleProcessingComplete = useCallback(
    (notes: QuantizedNote[], key: KeyResult, chordOptions: ChordProgression[], drumOptions: DrumStyle[], detectedBpm: number, beatOffset: number) => {
      dispatch({ type: "SET_NOTES", notes });
      dispatch({ type: "SET_KEY", key });
      dispatch({ type: "SET_CHORD_OPTIONS", options: chordOptions });
      dispatch({ type: "SET_DRUM_OPTIONS", options: drumOptions });
      dispatch({ type: "SET_BPM", bpm: detectedBpm });
      dispatch({ type: "SET_BEAT_OFFSET", offset: beatOffset });
      dispatch({ type: "SET_STEP", step: "review" });
    },
    []
  );

  const handleProcessingError = useCallback((error: string) => {
    dispatch({ type: "SET_ERROR", error });
  }, []);

  const handleBeatOffsetChange = useCallback((offset: number) => {
    dispatch({ type: "SET_BEAT_OFFSET", offset });
  }, []);

  const handleReviewContinue = useCallback(() => {
    dispatch({ type: "SET_STEP", step: "chords" });
  }, []);

  const handleChordSelect = useCallback((a: ChordProgression, b: ChordProgression | null, instrument: ChordInstrument, pattern: ChordPattern) => {
    dispatch({ type: "SELECT_CHORDS", progression: a, progressionB: b });
    dispatch({ type: "SET_CHORD_INSTRUMENT", instrument });
    dispatch({ type: "SET_CHORD_PATTERN", pattern });
    dispatch({ type: "SET_STEP", step: "drums" });
  }, []);

  const handleChordSkip = useCallback(() => {
    dispatch({ type: "SET_STEP", step: "drums" });
  }, []);

  const handleDrumSelect = useCallback((style: DrumStyle, kit: DrumKit) => {
    dispatch({ type: "SELECT_DRUMS", style });
    dispatch({ type: "SET_DRUM_KIT", kit });
    dispatch({ type: "SET_STEP", step: "mix" });
  }, []);

  const handleDrumSkip = useCallback(() => {
    dispatch({ type: "SET_STEP", step: "mix" });
  }, []);

  const handleMelodyVoiceChange = useCallback((voice: MelodyVoice) => {
    dispatch({ type: "SET_MELODY_VOICE", voice });
  }, []);

  const handleStartOver = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <StepIndicator currentStep={state.step} />

      {state.error && state.step === "record" && (
        <div className="mx-auto mb-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {state.error}
        </div>
      )}

      {state.step === "record" && (
        <RecordStep onComplete={handleRecordComplete} />
      )}

      {state.step === "processing" && (
        <ProcessingStep
          readings={state.pitchReadings}
          onComplete={handleProcessingComplete}
          onError={handleProcessingError}
        />
      )}

      {state.step === "review" && state.detectedKey && (
        <ReviewStep
          detectedKey={state.detectedKey}
          bpm={state.bpm}
          beatsPerBar={state.beatsPerBar}
          beatOffset={state.beatOffset}
          voicePcm={state.voicePcm}
          onBpmChange={handleBpmChange}
          onBeatsPerBarChange={handleBeatsPerBarChange}
          onBeatOffsetChange={handleBeatOffsetChange}
          onContinue={handleReviewContinue}
        />
      )}

      {state.step === "chords" && state.detectedKey && (
        <ChordStep
          options={state.chordOptions}
          detectedKey={state.detectedKey}
          bpm={state.bpm}
          beatsPerBar={state.beatsPerBar}
          onSelect={handleChordSelect}
          onSkip={handleChordSkip}
        />
      )}

      {state.step === "drums" && <DrumStep options={state.drumOptions} beatsPerBar={state.beatsPerBar} bpm={state.bpm} onSelect={handleDrumSelect} onSkip={handleDrumSkip} />}

      {state.step === "mix" && state.detectedKey && (
        <MixStep
          notes={state.notes}
          chords={state.selectedChords}
          chordsB={state.selectedChordsB}
          drums={state.selectedDrums}
          bpm={state.bpm}
          beatsPerBar={state.beatsPerBar}
          detectedKey={state.detectedKey}
          voicePcm={state.voicePcm}
          pitchReadings={state.pitchReadings}
          chordInstrument={state.chordInstrument}
          chordPattern={state.chordPattern}
          melodyVoice={state.melodyVoice}
          drumKit={state.drumKit}
          onMelodyVoiceChange={handleMelodyVoiceChange}
          onStartOver={handleStartOver}
        />
      )}
    </div>
  );
}
