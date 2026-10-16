"use client";

import type { CSSProperties } from "react";
import Icon from "./Icon";

export type MixTrackKey = "voice" | "chords" | "drums";
export const MIX_TRACKS = [
  { key: "voice" as const, label: "Your hum", icon: "mic" as const, color: "var(--lavender)" },
  { key: "chords" as const, label: "Chords", icon: "note" as const, color: "var(--pink)" },
  { key: "drums" as const, label: "Beat", icon: "beat" as const, color: "var(--mint)" },
];

interface Props {
  available: MixTrackKey[];
  volumes: Record<MixTrackKey, number>;
  mutes: Record<MixTrackKey, boolean>;
  onVolume: (key: MixTrackKey, volume: number) => void;
  onMute: (key: MixTrackKey) => void;
}

export default function MiniMixer({ available, volumes, mutes, onVolume, onMute }: Props) {
  return <section className="mini-mixer" aria-labelledby="your-mix-title">
    <h2 id="your-mix-title">Your mix</h2>
    <p>Make it yours, one little adjustment at a time.</p>
    <div className="mini-mixer-tracks">
      {MIX_TRACKS.filter(track => available.includes(track.key)).map(({ key, label, icon, color }) =>
        <div key={key} className={`mini-mixer-row${mutes[key] ? " is-muted" : ""}`} style={{ "--track-color": color } as CSSProperties}>
          <span className="mini-track-icon"><Icon name={icon} /></span>
          <label htmlFor={`mix-volume-${key}`}>{label}</label>
          <input id={`mix-volume-${key}`} type="range" min={0} max={1} step={.01} value={volumes[key]}
            aria-label={`${label} volume`} aria-valuetext={mutes[key] ? "Muted" : `${Math.round(volumes[key] * 100)} percent`}
            onChange={e => onVolume(key, Number(e.target.value))}
            style={{ backgroundSize: `${volumes[key] * 100}% 6px, 100% 6px` }} />
          <button type="button" className="mix-mute" aria-label={`${mutes[key] ? "Unmute" : "Mute"} ${label}`}
            aria-pressed={mutes[key]} onClick={() => onMute(key)}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4V5Z" />
              {mutes[key] ? <path d="m16 9 6 6m0-6-6 6" /> : <><path d="M15 8a6 6 0 0 1 0 8" /><path d="M18 5a10 10 0 0 1 0 14" /></>}
            </svg>
          </button>
        </div>)}
    </div>
  </section>;
}
