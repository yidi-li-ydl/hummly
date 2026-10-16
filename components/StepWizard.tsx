"use client";

import { useReducer, useCallback, useEffect, useRef, useState, useMemo } from "react";
import Icon from "./Icon";
import MySongs from "./MySongs";
import useProjectAutosave from "@/hooks/useProjectAutosave";
import { projectRepository } from "@/lib/projects/repository";
import type { SongIdentity, SongProject } from "@/lib/projects/model";
import StepIndicator from "./StepIndicator";
import RecordStep from "./RecordStep";
import ProcessingStep from "./ProcessingStep";
import ReviewStep from "./ReviewStep";
import ChordStep from "./ChordStep";
import DrumStep from "./DrumStep";
import MixStep from "./MixStep";
import ActionButton from "./ui/ActionButton";
import SecondaryButton from "./ui/SecondaryButton";
import { stopPreview } from "@/lib/audio/mixer";
import type {
  MixSnapshot,
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
  WizardStep,
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
  mixSnapshot: null,
  mixBuffer: null,
  mixUrl: null,
  error: null,
};

const PREVIOUS_STEP: Record<WizardStep, WizardStep> = {
  record: "record",
  processing: "record",
  review: "record",
  chords: "review",
  drums: "chords",
  mix: "drums",
};
const STEP_LABEL: Record<WizardStep, string> = {
  record: "Hum", processing: "Analysis", review: "Analysis",
  chords: "Find chords", drums: "Find beats", mix: "Mix",
};

function reducer(state: HummlyState, action: HummlyAction): HummlyState {
  switch (action.type) {
    case "RESTORE_PROJECT":
      return action.state;
    case "SET_MIX_SNAPSHOT":
      return { ...state, mixSnapshot: action.snapshot };
    case "SET_STEP":
      return { ...state, step: action.step, error: null };
    case "SET_BPM":
      return { ...state, bpm: action.bpm, mixSnapshot: null };
    case "SET_BEATS_PER_BAR":
      return { ...state, beatsPerBar: action.beatsPerBar, mixSnapshot: null };
    case "SET_VOICE_PCM":
      return { ...state, voicePcm: action.pcm, mixSnapshot: null };
    case "ADD_PITCH_READING":
      return { ...state, pitchReadings: [...state.pitchReadings, action.reading] };
    case "SET_PITCH_READINGS":
      return { ...state, pitchReadings: action.readings };
    case "SET_NOTES":
      return { ...state, notes: action.notes, mixSnapshot: null };
    case "SET_KEY":
      return { ...state, detectedKey: action.key, mixSnapshot: null };
    case "SET_CHORD_OPTIONS":
      return { ...state, chordOptions: action.options };
    case "SELECT_CHORDS":
      return { ...state, selectedChords: action.progression, selectedChordsB: action.progressionB, mixSnapshot: null };
    case "SET_CHORD_PATTERN":
      return { ...state, chordPattern: action.pattern, mixSnapshot: null };
    case "SET_CHORD_INSTRUMENT":
      return { ...state, chordInstrument: action.instrument, mixSnapshot: null };
    case "SET_DRUM_OPTIONS":
      return { ...state, drumOptions: action.options };
    case "SELECT_DRUMS":
      return { ...state, selectedDrums: action.style, mixSnapshot: null };
    case "SET_DRUM_KIT":
      return { ...state, drumKit: action.kit, mixSnapshot: null };
    case "SET_MELODY_VOICE":
      return { ...state, melodyVoice: action.voice, mixSnapshot: null };
    case "SET_BEAT_OFFSET":
      return { ...state, beatOffset: action.offset, mixSnapshot: null };
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
  const [view, setView] = useState<"loading" | "library" | "create">("loading");
  const [identity, setIdentity] = useState<SongIdentity | null>(null);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const [mixBusy, setMixBusy] = useState(false);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [resumeStep, setResumeStep] = useState<WizardStep | null>(null);
  const project = useMemo<SongProject | null>(() => view === "create" && identity && state.voicePcm ? { ...identity, state } : null, [identity, state, view]);
  const autosave = useProjectAutosave(project);
  useEffect(() => {
    let alive = true;
    projectRepository.list().then(songs => { if (alive) setView(songs.length ? "library" : "create"); }).catch(() => {
      if (alive) { setStorageMessage("Local storage couldn’t open. You can create a song, but saving may be unavailable."); setView("create"); }
    });
    return () => { alive = false; };
  }, []);
  const handleMixChange = useCallback((snapshot: MixSnapshot) => dispatch({ type: "SET_MIX_SNAPSHOT", snapshot }), []);
  const openLibrary = async () => {
    if (mixBusy || recordingBusy) return;
    if (!await autosave.flush()) { setStorageMessage("Your latest changes couldn’t be saved. Please retry before leaving this song."); return; }
    stopPreview(); setStorageMessage(null); setView("library");
  };
  const openSong = async (id: string) => {
    const song = await projectRepository.load(id);
    dispatch({ type: "RESTORE_PROJECT", state: song.state });
    setIdentity({ id: song.id, title: song.title, createdAt: song.createdAt, completedAt: song.completedAt });
    setResumeStep(null); setStorageMessage(null); setView("create");
  };
  const saveToLibrary = async (title: string) => {
    if (!project?.state.mixSnapshot) throw new Error("Your song is still being prepared. Try again in a moment.");
    const completed = { ...project, title: title.trim().slice(0, 80) || "Untitled song", completedAt: project.completedAt ?? new Date().toISOString() };
    if (!await autosave.commit(completed)) throw new Error("Couldn’t save your song. Please try again.");
    setIdentity({ id: completed.id, title: completed.title, createdAt: completed.createdAt, completedAt: completed.completedAt });
    stopPreview(); setStorageMessage(null); setView("library");
  };
  const previousStep = useRef(state.step);
  useEffect(() => {
    if ((previousStep.current !== state.step && state.step !== "processing") || state.error) {
      const heading = wizardRef.current?.querySelector<HTMLElement>("h1");
      if (heading) { heading.tabIndex = -1; heading.focus(); }
    }
    previousStep.current = state.step;
  }, [state.step, state.error]);
  useEffect(() => {
    if (view !== "create") return;
    const heading = wizardRef.current?.querySelector<HTMLElement>("h1");
    if (heading) { heading.tabIndex = -1; heading.focus(); }
  }, [view]);

  const handleBpmChange = useCallback((bpm: number) => {
    dispatch({ type: "SET_BPM", bpm });
  }, []);

  const handleBeatsPerBarChange = useCallback((beatsPerBar: number) => {
    dispatch({ type: "SET_BEATS_PER_BAR", beatsPerBar });
  }, []);

  const handleRecordComplete = useCallback((pcm: VoicePcm, readings: PitchReading[]) => {
    setIdentity(previous => previous ?? { id: crypto.randomUUID(), title: "Untitled song", createdAt: new Date().toISOString() });
    setResumeStep(null);
    dispatch({ type: "RESET" });
    dispatch({ type: "SET_VOICE_PCM", pcm });
    dispatch({ type: "SET_PITCH_READINGS", readings });
    dispatch({ type: "SET_STEP", step: "processing" });
  }, [setResumeStep]);

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
    dispatch({ type: "SELECT_DRUMS", style: null });
    dispatch({ type: "SET_STEP", step: "mix" });
  }, []);

  const handleMelodyVoiceChange = useCallback((voice: MelodyVoice) => {
    dispatch({ type: "SET_MELODY_VOICE", voice });
  }, []);

  const newSong = () => {
    setIdentity(null); setResumeStep(null); setStorageMessage(null); setMixBusy(false); setRecordingBusy(false);
    dispatch({ type: "RESET" }); setView("create");
  };
  const handleStartOver = async () => {
    if (!await autosave.flush()) { setStorageMessage("Couldn’t save your song. Please retry before starting another."); return; }
    newSong();
  };

  const handleBack = useCallback(() => {
    stopPreview();
    const previous = PREVIOUS_STEP[state.step];
    if (previous === "record" && state.step !== "record") setResumeStep(state.step);
    dispatch({ type: "SET_STEP", step: previous });
  }, [state.step, setResumeStep]);

  if (view === "loading") return <p className="library-loading" role="status">Opening Hummly…</p>;

  return (
    <div className="wizard" ref={wizardRef}>
      <header className="brand-header">
        {view === "library" ? <><span className="wordmark"><span className="brand-mark"><Icon name="wave" /></span>hummly<span className="brand-period">.</span></span><span className="library-local-tag">On this device</span></> : <>
        <div className="brand-navigation">
          <button type="button" className="header-back" aria-label={`Back to ${STEP_LABEL[PREVIOUS_STEP[state.step]]}`}
            disabled={mixBusy || recordingBusy || (state.step === "record" && !state.error)} onClick={handleBack}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12H4m6-6-6 6 6 6" /></svg>
          </button>
          <button type="button" onClick={() => void openLibrary()} disabled={mixBusy || recordingBusy} className="wordmark" aria-label="My songs">
            <span className="brand-mark"><Icon name="wave" /></span>hummly<span className="brand-period">.</span>
          </button>
        </div>
        <StepIndicator currentStep={state.step} />
        </>}
      </header>
      <main id="create" className="creation-main">
      {view === "library" ? <MySongs onOpen={openSong} onNew={newSong} /> : <>
      <div className="project-save-bar">
        <button type="button" onClick={() => void openLibrary()} disabled={mixBusy || recordingBusy}>My songs</button>
        {project && <span role="status">{autosave.status === "saved" ? "Saved on this device" : autosave.status === "error" ? "Couldn’t save" : "Saving…"}</span>}
      </div>
      {(storageMessage || autosave.error) && <div className="recovery-message" role="alert"><p>{storageMessage || autosave.error}</p><button type="button" onClick={() => void autosave.flush().then(ok => { if (ok) setStorageMessage(null); })}>Retry saving</button></div>}
      {state.step === "record" && resumeStep && state.voicePcm && <div className="wizard-navigation">
        <SecondaryButton onClick={() => {
          const step = resumeStep;
          if (step) dispatch({ type: "SET_STEP", step });
        }}>Continue with previous recording<span aria-hidden="true">→</span></SecondaryButton>
      </div>}

      {state.error && (
        <div className="work-panel recovery-message" role="alert">
          <h1 className="text-xl font-semibold">Let’s give that tune another try.</h1>
          <p>{state.error}</p>
          {state.voicePcm && <ActionButton onClick={() => dispatch({ type: "SET_STEP", step: "processing" })}>Retry this recording</ActionButton>}
          <SecondaryButton onClick={handleStartOver}>Record or upload another melody</SecondaryButton>
        </div>
      )}

      {(state.step === "record" || state.step === "processing") && !state.error && (
        <RecordStep onBusyChange={setRecordingBusy} onComplete={handleRecordComplete} analyzing={state.step === "processing"} />
      )}

      {state.step === "processing" && !state.error && (
        <ProcessingStep
          voicePcm={state.voicePcm}
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
        <ChordStep
          onApplyFirst={progression => dispatch({ type: "SELECT_CHORDS", progression, progressionB: state.selectedChordsB })}
          savedFirst={state.selectedChords}
          savedNext={state.selectedChordsB}
          savedInstrument={state.chordInstrument}
          savedPattern={state.chordPattern}
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
        <div className="work-heading beat-page-heading"><h1>Find your groove.</h1><p>Pick a beat to bring your song to life.</p></div>
        <DrumStep savedStyle={state.selectedDrums} savedKit={state.drumKit} previewSong={state} options={state.drumOptions} beatsPerBar={state.beatsPerBar} bpm={state.bpm} onSelect={handleDrumSelect} onSkip={handleDrumSkip} />
      </section>}

      {state.step === "mix" && state.detectedKey && (
        <section className="work-panel">
        <MixStep
          key={identity?.id ?? "new"}
          savedMix={state.mixSnapshot}
          onMixChange={handleMixChange}
          onBusyChange={setMixBusy}
          songTitle={identity?.title ?? "Untitled song"}
          onTitleChange={title => setIdentity(previous => previous ? { ...previous, title } : previous)}
          hasLocalProject
          onSaveToLibrary={saveToLibrary}
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
      </>}
      </main>
    </div>
  );
}
