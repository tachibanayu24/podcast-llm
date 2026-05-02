import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ListPlus, Loader2, Play, Trash2 } from "lucide-react";
import { EpisodeRow } from "@/components/EpisodeRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { friendlyError } from "@/lib/errors";
import { unsubscribePodcastFn } from "@/lib/functions";
import { getPodcast, listEpisodes } from "@/lib/podcasts";
import { usePlayerStore } from "@/lib/player-store";

export function PodcastDetailPage() {
  const { id } = useParams({ from: "/_app/podcast/$id" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
  const playSequence = usePlayerStore((s) => s.playSequence);

  const unsubscribe = useMutation({
    mutationFn: () => unsubscribePodcastFn({ podcastId: id }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      navigate({ to: "/" });
    },
  });

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
              <div className="pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={unsubscribe.isPending}
                  onClick={() => {
                    if (
                      confirm(
                        `「${podcast.title}」の購読を解除しますか?\n\nエピソード・要約・文字起こしも削除されます。`,
                      )
                    ) {
                      unsubscribe.mutate();
                    }
                  }}
                  className="gap-1.5 text-muted-foreground hover:text-destructive h-8"
                >
                  {unsubscribe.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  購読解除
                </Button>
                {unsubscribe.isError && (
                  <p className="text-xs text-destructive mt-1">
                    {friendlyError(unsubscribe.error)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">エピソード</h2>
          {episodes && episodes.length > 1 && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const oldFirst = [...episodes].reverse();
                  playSequence(oldFirst, podcast?.title);
                }}
                className="gap-1.5"
              >
                <Play className="size-3.5 fill-current" />
                古い順に再生
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => playSequence(episodes, podcast?.title)}
                className="gap-1.5"
                title="新しい順にキュー再生"
              >
                <ListPlus className="size-3.5" />
                新着から
              </Button>
            </div>
          )}
        </div>

        {episodesQuery.isLoading && <EpisodeListSkeleton />}

        {episodes && episodes.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            エピソードがまだ取得できていません。
            <br />
            設定ページから「フィードを再取得」してみてください。
          </Card>
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
