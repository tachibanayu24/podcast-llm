import { del, get, keys, set } from "idb-keyval";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const PREFIX = "audio:";

function key(episodeId: string): string {
  return `${PREFIX}${episodeId}`;
}

export async function getOfflineAudioBlob(
  episodeId: string,
): Promise<Blob | null> {
  const blob = (await get<Blob>(key(episodeId))) ?? null;
  return blob;
}

export async function isDownloaded(episodeId: string): Promise<boolean> {
  return (await get(key(episodeId))) != null;
}

export interface DownloadProgress {
  loaded: number;
  total: number; // 0 if unknown
}

export async function downloadAudio(
  episodeId: string,
  url: string,
  onProgress?: (p: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, { signal, mode: "cors" });
  if (!res.ok || !res.body) {
    throw new Error(`download failed: ${res.status}`);
  }
  const total = Number(res.headers.get("content-length") ?? "0");
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      onProgress?.({ loaded, total });
    }
  }
  const contentType =
    res.headers.get("content-type") ?? "audio/mpeg";
  const blob = new Blob(chunks as BlobPart[], { type: contentType });
  await set(key(episodeId), blob);

  // Mirror to Firestore (best effort) so we know across devices
  const uid = auth.currentUser?.uid;
  if (uid) {
    await updateDoc(doc(db, "users", uid, "episodes", episodeId), {
      isDownloaded: true,
      downloadedAt: Date.now(),
    }).catch(() => {});
  }
}

export async function deleteOffline(episodeId: string): Promise<void> {
  await del(key(episodeId));
  const uid = auth.currentUser?.uid;
  if (uid) {
    await updateDoc(doc(db, "users", uid, "episodes", episodeId), {
      isDownloaded: false,
      downloadedAt: null,
    }).catch(() => {});
  }
}

export async function listOfflineEpisodeIds(): Promise<string[]> {
  const all = await keys();
  return all
    .filter((k): k is string => typeof k === "string" && k.startsWith(PREFIX))
    .map((k) => k.slice(PREFIX.length));
}
