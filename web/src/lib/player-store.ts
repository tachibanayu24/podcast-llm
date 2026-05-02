import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Episode } from "@podcast-llm/shared";

interface PlayerState {
  episode: Episode | null;
  podcastTitle: string | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  isExpanded: boolean;
  playbackRate: number;

  load: (episode: Episode, podcastTitle?: string) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (sec: number) => void;
  skipBack: () => void;
  skipForward: () => void;
  setPosition: (sec: number) => void;
  setDuration: (sec: number) => void;
  setRate: (rate: number) => void;
  expand: () => void;
  collapse: () => void;
  close: () => void;
}

const SKIP_BACK = 15;
const SKIP_FORWARD = 30;

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      episode: null,
      podcastTitle: null,
      isPlaying: false,
      position: 0,
      duration: 0,
      isExpanded: false,
      playbackRate: 1,

      load: (episode, podcastTitle) => {
        const { episode: prev } = get();
        if (prev?.id === episode.id) {
          set({ isPlaying: true });
          return;
        }
        set({
          episode,
          podcastTitle: podcastTitle ?? null,
          isPlaying: true,
          position: episode.playback?.position ?? 0,
          duration: episode.duration ?? 0,
        });
      },

      play: () => set({ isPlaying: true }),
      pause: () => set({ isPlaying: false }),
      toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),

      seek: (sec) => set({ position: sec }),
      skipBack: () => {
        const { position } = get();
        set({ position: Math.max(0, position - SKIP_BACK) });
      },
      skipForward: () => {
        const { position, duration } = get();
        const next = position + SKIP_FORWARD;
        set({ position: duration > 0 ? Math.min(duration, next) : next });
      },
      setPosition: (sec) => set({ position: sec }),
      setDuration: (sec) => set({ duration: sec }),
      setRate: (rate) => set({ playbackRate: rate }),

      expand: () => set({ isExpanded: true }),
      collapse: () => set({ isExpanded: false }),

      close: () =>
        set({
          episode: null,
          podcastTitle: null,
          isPlaying: false,
          position: 0,
          duration: 0,
          isExpanded: false,
        }),
    }),
    {
      name: "podcast-llm.player",
      partialize: (s) => ({ playbackRate: s.playbackRate }),
    },
  ),
);
