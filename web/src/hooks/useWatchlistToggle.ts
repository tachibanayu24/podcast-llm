import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Episode } from "@podcast-llm/shared";
import { setWatchlist } from "@/lib/episodes";
import { usePlayerStore } from "@/lib/player-store";

export function useWatchlistToggle(episode: Episode) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (next: boolean) => setWatchlist(episode.id, next),
    onMutate: async (next) => {
      // Cancel inflight queries that touch this episode list
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["watchlist"] }),
        queryClient.cancelQueries({ queryKey: ["episodes", episode.podcastId] }),
        queryClient.cancelQueries({ queryKey: ["episode", episode.id] }),
      ]);

      const prevEpisode = queryClient.getQueryData<Episode | null>([
        "episode",
        episode.id,
      ]);
      const prevPlayer = usePlayerStore.getState().episode;

      const next_ts = Date.now();
      const optimistic: Episode = {
        ...episode,
        isInWatchlist: next,
        watchlistedAt: next ? next_ts : undefined,
      };

      queryClient.setQueryData<Episode | null>(
        ["episode", episode.id],
        optimistic,
      );

      if (prevPlayer?.id === episode.id) {
        usePlayerStore.setState({ episode: optimistic });
      }

      return { prevEpisode, prevPlayer };
    },
    onError: (_err, _next, ctx) => {
      // Rollback
      if (ctx) {
        queryClient.setQueryData(["episode", episode.id], ctx.prevEpisode);
        if (ctx.prevPlayer?.id === episode.id) {
          usePlayerStore.setState({ episode: ctx.prevPlayer });
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({
        queryKey: ["episodes", episode.podcastId],
      });
      queryClient.invalidateQueries({ queryKey: ["episode", episode.id] });
    },
  });
}
