import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Search } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { SearchResult } from "@podcast-llm/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { searchPodcastsFn } from "@/lib/functions";
import { subscribeFromSearch } from "@/lib/podcasts";

export function SearchPage() {
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data, isFetching, error } = useQuery({
    queryKey: ["search", submitted],
    queryFn: async () => {
      const res = await searchPodcastsFn({ term: submitted });
      return res.data;
    },
    enabled: submitted.length > 0,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(term.trim());
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">検索</h1>
        <p className="text-sm text-muted-foreground mt-1">
          podcastのタイトル・配信者で検索
        </p>
      </div>

      <form onSubmit={onSubmit} className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="例: コテンラジオ、Rebuild"
          className="pl-11 h-12 text-base"
        />
      </form>

      {isFetching && <ResultListSkeleton />}

      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "検索に失敗しました"}
        </p>
      )}

      {data && data.length === 0 && submitted && !isFetching && (
        <p className="text-sm text-muted-foreground">該当なし</p>
      )}

      {data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((r) => (
            <li key={r.collectionId}>
              <PodcastResultRow result={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PodcastResultRow({ result }: { result: SearchResult }) {
  const queryClient = useQueryClient();
  const subscribe = useMutation({
    mutationFn: () => subscribeFromSearch(result),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
  });

  return (
    <Card className="flex gap-3 p-3 hover:border-primary/50 transition-all duration-200">
      <img
        src={result.artwork}
        alt=""
        className="size-16 rounded-lg shrink-0 object-cover ring-1 ring-border"
        loading="lazy"
      />
      <div className="flex-1 min-w-0 self-center space-y-1">
        <div className="font-medium truncate leading-tight">{result.title}</div>
        <div className="text-sm text-muted-foreground truncate">
          {result.author}
        </div>
        {result.genre && (
          <Badge variant="outline" className="mt-1">
            {result.genre}
          </Badge>
        )}
      </div>
      <Button
        type="button"
        variant={subscribe.isSuccess ? "secondary" : "gradient"}
        size="sm"
        onClick={() => subscribe.mutate()}
        disabled={subscribe.isPending || subscribe.isSuccess}
        className="self-center"
      >
        {subscribe.isSuccess ? (
          <>
            <Check className="size-4" />
            登録済
          </>
        ) : subscribe.isPending ? (
          "..."
        ) : (
          <>
            <Plus className="size-4" />
            登録
          </>
        )}
      </Button>
    </Card>
  );
}

function ResultListSkeleton() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i}>
          <Card className="flex gap-3 p-3">
            <Skeleton className="size-16 rounded-lg shrink-0" />
            <div className="flex-1 min-w-0 self-center space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
