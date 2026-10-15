"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { stopPreview, pausePreview, resumePreview, type PreviewObserver } from "@/lib/audio/mixer";

type PreviewState = { key: string; phase: "loading" | "playing" | "paused"; step: number | null } | null;

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

  const start = useCallback(async (key: string, schedule: (observer: PreviewObserver) => Promise<void>, keepPlayingWhileLoading = false) => {
    const run = ++version.current;
    if (!keepPlayingWhileLoading) stopPreview();
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
        stopPreview();
        setState(null);
        setError("That sound couldn’t load. Your choices are safe—try the preview again.");
      }
    }
  }, []);

  const pause = useCallback(async () => {
    const run = version.current;
    try {
      await pausePreview();
      if (version.current === run) setState(s => s ? { ...s, phase: "paused" } : s);
    } catch { if (version.current === run) setError("Couldn’t pause the preview. Try again."); }
  }, []);
  const resume = useCallback(async () => {
    const run = version.current;
    try {
      await resumePreview();
      if (version.current === run) setState(s => s ? { ...s, phase: "playing" } : s);
    } catch { if (version.current === run) setError("Couldn’t resume the preview. Try again."); }
  }, []);
  return { state, error, start, stop, pause, resume };
}
