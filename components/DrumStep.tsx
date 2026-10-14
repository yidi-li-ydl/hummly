"use client";

import { useState } from "react";
import { previewDrums } from "@/lib/audio/mixer";
import useAudioPreview from "@/hooks/useAudioPreview";
import Icon from "./Icon";
import Surface from "./ui/Surface";
import CompactSelect from "./ui/CompactSelect";
import SecondaryButton from "./ui/SecondaryButton";
import type { DrumKit, DrumStyle } from "@/lib/types";

const DRUM_KITS: { id: DrumKit; label: string; description: string }[] = [
  { id: "acoustic-kit", label: "Acoustic", description: "Natural drum kit" },
  { id: "LINN", label: "LinnDrum", description: "Classic 80s" },
  { id: "CR78", label: "CR-78", description: "Vintage analog" },
  { id: "Kit3", label: "Studio", description: "Clean studio kit" },
  { id: "Kit8", label: "Punchy", description: "Tight & punchy" },
];

interface Props {
  options: DrumStyle[];
  beatsPerBar: number;
  bpm: number;
  onSelect: (style: DrumStyle, kit: DrumKit) => void;
  onSkip: () => void;
}

export default function DrumStep({ options, beatsPerBar, bpm, onSelect, onSkip }: Props) {
  const filtered = options.filter((s) => s.beatsPerBar === beatsPerBar);
  const [showAll, setShowAll] = useState(false);
  const [selectedKit, setSelectedKit] = useState<DrumKit>("acoustic-kit");
  const preview = useAudioPreview();
  const handlePreview = (style: DrumStyle) => {
    if (preview.state?.key === style.name) { preview.stop(); return; }
    void preview.start(style.name, (observer) => previewDrums(style, selectedKit, bpm, observer));
  };
  return (
    <div className="settings-stack">
      <CompactSelect label="Drum sound" value={selectedKit} options={DRUM_KITS.map((kit) => ({ value: kit.id, label: kit.label }))} onChange={(value) => { preview.stop(); setSelectedKit(value); }} />
      <SecondaryButton onClick={() => { preview.stop(); onSkip(); }}>Skip — no drums</SecondaryButton>
      {preview.error && <p className="recovery-message" role="alert">{preview.error}</p>}
      <div className="progression-list">
        {(showAll ? filtered : filtered.slice(0, 3)).map((style) => {
          const previewHere = preview.state?.key === style.name;
          const playing = previewHere && preview.state?.phase === "playing";
          const steps = beatsPerBar * 4;
          return <Surface as="article" level={playing ? "active" : "soft"} key={style.name} aria-label={`${style.name} rhythm`}>
            <div className="progression-header">
              <div><h2 className="progression-name">{style.name}</h2><p className="phase-hint">{style.description}</p><p className="progression-notation">{bpm} BPM</p></div>
              <SecondaryButton variant="soft" className="icon-action" aria-label={previewHere ? `Stop ${style.name} preview` : `Preview ${style.name}`} aria-busy={previewHere && preview.state?.phase === "loading"} aria-pressed={previewHere} onClick={() => handlePreview(style)}><Icon name={previewHere ? playing ? "stop" : "wave" : "play"} /></SecondaryButton>
            </div>
            <div className="rhythm-pattern" aria-hidden="true">{Array.from({ length: steps }, (_, step) => {
              const hits = style.pattern.filter((hit) => { const [bar, beat, sub] = hit.time.split(":").map(Number); return bar * steps + beat * 4 + sub === step; });
              const instrument = hits.find((hit) => hit.instrument === "kick")?.instrument ?? hits.find((hit) => hit.instrument === "snare")?.instrument ?? hits[0]?.instrument;
              const active = playing && preview.state?.step !== null && (preview.state?.step ?? -1) % steps === step;
              return <span key={step} className={`rhythm-step ${instrument ? `rhythm-step--${instrument} is-hit` : ""} ${active ? "is-playing" : ""}`} />;
            })}</div>
            <div className="progression-footer"><span className="progression-tip">Kick · snare · hi-hat</span><SecondaryButton aria-label={`Use ${style.name} beat`} onClick={() => { preview.stop(); onSelect(style, selectedKit); }}>Use this beat</SecondaryButton></div>
            {previewHere && <p className="phase-hint" role="status">{playing ? "Playing your groove…" : "Loading sounds…"}</p>}
          </Surface>;
        })}
      </div>
      {filtered.length > 3 && <SecondaryButton aria-expanded={showAll} onClick={() => { if (showAll) preview.stop(); setShowAll((value) => !value); }}>{showAll ? "Show fewer ideas" : "More beat ideas"}</SecondaryButton>}
    </div>
  );
}
