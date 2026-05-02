import { Link } from "@tanstack/react-router";
import {
  Bookmark,
  CheckCircle2,
  Download,
  Loader2,
  Pause,
  Play,
  X,
} from "lucide-react";
import type { Episode, Podcast } from "@podcast-llm/shared";
import { Button } from "@/components/ui/button";
import { useEpisodeDownload } from "@/hooks/useEpisodeDownload";
import { useWatchlistToggle } from "@/hooks/useWatchlistToggle";
import { formatDate, formatDuration } from "@/lib/format";
import { usePlayerStore } from "@/lib/player-store";
import { cn } from "@/lib/utils";

interface Props {
  episode: Episode;
  podcast: Podcast | null;
}

export function Hero({ episode, podcast }: Props) {
  const load = usePlayerStore((s) => s.load);
  const toggle = usePlayerStore((s) => s.toggle);
  const currentId = usePlayerStore((s) => s.episode?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const isCurrent = currentId === episode.id;
  const showPause = isCurrent && isPlaying;

  const watchlistMutation = useWatchlistToggle(episode);
  const dl = useEpisodeDownload(episode.id, episode.audioUrl);

  function handlePlay() {
    if (isCurrent) toggle();
    else load(episode, { podcastTitle: podcast?.title });
  }

  const dlPercent =
    dl.progress && dl.progress.total > 0
      ? Math.round((dl.progress.loaded / dl.progress.total) * 100)
      : null;

  return (
    <header className="relative -mx-4 sm:-mx-6 -mt-6 sm:-mt-8 px-4 sm:px-6 pt-8 pb-2 overflow-hidden">
      {episode.artwork && (
        <>
          <img
            src={episode.artwork}
            alt=""
            className="absolute inset-0 size-full object-cover -z-10 opacity-25 blur-2xl scale-110"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </>
      )}

      <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">
        {episode.artwork && (
          <img
            src={episode.artwork}
            alt=""
            className="size-32 sm:size-40 rounded-2xl ring-1 ring-border shadow-2xl shadow-black/50 shrink-0 object-cover"
          />
        )}
        <div className="flex-1 min-w-0 space-y-3 self-end">
          {podcast && (
            <Link
              to="/podcast/$id"
              params={{ id: podcast.id }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-block"
            >
              {podcast.title}
            </Link>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-[1.15]">
            {episode.title}
          </h1>
          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>{formatDate(episode.publishedAt)}</span>
            {episode.duration ? (
              <>
                <span className="opacity-50">·</span>
                <span>{formatDuration(episode.duration)}</span>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="gradient"
              size="lg"
              onClick={handlePlay}
              className="rounded-full px-6 gap-2"
            >
              {showPause ? (
                <>
                  <Pause className="size-4" />
                  一時停止
                </>
              ) : (
                <>
                  <Play className="size-4 fill-current" />
                  再生
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => watchlistMutation.mutate(!episode.isInWatchlist)}
              disabled={watchlistMutation.isPending}
              aria-label={
                episode.isInWatchlist ? "あとで聴くから外す" : "あとで聴く"
              }
              aria-pressed={episode.isInWatchlist}
              className="size-11"
            >
              <Bookmark
                className={cn(
                  "size-5 transition-colors",
                  episode.isInWatchlist
                    ? "fill-primary text-primary"
                    : "text-muted-foreground",
                )}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (dl.isDownloading) dl.cancel();
                else if (dl.isDownloaded) dl.remove();
                else dl.download();
              }}
              aria-label={
                dl.isDownloaded
                  ? "オフラインから削除"
                  : dl.isDownloading
                    ? "ダウンロード中止"
                    : "オフライン保存"
              }
              className="size-11"
            >
              {dl.isDownloading ? (
                <X className="size-5 text-muted-foreground" />
              ) : dl.isDownloaded ? (
                <CheckCircle2 className="size-5 text-primary fill-primary/20" />
              ) : (
                <Download className="size-5 text-muted-foreground" />
              )}
            </Button>
          </div>
          {(dl.isDownloading || dl.error) && (
            <div className="text-xs">
              {dl.isDownloading && (
                <span className="text-muted-foreground inline-flex items-center gap-2">
                  <Loader2 className="size-3 animate-spin" />
                  ダウンロード中
                  {dlPercent != null ? ` ${dlPercent}%` : "…"}
                </span>
              )}
              {dl.error && (
                <span className="text-destructive">
                  失敗: {dl.error.message}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
