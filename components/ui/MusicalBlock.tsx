import type { ReactNode } from "react";
import type { MusicalColor } from "@/lib/musicVisuals";

type Props = {
  children: ReactNode;
  color?: MusicalColor;
  selected?: boolean;
  playing?: boolean;
  onPress?: () => void;
  label?: string;
  title?: string;
  className?: string;
};

export default function MusicalBlock({ children, color = "lavender", selected = false, playing = false, onPress, label, title, className = "" }: Props) {
  const classes = `musical-block musical-block--${color} ${selected ? "is-selected" : ""} ${playing ? "is-playing" : ""} ${className}`;
  const content = <><span>{children}</span><span className="musical-block-mark" aria-hidden="true" /></>;
  return onPress
    ? <button type="button" className={classes} aria-label={label} aria-pressed={selected} aria-current={playing ? "true" : undefined} title={title} onClick={onPress}>{content}</button>
    : <span className={classes} aria-label={label} title={title}>{content}</span>;
}
