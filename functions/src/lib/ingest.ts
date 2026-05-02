import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { storage } from "./admin.js";
import { audioObjectPath } from "./gcs.js";
import { safeFetch } from "./safe-fetch.js";

const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;
const AUDIO_MAX_BYTES = 500 * 1024 * 1024; // 500 MB
const AUDIO_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

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

  const res = await safeFetch(audioUrl, { timeoutMs: AUDIO_TIMEOUT_MS });
  if (!res.ok || !res.body) {
    throw new Error(`audio fetch failed: ${res.status} ${res.statusText}`);
  }

  // Reject obviously oversized files via Content-Length when present
  const cl = Number(res.headers.get("content-length") ?? "0");
  if (cl > AUDIO_MAX_BYTES) {
    await res.body.cancel();
    throw new Error(`audio too large: ${cl} bytes`);
  }

  const contentType = res.headers.get("content-type") ?? "audio/mpeg";

  const writeStream = file.createWriteStream({
    metadata: { contentType, cacheControl: "private, max-age=0" },
    resumable: false,
  });

  // Size limiter — fail mid-stream if we exceed the cap
  let received = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      received += chunk.byteLength;
      if (received > AUDIO_MAX_BYTES) {
        cb(new Error(`audio exceeded size cap (${AUDIO_MAX_BYTES} bytes)`));
        return;
      }
      cb(null, chunk);
    },
  });

  const source = Readable.fromWeb(res.body as never);
  await pipeline(source, limiter, writeStream);

  const [meta] = await file.getMetadata();
  const bytes = Number(meta.size ?? 0);

  return {
    gcsUri: `gs://${bucket.name}/${objectPath}`,
    expiresAt: Date.now() + SEVEN_DAYS_MS,
    contentType,
    bytes,
  };
}
