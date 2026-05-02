import { signInWithPopup, signOut as fbSignOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";

export async function signInWithGoogle() {
  await signInWithPopup(auth, googleProvider);
}

export async function signOut() {
  await fbSignOut(auth);
}

export function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("not authenticated");
  return uid;
}
