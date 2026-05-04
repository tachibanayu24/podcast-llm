import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Languages, Loader2, Sparkles, StickyNote } from "lucide-react";
import { useState } from "react";
import type { Episode } from "@podcast-llm/shared";
import { Section } from "@/components/episode/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { estimateTranscribeCostUsd, formatUsd } from "@/lib/cost";
import { getSummary, getTranslation } from "@/lib/episodes";
import { friendlyError } from "@/lib/errors";
import {
  summarizeEpisodeFn,
  transcribeEpisodeFn,
  translateSummaryFn,
} from "@/lib/functions";

interface Props {
  episodeId: string;
  episode: Episode;
  hideTitle?: boolean;
}

export function SummarySection({ episodeId, episode, hideTitle }: Props) {
  const queryClient = useQueryClient();
  const summaryQuery = useQuery({
    queryKey: ["summary", episodeId],
    queryFn: () => getSummary(episodeId),
  });

  const [phase, setPhase] = useState<"idle" | "transcribing" | "summarizing">(
    "idle",
  );

  // 文字起こしが無いと要約はハルシネーションが乗りやすいので、
  // 必要に応じて先に文字起こしを生成してから要約する一連フロー。
  const generate = useMutation({
    mutationFn: async () => {
      const needTranscript =
        episode.transcript?.status !== "done" && !!episode.audioUrl;
      if (needTranscript) {
        setPhase("transcribing");
        await transcribeEpisodeFn({ episodeId });
      }
      setPhase("summarizing");
      const r = await summarizeEpisodeFn({ episodeId });
      return r.data;
    },
    onSettled: () => {
      setPhase("idle");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["summary", episodeId] });
      queryClient.invalidateQueries({ queryKey: ["transcript", episodeId] });
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
      <Section
        title="要約"
        icon={<StickyNote className="size-5" />}
        hideTitle={hideTitle}
      >
        <Skeleton className="h-24 w-full" />
      </Section>
    );
  }

  return (
    <Section
      title="要約"
      icon={<StickyNote className="size-5" />}
      hideTitle={hideTitle}
      action={
        summary && (
          <div className="flex items-center gap-2">
            {(() => {
              const summaryCost = summary.usage?.costUsd ?? 0;
              const translationCost =
                showJa && translation.data?.usage?.costUsd
                  ? translation.data.usage.costUsd
                  : 0;
              const totalCost = summaryCost + translationCost;
              if (totalCost <= 0) return null;
              const inputTokens =
                (summary.usage?.inputTokens ?? 0) +
                (showJa ? translation.data?.usage?.inputTokens ?? 0 : 0);
              const outputTokens =
                (summary.usage?.outputTokens ?? 0) +
                (showJa ? translation.data?.usage?.outputTokens ?? 0 : 0);
              return (
                <span
                  className="text-[10px] tabular-nums text-muted-foreground"
                  title={`実コスト見積 ${formatUsd(totalCost)} (in: ${inputTokens.toLocaleString()} / out: ${outputTokens.toLocaleString()} tokens)`}
                >
                  {formatUsd(totalCost)}
                </span>
              );
            })()}
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
      {!summary && episode.summary?.status === "pending" && (
        <Card className="p-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            要約を生成中です…
          </p>
          <p className="text-xs text-muted-foreground">
            画面を閉じても処理は続きます。完了後に開けば結果が反映されます。
          </p>
        </Card>
      )}

      {!summary &&
        episode.summary?.status !== "pending" &&
        (() => {
          const hasTranscript = episode.transcript?.status === "done";
          const transcribing =
            phase === "transcribing" ||
            episode.transcript?.status === "pending";
          const summarizing = phase === "summarizing";
          const audioMins = episode.duration
            ? Math.round(episode.duration / 60)
            : null;
          const transcribeCost = episode.duration
            ? estimateTranscribeCostUsd(episode.duration, "gemini-2.5-flash")
            : 0;

          return (
            <Card className="p-6 text-center space-y-3">
              <Sparkles className="size-6 text-muted-foreground mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-medium">要約を生成</p>
                {hasTranscript ? (
                  <p className="text-xs text-muted-foreground">
                    文字起こし・チャプター・Show Notesから要約を生成します。
                  </p>
                ) : episode.audioUrl ? (
                  <p className="text-xs text-muted-foreground">
                    精度確保のため、まず文字起こしを生成してから要約します
                    {audioMins
                      ? `(約${audioMins}分・推定${formatUsd(transcribeCost)})`
                      : ""}
                    。
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    音声が無いため、Show Notes から要約します。
                  </p>
                )}
              </div>
              <Button
                variant="gradient"
                size="sm"
                onClick={() => generate.mutate()}
                disabled={generate.isPending}
              >
                {transcribing
                  ? "文字起こし中…"
                  : summarizing
                    ? "要約中…"
                    : hasTranscript || !episode.audioUrl
                      ? "AIで要約を生成"
                      : "文字起こし → 要約 を生成"}
              </Button>
              {(transcribing || summarizing) && (
                <p className="text-xs text-muted-foreground">
                  画面を閉じても処理は続きます。完了後に開けば結果が反映されます。
                </p>
              )}
              {generate.isError && (
                <p className="text-xs text-destructive">
                  {friendlyError(generate.error)}
                </p>
              )}
            </Card>
          );
        })()}

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
