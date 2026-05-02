import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import type { Episode } from "@podcast-llm/shared";
import { auth, db } from "./firebase";

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("not authenticated");
  return uid;
}

export async function savePlaybackPosition(
  episodeId: string,
  position: number,
  completed = false,
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await updateDoc(doc(db, "users", uid, "episodes", episodeId), {
    "playback.position": position,
    "playback.completed": completed,
    "playback.lastPlayedAt": Date.now(),
  });
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
