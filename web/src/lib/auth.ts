import {
  type User,
  signInWithPopup,
  signOut as fbSignOut,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";

export async function waitForAuth(): Promise<User | null> {
  await auth.authStateReady();
  return auth.currentUser;
}

export async function signInWithGoogle() {
  await signInWithPopup(auth, googleProvider);
}

export async function signOut() {
  await fbSignOut(auth);
}
