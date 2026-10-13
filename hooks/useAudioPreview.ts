"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { stopPreview, type PreviewObserver } from "@/lib/audio/mixer";

type PreviewState = { key: string; phase: "loading" | "playing"; step: number | null } | null;

export default function useAudioPreview() {
  const [state, setState] = useState<PreviewState>(null);
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);
  useEffect(() => () => { version.current++; stopPreview(); }, []);

  const stop = useCallback(() => {
    version.current++;
    stopPreview();
    setState(null);
  }, []);

  const start = useCallback(async (key: string, schedule: (observer: PreviewObserver) => Promise<void>) => {
    const run = ++version.current;
    stopPreview();
    setError(null);
    setState({ key, phase: "loading", step: null });
    const current = () => version.current === run;
    try {
      await schedule({
        onStart: () => { if (current()) setState({ key, phase: "playing", step: null }); },
        onStep: (step) => { if (current()) setState({ key, phase: "playing", step }); },
        onEnd: () => { if (current()) setState(null); },
      });
    } catch {
      if (current()) {
        setState(null);
        setError("That sound couldn’t load. Your choices are safe—try the preview again.");
      }
    }
  }, []);

  return { state, error, start, stop };
}
