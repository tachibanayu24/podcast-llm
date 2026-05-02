export interface SummaryDoc {
  episodeId: string;
  tldr: string;
  body: string;
  keyPoints: string[];
  generatedChapters?: { start: number; title: string }[];
  language: string;
  model: string;
  contextTier: "transcript" | "shownotes" | "minimal";
  generatedAt: number;
}

export interface TranslationDoc {
  episodeId: string;
  kind: "summary" | "transcript";
  targetLanguage: string;
  text: string;
  segments?: { start: number; text: string }[];
  model: string;
  generatedAt: number;
}
