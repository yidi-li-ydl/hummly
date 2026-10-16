import type { HummlyState, MixSnapshot, VoicePcm } from "../types";

export const PROJECT_VERSION = 1;
export type SaveStatus = "saving" | "saved" | "error";
export interface SongIdentity { id: string; title: string; createdAt: string; completedAt?: string }
export interface SongSummary extends SongIdentity {
  updatedAt: string;
  stage: "draft" | "ready";
  duration: number;
  key: string | null;
  bpm: number;
}
export interface SongProject extends SongIdentity { state: HummlyState }
export type AssetSlot = "recording" | "editedVoice" | "voice" | "chords" | "drums";
export type ProjectRecipe = Omit<HummlyState, "voicePcm" | "mixSnapshot" | "mixBuffer" | "mixUrl" | "error">;
export interface ProjectManifest extends SongSummary {
  schemaVersion: typeof PROJECT_VERSION;
  recipe: ProjectRecipe;
  assets: Partial<Record<AssetSlot, string>>;
  mix: Omit<MixSnapshot, "tracks" | "editedVoicePcm"> | null;
}
export interface ProjectAsset { id: string; projectId: string; pcm: VoicePcm }

export function projectAssets(project: SongProject): Partial<Record<AssetSlot, VoicePcm>> {
  const { voicePcm, mixSnapshot: mix } = project.state;
  return {
    ...(voicePcm ? { recording: voicePcm } : {}),
    ...(mix?.editedVoicePcm ? { editedVoice: mix.editedVoicePcm } : {}),
    ...(mix?.tracks.voice ? { voice: mix.tracks.voice } : {}),
    ...(mix?.tracks.chords ? { chords: mix.tracks.chords } : {}),
    ...(mix?.tracks.drums ? { drums: mix.tracks.drums } : {}),
  };
}

export function createManifest(project: SongProject): ProjectManifest {
  const { voicePcm, mixSnapshot: mix, mixBuffer, mixUrl, error, ...recipe } = project.state;
  void mixBuffer; void mixUrl; void error;
  const assets = Object.fromEntries(Object.keys(projectAssets(project)).map(slot => [slot, `${project.id}/${slot}`]));
  const duration = mix ? Math.max(0, ...Object.values(mix.tracks).map(pcm => pcm ? pcm.channels[0].length / pcm.sampleRate : 0))
    : voicePcm ? voicePcm.channels[0].length / voicePcm.sampleRate : 0;
  return {
    id: project.id, title: project.title.trim().slice(0, 80) || "Untitled song", createdAt: project.createdAt,
    completedAt: project.completedAt,
    updatedAt: new Date().toISOString(), schemaVersion: PROJECT_VERSION,
    stage: recipe.step === "mix" && mix && project.completedAt ? "ready" : "draft", duration,
    key: recipe.detectedKey ? `${recipe.detectedKey.key} ${recipe.detectedKey.mode}` : null,
    bpm: recipe.bpm, recipe, assets,
    mix: mix ? { edited: mix.edited, volumes: mix.volumes, mutes: mix.mutes } : null,
  };
}

export function restoreProject(manifest: ProjectManifest, assets: Map<string, VoicePcm>): SongProject {
  if (manifest.schemaVersion !== PROJECT_VERSION) throw new Error("This song was saved by a newer version of Hummly.");
  const pcm = (slot: AssetSlot) => {
    const id = manifest.assets[slot];
    if (!id) return null;
    const value = assets.get(id);
    if (!value || value.sampleRate <= 0 || !value.channels.length || !value.channels[0].length) throw new Error("Some audio for this song couldn’t be loaded.");
    return value;
  };
  return {
    id: manifest.id, title: manifest.title, createdAt: manifest.createdAt,
    // Earlier v1 projects considered a rendered mix complete automatically.
    completedAt: manifest.completedAt ?? (manifest.stage === "ready" ? manifest.updatedAt : undefined),
    state: { ...manifest.recipe, voicePcm: pcm("recording"), mixBuffer: null, mixUrl: null, error: null,
      mixSnapshot: manifest.mix ? { ...manifest.mix, editedVoicePcm: pcm("editedVoice"),
        tracks: { voice: pcm("voice"), chords: pcm("chords"), drums: pcm("drums") } } : null },
  };
}
