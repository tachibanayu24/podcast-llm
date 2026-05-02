import { generateObject } from "ai";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { z } from "zod";
import { db } from "./lib/admin.js";
import { getVertex, MODELS } from "./lib/ai.js";
import { ingestAudioToGcs } from "./lib/ingest.js";
import type { Episode, TranscriptDoc } from "./lib/types.js";

const schema = z.object({
  language: z.string().describe("ISO 639-1 language code, e.g. 'ja' or 'en'"),
  segments: z
    .array(
      z.object({
        start: z.number().min(0).describe("開始秒"),
        end: z.number().min(0).describe("終了秒").optional(),
        speaker: z.string().describe("Speaker 1, Speaker 2 等").optional(),
        text: z.string().min(1),
      }),
    )
    .min(1),
});

export const transcribeEpisode = onCall<
  { episodeId: string; force?: boolean },
  Promise<{ ok: true; segments: number }>
>(
  {
    region: "asia-northeast1",
    maxInstances: 2,
    timeoutSeconds: 540,
    memory: "1GiB",
    invoker: "public",
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "auth required");

    const { episodeId, force } = request.data;
    if (!episodeId) throw new HttpsError("invalid-argument", "episodeId required");

    const epRef = db.doc(`users/${uid}/episodes/${episodeId}`);
    const epSnap = await epRef.get();
    if (!epSnap.exists) throw new HttpsError("not-found", "episode not found");
    const ep = epSnap.data() as Episode;

    if (!force && ep.transcript?.status === "done") {
      const t = await db.doc(`users/${uid}/transcripts/${episodeId}`).get();
      const segments = t.exists
        ? ((t.data() as TranscriptDoc).segments?.length ?? 0)
        : 0;
      return { ok: true, segments };
    }

    if (!ep.audioUrl) {
      throw new HttpsError("failed-precondition", "audioUrl missing");
    }

    await epRef.update({
      "transcript.status": "pending",
    });

    let gcsUri = ep.gcsUri;
    let expiresAt = ep.gcsExpiresAt ?? 0;

    try {
      if (!gcsUri || expiresAt < Date.now() + 60_000) {
        logger.info("transcribeEpisode: ingesting audio", { episodeId });
        const ingest = await ingestAudioToGcs(
          ep.podcastId,
          episodeId,
          ep.audioUrl,
        );
        gcsUri = ingest.gcsUri;
        expiresAt = ingest.expiresAt;
        await epRef.update({ gcsUri, gcsExpiresAt: expiresAt });
      }

      const vertex = getVertex();
      const { object } = await generateObject({
        model: vertex(MODELS.fast),
        schema,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  "次のポッドキャスト音声をできる限り正確に書き起こしてください。",
                  "- 話者ごとに `Speaker 1`, `Speaker 2` のようにラベル付けし、可能なら一貫させること",
                  "- セグメントはおおむね1〜2文ごとに区切り、各セグメントに開始秒(start)を付ける",
                  "- フィラー(えーと、あの 等)は適度に整理してよいが、内容を勝手に省略しない",
                  "- 言語は元音声の言語のまま (ja の場合は日本語)",
                ].join("\n"),
              },
              {
                type: "file",
                data: new URL(gcsUri),
                mediaType: "audio/mpeg",
              },
            ],
          },
        ],
        maxRetries: 2,
      });

      const segments = object.segments
        .map((s) => ({
          start: Math.max(0, s.start),
          ...(s.end != null ? { end: s.end } : {}),
          ...(s.speaker ? { speaker: s.speaker } : {}),
          text: s.text.trim(),
        }))
        .filter((s) => s.text.length > 0);

      const text = segments
        .map((s) => (s.speaker ? `${s.speaker}: ${s.text}` : s.text))
        .join("\n");

      const doc: TranscriptDoc = {
        episodeId,
        source: "gemini",
        language: object.language,
        text,
        segments,
        generatedAt: Date.now(),
      };
      await db.doc(`users/${uid}/transcripts/${episodeId}`).set(doc);

      await epRef.update({
        "transcript.status": "done",
        "transcript.source": "gemini",
        "transcript.model": MODELS.fast,
        "transcript.language": object.language,
        "transcript.generatedAt": Date.now(),
      });

      logger.info("transcribeEpisode: done", {
        episodeId,
        segments: segments.length,
      });
      return { ok: true, segments: segments.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await epRef.update({
        "transcript.status": "failed",
        "transcript.error": message.slice(0, 500),
      });
      logger.error("transcribeEpisode: failed", { episodeId, error: message });
      throw new HttpsError("internal", `transcription failed: ${message}`);
    }
  },
);
