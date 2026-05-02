import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { FieldValue } from "firebase-admin/firestore";
import type { Episode, Podcast, SearchResult } from "./lib/types.js";
import { db } from "./lib/admin.js";
import { fetchAndParseFeed } from "./lib/rss-parser.js";

export const subscribePodcast = onCall<
  { result: SearchResult },
  Promise<{ podcastId: string; episodeCount: number }>
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

    const result = request.data?.result;
    if (!result?.feedUrl) {
      throw new HttpsError("invalid-argument", "feedUrl required");
    }

    const podcastId = String(result.collectionId);
    const parsed = await fetchAndParseFeed(result.feedUrl, podcastId);

    const podcast: Podcast = {
      id: podcastId,
      title: parsed.podcast.title || result.title,
      ...(parsed.podcast.author || result.author
        ? { author: parsed.podcast.author ?? result.author }
        : {}),
      ...(parsed.podcast.description
        ? { description: parsed.podcast.description }
        : {}),
      artwork: parsed.podcast.artwork ?? result.artwork,
      feedUrl: result.feedUrl,
      ...(parsed.podcast.language || result.language
        ? { language: parsed.podcast.language ?? result.language }
        : {}),
      episodeCount: parsed.episodes.length,
      lastFetchedAt: Date.now(),
      subscribedAt: Date.now(),
    };

    const podcastRef = db.doc(`users/${uid}/podcasts/${podcastId}`);
    const existing = await podcastRef.get();
    if (existing.exists) {
      podcast.subscribedAt = (existing.data() as Podcast).subscribedAt;
    }
    await podcastRef.set(podcast, { merge: true });

    const batch = db.batch();
    for (const ep of parsed.episodes) {
      if (!ep.audioUrl) continue;
      const episode: Episode = {
        ...ep,
        podcastId,
        isInWatchlist: false,
        isDownloaded: false,
        playback: { position: 0, completed: false },
      };
      const epRef = db.doc(`users/${uid}/episodes/${ep.id}`);
      batch.set(
        epRef,
        { ...episode, _updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    }
    await batch.commit();

    return { podcastId, episodeCount: parsed.episodes.length };
  },
);

export const refreshMyFeeds = onCall<
  Record<string, never>,
  Promise<{ ok: true; podcasts: number; newEpisodes: number; errors: number }>
>(
  {
    region: "asia-northeast1",
    maxInstances: 2,
    timeoutSeconds: 540,
    memory: "512MiB",
    invoker: "public",
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "auth required");

    const podcastsSnap = await db.collection(`users/${uid}/podcasts`).get();
    let newEpisodes = 0;
    let errors = 0;

    for (const podcastDoc of podcastsSnap.docs) {
      const podcast = podcastDoc.data() as Podcast;
      if (!podcast.feedUrl) continue;
      try {
        const parsed = await fetchAndParseFeed(podcast.feedUrl, podcast.id);
        const existingSnap = await db
          .collection(`users/${uid}/episodes`)
          .where("podcastId", "==", podcast.id)
          .select()
          .get();
        const existingIds = new Set(existingSnap.docs.map((d) => d.id));

        const valid = parsed.episodes.filter((ep) => ep.audioUrl);
        const CHUNK = 400;
        for (let i = 0; i < valid.length; i += CHUNK) {
          const chunk = valid.slice(i, i + CHUNK);
          const batch = db.batch();
          for (const ep of chunk) {
            const isNew = !existingIds.has(ep.id);
            if (isNew) newEpisodes++;
            const update: Record<string, unknown> = {
              ...ep,
              podcastId: podcast.id,
              _updatedAt: FieldValue.serverTimestamp(),
            };
            if (isNew) {
              update.isInWatchlist = false;
              update.isDownloaded = false;
              update.playback = { position: 0, completed: false };
            }
            batch.set(
              db.doc(`users/${uid}/episodes/${ep.id}`),
              update,
              { merge: true },
            );
          }
          await batch.commit();
        }

        await podcastDoc.ref.update({
          lastFetchedAt: Date.now(),
          episodeCount: valid.length,
        });
      } catch (err) {
        errors++;
        logger.error("refreshMyFeeds: failed", {
          podcastId: podcast.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      ok: true,
      podcasts: podcastsSnap.size,
      newEpisodes,
      errors,
    };
  },
);

export const refreshFeeds = onSchedule(
  {
    region: "asia-northeast1",
    schedule: "every 6 hours",
    timeZone: "Asia/Tokyo",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const snap = await db.collectionGroup("podcasts").get();
    logger.info("refreshFeeds: scanning", { podcasts: snap.size });

    let totalNew = 0;
    let errors = 0;

    for (const podcastDoc of snap.docs) {
      const podcast = podcastDoc.data() as Podcast;
      const userId = podcastDoc.ref.parent.parent?.id;
      if (!userId || !podcast.feedUrl) continue;

      try {
        const parsed = await fetchAndParseFeed(podcast.feedUrl, podcast.id);

        const existingSnap = await db
          .collection(`users/${userId}/episodes`)
          .where("podcastId", "==", podcast.id)
          .select()
          .get();
        const existingIds = new Set(existingSnap.docs.map((d) => d.id));

        let newCount = 0;
        const validEpisodes = parsed.episodes.filter((ep) => ep.audioUrl);

        // Chunk to stay under Firestore batch limit (500 ops)
        const CHUNK = 400;
        for (let i = 0; i < validEpisodes.length; i += CHUNK) {
          const chunk = validEpisodes.slice(i, i + CHUNK);
          const batch = db.batch();
          for (const ep of chunk) {
            const isNew = !existingIds.has(ep.id);
            if (isNew) newCount++;

            // For new episodes: include user-state defaults
            // For existing episodes: only update metadata fields (preserve user state)
            const update: Record<string, unknown> = {
              ...ep,
              podcastId: podcast.id,
              _updatedAt: FieldValue.serverTimestamp(),
            };
            if (isNew) {
              update.isInWatchlist = false;
              update.isDownloaded = false;
              update.playback = { position: 0, completed: false };
            }
            batch.set(
              db.doc(`users/${userId}/episodes/${ep.id}`),
              update,
              { merge: true },
            );
          }
          await batch.commit();
        }
        totalNew += newCount;

        await podcastDoc.ref.update({
          lastFetchedAt: Date.now(),
          episodeCount: validEpisodes.length,
        });
      } catch (err) {
        errors++;
        logger.error("refreshFeeds: failed", {
          podcastId: podcast.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("refreshFeeds: done", { totalNew, errors });
  },
);
