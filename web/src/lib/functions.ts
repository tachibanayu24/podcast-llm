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

export const getEpisodeContextFn = httpsCallable<
  { episodeId: string },
  {
    hasChapters: boolean;
    hasTranscript: boolean;
    transcriptSource?: "rss" | "gemini";
  }
>(functions, "getEpisodeContext");
