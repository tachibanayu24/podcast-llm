import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { useMemo } from "react";
import type { Podcast } from "@podcast-llm/shared";
import { EpisodeRow } from "@/components/EpisodeRow";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listWatchlist } from "@/lib/episodes";
import { listSubscriptions } from "@/lib/podcasts";

export function WatchlistPage() {
  const watchlistQuery = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => listWatchlist(),
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

  const episodes = watchlistQuery.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">あとで聴く</h1>
        <p className="text-sm text-muted-foreground mt-1">
          気になったエピソードをここに集めて、好きなときに聴く。
        </p>
      </header>

      {watchlistQuery.isLoading && <ListSkeleton />}

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
        <Bookmark className="size-6 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">まだ何も入っていません</p>
        <p className="text-sm text-muted-foreground">
          エピソード一覧の
          <Bookmark className="inline size-3.5 mx-1 -mt-0.5" />
          ボタンで追加できます。
        </p>
      </div>
      <Link
        to="/"
        className="inline-block text-sm text-primary hover:underline"
      >
        ライブラリへ戻る
      </Link>
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
