import { type User, onAuthStateChanged } from "firebase/auth";
import { useSyncExternalStore } from "react";
import { auth } from "../lib/firebase";

const subscribe = (callback: () => void) => onAuthStateChanged(auth, callback);
const getSnapshot = (): User | null => auth.currentUser;
const getServerSnapshot = (): User | null => null;

export function useAuth(): User | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
