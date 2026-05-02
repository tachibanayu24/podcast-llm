import { generateObject } from "ai";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { z } from "zod";
import { db } from "./lib/admin.js";
import { getVertex, MODELS } from "./lib/ai.js";
import type { Episode, SummaryDoc, TranscriptDoc } from "./lib/types.js";

const schema = z.object({
  tldr: z
    .string()
    .min(20)
    .max(400)
    .describe("最重要ポイントを100〜200文字程度で。"),
  body: z
    .string()
    .min(100)
    .describe(
      "詳細な要約。Markdownの段落区切りでOK。5〜8段落程度を目安に、固有名詞や具体的な事実を含める。",
    ),
  keyPoints: z
    .array(z.string().min(5).max(200))
    .min(3)
    .max(12)
    .describe("重要ポイントの箇条書き。具体的に。"),
  generatedChapters: z
    .array(
      z.object({
        start: z.number().int().min(0),
        title: z.string().min(2).max(80),
      }),
    )
    .optional()
    .describe(
      "既存チャプターが無い場合のみ、本文の自然な区切りでチャプターを推定。startは秒。",
    ),
});

export const summarizeEpisode = onCall<
  { episodeId: string; force?: boolean },
  Promise<{ ok: true; tier: SummaryDoc["contextTier"] }>
>(
  {
    region: "asia-northeast1",
    maxInstances: 3,
    timeoutSeconds: 300,
    memory: "512MiB",
    invoker: "public",
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "auth required");

    const { episodeId, force } = request.data;
    if (!episodeId) throw new HttpsError("invalid-argument", "episodeId required");

    const epRef = db.doc(`users/${uid}/episodes/${episodeId}`);
    const epSnap = await epRef.get();
    if (!epSnap.exists) throw new HttpsError("not-found", "episode not found");
    const ep = epSnap.data() as Episode;

    if (!force && ep.summary?.status === "done") {
      return { ok: true, tier: (ep as Episode & { _summaryTier?: SummaryDoc["contextTier"] })._summaryTier ?? "shownotes" };
    }

    const transcriptSnap = await db
      .doc(`users/${uid}/transcripts/${episodeId}`)
      .get();
    const transcript = transcriptSnap.exists
      ? (transcriptSnap.data() as TranscriptDoc)
      : null;

    const tier: SummaryDoc["contextTier"] = transcript
      ? "transcript"
      : ep.showNotes && ep.showNotes.text.length > 80
        ? "shownotes"
        : "minimal";

    const context = buildContext(ep, transcript);

    await epRef.update({
      "summary.status": "pending",
    });

    try {
      const vertex = getVertex();
      const model = vertex(MODELS.fast);

      const { object } = await generateObject({
        model,
        schema,
        prompt: buildPrompt(ep, context, tier),
        maxRetries: 2,
      });

      const generatedChapters =
        ep.chapters && ep.chapters.length > 0
          ? undefined
          : object.generatedChapters;

      const summary: SummaryDoc = {
        episodeId,
        tldr: object.tldr,
        body: object.body,
        keyPoints: object.keyPoints,
        ...(generatedChapters && generatedChapters.length > 0
          ? { generatedChapters }
          : {}),
        language: "ja",
        model: MODELS.fast,
        contextTier: tier,
        generatedAt: Date.now(),
      };

      await db.doc(`users/${uid}/summaries/${episodeId}`).set(summary);

      const epUpdates: Record<string, unknown> = {
        "summary.status": "done",
        "summary.model": MODELS.fast,
        "summary.language": "ja",
        "summary.generatedAt": Date.now(),
      };

      // If we generated chapters and episode had none, save them as the chapters too
      if (
        generatedChapters &&
        generatedChapters.length > 0 &&
        (!ep.chapters || ep.chapters.length === 0)
      ) {
        const chapters = generatedChapters
          .slice()
          .sort((a, b) => a.start - b.start)
          .map((c, i, arr) => ({
            start: c.start,
            title: c.title,
            ...(arr[i + 1] ? { end: arr[i + 1]!.start } : {}),
          }));
        epUpdates.chapters = chapters;
        epUpdates.chaptersSource = "gemini";
      }

      await epRef.update(epUpdates);

      logger.info("summarizeEpisode: done", { episodeId, tier });
      return { ok: true, tier };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await epRef.update({
        "summary.status": "failed",
        "summary.error": message.slice(0, 500),
      });
      logger.error("summarizeEpisode: failed", { episodeId, error: message });
      throw new HttpsError("internal", `summary failed: ${message}`);
    }
  },
);

function buildContext(ep: Episode, transcript: TranscriptDoc | null): string {
  const parts: string[] = [];
  if (ep.chapters && ep.chapters.length > 0) {
    parts.push("【チャプター】");
    for (const c of ep.chapters) {
      parts.push(`  ${formatTs(c.start)} ${c.title}`);
    }
    parts.push("");
  }
  if (ep.showNotes?.text) {
    parts.push("【Show Notes】");
    parts.push(ep.showNotes.text.slice(0, 4000));
    parts.push("");
  }
  if (ep.showNotes?.links && ep.showNotes.links.length > 0) {
    parts.push("【参考リンク】");
    for (const l of ep.showNotes.links.slice(0, 30)) {
      parts.push(`  - ${l.title} (${l.url})`);
    }
    parts.push("");
  }
  if (transcript) {
    parts.push("【文字起こし】");
    // For very long transcripts, prefer joined text (segments may be too verbose)
    parts.push(transcript.text.slice(0, 200_000));
    parts.push("");
  }
  return parts.join("\n");
}

function buildPrompt(
  ep: Episode,
  context: string,
  tier: SummaryDoc["contextTier"],
): string {
  const tierNote =
    tier === "transcript"
      ? "文字起こしが利用可能なので、内容に深く踏み込んで具体的に要約してください。"
      : tier === "shownotes"
        ? "文字起こしは無く、Show Notesと参考リンクのみが手がかりです。Show Notesから読み取れる範囲で要約し、推測で補わないでください。"
        : "情報が乏しいため、タイトルと簡易な説明から想像できる範囲を控えめに記述してください。";

  return [
    "あなたは日本語のPodcastエピソードを正確に要約するアシスタントです。",
    "ハルシネーション禁止。コンテキストにない情報は書かないこと。",
    tierNote,
    "",
    `【エピソード】`,
    `タイトル: ${ep.title}`,
    ep.duration ? `長さ: 約${Math.round(ep.duration / 60)}分` : "",
    "",
    context,
    "",
    "出力は日本語で。tldrは敬体は使わず常体・端的に。bodyは段落構成で読みやすく。",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatTs(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
