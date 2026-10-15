import type { CSSProperties } from "react";
import type { ChordProgression, KeyResult } from "@/lib/types";
import { chordVisual } from "@/lib/musicVisuals";
import Icon from "./Icon";
import Surface from "./ui/Surface";
import SecondaryButton from "./ui/SecondaryButton";

type Props = {
  progression: ChordProgression;
  detectedKey: KeyResult;
  selected: boolean;
  recommended: boolean;
  phase: "pick-a" | "pick-b";
  sectionBars: number;
  bpm: number;
  previewPhase: "loading" | "playing" | null;
  playingChord: number | null;
  auditionedChord: number | null;
  onPreview: () => void;
  onAudition: (index: number) => void;
  onSelect: () => void;
};

export default function ProgressionModule({ progression, detectedKey, selected, recommended, phase, sectionBars, bpm, previewPhase, playingChord, auditionedChord, onPreview, onAudition, onSelect }: Props) {
  const notation = progression.description.replace(/^.*?:\s*/, "");
  return (
    <Surface as="article" className={`chord-progression selectable-progression${selected ? " is-selected" : ""}`} level="soft" aria-label={`${progression.name} progression`} style={{ "--musical-beat": `${60 / bpm}s` } as CSSProperties}>
      <button type="button" className="progression-card-select" aria-pressed={selected}
        aria-label={`Choose ${progression.name} for the ${phase === "pick-b" ? "next" : "first"} ${sectionBars} bars`}
        onClick={onSelect}>
        <span className="progression-selection-indicator" aria-hidden="true">{selected && <svg viewBox="0 0 16 16" fill="none"><path d="m4 8 2.5 2.5L12 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>
      </button>
      <div className="progression-header">
        <div className="progression-heading-group">
          <div className="progression-title-line">
            <h2 className="progression-name">{progression.name}</h2>
            <p className="progression-notation">{notation}</p>
          </div>
          {recommended && <div className="progression-badges">
            {recommended && <span className="state-label">Recommended next</span>}
          </div>}
        </div>
        <SecondaryButton
          variant="soft"
          className="icon-action progression-preview"
          aria-label={previewPhase ? `Stop ${progression.name} preview` : `Preview ${progression.name}`}
          aria-busy={previewPhase === "loading"}
          aria-pressed={previewPhase !== null}
          onClick={event => { event.stopPropagation(); onPreview(); }}
        ><Icon name={previewPhase === "loading" ? "wave" : previewPhase === "playing" ? "stop" : "play"} /></SecondaryButton>
      </div>
      <div className="progression-blocks" onClick={event => event.stopPropagation()}>
        {progression.chords.map((chord, index) => {
          const visual = chordVisual(chord, detectedKey);
          return <button key={`${chord.name}-${index}`} type="button"
            className={`musical-block musical-block--${visual.color}${auditionedChord === index ? " is-selected" : ""}${playingChord === index ? " is-playing" : ""}`}
            aria-label={`Hear ${chord.name}, chord ${index + 1} in ${progression.name}`}
            title={visual.role} aria-pressed={auditionedChord === index}
            aria-current={playingChord === index ? "true" : undefined}
            onClick={() => onAudition(index)}>{chord.name}</button>;
        })}
      </div>
      {previewPhase && <p className="phase-hint" role="status">{previewPhase === "loading" ? "Loading sounds…" : playingChord === null ? "Finishing preview…" : `Playing ${progression.chords[playingChord]?.name ?? "chord"}`}</p>}
    </Surface>
  );
}
