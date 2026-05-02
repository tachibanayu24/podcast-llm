import type { TranscriptSegment } from "./types.js";

export interface ParsedTranscript {
  segments: TranscriptSegment[];
  text: string;
  language?: string;
}

export function parseTranscript(
  body: string,
  type: string,
): ParsedTranscript | null {
  const t = type.toLowerCase();
  if (t.includes("vtt")) return parseVtt(body);
  if (t.includes("subrip") || t.includes("srt")) return parseSrt(body);
  if (t.includes("json")) return parseJsonTranscript(body);
  if (t.includes("html")) return parseHtmlTranscript(body);
  if (t.includes("plain")) return parsePlainText(body);
  // fallback: try VTT then plain
  if (body.trim().startsWith("WEBVTT")) return parseVtt(body);
  return parsePlainText(body);
}

function parseVtt(body: string): ParsedTranscript {
  const lines = body.replace(/^WEBVTT.*$/m, "").split(/\r?\n/);
  const segments: TranscriptSegment[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const tm = /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})/.exec(
      line,
    );
    if (!tm) {
      i++;
      continue;
    }
    const start =
      Number(tm[1]) * 3600 + Number(tm[2]) * 60 + Number(tm[3]) + Number(tm[4]) / 1000;
    const end =
      Number(tm[5]) * 3600 + Number(tm[6]) * 60 + Number(tm[7]) + Number(tm[8]) / 1000;
    i++;
    const buf: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "") {
      buf.push(lines[i]!);
      i++;
    }
    let speaker: string | undefined;
    let text = buf.join(" ").trim();
    const sm = /^<v\s+([^>]+)>(.*)$/i.exec(text);
    if (sm) {
      speaker = sm[1]!.trim();
      text = sm[2]!.trim();
    }
    text = text.replace(/<[^>]+>/g, "").trim();
    if (text) {
      segments.push({ start, end, ...(speaker ? { speaker } : {}), text });
    }
  }
  return { segments, text: joinSegments(segments) };
}

function parseSrt(body: string): ParsedTranscript {
  const segments: TranscriptSegment[] = [];
  const blocks = body.split(/\r?\n\r?\n/);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter((l) => l.trim());
    const tmIdx = lines.findIndex((l) => /\d+:\d+:\d+,\d+\s+-->/.test(l));
    if (tmIdx < 0) continue;
    const tm = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2}),(\d{3})/.exec(
      lines[tmIdx]!,
    );
    if (!tm) continue;
    const start =
      Number(tm[1]) * 3600 + Number(tm[2]) * 60 + Number(tm[3]) + Number(tm[4]) / 1000;
    const end =
      Number(tm[5]) * 3600 + Number(tm[6]) * 60 + Number(tm[7]) + Number(tm[8]) / 1000;
    const text = lines.slice(tmIdx + 1).join(" ").replace(/<[^>]+>/g, "").trim();
    if (text) segments.push({ start, end, text });
  }
  return { segments, text: joinSegments(segments) };
}

interface JsonSegment {
  start?: number | string;
  startTime?: number | string;
  end?: number | string;
  endTime?: number | string;
  speaker?: string;
  text?: string;
  body?: string;
}

interface JsonTranscriptShape {
  segments?: JsonSegment[];
  results?: JsonSegment[];
  language?: string;
}

function parseJsonTranscript(body: string): ParsedTranscript | null {
  try {
    const data = JSON.parse(body) as JsonTranscriptShape;
    const list = data.segments ?? data.results ?? [];
    const segments: TranscriptSegment[] = list
      .map((s) => {
        const start = Number(s.start ?? s.startTime);
        const end = s.end ?? s.endTime;
        const text = (s.text ?? s.body ?? "").toString().trim();
        if (!text || Number.isNaN(start)) return null;
        return {
          start,
          ...(end != null && !Number.isNaN(Number(end)) ? { end: Number(end) } : {}),
          ...(s.speaker ? { speaker: s.speaker } : {}),
          text,
        };
      })
      .filter((x): x is TranscriptSegment => x !== null);
    return {
      segments,
      text: joinSegments(segments),
      ...(data.language ? { language: data.language } : {}),
    };
  } catch {
    return null;
  }
}

function parseHtmlTranscript(body: string): ParsedTranscript {
  const text = body
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?(p|div|li|br|h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { segments: [], text };
}

function parsePlainText(body: string): ParsedTranscript {
  return { segments: [], text: body.trim() };
}

function joinSegments(segments: TranscriptSegment[]): string {
  let lastSpeaker: string | undefined;
  const lines: string[] = [];
  for (const s of segments) {
    if (s.speaker && s.speaker !== lastSpeaker) {
      lines.push(`${s.speaker}: ${s.text}`);
      lastSpeaker = s.speaker;
    } else {
      lines.push(s.text);
    }
  }
  return lines.join("\n");
}
