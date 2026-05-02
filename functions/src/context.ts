import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { db } from "./lib/admin.js";
import { parseChaptersJson } from "./lib/chapters-parser.js";
import { parseTranscript } from "./lib/transcript-parser.js";
import type { Episode, TranscriptDoc } from "./lib/types.js";

interface ContextResponse {
  hasChapters: boolean;
  hasTranscript: boolean;
  transcriptSource?: "rss" | "gemini";
}

/**
 * Lazily backfills chapter/transcript content from RSS-provided URLs.
 * Idempotent — only fetches what is missing.
 */
export const getEpisodeContext = onCall<
  { episodeId: string },
  Promise<ContextResponse>
>(
  {
    region: "asia-northeast1",
    maxInstances: 5,
    timeoutSeconds: 60,
    invoker: "public",
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "auth required");

    const { episodeId } = request.data;
    if (!episodeId) throw new HttpsError("invalid-argument", "episodeId required");

    const epRef = db.doc(`users/${uid}/episodes/${episodeId}`);
    const epSnap = await epRef.get();
    if (!epSnap.exists) throw new HttpsError("not-found", "episode not found");
    const ep = epSnap.data() as Episode;

    let chaptersFetched = !!ep.chapters && ep.chapters.length > 0;
    let transcriptFetched = ep.transcript?.status === "done";
    let transcriptSource: "rss" | "gemini" | undefined = ep.transcript?.source;

    // Backfill chapters from <podcast:chapters> URL if not already
    if (!chaptersFetched && ep.chaptersUrl) {
      try {
        const res = await fetch(ep.chaptersUrl, {
          headers: { "User-Agent": "podcast-llm/0.1" },
        });
        if (res.ok) {
          const body = await res.text();
          const chapters = parseChaptersJson(body);
          if (chapters.length > 0) {
            await epRef.update({
              chapters,
              chaptersSource: "podcast20",
            });
            chaptersFetched = true;
          }
        }
      } catch (err) {
        logger.warn("getEpisodeContext: chapters fetch failed", {
          episodeId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Backfill transcript from <podcast:transcript> URL if not already
    if (!transcriptFetched && ep.transcriptSources && ep.transcriptSources.length > 0) {
      const source = pickBestTranscript(ep.transcriptSources);
      if (source) {
        try {
          const res = await fetch(source.url, {
            headers: { "User-Agent": "podcast-llm/0.1" },
          });
          if (res.ok) {
            const body = await res.text();
            const parsed = parseTranscript(body, source.type);
            if (parsed && parsed.text.length > 0) {
              const doc: TranscriptDoc = {
                episodeId,
                source: "rss",
                ...(source.language || parsed.language
                  ? { language: source.language ?? parsed.language! }
                  : {}),
                text: parsed.text,
                ...(parsed.segments.length > 0
                  ? { segments: parsed.segments }
                  : {}),
                generatedAt: Date.now(),
              };
              await db
                .doc(`users/${uid}/transcripts/${episodeId}`)
                .set(doc);
              await epRef.update({
                "transcript.status": "done",
                "transcript.source": "rss",
                "transcript.generatedAt": Date.now(),
                ...(source.language || parsed.language
                  ? {
                      "transcript.language":
                        source.language ?? parsed.language ?? null,
                    }
                  : {}),
              });
              transcriptFetched = true;
              transcriptSource = "rss";
            }
          }
        } catch (err) {
          logger.warn("getEpisodeContext: transcript fetch failed", {
            episodeId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    return {
      hasChapters: chaptersFetched,
      hasTranscript: transcriptFetched,
      ...(transcriptSource ? { transcriptSource } : {}),
    };
  },
);

function pickBestTranscript<T extends { type: string }>(
  sources: T[],
): T | undefined {
  // priority: json > vtt > srt > html > plain
  const order = ["json", "vtt", "srt", "subrip", "html", "plain"];
  for (const want of order) {
    const found = sources.find((s) => s.type.toLowerCase().includes(want));
    if (found) return found;
  }
  return sources[0];
}
