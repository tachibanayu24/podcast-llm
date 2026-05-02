import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { db } from "./lib/admin.js";

const CHUNK = 400;

export const unsubscribePodcast = onCall<
  { podcastId: string },
  Promise<{ ok: true; deletedEpisodes: number }>
>(
  {
    region: "asia-northeast1",
    maxInstances: 2,
    timeoutSeconds: 120,
    invoker: "public",
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "auth required");

    const { podcastId } = request.data;
    if (!podcastId) {
      throw new HttpsError("invalid-argument", "podcastId required");
    }

    // Delete podcast doc
    await db.doc(`users/${uid}/podcasts/${podcastId}`).delete();

    // Delete episodes belonging to this podcast plus their derived docs
    const epSnap = await db
      .collection(`users/${uid}/episodes`)
      .where("podcastId", "==", podcastId)
      .select()
      .get();
    const ids = epSnap.docs.map((d) => d.id);

    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const batch = db.batch();
      for (const id of chunk) {
        batch.delete(db.doc(`users/${uid}/episodes/${id}`));
        batch.delete(db.doc(`users/${uid}/transcripts/${id}`));
        batch.delete(db.doc(`users/${uid}/summaries/${id}`));
      }
      await batch.commit();
    }

    logger.info("unsubscribePodcast: done", {
      podcastId,
      deletedEpisodes: ids.length,
    });
    return { ok: true, deletedEpisodes: ids.length };
  },
);
