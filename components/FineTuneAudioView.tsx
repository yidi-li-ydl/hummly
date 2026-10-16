"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  player: ReactNode;
  busy?: boolean;
}

/** Stay mounted so selection, zoom, scroll position and undo survive navigation. */
export default function FineTuneAudioView({ open, onClose, children, player, busy }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) { ref.current?.close(); return; }
    ref.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  return <dialog ref={ref} className="fine-tune-view" aria-labelledby="fine-tune-title"
    onCancel={e => { e.preventDefault(); onClose(); }}>
    <div className="fine-tune-shell">
      <header className="fine-tune-header">
        <button type="button" className="header-back" aria-label="Back to your mix" onClick={onClose} autoFocus>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12H4m6-6-6 6 6 6" /></svg>
        </button>
        <h1 id="fine-tune-title">Fine-tune audio</h1>
      </header>
      <div className="fine-tune-content" aria-busy={busy}>
        <p className="fine-tune-intro">A little polish, your way.</p>
        {busy && <p role="status">Updating your sound…</p>}
        {children}
      </div>
      <footer className="fine-tune-player">{player}</footer>
    </div>
  </dialog>;
}
