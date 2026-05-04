import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import type { Episode, Podcast } from "@podcast-llm/shared";
import {
  type DownloadProgress,
  deleteOffline,
  downloadAudio,
  isDownloaded,
} from "@/lib/offline";

export function useEpisodeDownload(episode: Episode, podcast: Podcast | null) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const status = useQuery({
    queryKey: ["offline", episode.id],
    queryFn: () => isDownloaded(episode.id),
  });

  const download = useMutation({
    mutationFn: async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setProgress({ loaded: 0, total: 0 });
      await downloadAudio(episode, podcast, (p) => setProgress(p), ctrl.signal);
    },
    onSettled: () => {
      abortRef.current = null;
      setProgress(null);
      queryClient.invalidateQueries({ queryKey: ["offline", episode.id] });
      queryClient.invalidateQueries({ queryKey: ["episode", episode.id] });
      queryClient.invalidateQueries({ queryKey: ["downloads"] });
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteOffline(episode.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offline", episode.id] });
      queryClient.invalidateQueries({ queryKey: ["episode", episode.id] });
      queryClient.invalidateQueries({ queryKey: ["downloads"] });
    },
  });

  function cancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    setProgress(null);
  }

  return {
    isDownloaded: status.data ?? false,
    isDownloading: download.isPending,
    progress,
    error: download.error as Error | null,
    download: () => download.mutate(),
    remove: () => remove.mutate(),
    cancel,
  };
}
