import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ChaptersSection } from "@/components/episode/ChaptersSection";
import { ChatSection } from "@/components/episode/ChatSection";
import { Hero } from "@/components/episode/Hero";
import { ShowNotesSection } from "@/components/episode/ShowNotesSection";
import { SummarySection } from "@/components/episode/SummarySection";
import { TranscriptSection } from "@/components/episode/TranscriptSection";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEpisodeRealtime } from "@/hooks/useEpisodeRealtime";
import { getEpisode, getSummary, getTranscript } from "@/lib/episodes";
import { getEpisodeContextFn } from "@/lib/functions";
import { getPodcast } from "@/lib/podcasts";

export function EpisodeDetailPage() {
  const { id } = useParams({ from: "/_app/episode/$id" });
  const queryClient = useQueryClient();

  // Firestore のエピソード doc をリアルタイム購読し、サーバ側の status 変化
  // (transcript/summary の生成完了など)を即時 UI に反映する。
  useEpisodeRealtime(id);

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
  const podcast = podcastQuery.data ?? null;
  const transcript = transcriptQuery.data ?? null;
  const summary = summaryQuery.data ?? null;

  const hasChapters = !!episode?.chapters && episode.chapters.length > 0;
  const hasNotes = !!episode?.showNotes || !!episode?.description;
  const hasChat = !!summary;

  const tabs = useMemo(
    () =>
      [
        { value: "summary", label: "要約", visible: true },
        { value: "transcript", label: "文字起こし", visible: true },
        { value: "chapters", label: "チャプター", visible: hasChapters },
        { value: "notes", label: "概要", visible: hasNotes },
        { value: "chat", label: "AIに質問", visible: hasChat },
      ].filter((t) => t.visible),
    [hasChapters, hasNotes, hasChat],
  );

  const [active, setActive] = useState<string>(() => tabs[0]?.value ?? "summary");
  // タブ可視性が変わったとき、現在の active が消えたら先頭にフォールバック。
  useEffect(() => {
    if (!tabs.some((t) => t.value === active)) {
      setActive(tabs[0]?.value ?? "summary");
    }
  }, [tabs, active]);

  if (episodeQuery.isLoading) return <DetailSkeleton />;
  if (!episode) {
    return (
      <div className="space-y-3">
        <BackLink podcastId={null} />
        <p className="text-sm text-muted-foreground">エピソードが見つかりません。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink podcastId={episode.podcastId} />

      <Hero episode={episode} podcast={podcast} />

      <Tabs value={active} onValueChange={setActive}>
        <TabsList className="overflow-x-auto max-w-full justify-start no-scrollbar">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="summary">
          <SummarySection episodeId={id} episode={episode} hideTitle />
        </TabsContent>

        <TabsContent value="transcript">
          <TranscriptSection
            episodeId={id}
            episode={episode}
            transcript={transcript}
            loading={contextMutation.isPending && !transcript}
            hideTitle
          />
        </TabsContent>

        {hasChapters && (
          <TabsContent value="chapters">
            <ChaptersSection
              chapters={episode.chapters!}
              episode={episode}
              source={episode.chaptersSource}
              hideTitle
            />
          </TabsContent>
        )}

        {hasNotes && (
          <TabsContent value="notes">
            <ShowNotesSection episode={episode} hideTitle />
          </TabsContent>
        )}

        {hasChat && (
          <TabsContent value="chat">
            <ChatSection episodeId={id} episode={episode} hideTitle />
          </TabsContent>
        )}
      </Tabs>
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
