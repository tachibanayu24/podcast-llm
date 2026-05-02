import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

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
