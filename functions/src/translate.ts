import { generateObject, generateText } from "ai";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { z } from "zod";
import { db } from "./lib/admin.js";
import { getVertex, MODELS } from "./lib/ai.js";
import { actualCostUsd } from "./lib/cost.js";
import type {
  Episode,
  SummaryDoc,
  TranscriptDoc,
  TranslationDoc,
  UsageMeta,
} from "./lib/types.js";

interface UsageAccumulator {
  inputTokens: number;
  outputTokens: number;
}
function addUsage(
  acc: UsageAccumulator,
  u: { inputTokens?: number; outputTokens?: number } | undefined,
): void {
  if (!u) return;
  acc.inputTokens += u.inputTokens ?? 0;
  acc.outputTokens += u.outputTokens ?? 0;
}
function toUsageMeta(model: string, acc: UsageAccumulator): UsageMeta {
  return {
    inputTokens: acc.inputTokens,
    outputTokens: acc.outputTokens,
    costUsd: actualCostUsd(model, acc),
  };
}

const SEGMENT_BATCH = 80;

export const translateSummary = onCall<
  {
    episodeId: string;
    kind: "summary" | "transcript";
    targetLanguage?: string;
  },
  Promise<{ ok: true }>
>(
  {
    region: "asia-northeast1",
    maxInstances: 3,
    timeoutSeconds: 540,
    memory: "512MiB",
    invoker: "public",
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "auth required");

    const { episodeId, kind, targetLanguage = "ja" } = request.data;
    if (!episodeId || !kind) {
      throw new HttpsError("invalid-argument", "episodeId and kind required");
    }

    const epSnap = await db.doc(`users/${uid}/episodes/${episodeId}`).get();
    if (!epSnap.exists) throw new HttpsError("not-found", "episode not found");
    const ep = epSnap.data() as Episode;

    const docRef = db.doc(
      `users/${uid}/translations/${episodeId}__${kind}__${targetLanguage}`,
    );

    try {
      const usageAcc: UsageAccumulator = { inputTokens: 0, outputTokens: 0 };
      let translation: TranslationDoc;
      if (kind === "summary") {
        const snap = await db.doc(`users/${uid}/summaries/${episodeId}`).get();
        if (!snap.exists)
          throw new HttpsError("failed-precondition", "no summary");
        const summary = snap.data() as SummaryDoc;
        const source = [
          summary.tldr,
          "",
          summary.body,
          "",
          "重要ポイント:",
          ...summary.keyPoints.map((p) => `- ${p}`),
        ].join("\n");

        const result = await translateText(
          ep,
          source,
          "summary",
          targetLanguage,
        );
        addUsage(usageAcc, result.usage);
        translation = {
          episodeId,
          kind: "summary",
          targetLanguage,
          text: result.text,
          model: MODELS.fast,
          generatedAt: Date.now(),
          usage: toUsageMeta(MODELS.fast, usageAcc),
        };
      } else {
        const snap = await db
          .doc(`users/${uid}/transcripts/${episodeId}`)
          .get();
        if (!snap.exists)
          throw new HttpsError("failed-precondition", "no transcript");
        const t = snap.data() as TranscriptDoc;

        if (t.segments && t.segments.length > 0) {
          // Segment-aware translation. Reconstruct full text from translated
          // segments — saves a separate full-text generateText call (50% less
          // LLM cost than calling both).
          const inputs = t.segments.map((s) => ({
            start: s.start,
            text: s.text,
          }));
          const translatedSegments = await translateSegments(
            inputs,
            targetLanguage,
            usageAcc,
          );
          const text = translatedSegments.map((s) => s.text).join("\n");
          translation = {
            episodeId,
            kind: "transcript",
            targetLanguage,
            text,
            segments: translatedSegments,
            model: MODELS.fast,
            generatedAt: Date.now(),
            usage: toUsageMeta(MODELS.fast, usageAcc),
          };
        } else {
          // Plain text transcript only — single full-text translation.
          const result = await translateText(
            ep,
            t.text,
            "transcript",
            targetLanguage,
          );
          addUsage(usageAcc, result.usage);
          translation = {
            episodeId,
            kind: "transcript",
            targetLanguage,
            text: result.text,
            model: MODELS.fast,
            generatedAt: Date.now(),
            usage: toUsageMeta(MODELS.fast, usageAcc),
          };
        }
      }

      await docRef.set(translation);

      logger.info("translateSummary: done", {
        episodeId,
        kind,
        targetLanguage,
        textLength: translation.text.length,
        inputTokens: usageAcc.inputTokens,
        outputTokens: usageAcc.outputTokens,
        costUsd: translation.usage?.costUsd,
      });
      return { ok: true };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      logger.error("translateSummary: failed", { episodeId, error: message });
      throw new HttpsError("internal", `translation failed: ${message}`);
    }
  },
);

async function translateText(
  ep: Episode,
  source: string,
  kind: "summary" | "transcript",
  target: string,
): Promise<{ text: string; usage: { inputTokens?: number; outputTokens?: number } | undefined }> {
  const lang = target === "ja" ? "日本語" : target === "en" ? "英語" : target;
  const vertex = getVertex();
  const { text, usage } = await generateText({
    model: vertex(MODELS.fast),
    prompt: [
      `次の${kind === "summary" ? "ポッドキャストの要約" : "ポッドキャストの文字起こし"}を${lang}に翻訳してください。`,
      "原文の意味を保ちつつ、自然な訳文にしてください。固有名詞は元の表記を残すか、慣用的な表記を使ってください。",
      `番組: ${ep.title}`,
      "",
      "---原文---",
      source.slice(0, 200_000),
      "---原文ここまで---",
      "",
      "翻訳のみ出力してください。前置きや解説は不要です。",
    ].join("\n"),
  });
  return { text: text.trim(), usage };
}

async function translateSegments(
  segments: { start: number; text: string }[],
  target: string,
  usageAcc: UsageAccumulator,
): Promise<{ start: number; text: string }[]> {
  const lang = target === "ja" ? "日本語" : target === "en" ? "英語" : target;
  const vertex = getVertex();
  const out: { start: number; text: string }[] = [];

  // JSON array output keeps alignment robust against numbering noise.
  const segmentSchema = z.object({
    items: z
      .array(z.object({ index: z.number().int(), text: z.string() }))
      .describe("対応する翻訳結果"),
  });

  for (let i = 0; i < segments.length; i += SEGMENT_BATCH) {
    const batch = segments.slice(i, i + SEGMENT_BATCH);
    const items = batch.map((s, j) => ({ index: j + 1, text: s.text }));

    try {
      const { object, usage } = await generateObject({
        model: vertex(MODELS.fast),
        schema: segmentSchema,
        prompt: [
          `次の番号付きセグメントを${lang}に翻訳してください。`,
          "各セグメントの`index`を保ち、`text`に翻訳結果を入れて返してください。",
          "原文の意味を保ち、固有名詞は元の表記または慣用的な表記を使うこと。",
          "",
          JSON.stringify({ items }, null, 2),
        ].join("\n"),
        maxRetries: 1,
      });
      addUsage(usageAcc, usage);

      const map = new Map<number, string>();
      for (const it of object.items) {
        if (typeof it.index === "number" && typeof it.text === "string") {
          map.set(it.index, it.text.trim());
        }
      }
      for (let j = 0; j < batch.length; j++) {
        const translated = map.get(j + 1) ?? batch[j]!.text;
        out.push({ start: batch[j]!.start, text: translated });
      }
    } catch (err) {
      logger.warn("translateSegments: batch failed, keeping originals", {
        from: i,
        size: batch.length,
        error: err instanceof Error ? err.message : String(err),
      });
      for (const s of batch) out.push({ start: s.start, text: s.text });
    }
  }
  return out;
}
