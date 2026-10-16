"use client";
import { useEffect, useRef, useState } from "react";
import { projectRepository } from "@/lib/projects/repository";
import type { SongSummary } from "@/lib/projects/model";
import Hummi from "./Hummi";
import Icon from "./Icon";
import ActionButton from "./ui/ActionButton";
import { formatMixTime } from "./MixPlayer";

interface Props { onOpen: (id: string) => Promise<void>; onNew: () => void }
export default function MySongs({ onOpen, onNew }: Props) {
  const [songs, setSongs] = useState<SongSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<SongSummary | null>(null);
  const [title, setTitle] = useState("");
  const renameDialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let alive = true;
    projectRepository.list().then(items => { if (alive) setSongs(items); }).catch(() => { if (alive) setError("Couldn’t open your local library. Your songs haven’t been deleted."); });
    heading.current?.focus();
    return () => { alive = false; };
  }, []);
  async function open(id: string) {
    if (busy) return;
    setBusy(id); setError(null);
    try { await onOpen(id); } catch (error) { setError(error instanceof Error ? error.message : "Couldn’t open this song."); setBusy(null); }
  }
  async function remove(song: SongSummary) {
    if (!window.confirm(`Delete “${song.title}”? This removes the song and its audio from this device.`)) return;
    setBusy(song.id); setError(null);
    try { await projectRepository.delete(song.id); setSongs(await projectRepository.list()); }
    catch { setError("Couldn’t delete this song. Try again."); }
    finally { setBusy(null); }
  }
  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !title.trim()) return;
    setBusy(editing.id);
    try {
      const project = await projectRepository.load(editing.id);
      await projectRepository.save({ ...project, title: title.trim().slice(0, 80) });
      setSongs(await projectRepository.list()); renameDialog.current?.close(); setEditing(null);
    } catch { setError("Couldn’t rename this song. Try again."); }
    finally { setBusy(null); }
  }
  return <section className="songs-library" aria-labelledby="my-songs-title">
    <header className="songs-heading"><div><h1 id="my-songs-title" ref={heading} tabIndex={-1}>My songs</h1><p>Little hums. Yours to keep.</p></div><span className="songs-count">{songs?.length ?? ""}</span></header>
    <ActionButton onClick={onNew} disabled={!!busy}><span aria-hidden="true">＋</span>New song</ActionButton>
    {error && <p className="recovery-message" role="alert">{error}</p>}
    {!songs && !error && <p role="status">Opening your songs…</p>}
    {songs?.length === 0 && <div className="songs-empty"><Hummi state="headphones" animated={false} /><h2>Your first song starts with a hum.</h2><p>No perfect pitch needed. Just a little idea.</p></div>}
    <div className="songs-list">{songs?.map((song, index) => <article key={song.id} className={`song-card song-card--${index % 3}`}>
      <button type="button" className="song-open" aria-label={`Open ${song.title}`} disabled={!!busy} onClick={() => void open(song.id)}>
        <span className="song-art" aria-hidden="true"><Icon name={song.stage === "ready" ? "note" : "mic"} /><span>♪</span></span>
        <span className="song-copy"><strong>{song.title}</strong><span>{[song.key, `${song.bpm} BPM`, formatMixTime(song.duration)].filter(Boolean).join(" · ")}</span><span className="song-date">{new Date(song.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}<span className="song-stage">{song.stage === "ready" ? "Ready to play" : "Draft"}</span></span></span>
        <Icon name="arrow" className="song-arrow" />
      </button>
      <div className="song-actions"><button type="button" disabled={!!busy} aria-label={`Rename ${song.title}`} onClick={() => { setError(null); setEditing(song); setTitle(song.title); renameDialog.current?.showModal(); }}>Rename</button><button type="button" disabled={!!busy} aria-label={`Delete ${song.title}`} onClick={() => void remove(song)}>Delete</button></div>
    </article>)}</div>
    <p className="songs-local-note"><Icon name="spark" />Saved on this device. No account needed.</p>
    <dialog ref={renameDialog} className="song-rename-dialog" onCancel={() => setEditing(null)}>
      <form onSubmit={rename}><h2>Name your song</h2>{error && <p role="alert">{error}</p>}<label htmlFor="song-new-name">Song name</label><input id="song-new-name" maxLength={80} value={title} onChange={e => setTitle(e.target.value)} autoFocus /><div><button type="button" onClick={() => { renameDialog.current?.close(); setEditing(null); }}>Cancel</button><button type="submit" disabled={!title.trim() || !!busy}>Save name</button></div></form>
    </dialog>
  </section>;
}
