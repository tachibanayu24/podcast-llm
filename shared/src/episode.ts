export type ArtifactStatus = "none" | "pending" | "done" | "failed";

export type ChapterSource =
  | "psc" // Podlove Simple Chapters (RSS XML embedded)
  | "podcast20" // <podcast:chapters> JSON URL
  | "shownotes" // extracted from description timestamps
  | "gemini"; // generated

export type TranscriptSource =
  | "rss" // <podcast:transcript> URL
  | "gemini"; // generated

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
  text: string; // plain text body (HTML stripped)
  links: { url: string; title: string }[];
}

export interface TranscriptSourceRef {
  url: string;
  type: string; // text/vtt | application/json | application/x-subrip | text/html | text/plain
  language?: string;
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

  // Chapters (any source)
  chapters?: Chapter[];
  chaptersSource?: ChapterSource;
  chaptersUrl?: string; // <podcast:chapters> reference

  // Transcript metadata (text stored in subcollection)
  transcriptSources?: TranscriptSourceRef[]; // from RSS
  transcript?: ArtifactMeta & { source?: TranscriptSource };

  // Summary
  summary?: ArtifactMeta;

  // Show notes (parsed from description HTML)
  showNotes?: ShowNotes;

  // Gemini ingest staging
  gcsUri?: string;
  gcsExpiresAt?: number;
}

