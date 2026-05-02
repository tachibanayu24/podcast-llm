import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import type { Episode, TranscriptDoc } from "@podcast-llm/shared";
import { Section } from "@/components/episode/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { friendlyError } from "@/lib/errors";
import { formatTimestamp } from "@/lib/format";
import { transcribeEpisodeFn } from "@/lib/functions";
import { usePlayerStore } from "@/lib/player-store";
import { cn } from "@/lib/utils";

interface Props {
  episodeId: string;
  episode: Episode;
  transcript: TranscriptDoc | null;
  loading: boolean;
}

export function TranscriptSection({
  episodeId,
  episode,
  transcript,
  loading,
}: Props) {
  const queryClient = useQueryClient();
  const seek = usePlayerStore((s) => s.seek);
  const loadAndSeek = usePlayerStore((s) => s.loadAndSeek);
  const currentId = usePlayerStore((s) => s.episode?.id);
  const position = usePlayerStore((s) => s.position);

  const generate = useMutation({
    mutationFn: () =>
      transcribeEpisodeFn({ episodeId }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transcript", episodeId] });
      queryClient.invalidateQueries({ queryKey: ["episode", episodeId] });
    },
  });

  function jump(start: number) {
    if (currentId === episode.id) seek(start);
    else loadAndSeek(episode, start);
  }

  const minutes = episode.duration ? Math.round(episode.duration / 60) : null;
  const estCostJpy = minutes ? Math.round(minutes * 4) : null;

  return (
    <Section
      title="文字起こし"
      action={
        transcript?.source && (
          <Badge
            variant="outline"
            className="text-[10px] uppercase tracking-wider"
          >
            {transcript.source === "rss" ? "RSS" : "AI"}
          </Badge>
        )
      }
    >
      {loading && <TranscriptSkeleton />}

      {!loading && !transcript && episode.transcript?.status !== "pending" && (
        <Card className="p-6 text-center space-y-3">
          <Sparkles className="size-6 text-muted-foreground mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-medium">文字起こしがありません</p>
            <p className="text-xs text-muted-foreground">
              RSSに含まれていないため、AIで生成できます
              {minutes && estCostJpy
                ? `(約${minutes}分・推定${estCostJpy}円)`
                : ""}
              。
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? "生成中…" : "AIで生成"}
          </Button>
          {generate.isError && (
            <p className="text-xs text-destructive">
              {friendlyError(generate.error)}
            </p>
          )}
        </Card>
      )}

      {!loading && episode.transcript?.status === "pending" && (
        <Card className="p-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            生成中です。1〜数分かかります…
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => generate.mutate()}
            className="text-xs text-muted-foreground"
          >
            やり直す
          </Button>
        </Card>
      )}

      {!loading &&
        transcript &&
        transcript.segments &&
        transcript.segments.length > 0 && (
          <Card className="p-4 max-h-[60vh] overflow-y-auto">
            <ol className="space-y-2.5">
              {transcript.segments.map((s, i) => {
                const active =
                  currentId === episode.id &&
                  s.start <= position &&
                  position < (s.end ?? s.start + 60);
                return (
                  <li
                    key={i}
                    className={cn(
                      "flex gap-3 items-start",
                      active && "bg-primary/5 -mx-2 px-2 py-1 rounded",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => jump(s.start)}
                      className={cn(
                        "text-xs font-mono tabular-nums shrink-0 mt-0.5 w-14 text-left transition-colors",
                        active
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {formatTimestamp(s.start)}
                    </button>
                    <div className="flex-1 text-sm leading-relaxed">
                      {s.speaker && (
                        <span className="text-xs font-semibold text-muted-foreground mr-2">
                          {s.speaker}
                        </span>
                      )}
                      <span className={active ? "font-medium" : ""}>
                        {s.text}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        )}

      {!loading &&
        transcript &&
        (!transcript.segments || transcript.segments.length === 0) && (
          <Card className="p-5">
            <p className="text-sm leading-relaxed whitespace-pre-line">
              {transcript.text}
            </p>
          </Card>
        )}
    </Section>
  );
}

function TranscriptSkeleton() {
  return (
    <Card className="p-4 space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-3 w-12 shrink-0" />
          <Skeleton className="h-3 flex-1" />
        </div>
      ))}
    </Card>
  );
}
