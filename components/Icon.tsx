import type { ReactNode, SVGProps } from "react";

type IconName = "mic" | "pause" | "stop" | "upload" | "arrow" | "spark" | "wave" | "note" | "beat" | "play";
const paths: Record<IconName, ReactNode> = {
  mic: <><rect x="9" y="2" width="6" height="13" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></>,
  pause: <><path d="M8 5v14M16 5v14" strokeWidth="4" /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />,
  upload: <path d="M12 16V3m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  spark: <path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8L12 2Z" />,
  wave: <path d="M2 12h3l2-7 4 14 3-14 3 7h5" />,
  note: <><path d="M10 17V5l10-2v12M10 8l10-2" /><ellipse cx="7" cy="17" rx="3" ry="2.5" /><ellipse cx="17" cy="15" rx="3" ry="2.5" /></>,
  beat: <><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></>,
  play: <path d="m8 4 12 8-12 8V4Z" fill="currentColor" />,
};
export default function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
