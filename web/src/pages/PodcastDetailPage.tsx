import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { formatDate, formatDuration } from "../lib/format";
import { getPodcast, listEpisodes } from "../lib/podcasts";

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
    <div className="p-4 space-y-6">
      {podcastQuery.isLoading && (
        <p className="text-sm text-neutral-400">読み込み中...</p>
      )}
      {!podcastQuery.isLoading && !podcast && (
        <p className="text-sm text-neutral-400">
          見つかりません。
          <Link to="/" className="underline ml-1">
            戻る
          </Link>
        </p>
      )}

      {podcast && (
        <header className="flex gap-4">
          <img
            src={podcast.artwork}
            alt=""
            className="w-32 h-32 rounded shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-xl font-bold">{podcast.title}</h1>
            <p className="text-sm text-neutral-400">{podcast.author}</p>
            {podcast.description && (
              <p className="mt-2 text-sm text-neutral-300 line-clamp-4">
                {podcast.description}
              </p>
            )}
          </div>
        </header>
      )}

      <section>
        <h2 className="text-base font-bold mb-3">エピソード</h2>
        {episodesQuery.isLoading && (
          <p className="text-sm text-neutral-400">読み込み中...</p>
        )}
        {episodes && episodes.length === 0 && (
          <p className="text-sm text-neutral-400">エピソードがありません</p>
        )}
        <ul className="space-y-2">
          {episodes?.map((ep) => (
            <li
              key={ep.id}
              className="p-3 bg-neutral-900 rounded-lg"
            >
              <div className="font-medium">{ep.title}</div>
              <div className="text-xs text-neutral-400 mt-1 flex gap-3">
                <span>{formatDate(ep.publishedAt)}</span>
                {ep.duration ? <span>{formatDuration(ep.duration)}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

