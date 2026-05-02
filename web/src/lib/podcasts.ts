import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import type { Podcast, SearchResult } from "@podcast-llm/shared";
import { auth, db } from "./firebase";

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

export async function subscribeFromSearch(result: SearchResult): Promise<Podcast> {
  const uid = requireUid();
  const podcast: Podcast = {
    id: String(result.collectionId),
    title: result.title,
    author: result.author,
    artwork: result.artwork,
    feedUrl: result.feedUrl,
    ...(result.language ? { language: result.language } : {}),
    lastFetchedAt: 0,
    subscribedAt: Date.now(),
  };
  await setDoc(doc(db, "users", uid, "podcasts", podcast.id), podcast);
  return podcast;
}
