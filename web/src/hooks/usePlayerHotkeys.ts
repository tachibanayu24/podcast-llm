import { useEffect } from "react";
import { usePlayerStore } from "@/lib/player-store";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

/**
 * Global player keyboard shortcuts. Registers once at app shell level.
 * Inactive when an input/textarea is focused.
 *
 * Space: toggle play/pause
 * ←  : skip back 15s
 * →  : skip forward 30s
 * j  : skip back 15s (YouTube convention)
 * l  : skip forward 30s
 * k  : toggle play/pause
 */
export function usePlayerHotkeys(): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const state = usePlayerStore.getState();
      if (!state.episode) return;

      switch (e.key) {
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          state.toggle();
          break;
        case "ArrowLeft":
        case "j":
        case "J":
          e.preventDefault();
          state.skipBack();
          break;
        case "ArrowRight":
        case "l":
        case "L":
          e.preventDefault();
          state.skipForward();
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
