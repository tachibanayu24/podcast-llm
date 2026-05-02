import { Link } from "@tanstack/react-router";
import type { Podcast } from "@podcast-llm/shared";

export function PodcastTile({ podcast }: { podcast: Podcast }) {
  return (
    <Link
      to="/podcast/$id"
      params={{ id: podcast.id }}
      className="group block space-y-2.5"
    >
      <div className="aspect-square overflow-hidden rounded-2xl bg-card ring-1 ring-border group-hover:ring-primary/60 transition-all duration-300">
        {podcast.artwork ? (
          <img
            src={podcast.artwork}
            alt=""
            className="size-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="size-full brand-gradient" />
        )}
      </div>
      <div>
        <div className="font-medium leading-snug line-clamp-2 text-sm">
          {podcast.title}
        </div>
        {podcast.author && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {podcast.author}
          </div>
        )}
      </div>
    </Link>
  );
}
