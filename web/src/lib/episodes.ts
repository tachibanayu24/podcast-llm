import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type {
  Episode,
  SummaryDoc,
  TranscriptDoc,
  TranslationDoc,
} from "@podcast-llm/shared";
import { requireUid } from "./auth";
import { auth, db } from "./firebase";

export async function savePlaybackPosition(
  episodeId: string,
  position: number,
  completed = false,
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  // setDoc(merge) so it works even if the episode doc hasn't been
  // initialized for this user yet (rare, but updateDoc would throw).
  await setDoc(
    doc(db, "users", uid, "episodes", episodeId),
    {
      playback: {
        position,
        completed,
        lastPlayedAt: Date.now(),
      },
    },
    { merge: true },
  );
}

export async function setWatchlist(
  episodeId: string,
  inWatchlist: boolean,
): Promise<void> {
  const uid = requireUid();
  await updateDoc(doc(db, "users", uid, "episodes", episodeId), {
    isInWatchlist: inWatchlist,
    watchlistedAt: inWatchlist ? Date.now() : null,
  });
}

export async function listRecentEpisodes(max = 50): Promise<Episode[]> {
  const uid = requireUid();
  const snap = await getDocs(
    query(
      collection(db, "users", uid, "episodes"),
      orderBy("publishedAt", "desc"),
      limit(max),
    ),
  );
  return snap.docs.map((d) => d.data() as Episode);
}

export async function listWatchlist(max = 100): Promise<Episode[]> {
  const uid = requireUid();
  const snap = await getDocs(
    query(
      collection(db, "users", uid, "episodes"),
      where("isInWatchlist", "==", true),
      orderBy("watchlistedAt", "desc"),
      limit(max),
    ),
  );
  return snap.docs.map((d) => d.data() as Episode);
}

export async function getEpisode(episodeId: string): Promise<Episode | null> {
  const uid = requireUid();
  const snap = await getDoc(doc(db, "users", uid, "episodes", episodeId));
  return snap.exists() ? (snap.data() as Episode) : null;
}

export async function getTranscript(
  episodeId: string,
): Promise<TranscriptDoc | null> {
  const uid = requireUid();
  const snap = await getDoc(doc(db, "users", uid, "transcripts", episodeId));
  return snap.exists() ? (snap.data() as TranscriptDoc) : null;
}

export async function getSummary(
  episodeId: string,
): Promise<SummaryDoc | null> {
  const uid = requireUid();
  const snap = await getDoc(doc(db, "users", uid, "summaries", episodeId));
  return snap.exists() ? (snap.data() as SummaryDoc) : null;
}

export async function getTranslation(
  episodeId: string,
  kind: "summary" | "transcript",
  targetLanguage = "ja",
): Promise<TranslationDoc | null> {
  const uid = requireUid();
  const id = `${episodeId}__${kind}__${targetLanguage}`;
  const snap = await getDoc(doc(db, "users", uid, "translations", id));
  return snap.exists() ? (snap.data() as TranslationDoc) : null;
}
