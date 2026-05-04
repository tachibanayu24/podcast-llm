import { del, get, keys, set } from "idb-keyval";
import { doc, updateDoc } from "firebase/firestore";
import type { Episode, Podcast } from "@podcast-llm/shared";
import { auth, db } from "./firebase";

const AUDIO_PREFIX = "audio:";
const META_PREFIX = "meta:";

function audioKey(episodeId: string): string {
  return `${AUDIO_PREFIX}${episodeId}`;
}

function metaKey(episodeId: string): string {
  return `${META_PREFIX}${episodeId}`;
}

interface OfflineMetaSnapshot {
  episode: Episode;
  podcast: Podcast | null;
  savedAt: number;
}

export async function getOfflineAudioBlob(
  episodeId: string,
): Promise<Blob | null> {
  const blob = (await get<Blob>(audioKey(episodeId))) ?? null;
  return blob;
}

export async function isDownloaded(episodeId: string): Promise<boolean> {
  return (await get(audioKey(episodeId))) != null;
}

export interface DownloadProgress {
  loaded: number;
  total: number; // 0 if unknown
}

export async function downloadAudio(
  episode: Episode,
  podcast: Podcast | null,
  onProgress?: (p: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("ログインが必要です");
  const idToken = await user.getIdToken();

  // 配信元の多くが CORS を返さないため、Cloud Functions 側のプロキシを経由する。
  // Hosting rewrite (/api/audio) はレスポンス 32MB 上限があるので、関数の URL を直接叩く。
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const proxyUrl = `https://asia-northeast1-${projectId}.cloudfunctions.net/audioProxy?episodeId=${encodeURIComponent(episode.id)}`;
  const res = await fetch(proxyUrl, {
    signal,
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok || !res.body) {
    throw new Error(`download failed: ${res.status}`);
  }
  // Cloud Run の 32MB cap 回避のため proxy は chunked で返す。
  // 生サイズはカスタムヘッダ(X-Audio-Size)経由で渡される。
  const total = Number(
    res.headers.get("x-audio-size") ?? res.headers.get("content-length") ?? "0",
  );
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
  const contentType = res.headers.get("content-type") ?? "audio/mpeg";
  const blob = new Blob(chunks as BlobPart[], { type: contentType });
  await set(audioKey(episode.id), blob);

  // 機内モードでもダウンロード一覧が出せるよう、エピソード/番組メタも同梱保存。
  const meta: OfflineMetaSnapshot = {
    episode,
    podcast,
    savedAt: Date.now(),
  };
  await set(metaKey(episode.id), meta);

  // Mirror to Firestore (best effort) so we know across devices
  const uid = auth.currentUser?.uid;
  if (uid) {
    await updateDoc(doc(db, "users", uid, "episodes", episode.id), {
      isDownloaded: true,
      downloadedAt: Date.now(),
    }).catch(() => {});
  }
}

export async function deleteOffline(episodeId: string): Promise<void> {
  await del(audioKey(episodeId));
  await del(metaKey(episodeId));
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
    .filter(
      (k): k is string => typeof k === "string" && k.startsWith(AUDIO_PREFIX),
    )
    .map((k) => k.slice(AUDIO_PREFIX.length));
}

export interface OfflineEntry {
  episodeId: string;
  size: number;
  episode: Episode | null;
  podcast: Podcast | null;
}

export async function listOfflineEntries(): Promise<OfflineEntry[]> {
  const ids = await listOfflineEpisodeIds();
  const entries = await Promise.all(
    ids.map(async (episodeId): Promise<OfflineEntry> => {
      const [blob, meta] = await Promise.all([
        get<Blob>(audioKey(episodeId)),
        get<OfflineMetaSnapshot>(metaKey(episodeId)),
      ]);
      return {
        episodeId,
        size: blob?.size ?? 0,
        episode: meta?.episode ?? null,
        podcast: meta?.podcast ?? null,
      };
    }),
  );
  return entries;
}

export async function deleteAllOffline(): Promise<void> {
  const ids = await listOfflineEpisodeIds();
  await Promise.all(ids.map((id) => deleteOffline(id)));
}
