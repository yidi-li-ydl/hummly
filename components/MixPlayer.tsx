"use client";

import Icon from "./Icon";

export function formatMixTime(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

interface Props {
  playing: boolean;
  position: number;
  duration: number;
  disabled?: boolean;
  compact?: boolean;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
}

export default function MixPlayer({ playing, position, duration, disabled, compact, onToggle, onSeek }: Props) {
  return <div className={`mix-player${compact ? " mix-player--compact" : ""}`}>
    <button type="button" className="mix-play" onClick={onToggle} disabled={disabled}
      aria-label={playing ? "Pause song" : "Play song"}>
      <Icon name={playing ? "pause" : "play"} />
    </button>
    <div className="mix-progress">
      <input type="range" min={0} max={duration || 1} step={.01} value={Math.min(position, duration)}
        aria-label="Song position" aria-valuetext={`${formatMixTime(position)} of ${formatMixTime(duration)}`}
        disabled={disabled || !duration} onChange={e => onSeek(Number(e.target.value))}
        style={{ backgroundSize: `${duration ? position / duration * 100 : 0}% 4px, 100% 4px` }} />
      <div className="mix-times"><span>{formatMixTime(position)}</span><span>{formatMixTime(duration)}</span></div>
    </div>
  </div>;
}
