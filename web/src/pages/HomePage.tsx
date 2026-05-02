import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { listSubscriptions } from "../lib/podcasts";

export function HomePage() {
  const { data: podcasts, isLoading } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: listSubscriptions,
  });

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">購読中</h2>
        <Link
          to="/search"
          className="text-sm text-neutral-400 hover:text-neutral-100"
        >
          + 検索して追加
        </Link>
      </div>

      {isLoading && <p className="text-sm text-neutral-400">読み込み中...</p>}

      {podcasts && podcasts.length === 0 && (
        <p className="text-sm text-neutral-400">
          まだpodcastを登録していません。
          <Link to="/search" className="underline ml-1">
            検索する
          </Link>
        </p>
      )}

      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {podcasts?.map((p) => (
          <li key={p.id}>
            <Link
              to="/podcast/$id"
              params={{ id: p.id }}
              className="block group"
            >
              <img
                src={p.artwork}
                alt=""
                className="w-full aspect-square rounded group-hover:opacity-80 transition"
                loading="lazy"
              />
              <div className="mt-1.5 text-sm font-medium line-clamp-2">
                {p.title}
              </div>
              <div className="text-xs text-neutral-400 truncate">
                {p.author}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
