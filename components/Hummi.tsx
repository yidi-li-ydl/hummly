"use client";

import { useState, useSyncExternalStore, type CSSProperties } from "react";
import Image from "next/image";
import { hummiStates, type HummiState } from "@/lib/hummi";
import { hummiAnimations, hummiAnimationsReady } from "@/lib/hummiAnimations";
import styles from "./Hummi.module.css";

interface HummiProps {
  state: HummiState;
  size?: "small" | "medium" | "large";
  alt?: string;
  className?: string;
  animated?: boolean;
  /** Accessibility is unconditional: system reduced-motion always takes precedence. */
  respectReducedMotion?: true;
  priority?: boolean;
  /** Manual, zero-based frame selection for animation review. */
  frame?: number;
}

const sizes = { small: 88, medium: 144, large: 200 };

function subscribeMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function motionAllowed() {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function Hummi(props: HummiProps) {
  return <HummiRenderer key={props.state} {...props} />;
}

function HummiRenderer({ state, size = "medium", alt, className = "", animated = false, priority = false, frame }: HummiProps) {
  const asset = hummiStates[state];
  const animation = hummiAnimations[state];
  const pixels = sizes[size];
  const allowMotion = useSyncExternalStore(subscribeMotion, motionAllowed, () => false);
  const [spriteReady, setSpriteReady] = useState(false);
  const [spriteFailed, setSpriteFailed] = useState(false);
  const showSprite = hummiAnimationsReady && !spriteFailed && ((animated && allowMotion) || frame !== undefined);
  const selectedFrame = Math.max(0, Math.min(animation.frames - 1, Math.floor(frame ?? 0)));
  const label = alt ?? asset.alt;
  const spriteStyle = {
    "--hummi-duration": `${animation.duration}s`,
    width: `${animation.columns * 100}%`,
    height: `${animation.rows * 100}%`,
    ...(frame !== undefined ? {
      animation: "none",
      transform: `translate(${-100 * (selectedFrame % animation.columns) / animation.columns}%, ${-100 * Math.floor(selectedFrame / animation.columns) / animation.rows}%)`,
    } : {}),
  } as CSSProperties;

  // Keep the asset renderer here so future animated formats do not change page APIs.
  return (
    <span className={`${styles.frame} ${className}`} style={{ width: pixels, height: pixels }} role={label ? "img" : undefined} aria-label={label || undefined}>
      <Image
        src={asset.src}
        alt=""
        width={768}
        height={768}
        sizes={`${pixels}px`}
        loading={priority ? "eager" : "lazy"}
        className={`${styles.image} ${showSprite && spriteReady ? styles.hidden : animated && allowMotion ? styles[asset.motion] : ""}`}
      />
      {showSprite && (
        <span className={`${styles.spriteViewport} ${spriteReady ? "" : styles.hidden}`} aria-hidden="true">
          <Image
            src={animation.src}
            alt=""
            width={2048}
            height={3072}
            unoptimized
            loading={priority ? "eager" : "lazy"}
            onLoad={() => setSpriteReady(true)}
            onError={() => setSpriteFailed(true)}
            className={styles.sprite}
            style={spriteStyle}
          />
        </span>
      )}
    </span>
  );
}
