"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { projectRepository } from "@/lib/projects/repository";
import type { SongProject } from "@/lib/projects/model";

export default function useProjectAutosave(project: SongProject | null) {
  const latest = useRef<SongProject | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saved, setSaved] = useState<SongProject | null>(null);
  const [failure, setFailure] = useState<{ project: SongProject; message: string } | null>(null);
  const persist = useCallback(async (snapshot: SongProject, reportProject = snapshot) => {
    try {
      await projectRepository.save(snapshot);
      if (latest.current === snapshot) { setSaved(snapshot); setFailure(null); }
      return true;
    } catch (error) {
      if (latest.current === snapshot) setFailure({ project: reportProject, message: error instanceof Error ? error.message : "Couldn’t save on this device." });
      return false;
    }
  }, []);
  useEffect(() => {
    latest.current = project;
    if (!project?.state.voicePcm) return;
    const timer = setTimeout(() => { void persist(project); }, 350);
    timerRef.current = timer;
    return () => clearTimeout(timer);
  }, [project, persist]);
  useEffect(() => {
    const save = () => { const snapshot = latest.current; if (snapshot?.state.voicePcm) void persist(snapshot); };
    const visibility = () => { if (document.visibilityState === "hidden") save(); };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("pagehide", save); document.removeEventListener("visibilitychange", visibility); };
  }, [persist]);
  const flush = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    let snapshot = latest.current;
    while (snapshot?.state.voicePcm && snapshot !== saved) {
      if (!await persist(snapshot)) return false;
      if (latest.current === snapshot) return true;
      snapshot = latest.current;
    }
    return true;
  }, [persist, saved]);
  const commit = useCallback(async (snapshot: SongProject) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const previous = latest.current;
    // Any background save must now use the confirmed metadata, not an older draft.
    latest.current = snapshot;
    const ok = await persist(snapshot, previous ?? snapshot);
    if (!ok && latest.current === snapshot) latest.current = previous;
    return ok;
  }, [persist]);
  const status = !project?.state.voicePcm ? "idle" : saved === project ? "saved" : failure?.project === project ? "error" : "saving";
  return { status, error: failure?.project === project ? failure.message : null, flush, commit };
}
