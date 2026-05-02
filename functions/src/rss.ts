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

        const newEpisodes = parsed.episodes.filter(
          (ep) => ep.audioUrl && !existingIds.has(ep.id),
        );

        if (newEpisodes.length > 0) {
          const batch = db.batch();
          for (const ep of newEpisodes) {
            const episode: Episode = {
              ...ep,
              podcastId: podcast.id,
              isInWatchlist: false,
              isDownloaded: false,
              playback: { position: 0, completed: false },
            };
            batch.set(
              db.doc(`users/${userId}/episodes/${ep.id}`),
              { ...episode, _updatedAt: FieldValue.serverTimestamp() },
              { merge: true },
            );
          }
          await batch.commit();
          totalNew += newEpisodes.length;
        }

        await podcastDoc.ref.update({
          lastFetchedAt: Date.now(),
          episodeCount: existingIds.size + newEpisodes.length,
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
