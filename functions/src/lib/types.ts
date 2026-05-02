export interface SearchResult {
  collectionId: number;
  title: string;
  author: string;
  artwork: string;
  feedUrl: string;
  genre?: string;
  language?: string;
}

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

export type ArtifactStatus = "none" | "pending" | "done" | "failed";

export interface PlaybackState {
  position: number;
  completed: boolean;
  lastPlayedAt?: number;
}

export interface ArtifactMeta {
  status: ArtifactStatus;
  language?: string;
  model?: string;
  generatedAt?: number;
  error?: string;
}

export interface Chapter {
  start: number;
  end: number;
  title: string;
}

export interface Episode {
  id: string;
  podcastId: string;
  title: string;
  description?: string;
  audioUrl: string;
  duration?: number;
  publishedAt: number;
  artwork?: string;

  isInWatchlist: boolean;
  watchlistedAt?: number;
  isDownloaded: boolean;
  downloadedAt?: number;

  playback: PlaybackState;

  transcript?: ArtifactMeta;
  summary?: ArtifactMeta;
  chapters?: Chapter[];

  gcsUri?: string;
  gcsExpiresAt?: number;
}
