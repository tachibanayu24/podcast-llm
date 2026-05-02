import { storage } from "./admin";

export const AUDIO_BUCKET_PREFIX = "audio";

export function audioObjectPath(podcastId: string, episodeId: string): string {
  return `${AUDIO_BUCKET_PREFIX}/${podcastId}/${episodeId}.mp3`;
}

export function gcsUriFor(objectPath: string): string {
  const bucket = storage.bucket();
  return `gs://${bucket.name}/${objectPath}`;
}

export async function getSignedDownloadUrl(
  objectPath: string,
  expiresInSec = 60 * 60,
): Promise<string> {
  const file = storage.bucket().file(objectPath);
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + expiresInSec * 1000,
  });
  return url;
}
