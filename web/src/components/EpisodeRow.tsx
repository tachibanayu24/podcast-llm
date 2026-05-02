import { Link } from "@tanstack/react-router";
import { Bookmark, Pause, Play } from "lucide-react";
import type { Episode, Podcast } from "@podcast-llm/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useWatchlistToggle } from "@/hooks/useWatchlistToggle";
import { formatDate, formatDuration } from "@/lib/format";
import { usePlayerStore } from "@/lib/player-store";
import { cn } from "@/lib/utils";

interface EpisodeRowProps {
  episode: Episode;
  podcast: Podcast | null;
  showPodcast?: boolean;
}

export function EpisodeRow({
  episode,
  podcast,
  showPodcast = false,
}: EpisodeRowProps) {
  const load = usePlayerStore((s) => s.load);
  const toggle = usePlayerStore((s) => s.toggle);
  const currentId = usePlayerStore((s) => s.episode?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const isCurrent = currentId === episode.id;
  const showPause = isCurrent && isPlaying;

  const watchlistMutation = useWatchlistToggle(episode);

  function handlePlay() {
    if (isCurrent) toggle();
    else load(episode, podcast?.title);
  }

  return (
    <Card className="p-4 hover:border-primary/40 transition-all duration-200 group">
      <div className="flex items-start gap-3">
        {showPodcast && podcast?.artwork && (
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
          {showPodcast && podcast && (
            <Link
              to="/podcast/$id"
              params={{ id: episode.podcastId }}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors block truncate"
            >
              {podcast.title}
            </Link>
          )}
          <div className="font-medium leading-snug line-clamp-2">
            {episode.title}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>{formatDate(episode.publishedAt)}</span>
            {episode.duration ? (
              <>
                <span className="opacity-50">·</span>
                <span>{formatDuration(episode.duration)}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => watchlistMutation.mutate(!episode.isInWatchlist)}
            disabled={watchlistMutation.isPending}
            aria-label={episode.isInWatchlist ? "あとで聴くから外す" : "あとで聴く"}
            aria-pressed={episode.isInWatchlist}
          >
            <Bookmark
              className={cn(
                "size-4 transition-colors",
                episode.isInWatchlist
                  ? "fill-primary text-primary"
                  : "text-muted-foreground",
              )}
            />
          </Button>
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
        </div>
      </div>
    </Card>
  );
}
