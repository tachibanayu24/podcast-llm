import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useMemo } from "react";
import type { Podcast } from "@podcast-llm/shared";
import { EpisodeRow } from "@/components/EpisodeRow";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listRecentEpisodes } from "@/lib/episodes";
import { listSubscriptions } from "@/lib/podcasts";

export function FeedPage() {
  const episodesQuery = useQuery({
    queryKey: ["feed"],
    queryFn: () => listRecentEpisodes(50),
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

  const episodes = episodesQuery.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">新着</h1>
        <p className="text-sm text-muted-foreground mt-1">
          購読中の番組から、新しい順に。
        </p>
      </header>

      {episodesQuery.isLoading && <ListSkeleton />}

      {episodes && episodes.length === 0 && <Empty />}

      {episodes && episodes.length > 0 && (
        <ul className="space-y-2">
          {episodes.map((ep) => (
            <li key={ep.id}>
              <EpisodeRow
                episode={ep}
                podcast={podcastById.get(ep.podcastId) ?? null}
                showPodcast
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Empty() {
  return (
    <Card className="p-8 text-center space-y-3">
      <div className="mx-auto size-12 rounded-full bg-primary/10 grid place-items-center">
        <Sparkles className="size-6 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">まだエピソードがありません</p>
        <p className="text-sm text-muted-foreground">
          番組を購読すると、ここに新着が並びます。
        </p>
      </div>
      <Link
        to="/search"
        className="inline-block text-sm text-primary hover:underline"
      >
        番組を探す
      </Link>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
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
