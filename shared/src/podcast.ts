export interface Podcast {
  id: string;
  title: string;
  author?: string;
  description?: string;
  artwork?: string;
  feedUrl: string;
  language?: string;
  episodeCount?: number;
  lastFetchedAt: number;
  subscribedAt: number;
}
