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

export type ChapterSource = "psc" | "podcast20" | "shownotes" | "gemini";
export type TranscriptSource = "rss" | "gemini";

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
  end?: number;
  title: string;
}

export interface ShowNotes {
  text: string;
  links: { url: string; title: string }[];
}

export interface TranscriptSourceRef {
  url: string;
  type: string;
  language?: string;
}

export interface TranscriptSegment {
  start: number;
  end?: number;
  speaker?: string;
  text: string;
}

export interface TranscriptDoc {
  episodeId: string;
  source: TranscriptSource;
  language?: string;
  text: string;
  segments?: TranscriptSegment[];
  generatedAt: number;
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

  chapters?: Chapter[];
  chaptersSource?: ChapterSource;
  chaptersUrl?: string;

  transcriptSources?: TranscriptSourceRef[];
  transcript?: ArtifactMeta & { source?: TranscriptSource };

  summary?: ArtifactMeta;

  showNotes?: ShowNotes;

  gcsUri?: string;
  gcsExpiresAt?: number;
}
