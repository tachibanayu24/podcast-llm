import { httpsCallable } from "firebase/functions";
import type { SearchResult } from "@podcast-llm/shared";
import { functions } from "./firebase";

export const searchPodcastsFn = httpsCallable<
  { term: string },
  SearchResult[]
>(functions, "searchPodcasts");

export const subscribePodcastFn = httpsCallable<
  { result: SearchResult },
  { podcastId: string; episodeCount: number }
>(functions, "subscribePodcast");

export const refreshMyFeedsFn = httpsCallable<
  Record<string, never>,
  { ok: true; podcasts: number; newEpisodes: number; errors: number }
>(functions, "refreshMyFeeds");

export const unsubscribePodcastFn = httpsCallable<
  { podcastId: string },
  { ok: true; deletedEpisodes: number }
>(functions, "unsubscribePodcast");

export const getEpisodeContextFn = httpsCallable<
  { episodeId: string },
  {
    hasChapters: boolean;
    hasTranscript: boolean;
    transcriptSource?: "rss" | "gemini";
  }
>(functions, "getEpisodeContext");

// httpsCallable のクライアント側デフォルト timeout は 70 秒。
// LLM 系は server 側 timeoutSeconds に合わせて長めに上書きする。
export const summarizeEpisodeFn = httpsCallable<
  { episodeId: string; force?: boolean },
  { ok: true; tier: "transcript" | "shownotes" | "minimal" }
>(functions, "summarizeEpisode", { timeout: 300_000 });

export const transcribeEpisodeFn = httpsCallable<
  { episodeId: string; force?: boolean },
  { ok: true; segments: number }
>(functions, "transcribeEpisode", { timeout: 540_000 });

export const translateSummaryFn = httpsCallable<
  {
    episodeId: string;
    kind: "summary" | "transcript";
    targetLanguage?: string;
  },
  { ok: true }
>(functions, "translateSummary", { timeout: 300_000 });
