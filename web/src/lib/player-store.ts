import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Episode } from "@podcast-llm/shared";

export type PlayerError =
  | { kind: "playback"; message: string }
  | { kind: "load"; message: string };

interface LoadOptions {
  podcastTitle?: string;
  startAt?: number;
  autoplay?: boolean;
}

interface PlayerState {
  episode: Episode | null;
  podcastTitle: string | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  isExpanded: boolean;
  playbackRate: number;
  queue: Episode[];

  /** Pending seek to apply once audio metadata is loaded. */
  pendingSeek: number | null;
  /** Last error from audio element. UI displays + retry. */
  error: PlayerError | null;
  /** Increments to force the audio element to re-attempt load. */
  loadVersion: number;

  load: (episode: Episode, options?: LoadOptions) => void;
  loadAndSeek: (episode: Episode, sec: number, podcastTitle?: string) => void;
  /** Replace queue and start playback of first item. */
  playSequence: (episodes: Episode[], podcastTitle?: string) => void;
  /** Add to end of queue. */
  enqueue: (episode: Episode) => void;
  /** Remove from queue. */
  dequeue: (episodeId: string) => void;
  clearQueue: () => void;
  /** Advance to next queued episode, or close if none. */
  playNext: () => void;

  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (sec: number) => void;
  skipBack: () => void;
  skipForward: () => void;
  setPosition: (sec: number) => void;
  setDuration: (sec: number) => void;
  setRate: (rate: number) => void;

  consumePendingSeek: () => number | null;
  setError: (error: PlayerError | null) => void;
  retry: () => void;

  expand: () => void;
  collapse: () => void;
  /** Stop playback and remove episode from player. */
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
      queue: [],
      pendingSeek: null,
      error: null,
      loadVersion: 0,

      load: (episode, options = {}) => {
        const { episode: prev } = get();
        const isSame = prev?.id === episode.id;
        const startAt = options.startAt;
        const autoplay = options.autoplay ?? true;

        if (isSame) {
          set({
            isPlaying: autoplay,
            error: null,
            ...(startAt != null ? { pendingSeek: startAt, position: startAt } : {}),
          });
          return;
        }

        set({
          episode,
          podcastTitle: options.podcastTitle ?? null,
          isPlaying: autoplay,
          position: startAt ?? episode.playback?.position ?? 0,
          duration: episode.duration ?? 0,
          pendingSeek: startAt ?? episode.playback?.position ?? null,
          error: null,
        });
      },

      loadAndSeek: (episode, sec, podcastTitle) => {
        get().load(episode, { podcastTitle, startAt: sec });
      },

      playSequence: (episodes, podcastTitle) => {
        if (episodes.length === 0) return;
        const [first, ...rest] = episodes;
        get().load(first!, { podcastTitle });
        set({ queue: rest });
      },

      enqueue: (episode) => {
        set((s) => ({
          queue: s.queue.some((e) => e.id === episode.id)
            ? s.queue
            : [...s.queue, episode],
        }));
      },

      dequeue: (episodeId) => {
        set((s) => ({ queue: s.queue.filter((e) => e.id !== episodeId) }));
      },

      clearQueue: () => set({ queue: [] }),

      playNext: () => {
        const { queue, podcastTitle } = get();
        if (queue.length === 0) {
          get().close();
          return;
        }
        const [next, ...rest] = queue;
        get().load(next!, { podcastTitle: podcastTitle ?? undefined });
        set({ queue: rest });
      },

      play: () => set({ isPlaying: true, error: null }),
      pause: () => set({ isPlaying: false }),
      toggle: () => set((s) => ({ isPlaying: !s.isPlaying, error: null })),

      seek: (sec) => set({ position: sec, pendingSeek: sec }),
      skipBack: () => {
        const { position } = get();
        const next = Math.max(0, position - SKIP_BACK);
        set({ position: next, pendingSeek: next });
      },
      skipForward: () => {
        const { position, duration } = get();
        const candidate = position + SKIP_FORWARD;
        const next = duration > 0 ? Math.min(duration, candidate) : candidate;
        set({ position: next, pendingSeek: next });
      },
      setPosition: (sec) => set({ position: sec }),
      setDuration: (sec) => set({ duration: sec }),
      setRate: (rate) => set({ playbackRate: rate }),

      consumePendingSeek: () => {
        const { pendingSeek } = get();
        if (pendingSeek != null) set({ pendingSeek: null });
        return pendingSeek;
      },
      setError: (error) =>
        set({ error, ...(error ? { isPlaying: false } : {}) }),
      retry: () => {
        set((s) => ({ error: null, isPlaying: true, loadVersion: s.loadVersion + 1 }));
      },

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
          pendingSeek: null,
          error: null,
          queue: [],
        }),
    }),
    {
      name: "podcast-llm.player",
      partialize: (s) => ({
        playbackRate: s.playbackRate,
        episode: s.episode,
        podcastTitle: s.podcastTitle,
        position: s.position,
        duration: s.duration,
      }),
      // After hydration, never auto-resume playback
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isPlaying = false;
          state.isExpanded = false;
          state.pendingSeek = state.position > 0 ? state.position : null;
          state.error = null;
        }
      },
    },
  ),
);
