export interface ChapterSummary {
  start: number;
  end: number;
  title: string;
  summary: string;
}

export interface Summary {
  overall: string;
  chapters: ChapterSummary[];
  language: string;
  model: string;
  generatedAt: number;
}

export interface Translation {
  language: string;
  summary: Summary;
  fullText?: string;
  model: string;
  generatedAt: number;
}
