import type { CSSProperties } from "react";
import type { ChordProgression, KeyResult } from "@/lib/types";
import { chordVisual } from "@/lib/musicVisuals";
import Icon from "./Icon";
import Surface from "./ui/Surface";
import SecondaryButton from "./ui/SecondaryButton";
import MusicalBlock from "./ui/MusicalBlock";

type Props = {
  progression: ChordProgression;
  detectedKey: KeyResult;
  selected: boolean;
  recommended: boolean;
  phase: "pick-a" | "pick-b";
  bpm: number;
  previewPhase: "loading" | "playing" | null;
  playingChord: number | null;
  auditionedChord: number | null;
  onPreview: () => void;
  onAudition: (index: number) => void;
  onSelect: () => void;
};

export default function ProgressionModule({ progression, detectedKey, selected, recommended, phase, bpm, previewPhase, playingChord, auditionedChord, onPreview, onAudition, onSelect }: Props) {
  const notation = progression.description.replace(/^.*?:\s*/, "");
  return (
    <Surface as="article" level={selected ? "active" : "soft"} aria-label={`${progression.name} progression`} style={{ "--musical-beat": `${60 / bpm}s` } as CSSProperties}>
      <div className="progression-header">
        <div>
          <h2 className="progression-name">{progression.name}</h2>
          <p className="progression-notation">{notation}</p>
          {(selected || recommended) && <div className="progression-badges">
            {selected && <span className="state-label">Verse selected</span>}
            {recommended && <span className="state-label">Recommended chorus</span>}
          </div>}
        </div>
        <SecondaryButton
          variant="soft"
          className="icon-action"
          aria-label={previewPhase ? `Stop ${progression.name} preview` : `Preview ${progression.name}`}
          aria-busy={previewPhase === "loading"}
          aria-pressed={previewPhase !== null}
          onClick={onPreview}
        ><Icon name={previewPhase === "loading" ? "wave" : previewPhase === "playing" ? "stop" : "play"} /></SecondaryButton>
      </div>
      <div className="progression-blocks">
        {progression.chords.map((chord, index) => {
          const visual = chordVisual(chord, detectedKey);
          return <MusicalBlock key={`${chord.name}-${index}`} color={visual.color} label={`Hear ${chord.name}, chord ${index + 1} in ${progression.name}`} title={visual.role} selected={auditionedChord === index} playing={playingChord === index} onPress={() => onAudition(index)}>{chord.name}</MusicalBlock>;
        })}
      </div>
      <div className="progression-footer">
        <span className="progression-tip">Tap a chord to hear it.</span>
        <SecondaryButton variant="quiet" disabled={selected} aria-label={`Use ${progression.name}${phase === "pick-b" ? " for the chorus" : " for the verse"}`} onClick={onSelect}>{selected ? "Verse selected" : phase === "pick-b" ? "Use for chorus" : "Use for verse"}</SecondaryButton>
      </div>
      {previewPhase && <p className="phase-hint" role="status">{previewPhase === "loading" ? "Loading sounds…" : playingChord === null ? "Finishing preview…" : `Playing ${progression.chords[playingChord]?.name ?? "chord"}`}</p>}
    </Surface>
  );
}
