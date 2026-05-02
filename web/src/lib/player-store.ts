import { create } from "zustand";
import type { Episode } from "@podcast-llm/shared";

interface PlayerState {
  episode: Episode | null;
  podcastTitle: string | null;
  isPlaying: boolean;
  position: number;
  duration: number;

  load: (episode: Episode, podcastTitle?: string) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (sec: number) => void;
  setPosition: (sec: number) => void;
  setDuration: (sec: number) => void;
  close: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  episode: null,
  podcastTitle: null,
  isPlaying: false,
  position: 0,
  duration: 0,

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
  setPosition: (sec) => set({ position: sec }),
  setDuration: (sec) => set({ duration: sec }),

  close: () =>
    set({
      episode: null,
      podcastTitle: null,
      isPlaying: false,
      position: 0,
      duration: 0,
    }),
}));
