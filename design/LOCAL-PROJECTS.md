# My songs and local projects — v1

## Product scope

Hummly is an iOS-first, local-first music creation app. The existing web app validates the same project and library experience before native implementation. No account, cloud upload, or audio-processing server is needed for this milestone.

- First launch opens the existing creation flow.
- Subsequent launches with saved work open My songs.
- My songs offers New song and projects sorted by most recently edited.
- Each project shows a title, short musical details, length and Draft/Ready status.
- Opening a card resumes its last creation step or the finished Mix.
- Rename and Delete are explicit project actions. Delete confirms and removes associated audio atomically.
- My songs is reachable during creation and from Mix. Starting a new song preserves existing saved work.
- Mix exposes an editable song title and truthful Saving / Saved on this device / Couldn't save states.

## What constitutes a project

A project is the editable source and current sound, not only an exported WAV:

1. A versioned manifest: UUID, title, creation/update timestamps, last creation step, tempo, key, timing offset, notes, pitch readings, chord/beat choices, instruments and patterns.
2. Original recording: lossless Float32 PCM channels with their sample rate.
3. Latest Mix checkpoint: rendered voice/chords/drums PCM, edited source voice when applicable, per-track volume and mute. Restoring a checkpoint avoids regeneration and preserves the exact edited sound.
4. Session-only information: active playback, Web Audio nodes, Blob URLs, waveform selection, undo history and scroll position are not serialized in v1. A reopened project starts paused; edits and settings remain.

Changes to generation choices invalidate the old Mix checkpoint. Merely navigating between My songs, Mix and the editor does not invalidate it.

## Storage boundary

Use a small repository interface: list, load, save, delete. The web adapter uses IndexedDB with separate manifest and audio stores. PCM is structured-cloned without JSON conversion or Base64. Metadata and referenced audio are committed in one transaction; only audio assets whose references changed are rewritten. A failed transaction must not mark a project saved.

Use a serialized save queue and save revisions so older writes cannot overwrite newer edits or incorrectly mark them saved. Flush pending changes before leaving a project. Preserve recoverable in-memory state if storage fails. Report failures and allow retry; do not silently switch to ephemeral storage.

Do not store AudioBuffer instances, active audio contexts or object URLs. Do not autosave exported WAV copies. Project deletion also deletes every asset it owns.

## iOS mapping

Keep the same versioned manifest and stable project/asset identities. The native adapter can use an Application Support project directory per UUID, JSON metadata and lossless audio files, with a lightweight local index for the library. Use atomic file replacement and coordinate multi-file saves. The browser's IndexedDB format is an adapter, not the future iOS storage format.

Cross-device sync, cloud backup, public links, accounts, onboarding and billing are later milestones. Browser storage is specific to this browser/origin and may be cleared; the UI must say Saved on this device, not Backed up. Native backup/protection and storage limits need separate validation during the iOS implementation.

## Verification

Create and save; refresh and reopen; resume unfinished drafts; preserve naming, music choices, actual PCM edits, volumes and mutes; verify restored audio and export; switch between multiple projects without state leaking; delete both manifest and audio; exercise save failures and overlapping writes; check mobile layout and existing audio editing.

## Implemented boundaries

- `lib/projects/model.ts`: versioned manifest, stable asset slots, summary metadata and project restoration.
- `lib/projects/repository.ts`: IndexedDB adapter, serialized atomic writes/deletion, and a bounded cache for the active project's audio references.
- `hooks/useProjectAutosave.ts`: debounced autosave, background save attempts, error/retry state and flush-to-latest before in-app navigation.
- `components/MySongs.tsx`: local library, new/open/rename/delete.
- `components/StepWizard.tsx`: project identity, draft continuation and generation-checkpoint invalidation.
- `components/MixStep.tsx`: current audio checkpoints and direct restoration; unchanged audio generation/editing algorithms.

Browser background saves are best effort. Abrupt process termination can lose changes still marked Saving. Only a completed transaction is shown as Saved on this device. Browser data deletion or eviction is not a backup mechanism; native file protection, backup and recovery remain part of the iOS implementation milestone.

## Explicit save on Mix Home

The primary Mix action is Save to My songs. It opens a name-confirmation dialog, atomically commits the current project and a `completedAt` timestamp, then opens the library. Autosave continues protecting the current draft independently. A freshly rendered mix remains a Draft until this explicit confirmation succeeds. Cancellation does not mark a draft complete; failed writes keep the dialog open for retry.

`completedAt` is an optional additive v1 field. Older v1 projects already marked Ready retain that status when loaded. Explicit saves replace the pending autosave snapshot so delayed/background draft writes cannot revert completion metadata.

Export WAV remains a secondary Mix action. Create another song retains the current saved project and starts a new one. This milestone changes the web adapter only; native iOS storage and optional project-file export remain separate future work.
