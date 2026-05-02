import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { Pause, Play } from "lucide-react";
import type { Episode, Podcast } from "@podcast-llm/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDuration } from "@/lib/format";
import { usePlayerStore } from "@/lib/player-store";
import { getPodcast, listEpisodes } from "@/lib/podcasts";

export function PodcastDetailPage() {
  const { id } = useParams({ from: "/_app/podcast/$id" });

  const podcastQuery = useQuery({
    queryKey: ["podcast", id],
    queryFn: () => getPodcast(id),
  });

  const episodesQuery = useQuery({
    queryKey: ["episodes", id],
    queryFn: () => listEpisodes(id),
  });

  const podcast = podcastQuery.data;
  const episodes = episodesQuery.data;

  return (
    <div className="space-y-10">
      {podcastQuery.isLoading && <HeroSkeleton />}

      {!podcastQuery.isLoading && !podcast && (
        <p className="text-sm text-muted-foreground">
          見つかりません。
          <Link to="/" className="underline ml-1">
            戻る
          </Link>
        </p>
      )}

      {podcast && (
        <header className="relative -mx-4 sm:-mx-6 -mt-6 sm:-mt-8 px-4 sm:px-6 pt-12 pb-6 overflow-hidden">
          {podcast.artwork && (
            <>
              <img
                src={podcast.artwork}
                alt=""
                className="absolute inset-0 size-full object-cover -z-10 opacity-25 blur-2xl scale-110"
              />
              <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/60 via-background/80 to-background" />
            </>
          )}

          <div className="flex flex-col sm:flex-row gap-6">
            {podcast.artwork && (
              <img
                src={podcast.artwork}
                alt=""
                className="size-40 sm:size-48 rounded-2xl ring-1 ring-border shadow-2xl shadow-black/50 shrink-0 object-cover"
              />
            )}
            <div className="space-y-3 self-end min-w-0">
              <Badge variant="gradient">PODCAST</Badge>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.1]">
                {podcast.title}
              </h1>
              {podcast.author && (
                <p className="text-muted-foreground">{podcast.author}</p>
              )}
              {podcast.description && (
                <p className="text-sm text-muted-foreground line-clamp-3 max-w-2xl whitespace-pre-line">
                  {podcast.description}
                </p>
              )}
            </div>
          </div>
        </header>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-bold tracking-tight">エピソード</h2>

        {episodesQuery.isLoading && <EpisodeListSkeleton />}

        {episodes && episodes.length === 0 && (
          <p className="text-sm text-muted-foreground">エピソードがありません</p>
        )}

        {episodes && episodes.length > 0 && (
          <ul className="space-y-2">
            {episodes.map((ep) => (
              <li key={ep.id}>
                <EpisodeRow episode={ep} podcast={podcast ?? null} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EpisodeRow({
  episode,
  podcast,
}: {
  episode: Episode;
  podcast: Podcast | null;
}) {
  const load = usePlayerStore((s) => s.load);
  const toggle = usePlayerStore((s) => s.toggle);
  const currentId = usePlayerStore((s) => s.episode?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const isCurrent = currentId === episode.id;
  const showPause = isCurrent && isPlaying;

  function handleClick() {
    if (isCurrent) toggle();
    else load(episode, podcast?.title);
  }

  return (
    <Card className="p-4 hover:border-primary/40 transition-all duration-200 group">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
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
        <Button
          variant={isCurrent ? "gradient" : "secondary"}
          size="icon"
          onClick={handleClick}
          aria-label={showPause ? "一時停止" : "再生"}
          className="shrink-0"
        >
          {showPause ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4 fill-current" />
          )}
        </Button>
      </div>
    </Card>
  );
}

function HeroSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row gap-6">
      <Skeleton className="size-40 sm:size-48 rounded-2xl shrink-0" />
      <div className="space-y-3 self-end flex-1">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

function EpisodeListSkeleton() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i}>
          <Card className="p-4 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/4" />
          </Card>
        </li>
      ))}
    </ul>
  );
}
