import type { TranscriptSource } from "./episode.js";

export interface TranscriptSegment {
  start: number; // seconds
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
