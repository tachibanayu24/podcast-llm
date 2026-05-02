import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import {
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  Download,
  Languages,
  ListMusic,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Send,
  Sparkles,
  StickyNote,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Chapter, Episode, TranscriptDoc } from "@podcast-llm/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SanitizedHtml } from "@/components/SanitizedHtml";
import { useEpisodeChat } from "@/hooks/useEpisodeChat";
import { useEpisodeDownload } from "@/hooks/useEpisodeDownload";
import { useWatchlistToggle } from "@/hooks/useWatchlistToggle";
import {
  getEpisode,
  getSummary,
  getTranscript,
  getTranslation,
} from "@/lib/episodes";
import { formatDate, formatDuration, formatTimestamp } from "@/lib/format";
import {
  getEpisodeContextFn,
  summarizeEpisodeFn,
  transcribeEpisodeFn,
  translateSummaryFn,
} from "@/lib/functions";
import { getPodcast } from "@/lib/podcasts";
import { usePlayerStore } from "@/lib/player-store";
import { cn } from "@/lib/utils";

export function EpisodeDetailPage() {
  const { id } = useParams({ from: "/_app/episode/$id" });
  const queryClient = useQueryClient();

  const episodeQuery = useQuery({
    queryKey: ["episode", id],
    queryFn: () => getEpisode(id),
  });

  const podcastId = episodeQuery.data?.podcastId;
  const podcastQuery = useQuery({
    queryKey: ["podcast", podcastId],
    queryFn: () => getPodcast(podcastId!),
    enabled: !!podcastId,
  });

  const transcriptQuery = useQuery({
    queryKey: ["transcript", id],
    queryFn: () => getTranscript(id),
  });

  const summaryQuery = useQuery({
    queryKey: ["summary", id],
    queryFn: () => getSummary(id),
  });

  const contextMutation = useMutation({
    mutationFn: () => getEpisodeContextFn({ episodeId: id }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["episode", id] });
      queryClient.invalidateQueries({ queryKey: ["transcript", id] });
    },
  });

  useEffect(() => {
    const ep = episodeQuery.data;
    if (!ep) return;
    const needChapters =
      !!ep.chaptersUrl && (!ep.chapters || ep.chapters.length === 0);
    const needTranscript =
      !!ep.transcriptSources?.length && ep.transcript?.status !== "done";
    if (needChapters || needTranscript) {
      contextMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeQuery.data?.id]);

  const episode = episodeQuery.data;

  if (episodeQuery.isLoading) return <DetailSkeleton />;
  if (!episode) {
    return (
      <div className="space-y-3">
        <BackLink podcastId={null} />
        <p className="text-sm text-muted-foreground">エピソードが見つかりません。</p>
      </div>
    );
  }

  const podcast = podcastQuery.data ?? null;
  const transcript = transcriptQuery.data ?? null;
  const summary = summaryQuery.data ?? null;

  return (
    <div className="space-y-8">
      <BackLink podcastId={episode.podcastId} />

      <Hero episode={episode} podcast={podcast} />

      <SummarySection episodeId={id} episode={episode} />

      {episode.chapters && episode.chapters.length > 0 && (
        <ChaptersSection
          chapters={episode.chapters}
          episode={episode}
          source={episode.chaptersSource}
        />
      )}

      <ShowNotesSection episode={episode} />

      <TranscriptSection
        episodeId={id}
        episode={episode}
        transcript={transcript}
        loading={contextMutation.isPending && !transcript}
      />

      {summary && <ChatSection episodeId={id} episode={episode} />}
    </div>
  );
}

function BackLink({ podcastId }: { podcastId: string | null }) {
  if (podcastId) {
    return (
      <Link
        to="/podcast/$id"
        params={{ id: podcastId }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="size-4" />
        ポッドキャストに戻る
      </Link>
    );
  }
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ChevronLeft className="size-4" />
      ライブラリに戻る
    </Link>
  );
}

function Hero({
  episode,
  podcast,
}: {
  episode: Episode;
  podcast: { id: string; title: string; artwork?: string } | null;
}) {
  const load = usePlayerStore((s) => s.load);
  const toggle = usePlayerStore((s) => s.toggle);
  const currentId = usePlayerStore((s) => s.episode?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const isCurrent = currentId === episode.id;
  const showPause = isCurrent && isPlaying;

  const watchlistMutation = useWatchlistToggle(episode);
  const dl = useEpisodeDownload(episode.id, episode.audioUrl);

  function handlePlay() {
    if (isCurrent) toggle();
    else load(episode, { podcastTitle: podcast?.title });
  }

  const dlPercent =
    dl.progress && dl.progress.total > 0
      ? Math.round((dl.progress.loaded / dl.progress.total) * 100)
      : null;

  return (
    <header className="relative -mx-4 sm:-mx-6 -mt-6 sm:-mt-8 px-4 sm:px-6 pt-8 pb-2 overflow-hidden">
      {episode.artwork && (
        <>
          <img
            src={episode.artwork}
            alt=""
            className="absolute inset-0 size-full object-cover -z-10 opacity-25 blur-2xl scale-110"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </>
      )}

      <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">
        {episode.artwork && (
          <img
            src={episode.artwork}
            alt=""
            className="size-32 sm:size-40 rounded-2xl ring-1 ring-border shadow-2xl shadow-black/50 shrink-0 object-cover"
          />
        )}
        <div className="flex-1 min-w-0 space-y-3 self-end">
          {podcast && (
            <Link
              to="/podcast/$id"
              params={{ id: podcast.id }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-block"
            >
              {podcast.title}
            </Link>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-[1.15]">
            {episode.title}
          </h1>
          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>{formatDate(episode.publishedAt)}</span>
            {episode.duration ? (
              <>
                <span className="opacity-50">·</span>
                <span>{formatDuration(episode.duration)}</span>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="gradient"
              size="lg"
              onClick={handlePlay}
              className="rounded-full px-6 gap-2"
            >
              {showPause ? (
                <>
                  <Pause className="size-4" />
                  一時停止
                </>
              ) : (
                <>
                  <Play className="size-4 fill-current" />
                  再生
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                watchlistMutation.mutate(!episode.isInWatchlist)
              }
              disabled={watchlistMutation.isPending}
              aria-label={
                episode.isInWatchlist ? "あとで聴くから外す" : "あとで聴く"
              }
              aria-pressed={episode.isInWatchlist}
              className="size-11"
            >
              <Bookmark
                className={cn(
                  "size-5 transition-colors",
                  episode.isInWatchlist
                    ? "fill-primary text-primary"
                    : "text-muted-foreground",
                )}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (dl.isDownloading) dl.cancel();
                else if (dl.isDownloaded) dl.remove();
                else dl.download();
              }}
              aria-label={
                dl.isDownloaded
                  ? "オフラインから削除"
                  : dl.isDownloading
                    ? "ダウンロード中止"
                    : "オフライン保存"
              }
              className="size-11"
            >
              {dl.isDownloading ? (
                <X className="size-5 text-muted-foreground" />
              ) : dl.isDownloaded ? (
                <CheckCircle2 className="size-5 text-primary fill-primary/20" />
              ) : (
                <Download className="size-5 text-muted-foreground" />
              )}
            </Button>
          </div>
          {(dl.isDownloading || dl.error) && (
            <div className="text-xs">
              {dl.isDownloading && (
                <span className="text-muted-foreground inline-flex items-center gap-2">
                  <Loader2 className="size-3 animate-spin" />
                  ダウンロード中
                  {dlPercent != null ? ` ${dlPercent}%` : "…"}
                </span>
              )}
              {dl.error && (
                <span className="text-destructive">
                  失敗: {dl.error.message}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function SummarySection({
  episodeId,
  episode,
}: {
  episodeId: string;
  episode: Episode;
}) {
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
                <Languages className="size-3.5" />
                {showJa ? "原文" : "日本語"}
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
              {(generate.error as Error).message}
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

function ChaptersSection({
  chapters,
  episode,
  source,
}: {
  chapters: Chapter[];
  episode: Episode;
  source?: Episode["chaptersSource"];
}) {
  const seek = usePlayerStore((s) => s.seek);
  const loadAndSeek = usePlayerStore((s) => s.loadAndSeek);
  const currentId = usePlayerStore((s) => s.episode?.id);
  const position = usePlayerStore((s) => s.position);

  function handleClick(start: number) {
    if (currentId === episode.id) {
      seek(start);
    } else {
      loadAndSeek(episode, start);
    }
  }

  const activeIndex = chapters.findIndex(
    (c, i) =>
      c.start <= position &&
      position < (c.end ?? chapters[i + 1]?.start ?? Infinity),
  );

  return (
    <Section
      title="チャプター"
      icon={<ListMusic className="size-5" />}
      action={source && <ChapterSourceBadge source={source} />}
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

function ShowNotesSection({ episode }: { episode: Episode }) {
  if (!episode.showNotes && !episode.description) return null;
  const html = episode.showNotes?.html ?? episode.description ?? "";
  const text = episode.showNotes?.text ?? "";
  const hasHtml = /<[a-z][\s\S]*>/i.test(html);

  return (
    <Section title="エピソードについて">
      <Card className="p-5">
        {hasHtml ? (
          <SanitizedHtml html={html} className="prose-podcast" />
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
            {text || html}
          </p>
        )}
      </Card>
    </Section>
  );
}

function TranscriptSection({
  episodeId,
  episode,
  transcript,
  loading,
}: {
  episodeId: string;
  episode: Episode;
  transcript: TranscriptDoc | null;
  loading: boolean;
}) {
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
  const estCostJpy = minutes ? Math.round(minutes * 4) : null; // ~4円/分 目安

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
                ? `（約${minutes}分・推定${estCostJpy}円）`
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
              {(generate.error as Error).message}
            </p>
          )}
        </Card>
      )}

      {!loading && episode.transcript?.status === "pending" && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          生成中です。1〜数分かかります…
        </Card>
      )}

      {!loading && transcript && transcript.segments && transcript.segments.length > 0 && (
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
                    <span className={active ? "font-medium" : ""}>{s.text}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {!loading && transcript && (!transcript.segments || transcript.segments.length === 0) && (
        <Card className="p-5">
          <p className="text-sm leading-relaxed whitespace-pre-line">
            {transcript.text}
          </p>
        </Card>
      )}
    </Section>
  );
}

function ChatSection({
  episodeId,
  episode,
}: {
  episodeId: string;
  episode: Episode;
}) {
  const { messages, send, isStreaming, error } = useEpisodeChat(episodeId);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input;
    setInput("");
    await send(text);
  }

  const placeholder = `「${episode.title}」について質問してみる…`;

  return (
    <Section title="QA チャット" icon={<MessageSquare className="size-5" />}>
      <Card className="overflow-hidden">
        {messages.length === 0 ? (
          <div className="px-5 py-8 text-center space-y-2 text-sm text-muted-foreground">
            <Sparkles className="size-5 text-primary mx-auto" />
            <p>このエピソードの内容について何でも聞いてください。</p>
            <p className="text-xs">
              要約・チャプター・Show Notes
              {episode.transcript?.status === "done" ? "・文字起こし" : ""}
              を踏まえてお答えします。
            </p>
          </div>
        ) : (
          <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm max-w-[85%] whitespace-pre-line leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {m.content || (isStreaming && m.role === "assistant" ? "…" : "")}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="px-5 py-2 text-xs text-destructive border-t border-border">
            {error}
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className="border-t border-border p-2 flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={isStreaming}
            className="flex-1 bg-transparent text-sm px-3 py-2 outline-none placeholder:text-muted-foreground"
          />
          <Button
            type="submit"
            variant="gradient"
            size="icon"
            disabled={isStreaming || !input.trim()}
            aria-label="送信"
          >
            <Send className="size-4" />
          </Button>
        </form>
      </Card>
    </Section>
  );
}

function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-4 w-32" />
      <div className="flex flex-col sm:flex-row gap-5">
        <Skeleton className="size-32 sm:size-40 rounded-2xl shrink-0" />
        <div className="space-y-3 flex-1 self-end">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-10 w-32 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
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
