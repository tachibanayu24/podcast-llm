import {
  type User,
  getRedirectResult,
  signInWithRedirect,
  signOut as fbSignOut,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";

export async function waitForAuth(): Promise<User | null> {
  await auth.authStateReady();
  return auth.currentUser;
}

export async function consumeRedirectResult(): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch (e) {
    console.error("getRedirectResult failed", e);
    return null;
  }
}

export async function signInWithGoogle() {
  await signInWithRedirect(auth, googleProvider);
}

export async function signOut() {
  await fbSignOut(auth);
}
