import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, Download, Pause, Play, Trash2 } from "lucide-react";
import { useMemo } from "react";
import type { Episode, Podcast } from "@podcast-llm/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getEpisode } from "@/lib/episodes";
import { friendlyError } from "@/lib/errors";
import { formatBytes, formatDate, formatDuration } from "@/lib/format";
import {
  type OfflineEntry,
  deleteAllOffline,
  deleteOffline,
  listOfflineEntries,
} from "@/lib/offline";
import { listSubscriptions } from "@/lib/podcasts";
import { usePlayerStore } from "@/lib/player-store";
import { cn } from "@/lib/utils";

interface Row {
  episode: Episode;
  podcast: Podcast | null;
  size: number;
}

export function DownloadsPage() {
  const queryClient = useQueryClient();

  const entriesQuery = useQuery({
    queryKey: ["downloads", "entries"],
    queryFn: () => listOfflineEntries(),
  });

  const podcastsQuery = useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => listSubscriptions(),
  });

  const podcastById = useMemo(() => {
    const map = new Map<string, Podcast>();
    for (const p of podcastsQuery.data ?? []) map.set(p.id, p);
    return map;
  }, [podcastsQuery.data]);

  const rowsQuery = useQuery({
    queryKey: [
      "downloads",
      "rows",
      entriesQuery.data?.map((e) => e.episodeId).join(","),
    ],
    queryFn: async (): Promise<Row[]> => {
      const entries = entriesQuery.data ?? [];
      const episodes = await Promise.all(
        entries.map((e) =>
          getEpisode(e.episodeId).then((ep) => ({ ep, entry: e })),
        ),
      );
      return episodes
        .filter((x): x is { ep: Episode; entry: OfflineEntry } => !!x.ep)
        .map(({ ep, entry }) => ({
          episode: ep,
          podcast: podcastById.get(ep.podcastId) ?? null,
          size: entry.size,
        }))
        .sort((a, b) => b.episode.publishedAt - a.episode.publishedAt);
    },
    enabled: !!entriesQuery.data,
  });

  const deleteOne = useMutation({
    mutationFn: (episodeId: string) => deleteOffline(episodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["downloads"] });
    },
  });

  const deleteAll = useMutation({
    mutationFn: () => deleteAllOffline(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["downloads"] });
    },
  });

  const rows = rowsQuery.data;
  const totalBytes = (rows ?? []).reduce((sum, r) => sum + r.size, 0);
  const isLoading = entriesQuery.isLoading || rowsQuery.isLoading;

  function handleDeleteAll() {
    if (!confirm("ダウンロード済みエピソードを全て削除します。よろしいですか?"))
      return;
    deleteAll.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" />
          設定に戻る
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">ダウンロード</h1>
        <p className="text-sm text-muted-foreground">
          オフラインで聴けるエピソード一覧。
        </p>
      </div>

      {isLoading && <ListSkeleton />}

      {!isLoading && rows && rows.length === 0 && <Empty />}

      {rows && rows.length > 0 && (
        <>
          <Card className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-muted-foreground">合計</div>
              <div className="font-semibold">
                {rows.length}件 · {formatBytes(totalBytes)}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteAll}
              disabled={deleteAll.isPending}
              className="gap-1.5"
            >
              <Trash2 className="size-3.5" />
              全削除
            </Button>
          </Card>

          {deleteAll.isError && (
            <p className="text-sm text-destructive">
              {friendlyError(deleteAll.error)}
            </p>
          )}

          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.episode.id}>
                <DownloadRow
                  row={row}
                  onDelete={() => {
                    if (confirm(`「${row.episode.title}」を削除しますか?`)) {
                      deleteOne.mutate(row.episode.id);
                    }
                  }}
                  busy={deleteOne.isPending}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function DownloadRow({
  row,
  onDelete,
  busy,
}: {
  row: Row;
  onDelete: () => void;
  busy: boolean;
}) {
  const { episode, podcast, size } = row;

  const load = usePlayerStore((s) => s.load);
  const toggle = usePlayerStore((s) => s.toggle);
  const currentId = usePlayerStore((s) => s.episode?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const isCurrent = currentId === episode.id;
  const showPause = isCurrent && isPlaying;

  function handlePlay() {
    if (isCurrent) toggle();
    else load(episode, { podcastTitle: podcast?.title });
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        {podcast?.artwork && (
          <Link
            to="/podcast/$id"
            params={{ id: episode.podcastId }}
            className="shrink-0"
          >
            <img
              src={podcast.artwork}
              alt=""
              className="size-12 rounded-lg object-cover"
            />
          </Link>
        )}
        <div className="flex-1 min-w-0 space-y-1">
          {podcast && (
            <Link
              to="/podcast/$id"
              params={{ id: episode.podcastId }}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors block truncate"
            >
              {podcast.title}
            </Link>
          )}
          <Link
            to="/episode/$id"
            params={{ id: episode.id }}
            className="font-medium leading-snug line-clamp-2 hover:text-primary transition-colors block"
          >
            {episode.title}
          </Link>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>{formatDate(episode.publishedAt)}</span>
            {episode.duration && (
              <>
                <span className="opacity-50">·</span>
                <span>{formatDuration(episode.duration)}</span>
              </>
            )}
            <span className="opacity-50">·</span>
            <span className="font-mono">{formatBytes(size)}</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0">
          <Button
            variant={isCurrent ? "gradient" : "secondary"}
            size="icon"
            onClick={handlePlay}
            aria-label={showPause ? "一時停止" : "再生"}
          >
            {showPause ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4 fill-current" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={busy}
            aria-label="削除"
            className={cn("text-muted-foreground hover:text-destructive")}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Empty() {
  return (
    <Card className="p-8 text-center space-y-3">
      <div className="mx-auto size-12 rounded-full bg-primary/10 grid place-items-center">
        <Download className="size-6 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">ダウンロード済みのエピソードはありません</p>
        <p className="text-sm text-muted-foreground">
          エピソード詳細の
          <Download className="inline size-3.5 mx-1 -mt-0.5" />
          ボタンからダウンロードできます。
        </p>
      </div>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i}>
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="size-12 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
