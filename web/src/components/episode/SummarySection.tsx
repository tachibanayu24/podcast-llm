import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Languages, Loader2, Sparkles, StickyNote } from "lucide-react";
import { useState } from "react";
import type { Episode } from "@podcast-llm/shared";
import { Section } from "@/components/episode/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSummary, getTranslation } from "@/lib/episodes";
import { friendlyError } from "@/lib/errors";
import { summarizeEpisodeFn, translateSummaryFn } from "@/lib/functions";

interface Props {
  episodeId: string;
  episode: Episode;
}

export function SummarySection({ episodeId, episode }: Props) {
  const queryClient = useQueryClient();
  const summaryQuery = useQuery({
    queryKey: ["summary", episodeId],
    queryFn: () => getSummary(episodeId),
  });

  const generate = useMutation({
    mutationFn: () =>
      summarizeEpisodeFn({ episodeId }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["summary", episodeId] });
      queryClient.invalidateQueries({ queryKey: ["episode", episodeId] });
    },
  });

  const [showJa, setShowJa] = useState(false);
  const translation = useQuery({
    queryKey: ["translation", episodeId, "summary", "ja"],
    queryFn: () => getTranslation(episodeId, "summary", "ja"),
    enabled: showJa,
  });
  const translateMutation = useMutation({
    mutationFn: () =>
      translateSummaryFn({
        episodeId,
        kind: "summary",
        targetLanguage: "ja",
      }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["translation", episodeId, "summary", "ja"],
      });
    },
  });

  const summary = summaryQuery.data;
  const isJapanese =
    !episode.summary?.language || episode.summary.language === "ja";

  if (summaryQuery.isLoading) {
    return (
      <Section title="要約" icon={<StickyNote className="size-5" />}>
        <Skeleton className="h-24 w-full" />
      </Section>
    );
  }

  return (
    <Section
      title="要約"
      icon={<StickyNote className="size-5" />}
      action={
        summary && (
          <div className="flex items-center gap-2">
            {!isJapanese && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowJa((v) => !v);
                  if (!translation.data && !showJa) translateMutation.mutate();
                }}
                disabled={translateMutation.isPending}
                className="gap-1.5 h-8"
              >
                {translateMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Languages className="size-3.5" />
                )}
                {translateMutation.isPending
                  ? "翻訳中"
                  : showJa
                    ? "原文"
                    : "日本語"}
              </Button>
            )}
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-wider"
            >
              {summary.contextTier === "transcript"
                ? "詳細"
                : summary.contextTier === "shownotes"
                  ? "概要"
                  : "簡易"}
            </Badge>
          </div>
        )
      }
    >
      {!summary && (
        <Card className="p-6 text-center space-y-3">
          <Sparkles className="size-6 text-muted-foreground mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-medium">要約を生成</p>
            <p className="text-xs text-muted-foreground">
              文字起こし・チャプター・Show Notesから要約とポイントを生成します。
            </p>
          </div>
          <Button
            variant="gradient"
            size="sm"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? "生成中…" : "AIで要約を生成"}
          </Button>
          {generate.isError && (
            <p className="text-xs text-destructive">
              {friendlyError(generate.error)}
            </p>
          )}
        </Card>
      )}

      {summary && (
        <Card className="p-5 space-y-4">
          {showJa && translation.data ? (
            <div className="text-sm leading-relaxed whitespace-pre-line">
              {translation.data.text}
            </div>
          ) : (
            <>
              <p className="text-base font-medium leading-relaxed">
                {summary.tldr}
              </p>
              <div className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
                {summary.body}
              </div>
              {summary.keyPoints.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    重要ポイント
                  </h3>
                  <ul className="space-y-1.5">
                    {summary.keyPoints.map((p, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span className="flex-1">{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </Section>
  );
}
