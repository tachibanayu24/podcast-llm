import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { storage } from "./admin.js";
import { audioObjectPath } from "./gcs.js";

const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;

export interface IngestResult {
  gcsUri: string;
  expiresAt: number;
  contentType: string;
  bytes: number;
}

export async function ingestAudioToGcs(
  podcastId: string,
  episodeId: string,
  audioUrl: string,
): Promise<IngestResult> {
  const objectPath = audioObjectPath(podcastId, episodeId);
  const bucket = storage.bucket();
  const file = bucket.file(objectPath);

  const res = await fetch(audioUrl, {
    headers: { "User-Agent": "podcast-llm/0.1" },
    redirect: "follow",
  });
  if (!res.ok || !res.body) {
    throw new Error(`audio fetch failed: ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") ?? "audio/mpeg";

  const writeStream = file.createWriteStream({
    metadata: { contentType, cacheControl: "private, max-age=0" },
    resumable: false,
  });

  const source = Readable.fromWeb(res.body as never);
  await pipeline(source, writeStream);

  const [meta] = await file.getMetadata();
  const bytes = Number(meta.size ?? 0);

  return {
    gcsUri: `gs://${bucket.name}/${objectPath}`,
    expiresAt: Date.now() + SEVEN_DAYS_MS,
    contentType,
    bytes,
  };
}
