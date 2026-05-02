import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Episode } from "@podcast-llm/shared";
import { setWatchlist } from "@/lib/episodes";
import { usePlayerStore } from "@/lib/player-store";

export function useWatchlistToggle(episode: Episode) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (next: boolean) => setWatchlist(episode.id, next),
    onSuccess: (_, next) => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({
        queryKey: ["episodes", episode.podcastId],
      });

      const current = usePlayerStore.getState().episode;
      if (current?.id === episode.id) {
        usePlayerStore.setState({
          episode: {
            ...current,
            isInWatchlist: next,
            watchlistedAt: next ? Date.now() : undefined,
          },
        });
      }
    },
  });
}
