import type { Chapter, Episode } from "@podcast-llm/shared";
import { Section } from "@/components/episode/Section";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatTimestamp } from "@/lib/format";
import { usePlayerStore } from "@/lib/player-store";
import { cn } from "@/lib/utils";

interface Props {
  chapters: Chapter[];
  episode: Episode;
  source?: Episode["chaptersSource"];
  hideTitle?: boolean;
}

export function ChaptersSection({ chapters, episode, source, hideTitle }: Props) {
  const seek = usePlayerStore((s) => s.seek);
  const loadAndSeek = usePlayerStore((s) => s.loadAndSeek);
  const currentId = usePlayerStore((s) => s.episode?.id);
  const position = usePlayerStore((s) => s.position);

  function handleClick(start: number) {
    if (currentId === episode.id) seek(start);
    else loadAndSeek(episode, start);
  }

  const activeIndex = chapters.findIndex(
    (c, i) =>
      c.start <= position &&
      position < (c.end ?? chapters[i + 1]?.start ?? Infinity),
  );

  return (
    <Section
      title="チャプター"
      action={source && <ChapterSourceBadge source={source} />}
      hideTitle={hideTitle}
    >
      <Card className="divide-y divide-border overflow-hidden">
        {chapters.map((c, i) => {
          const isActive = currentId === episode.id && i === activeIndex;
          return (
            <button
              key={`${c.start}-${i}`}
              type="button"
              onClick={() => handleClick(c.start)}
              className={cn(
                "w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-accent/40 transition-colors",
                isActive && "bg-primary/10",
              )}
            >
              <span
                className={cn(
                  "text-xs font-mono tabular-nums shrink-0 mt-0.5 w-14",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                {formatTimestamp(c.start)}
              </span>
              <span
                className={cn(
                  "text-sm flex-1",
                  isActive ? "font-medium text-primary" : "",
                )}
              >
                {c.title}
              </span>
            </button>
          );
        })}
      </Card>
    </Section>
  );
}

function ChapterSourceBadge({
  source,
}: {
  source: NonNullable<Episode["chaptersSource"]>;
}) {
  const labels: Record<NonNullable<Episode["chaptersSource"]>, string> = {
    psc: "RSS",
    podcast20: "RSS",
    shownotes: "Show notes",
    gemini: "AI",
  };
  return (
    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
      {labels[source]}
    </Badge>
  );
}
