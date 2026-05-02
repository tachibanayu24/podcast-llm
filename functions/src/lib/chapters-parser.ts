import type { Chapter } from "./types.js";

interface PodcastChaptersJson {
  version?: string;
  chapters?: {
    startTime?: number | string;
    endTime?: number | string;
    title?: string;
    img?: string;
    url?: string;
  }[];
}

export function parseChaptersJson(body: string): Chapter[] {
  let data: PodcastChaptersJson;
  try {
    data = JSON.parse(body);
  } catch {
    return [];
  }
  const list = data.chapters ?? [];
  const chapters: Chapter[] = [];
  for (const c of list) {
    const start = Number(c.startTime);
    if (Number.isNaN(start)) continue;
    const title = (c.title ?? "").toString().trim();
    if (!title) continue;
    const end = c.endTime != null ? Number(c.endTime) : undefined;
    chapters.push({
      start,
      ...(end != null && !Number.isNaN(end) ? { end } : {}),
      title,
    });
  }
  for (let i = 0; i < chapters.length - 1; i++) {
    if (chapters[i]!.end == null) {
      chapters[i]!.end = chapters[i + 1]!.start;
    }
  }
  return chapters;
}
