import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { db } from "./lib/admin.js";
import { transcribeWithChirp } from "./lib/chirp.js";
import { actualCostUsd, chirpCostUsd } from "./lib/cost.js";
import { ingestAudioToGcs } from "./lib/ingest.js";
import { mapSpeakerNames } from "./lib/speaker-map.js";
import type { Episode, Podcast, TranscriptDoc } from "./lib/types.js";

const TRANSCRIBE_MODEL = "chirp_3";
const NAME_MAPPING_MODEL = "gemini-2.5-flash-lite";

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
    let contentType = ep.gcsContentType;

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
        contentType = ingest.contentType;
        await epRef.update({
          gcsUri,
          gcsExpiresAt: expiresAt,
          gcsContentType: contentType,
        });
      }

      logger.info("transcribeEpisode: chirp start", { episodeId, gcsUri });
      const startedAt = Date.now();
      const chirp = await transcribeWithChirp(gcsUri);
      logger.info("transcribeEpisode: chirp done", {
        episodeId,
        elapsedMs: Date.now() - startedAt,
        rawSegments: chirp.segments.length,
        durationSec: chirp.durationSec,
      });

      if (chirp.segments.length === 0) {
        throw new Error("Chirp returned 0 segments");
      }

      // 話者ラベル (1, 2, ...) → 実名 のマッピングを Gemini で取得。
      const podcastSnap = await db
        .doc(`users/${uid}/podcasts/${ep.podcastId}`)
        .get();
      const podcast = podcastSnap.exists
        ? (podcastSnap.data() as Podcast)
        : null;

      let speakerMap: Record<string, string> = {};
      let mapUsage:
        | { inputTokens?: number; outputTokens?: number }
        | undefined;
      try {
        const r = await mapSpeakerNames({
          segments: chirp.segments,
          episode: ep,
          podcast,
        });
        speakerMap = r.mapping;
        mapUsage = r.usage;
        logger.info("transcribeEpisode: speaker map", {
          episodeId,
          mapping: speakerMap,
        });
      } catch (e) {
        logger.warn("transcribeEpisode: speaker mapping failed (continuing)", {
          episodeId,
          err: e instanceof Error ? e.message : String(e),
        });
      }

      // Chirp segment → TranscriptSegment 変換
      const segments = chirp.segments.map((s) => {
        const name = speakerMap[s.speakerLabel];
        const speaker = name && name.trim() ? name : `Speaker ${s.speakerLabel}`;
        return {
          start: s.start,
          end: s.end,
          speaker,
          text: s.text,
        };
      });

      const text = segments
        .map((s) => (s.speaker ? `${s.speaker}: ${s.text}` : s.text))
        .join("\n");

      // コスト: Chirp (時間ベース) + Gemini 名寄せ (token ベース)
      const audioSec = chirp.durationSec || ep.duration || 0;
      const chirpUsd = chirpCostUsd(audioSec, "standard");
      const mapUsd = actualCostUsd(NAME_MAPPING_MODEL, mapUsage);
      const costUsd = chirpUsd + mapUsd;

      const usageMeta = {
        inputTokens: mapUsage?.inputTokens ?? 0,
        outputTokens: mapUsage?.outputTokens ?? 0,
        costUsd,
      };

      const doc: TranscriptDoc = {
        episodeId,
        source: "gemini",
        language: chirp.language,
        text,
        segments,
        generatedAt: Date.now(),
        model: TRANSCRIBE_MODEL,
        usage: usageMeta,
      };
      await db.doc(`users/${uid}/transcripts/${episodeId}`).set(doc);

      await epRef.update({
        "transcript.status": "done",
        "transcript.source": "gemini",
        "transcript.model": TRANSCRIBE_MODEL,
        "transcript.language": chirp.language,
        "transcript.generatedAt": Date.now(),
      });

      logger.info("transcribeEpisode: done", {
        episodeId,
        segments: segments.length,
        durationSec: audioSec,
        chirpUsd,
        mapUsd,
        costUsd,
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
