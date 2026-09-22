"use client";

import { useReducer, useCallback } from "react";
import StepIndicator from "./StepIndicator";
import RecordStep from "./RecordStep";
import ProcessingStep from "./ProcessingStep";
import ChordStep from "./ChordStep";
import DrumStep from "./DrumStep";
import MixStep from "./MixStep";
import type {
  HummlyState,
  HummlyAction,
  PitchReading,
  QuantizedNote,
  KeyResult,
  ChordProgression,
  DrumStyle,
} from "@/lib/types";

const initialState: HummlyState = {
  step: "record",
  audioBlob: null,
  pitchReadings: [],
  notes: [],
  detectedKey: null,
  chordOptions: [],
  selectedChords: null,
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
    case "SET_AUDIO_BLOB":
      return { ...state, audioBlob: action.blob };
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
      return { ...state, selectedChords: action.progression };
    case "SET_DRUM_OPTIONS":
      return { ...state, drumOptions: action.options };
    case "SELECT_DRUMS":
      return { ...state, selectedDrums: action.style };
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

  const handleRecordComplete = useCallback((blob: Blob, readings: PitchReading[]) => {
    dispatch({ type: "SET_AUDIO_BLOB", blob });
    dispatch({ type: "SET_PITCH_READINGS", readings });
    dispatch({ type: "SET_STEP", step: "processing" });
  }, []);

  const handleProcessingComplete = useCallback(
    (notes: QuantizedNote[], key: KeyResult, chordOptions: ChordProgression[], drumOptions: DrumStyle[]) => {
      dispatch({ type: "SET_NOTES", notes });
      dispatch({ type: "SET_KEY", key });
      dispatch({ type: "SET_CHORD_OPTIONS", options: chordOptions });
      dispatch({ type: "SET_DRUM_OPTIONS", options: drumOptions });
      dispatch({ type: "SET_STEP", step: "chords" });
    },
    []
  );

  const handleProcessingError = useCallback((error: string) => {
    dispatch({ type: "SET_ERROR", error });
  }, []);

  const handleChordSelect = useCallback((progression: ChordProgression) => {
    dispatch({ type: "SELECT_CHORDS", progression });
    dispatch({ type: "SET_STEP", step: "drums" });
  }, []);

  const handleDrumSelect = useCallback((style: DrumStyle) => {
    dispatch({ type: "SELECT_DRUMS", style });
    dispatch({ type: "SET_STEP", step: "mix" });
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

      {state.step === "record" && <RecordStep onComplete={handleRecordComplete} />}

      {state.step === "processing" && (
        <ProcessingStep
          readings={state.pitchReadings}
          onComplete={handleProcessingComplete}
          onError={handleProcessingError}
        />
      )}

      {state.step === "chords" && state.detectedKey && (
        <ChordStep
          options={state.chordOptions}
          detectedKey={state.detectedKey}
          onSelect={handleChordSelect}
        />
      )}

      {state.step === "drums" && <DrumStep options={state.drumOptions} onSelect={handleDrumSelect} />}

      {state.step === "mix" && state.selectedChords && state.selectedDrums && state.detectedKey && (
        <MixStep
          notes={state.notes}
          chords={state.selectedChords}
          drums={state.selectedDrums}
          detectedKey={state.detectedKey}
          onStartOver={handleStartOver}
        />
      )}
    </div>
  );
}
