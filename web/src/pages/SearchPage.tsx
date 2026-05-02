import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import type { SearchResult } from "@podcast-llm/shared";
import { searchPodcastsFn } from "../lib/functions";
import { subscribeFromSearch } from "../lib/podcasts";

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
    <div className="p-4 space-y-4">
      <form onSubmit={onSubmit}>
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="podcastを検索..."
          className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg outline-none focus:border-neutral-600"
        />
      </form>

      {isFetching && <p className="text-sm text-neutral-400">検索中...</p>}
      {error && (
        <p className="text-sm text-red-400">
          {error instanceof Error ? error.message : "検索に失敗しました"}
        </p>
      )}

      {data && data.length === 0 && submitted && !isFetching && (
        <p className="text-sm text-neutral-400">該当なし</p>
      )}

      <ul className="space-y-2">
        {data?.map((r) => (
          <li key={r.collectionId}>
            <PodcastResultRow result={r} />
          </li>
        ))}
      </ul>
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
    <div className="flex gap-3 p-3 bg-neutral-900 rounded-lg">
      <img
        src={result.artwork}
        alt=""
        className="w-16 h-16 rounded shrink-0"
        loading="lazy"
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{result.title}</div>
        <div className="text-sm text-neutral-400 truncate">{result.author}</div>
      </div>
      <button
        type="button"
        onClick={() => subscribe.mutate()}
        disabled={subscribe.isPending || subscribe.isSuccess}
        className="px-3 py-1 text-sm bg-white text-neutral-900 rounded hover:bg-neutral-200 disabled:opacity-50 self-center"
      >
        {subscribe.isSuccess ? "登録済" : subscribe.isPending ? "..." : "登録"}
      </button>
    </div>
  );
}
