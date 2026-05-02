import { XMLParser } from "fast-xml-parser";
import type { Episode, Podcast } from "./types.js";

interface RawEnclosure {
  "@_url"?: string;
  "@_length"?: string;
  "@_type"?: string;
}

interface RawItem {
  guid?: string | { "#text": string };
  title?: string;
  description?: string;
  pubDate?: string;
  enclosure?: RawEnclosure;
  "itunes:duration"?: string | number;
  "itunes:image"?: { "@_href"?: string };
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

export interface ParsedFeed {
  podcast: Pick<
    Podcast,
    "title" | "author" | "description" | "artwork" | "language"
  >;
  episodes: Pick<
    Episode,
    | "id"
    | "title"
    | "description"
    | "audioUrl"
    | "duration"
    | "publishedAt"
    | "artwork"
  >[];
}

export async function fetchAndParseFeed(
  feedUrl: string,
  podcastId: string,
): Promise<ParsedFeed> {
  const res = await fetch(feedUrl, {
    headers: { "User-Agent": "podcast-llm/0.1" },
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
): ParsedFeed["episodes"][number] {
  const guidText =
    typeof item.guid === "string" ? item.guid : item.guid?.["#text"];
  const guid = guidText ?? item.enclosure?.["@_url"] ?? item.title ?? "";
  const id = `${podcastId}__${hashString(guid)}`;

  const itemArtwork = item["itunes:image"]?.["@_href"];

  return {
    id,
    title: item.title ?? "(untitled)",
    ...(item.description ? { description: item.description } : {}),
    audioUrl: item.enclosure?.["@_url"] ?? "",
    ...(item["itunes:duration"]
      ? { duration: parseDuration(item["itunes:duration"]) }
      : {}),
    publishedAt: item.pubDate ? Date.parse(item.pubDate) : 0,
    ...(itemArtwork || fallbackArtwork
      ? { artwork: itemArtwork ?? fallbackArtwork }
      : {}),
  };
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
