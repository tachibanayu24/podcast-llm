import { XMLParser } from "fast-xml-parser";
import type {
  Chapter,
  ChapterSource,
  Episode,
  Podcast,
  ShowNotes,
  TranscriptSourceRef,
} from "./types.js";

interface RawEnclosure {
  "@_url"?: string;
  "@_length"?: string;
  "@_type"?: string;
}

interface RawPscChapter {
  "@_start"?: string;
  "@_title"?: string;
  "@_href"?: string;
  "@_image"?: string;
}

interface RawPscChapters {
  "@_version"?: string;
  "psc:chapter"?: RawPscChapter | RawPscChapter[];
}

interface RawPodcastUrlRef {
  "@_url"?: string;
  "@_type"?: string;
  "@_language"?: string;
}

interface RawItem {
  guid?: string | { "#text": string; "@_isPermaLink"?: string };
  title?: string;
  description?: string;
  pubDate?: string;
  enclosure?: RawEnclosure;
  "itunes:duration"?: string | number;
  "itunes:image"?: { "@_href"?: string };
  "itunes:summary"?: string;
  "psc:chapters"?: RawPscChapters;
  "podcast:transcript"?: RawPodcastUrlRef | RawPodcastUrlRef[];
  "podcast:chapters"?: RawPodcastUrlRef;
}

interface RawChannel {
  title?: string;
  description?: string;
  language?: string;
  "itunes:author"?: string;
  "itunes:image"?: { "@_href"?: string };
  image?: { url?: string };
  item?: RawItem | RawItem[];
}

interface RawFeed {
  rss?: { channel?: RawChannel };
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

type ParsedEpisode = Pick<
  Episode,
  | "id"
  | "title"
  | "description"
  | "audioUrl"
  | "duration"
  | "publishedAt"
  | "artwork"
  | "chapters"
  | "chaptersSource"
  | "chaptersUrl"
  | "transcriptSources"
  | "showNotes"
>;

export interface ParsedFeed {
  podcast: Pick<
    Podcast,
    "title" | "author" | "description" | "artwork" | "language"
  >;
  episodes: ParsedEpisode[];
}

export async function fetchAndParseFeed(
  feedUrl: string,
  podcastId: string,
): Promise<ParsedFeed> {
  const res = await fetch(feedUrl, {
    headers: { "User-Agent": "podcast-llm/0.1" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`feed fetch failed: ${res.status}`);
  const xml = await res.text();
  const data = parser.parse(xml) as RawFeed;
  const channel = data.rss?.channel;
  if (!channel) throw new Error("invalid feed: no channel");

  const items = Array.isArray(channel.item)
    ? channel.item
    : channel.item
      ? [channel.item]
      : [];

  const podcastArtwork =
    channel["itunes:image"]?.["@_href"] ?? channel.image?.url;

  return {
    podcast: {
      title: channel.title ?? "(untitled)",
      ...(channel["itunes:author"] ? { author: channel["itunes:author"] } : {}),
      ...(channel.description ? { description: channel.description } : {}),
      ...(podcastArtwork ? { artwork: podcastArtwork } : {}),
      ...(channel.language ? { language: channel.language } : {}),
    },
    episodes: items.map((item) => normalizeItem(item, podcastId, podcastArtwork)),
  };
}

function normalizeItem(
  item: RawItem,
  podcastId: string,
  fallbackArtwork: string | undefined,
): ParsedEpisode {
  const guidText =
    typeof item.guid === "string" ? item.guid : item.guid?.["#text"];
  const guid = guidText ?? item.enclosure?.["@_url"] ?? item.title ?? "";
  const id = `${podcastId}__${hashString(guid)}`;

  const itemArtwork = item["itunes:image"]?.["@_href"];
  const description = item.description ?? item["itunes:summary"];

  // Chapters: prefer psc:chapters (XML embedded) > podcast:chapters URL > shownotes timestamps
  const pscChapters = parsePscChapters(item["psc:chapters"]);
  const podcastChaptersUrl = item["podcast:chapters"]?.["@_url"];

  let chapters: Chapter[] | undefined;
  let chaptersSource: ChapterSource | undefined;
  if (pscChapters && pscChapters.length > 0) {
    chapters = pscChapters;
    chaptersSource = "psc";
  } else if (description) {
    const fromNotes = extractChaptersFromShowNotes(description);
    if (fromNotes.length > 0) {
      chapters = fromNotes;
      chaptersSource = "shownotes";
    }
  }

  // Transcript URLs (may have multiple formats)
  const transcripts = item["podcast:transcript"];
  const transcriptList = Array.isArray(transcripts)
    ? transcripts
    : transcripts
      ? [transcripts]
      : [];
  const transcriptSources: TranscriptSourceRef[] = transcriptList
    .filter((t): t is RawPodcastUrlRef => !!t["@_url"])
    .map((t) => ({
      url: t["@_url"]!,
      type: t["@_type"] ?? "text/plain",
      ...(t["@_language"] ? { language: t["@_language"] } : {}),
    }));

  // Show notes (text + links from description)
  const showNotes = description ? parseShowNotes(description) : undefined;

  return {
    id,
    title: item.title ?? "(untitled)",
    ...(description ? { description } : {}),
    audioUrl: item.enclosure?.["@_url"] ?? "",
    ...(item["itunes:duration"]
      ? { duration: parseDuration(item["itunes:duration"]) }
      : {}),
    publishedAt: item.pubDate ? Date.parse(item.pubDate) : 0,
    ...(itemArtwork || fallbackArtwork
      ? { artwork: itemArtwork ?? fallbackArtwork }
      : {}),
    ...(chapters ? { chapters, chaptersSource } : {}),
    ...(podcastChaptersUrl ? { chaptersUrl: podcastChaptersUrl } : {}),
    ...(transcriptSources.length > 0 ? { transcriptSources } : {}),
    ...(showNotes ? { showNotes } : {}),
  };
}

function parsePscChapters(
  raw: RawPscChapters | undefined,
): Chapter[] | undefined {
  if (!raw) return undefined;
  const list = raw["psc:chapter"];
  const items = Array.isArray(list) ? list : list ? [list] : [];
  const chapters: Chapter[] = [];
  for (const c of items) {
    const start = parseTimestamp(c["@_start"]);
    const title = c["@_title"];
    if (start === null || !title) continue;
    chapters.push({ start, title });
  }
  // fill end as next chapter's start
  for (let i = 0; i < chapters.length - 1; i++) {
    chapters[i]!.end = chapters[i + 1]!.start;
  }
  return chapters;
}

// Match common timestamp prefixes in show notes:
//   "00:00 オープニング", "1:23:45 - チャプター", "(0:34) 話題", "[12:34] foo"
const TIMESTAMP_RE = /^[\s\-\(\[　【「]*(\d{1,2}):(\d{2})(?::(\d{2}))?[\s\-\)\]　】」、:]*\s*(.+?)\s*$/;

function extractChaptersFromShowNotes(html: string): Chapter[] {
  const text = stripHtml(html);
  const lines = text.split(/\r?\n/);
  const chapters: Chapter[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = TIMESTAMP_RE.exec(trimmed);
    if (!m) continue;
    const h = m[3] ? Number(m[1]) : 0;
    const min = m[3] ? Number(m[2]) : Number(m[1]);
    const sec = m[3] ? Number(m[3]) : Number(m[2]);
    const start = h * 3600 + min * 60 + sec;
    const title = m[4]!.replace(/^[-:\s]+/, "").trim();
    if (!title || title.length > 140) continue;
    chapters.push({ start, title });
  }
  // Need at least 2 to be useful; otherwise it's probably a noise match
  if (chapters.length < 2) return [];
  for (let i = 0; i < chapters.length - 1; i++) {
    chapters[i]!.end = chapters[i + 1]!.start;
  }
  return chapters;
}

function parseShowNotes(html: string): ShowNotes {
  const text = stripHtml(html).trim();
  const links = extractLinks(html);
  return { text, html, links };
}

const A_TAG_RE = /<a\b[^>]*\bhref=(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;

function extractLinks(html: string): { url: string; title: string }[] {
  const out: { url: string; title: string }[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = A_TAG_RE.exec(html)) !== null) {
    const url = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    const inner = m[4] ?? "";
    const title = stripHtml(inner).replace(/\s+/g, " ").trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, title: title || url });
  }
  return out;
}

function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<\/?(p|div|li|br|h[1-6])\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function parseTimestamp(s: string | undefined): number | null {
  if (!s) return null;
  const parts = s.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 1) return parts[0]!;
  return null;
}

function parseDuration(d: string | number): number {
  if (typeof d === "number") return d;
  const parts = d.split(":").map(Number);
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  return Number(d) || 0;
}

function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
