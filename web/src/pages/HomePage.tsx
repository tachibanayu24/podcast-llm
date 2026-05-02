import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Headphones, Plus } from "lucide-react";
import { PodcastTile } from "@/components/PodcastTile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listSubscriptions } from "@/lib/podcasts";

export function HomePage() {
  const { data: podcasts, isLoading } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: listSubscriptions,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            ライブラリ
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            購読中の {podcasts?.length ?? 0} 番組
          </p>
        </div>
        <Button asChild variant="gradient" size="sm">
          <Link to="/search">
            <Plus className="size-4" />
            追加
          </Link>
        </Button>
      </div>

      {isLoading && <PodcastGridSkeleton />}

      {!isLoading && podcasts && podcasts.length === 0 && <EmptyLibrary />}

      {podcasts && podcasts.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {podcasts.map((p) => (
            <li key={p.id}>
              <PodcastTile podcast={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PodcastGridSkeleton() {
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <li key={i} className="space-y-2.5">
          <Skeleton className="aspect-square rounded-2xl" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </li>
      ))}
    </ul>
  );
}

function EmptyLibrary() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center">
      <div className="mx-auto size-14 grid place-items-center rounded-2xl brand-gradient">
        <Headphones className="size-7 text-white" />
      </div>
      <h3 className="mt-5 font-semibold text-lg">まだPodcastがありません</h3>
      <p className="text-sm text-muted-foreground mt-1.5">
        検索して気になる番組を追加しよう
      </p>
      <Button asChild variant="gradient" className="mt-6">
        <Link to="/search">
          <Plus className="size-4" />
          検索して追加
        </Link>
      </Button>
    </div>
  );
}
