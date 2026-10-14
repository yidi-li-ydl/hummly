"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import StepIndicator from "./StepIndicator";
import RecordStep from "./RecordStep";
import ProcessingStep from "./ProcessingStep";
import ReviewStep from "./ReviewStep";
import ChordStep from "./ChordStep";
import DrumStep from "./DrumStep";
import MixStep from "./MixStep";
import ActionButton from "./ui/ActionButton";
import SecondaryButton from "./ui/SecondaryButton";
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
      return { ...state, error: action.error };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

export default function StepWizard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wizardRef = useRef<HTMLDivElement>(null);
  const previousStep = useRef(state.step);
  useEffect(() => {
    if ((previousStep.current !== state.step && state.step !== "processing") || state.error) {
      const heading = wizardRef.current?.querySelector<HTMLElement>("h1");
      if (heading) { heading.tabIndex = -1; heading.focus(); }
    }
    previousStep.current = state.step;
  }, [state.step, state.error]);

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
    <div className="wizard" ref={wizardRef}>
      <StepIndicator currentStep={state.step === "processing" && !state.error ? "record" : state.step} />

      {state.error && (
        <div className="work-panel recovery-message" role="alert">
          <h1 className="text-xl font-semibold">Let’s give that tune another try.</h1>
          <p>{state.error}</p>
          {state.voicePcm && <ActionButton onClick={() => dispatch({ type: "SET_STEP", step: "processing" })}>Retry this recording</ActionButton>}
          <SecondaryButton onClick={handleStartOver}>Record or upload another melody</SecondaryButton>
        </div>
      )}

      {(state.step === "record" || state.step === "processing") && !state.error && (
        <RecordStep onComplete={handleRecordComplete} analyzing={state.step === "processing"} />
      )}

      {state.step === "processing" && !state.error && (
        <ProcessingStep
          readings={state.pitchReadings}
          onComplete={handleProcessingComplete}
          onError={handleProcessingError}
        />
      )}

      {state.step === "review" && state.detectedKey && (
        <section className="work-panel">
          <div className="work-heading"><h1>Your melody, found.</h1></div>
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
        </section>
      )}

      {state.step === "chords" && state.detectedKey && (
        <section className="work-panel">
          <div className="work-heading"><h1>Your hum, meet your chords.</h1><p>We found a few chord progressions that might fit your melody.</p></div>
        <ChordStep
          options={state.chordOptions}
          detectedKey={state.detectedKey}
          bpm={state.bpm}
          beatsPerBar={state.beatsPerBar}
          onSelect={handleChordSelect}
          onSkip={handleChordSkip}
        />
        </section>
      )}

      {state.step === "drums" && <section className="work-panel">
        <div className="work-heading"><p className="eyebrow">Find beats</p><h1>Find your groove.</h1><p>Try a beat, or keep it simple.</p></div>
        <DrumStep options={state.drumOptions} beatsPerBar={state.beatsPerBar} bpm={state.bpm} onSelect={handleDrumSelect} onSkip={handleDrumSkip} />
      </section>}

      {state.step === "mix" && state.detectedKey && (
        <section className="work-panel">
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
          beatOffset={state.beatOffset}
          onMelodyVoiceChange={handleMelodyVoiceChange}
          onStartOver={handleStartOver}
        />
        </section>
      )}
    </div>
  );
}
