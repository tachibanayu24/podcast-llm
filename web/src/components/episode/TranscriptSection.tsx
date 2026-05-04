import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import type { Episode, TranscriptDoc } from "@podcast-llm/shared";
import { Section } from "@/components/episode/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { estimateTranscribeCostUsd, formatUsd } from "@/lib/cost";
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
  hideTitle?: boolean;
}

export function TranscriptSection({
  episodeId,
  episode,
  transcript,
  loading,
  hideTitle,
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
  const estCostUsd = episode.duration
    ? estimateTranscribeCostUsd(episode.duration)
    : null;

  return (
    <Section
      title="文字起こし"
      hideTitle={hideTitle}
      action={
        transcript?.source && (
          <div className="flex items-center gap-1.5">
            {transcript.usage && transcript.usage.costUsd > 0 && (
              <span
                className="text-[10px] tabular-nums text-muted-foreground"
                title={`実コスト見積 ${formatUsd(transcript.usage.costUsd)} (in: ${transcript.usage.inputTokens.toLocaleString()} / out: ${transcript.usage.outputTokens.toLocaleString()} tokens)`}
              >
                {formatUsd(transcript.usage.costUsd)}
              </span>
            )}
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-wider"
            >
              {transcript.source === "rss" ? "RSS" : "AI"}
            </Badge>
          </div>
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
              {minutes && estCostUsd
                ? `(約${minutes}分・推定${formatUsd(estCostUsd)})`
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
          <p className="text-xs text-muted-foreground">
            画面を閉じても処理は続きます。完了後に開けば結果が反映されます。
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
            <ol className="space-y-1">
              {transcript.segments.map((s, i) => {
                const active =
                  currentId === episode.id &&
                  s.start <= position &&
                  position < (s.end ?? s.start + 60);
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => jump(s.start)}
                      className={cn(
                        "w-full flex gap-3 items-start text-left -mx-2 px-2 py-1.5 rounded transition-colors",
                        active
                          ? "bg-primary/5"
                          : "hover:bg-muted/50",
                      )}
                      aria-label={`${formatTimestamp(s.start)} から再生`}
                    >
                      <span
                        className={cn(
                          "text-xs font-mono tabular-nums shrink-0 mt-0.5 w-14",
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {formatTimestamp(s.start)}
                      </span>
                      <span className="flex-1 text-sm leading-relaxed">
                        {s.speaker && (
                          <span className="text-xs font-semibold text-muted-foreground mr-2">
                            {s.speaker}
                          </span>
                        )}
                        <span className={active ? "font-medium" : ""}>
                          {s.text}
                        </span>
                      </span>
                    </button>
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
