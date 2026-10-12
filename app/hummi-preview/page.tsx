"use client";

import { useState } from "react";
import Link from "next/link";
import Hummi from "@/components/Hummi";
import type { HummiState } from "@/lib/hummi";
import { hummiAnimationsReady, hummiAnimations } from "@/lib/hummiAnimations";

const poses: { state: HummiState; name: string; motion: string }[] = [
  { state: "curious-listening", name: "Curious Listening", motion: "Listen → look up → nod · 3s" },
  { state: "unhappy", name: "Unhappy", motion: "Shrink → breathe in → sigh · 2.5s" },
  { state: "singing", name: "Singing", motion: "Breathe in → sing → smile · 3.5s" },
  { state: "dancing", name: "Solo Dance", motion: "Step → hop → kick · 2.8s" },
  { state: "group-dance", name: "Four-Note Group Dance", motion: "Wave → crouch → jump together · 3.5s" },
  { state: "cool-sunglasses", name: "Cool Sunglasses", motion: "Tap → lower shades → side-eye · 3s" },
  { state: "headphones", name: "Headphone Listening", motion: "Sway → bounce your shoulders · 3s" },
  { state: "dj", name: "DJ Performance", motion: "Scratch → turn → hands up → drop · 3.5s" },
];

export default function HummiPreview() {
  const [animated, setAnimated] = useState(true);
  const [frame, setFrame] = useState(0);

  return (
    <main className="w-full max-w-5xl mx-auto px-4 py-8 sm:py-12" lang="en">
      <Link href="/" className="text-sm text-neon-cyan hover:underline">← Back to Hummly</Link>
      <div className="flex flex-wrap items-center justify-between gap-4 mt-6 mb-3">
        <h1 className="text-3xl font-semibold">Meet Hummi</h1>
        <button
          type="button"
          aria-pressed={animated}
          disabled={!hummiAnimationsReady}
          onClick={() => setAnimated((value) => !value)}
          className="rounded-lg px-4 py-2 bg-surface-card text-text-primary border border-text-secondary/30 hover:border-neon-purple focus-visible:outline-2 focus-visible:outline-neon-cyan"
        >
          {!hummiAnimationsReady ? "Animations in review" : animated ? "Pause animations" : "Play animations"}
        </button>
      </div>
      <p className="text-text-secondary text-sm leading-relaxed max-w-2xl mb-8">
        Eight expressive loops, 96 frames each. Pause to inspect individual frames.
        Animations respect your system’s Reduce Motion setting.
      </p>
      {!animated && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button type="button" onClick={() => setFrame((value) => (value + 95) % 96)} className="px-3 py-2 rounded-lg bg-surface-card">Previous frame</button>
          <span className="text-sm tabular-nums" aria-live="polite">Frame {frame + 1} / 96</span>
          <button type="button" onClick={() => setFrame((value) => (value + 1) % 96)} className="px-3 py-2 rounded-lg bg-surface-card">Next frame</button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {poses.map(({ state, name, motion }, index) => (
          <section key={state} className="flex flex-col items-center rounded-2xl bg-surface-secondary border border-surface-card px-4 py-6 min-w-0">
            <Hummi state={state} size="large" animated={animated} frame={animated ? undefined : frame} priority={index < 4} />
            <h2 className="text-base font-medium mt-3">{name}</h2>
            <p className="text-text-secondary text-xs mt-2 text-center">{motion}</p>
            <a href={hummiAnimations[state].src.replace(/\.webp$/, "-loop.webp")} download className="text-neon-cyan text-xs mt-3 hover:underline">Download animated WebP</a>
          </section>
        ))}
      </div>
    </main>
  );
}
