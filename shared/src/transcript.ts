export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface Transcript {
  text: string;
  segments: TranscriptSegment[];
  language: string;
  model: string;
  generatedAt: number;
}
