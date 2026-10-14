import type { HummiState } from "./hummi";

// Turn on only after transparent atlases pass visual QA.
export const hummiAnimationsReady = true;

// Sprite sheets use 96 cells on an 8 × 12 grid: continuous rigs or motion in-betweens.
export const hummiAnimations: Record<HummiState, { src: string; duration: number; frames: number; columns: number; rows: number }> = {
  "curious-listening": { src: "/mascot/hummi/animations/curious-listening-smooth.webp", duration: 3, frames: 96, columns: 8, rows: 12 },
  unhappy: { src: "/mascot/hummi/animations/unhappy-rig-v3.webp", duration: 2.5, frames: 96, columns: 8, rows: 12 },
  singing: { src: "/mascot/hummi/animations/singing-microphone-smooth.webp", duration: 3.5, frames: 96, columns: 8, rows: 12 },
  dancing: { src: "/mascot/hummi/animations/dancing-rig-v3.webp", duration: 2.8, frames: 96, columns: 8, rows: 12 },
  "group-dance": { src: "/mascot/hummi/animations/group-dance-smooth.webp", duration: 3.5, frames: 96, columns: 8, rows: 12 },
  "cool-sunglasses": { src: "/mascot/hummi/animations/cool-sunglasses-rig-v4.webp", duration: 3, frames: 96, columns: 8, rows: 12 },
  headphones: { src: "/mascot/hummi/animations/headphones-smooth.webp", duration: 3, frames: 96, columns: 8, rows: 12 },
  dj: { src: "/mascot/hummi/animations/dj-smooth.webp", duration: 3.5, frames: 96, columns: 8, rows: 12 },
};
