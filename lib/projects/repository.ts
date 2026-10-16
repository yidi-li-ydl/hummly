import { createManifest, projectAssets, restoreProject, type AssetSlot, type ProjectAsset, type ProjectManifest, type SongProject, type SongSummary } from "./model";
import type { VoicePcm } from "../types";

export interface ProjectRepository {
  list(): Promise<SongSummary[]>;
  load(id: string): Promise<SongProject>;
  save(project: SongProject): Promise<void>;
  delete(id: string): Promise<void>;
}

const DB_NAME = "hummly-projects";
let database: Promise<IDBDatabase> | null = null;
function openDatabase() {
  if (database) return database;
  database = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("Local storage is unavailable in this browser.")); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("projects", { keyPath: "id" });
      const assets = db.createObjectStore("assets", { keyPath: "id" });
      assets.createIndex("projectId", "projectId");
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Close other Hummly tabs and try saving again."));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); database = null; };
      resolve(db);
    };
  }).catch(error => { database = null; throw error; });
  return database;
}
function result<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function committed(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("Couldn’t save on this device."));
    transaction.onerror = () => { /* onabort reports transaction failures */ };
  });
}

// Serialize writes and use stable asset IDs. Changing a slider writes only the
// manifest; a new PCM buffer is committed together with its updated manifest.
let writes: Promise<unknown> = Promise.resolve();
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const next = writes.then(operation);
  writes = next.catch(() => {});
  return next;
}
const assetReferences = new Map<string, Partial<Record<AssetSlot, VoicePcm>>>();
export const projectRepository: ProjectRepository = {
  async list() {
    await writes;
    const db = await openDatabase();
    const records = await result<ProjectManifest[]>(db.transaction("projects").objectStore("projects").getAll());
    return records.map(({ id, title, createdAt, completedAt, updatedAt, stage, duration, key, bpm }) => ({ id, title, createdAt, completedAt, updatedAt, stage, duration, key, bpm }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async load(id) {
    await writes;
    const db = await openDatabase();
    const transaction = db.transaction(["projects", "assets"]);
    const [manifest, assets] = await Promise.all([
      result<ProjectManifest | undefined>(transaction.objectStore("projects").get(id)),
      result<ProjectAsset[]>(transaction.objectStore("assets").index("projectId").getAll(id)),
    ]);
    if (!manifest) throw new Error("This song is no longer on this device.");
    const project = restoreProject(manifest, new Map(assets.map(asset => [asset.id, asset.pcm])));
    assetReferences.clear();
    assetReferences.set(id, projectAssets(project));
    return project;
  },
  save(project) {
    return enqueue(async () => {
      const db = await openDatabase();
      const assets = projectAssets(project);
      const previous = assetReferences.get(project.id) ?? {};
      const manifest = createManifest(project);
      const transaction = db.transaction(["projects", "assets"], "readwrite");
      const done = committed(transaction);
      const store = transaction.objectStore("assets");
      try {
        for (const slot of ["recording", "editedVoice", "voice", "chords", "drums"] as const) {
          const id = `${project.id}/${slot}`;
          const pcm = assets[slot];
          if (!pcm) store.delete(id);
          else if (previous[slot] !== pcm) store.put({ id, projectId: project.id, pcm } satisfies ProjectAsset);
        }
        transaction.objectStore("projects").put(manifest);
      } catch (error) {
        transaction.abort();
        await done.catch(() => {});
        throw error;
      }
      await done;
      assetReferences.clear();
      assetReferences.set(project.id, assets);
    });
  },
  delete(id) {
    return enqueue(async () => {
      const db = await openDatabase();
      const transaction = db.transaction(["projects", "assets"], "readwrite");
      const done = committed(transaction);
      transaction.objectStore("projects").delete(id);
      const cursor = transaction.objectStore("assets").index("projectId").openCursor(id);
      cursor.onsuccess = () => { const item = cursor.result; if (item) { item.delete(); item.continue(); } };
      await done;
      assetReferences.delete(id);
    });
  },
};
