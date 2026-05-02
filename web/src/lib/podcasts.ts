import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import type { Episode, Podcast, SearchResult } from "@podcast-llm/shared";
import { auth, db } from "./firebase";
import { subscribePodcastFn } from "./functions";

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("not authenticated");
  return uid;
}

export async function listSubscriptions(): Promise<Podcast[]> {
  const uid = requireUid();
  const snap = await getDocs(
    query(
      collection(db, "users", uid, "podcasts"),
      orderBy("subscribedAt", "desc"),
    ),
  );
  return snap.docs.map((d) => d.data() as Podcast);
}

export async function getPodcast(podcastId: string): Promise<Podcast | null> {
  const uid = requireUid();
  const snap = await getDoc(doc(db, "users", uid, "podcasts", podcastId));
  return snap.exists() ? (snap.data() as Podcast) : null;
}

export async function listEpisodes(
  podcastId: string,
  max = 50,
): Promise<Episode[]> {
  const uid = requireUid();
  const snap = await getDocs(
    query(
      collection(db, "users", uid, "episodes"),
      where("podcastId", "==", podcastId),
      orderBy("publishedAt", "desc"),
      limit(max),
    ),
  );
  return snap.docs.map((d) => d.data() as Episode);
}

export async function subscribeFromSearch(
  result: SearchResult,
): Promise<{ podcastId: string; episodeCount: number }> {
  const res = await subscribePodcastFn({ result });
  return res.data;
}
