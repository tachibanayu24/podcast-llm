import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  type DownloadProgress,
  deleteOffline,
  downloadAudio,
  isDownloaded,
} from "@/lib/offline";

export function useEpisodeDownload(episodeId: string, audioUrl: string) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const status = useQuery({
    queryKey: ["offline", episodeId],
    queryFn: () => isDownloaded(episodeId),
  });

  const download = useMutation({
    mutationFn: async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setProgress({ loaded: 0, total: 0 });
      await downloadAudio(episodeId, audioUrl, (p) => setProgress(p), ctrl.signal);
    },
    onSettled: () => {
      abortRef.current = null;
      setProgress(null);
      queryClient.invalidateQueries({ queryKey: ["offline", episodeId] });
      queryClient.invalidateQueries({ queryKey: ["episode", episodeId] });
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteOffline(episodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offline", episodeId] });
      queryClient.invalidateQueries({ queryKey: ["episode", episodeId] });
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
