import { generateObject } from "ai";
import { z } from "zod";
import { getVertexGlobal, MODELS } from "./ai.js";
import type { Episode, Podcast } from "./types.js";

const schema = z.object({
  mapping: z
    .array(
      z.object({
        speakerLabel: z
          .string()
          .describe("Chirp が出した話者ラベル(1, 2, ...)"),
        name: z
          .string()
          .describe("実名 (例: 橘, 田中). 判別不能なら空文字列"),
      }),
    )
    .describe("speakerLabel → 実名 のマッピング"),
});

interface SpeakerMappingInput {
  segments: { speakerLabel: string; text: string }[];
  episode: Episode;
  podcast: Podcast | null;
}

/**
 * Chirp が返した数字ラベル (1, 2, ...) を、番組メタや冒頭の自己紹介から
 * 実名にマップする。Flash-Lite で 1 回叩くだけなので非常に安価 (≪ $0.001 / 55min)。
 */
export async function mapSpeakerNames({
  segments,
  episode,
  podcast,
}: SpeakerMappingInput): Promise<{
  mapping: Record<string, string>;
  usage: { inputTokens?: number; outputTokens?: number } | undefined;
}> {
  // 自己紹介は冒頭にあることが多いので 50 segments (≒ 数分) サンプル。
  const sample = segments.slice(0, 50);
  // 全体のラベル種別も渡す (冒頭に登場しないゲスト用)。
  const allLabels = Array.from(new Set(segments.map((s) => s.speakerLabel)));

  const hints: string[] = [];
  if (podcast?.title) hints.push(`番組名: ${podcast.title}`);
  if (podcast?.author) hints.push(`番組オーナー: ${podcast.author}`);
  if (podcast?.description) {
    hints.push(`番組概要:\n${podcast.description.slice(0, 1500)}`);
  }
  if (episode.title) hints.push(`エピソード: ${episode.title}`);
  if (episode.description) {
    hints.push(`エピソード説明:\n${episode.description.slice(0, 1000)}`);
  }
  if (episode.showNotes?.text) {
    hints.push(`Show Notes:\n${episode.showNotes.text.slice(0, 1500)}`);
  }
  if (episode.showNotes?.links?.length) {
    const links = episode.showNotes.links
      .slice(0, 15)
      .map((l) => `- ${l.title} (${l.url})`)
      .join("\n");
    hints.push(`Show Notes 内リンク:\n${links}`);
  }

  const prompt = [
    "ポッドキャスト音声の文字起こし(話者ラベルは ID 番号)に対し、ラベルを **実名に対応付け** してください。",
    "",
    "# ルール",
    "- 番組情報・自己紹介・呼びかけから話者名を推定する",
    "- 確証が無いラベルは name を空文字列のままにする(推測で捏造しない)",
    `- mapping には全てのラベル(${allLabels.join(", ")})を必ず含める`,
    "- 同一話者が複数ラベルに跨っているように見える場合は、最も自然な名前を両方に付ける",
    "",
    "# 番組情報",
    hints.length > 0 ? hints.join("\n\n") : "(なし)",
    "",
    "# 文字起こし冒頭サンプル",
    sample
      .map((s) => `Speaker ${s.speakerLabel}: ${s.text}`)
      .join("\n"),
  ].join("\n");

  const vertex = getVertexGlobal();
  const { object, usage } = await generateObject({
    model: vertex(MODELS.lite),
    schema,
    prompt,
    temperature: 0.0,
    maxOutputTokens: 1024,
    providerOptions: {
      vertex: { thinkingConfig: { thinkingBudget: 0 } },
    },
    maxRetries: 1,
  });

  const mapping: Record<string, string> = {};
  for (const m of object.mapping) {
    if (m.name && m.name.trim()) {
      mapping[m.speakerLabel] = m.name.trim();
    }
  }

  return { mapping, usage };
}
