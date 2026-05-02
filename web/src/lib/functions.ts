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

export const getEpisodeContextFn = httpsCallable<
  { episodeId: string },
  {
    hasChapters: boolean;
    hasTranscript: boolean;
    transcriptSource?: "rss" | "gemini";
  }
>(functions, "getEpisodeContext");

export const summarizeEpisodeFn = httpsCallable<
  { episodeId: string; force?: boolean },
  { ok: true; tier: "transcript" | "shownotes" | "minimal" }
>(functions, "summarizeEpisode");

export const transcribeEpisodeFn = httpsCallable<
  { episodeId: string; force?: boolean },
  { ok: true; segments: number }
>(functions, "transcribeEpisode");

export const translateSummaryFn = httpsCallable<
  {
    episodeId: string;
    kind: "summary" | "transcript";
    targetLanguage?: string;
  },
  { ok: true }
>(functions, "translateSummary");
