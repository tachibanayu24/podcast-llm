import { onCall } from "firebase-functions/v2/https";
import type { SearchResult } from "./lib/types.js";

export const searchPodcasts = onCall(
  { region: "asia-northeast1", maxInstances: 5, invoker: "public" },
  async (request): Promise<SearchResult[]> => {
    const term = request.data?.term?.trim();
    if (!term) return [];

    const url = new URL("https://itunes.apple.com/search");
    url.searchParams.set("term", term);
    url.searchParams.set("media", "podcast");
    url.searchParams.set("country", "JP");
    url.searchParams.set("limit", "30");

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`iTunes search failed: ${res.status}`);
    }
    const json = (await res.json()) as { results: ITunesPodcast[] };

    return json.results
      .filter((r) => r.feedUrl)
      .map((r) => ({
        collectionId: r.collectionId,
        title: r.collectionName,
        author: r.artistName,
        artwork: r.artworkUrl600 || r.artworkUrl100,
        feedUrl: r.feedUrl,
        genre: r.primaryGenreName,
        language: r.languageCodesISO2A?.[0],
      }));
  },
);

interface ITunesPodcast {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl100: string;
  artworkUrl600?: string;
  feedUrl: string;
  primaryGenreName?: string;
  languageCodesISO2A?: string[];
}
