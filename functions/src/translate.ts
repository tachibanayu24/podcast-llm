import { generateText } from "ai";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { db } from "./lib/admin.js";
import { getVertex, MODELS } from "./lib/ai.js";
import type {
  Episode,
  SummaryDoc,
  TranscriptDoc,
  TranslationDoc,
} from "./lib/types.js";

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
    timeoutSeconds: 300,
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

    let sourceText: string;
    let segments: { start: number; text: string }[] | undefined;

    if (kind === "summary") {
      const snap = await db.doc(`users/${uid}/summaries/${episodeId}`).get();
      if (!snap.exists) throw new HttpsError("failed-precondition", "no summary");
      const s = snap.data() as SummaryDoc;
      sourceText = [s.tldr, "", s.body, "", "重要ポイント:", ...s.keyPoints.map((p) => `- ${p}`)].join("\n");
    } else {
      const snap = await db.doc(`users/${uid}/transcripts/${episodeId}`).get();
      if (!snap.exists) throw new HttpsError("failed-precondition", "no transcript");
      const t = snap.data() as TranscriptDoc;
      sourceText = t.text;
      segments = t.segments?.map((s) => ({ start: s.start, text: s.text }));
    }

    const docRef = db.doc(
      `users/${uid}/translations/${episodeId}__${kind}__${targetLanguage}`,
    );

    try {
      const vertex = getVertex();
      const { text } = await generateText({
        model: vertex(MODELS.fast),
        prompt: buildPrompt(ep, sourceText, kind, targetLanguage),
      });

      // For transcripts with segments, also translate segment-by-segment for timestamp alignment
      let translatedSegments: { start: number; text: string }[] | undefined;
      if (kind === "transcript" && segments && segments.length > 0) {
        translatedSegments = await translateSegments(
          segments,
          targetLanguage,
        );
      }

      const doc: TranslationDoc = {
        episodeId,
        kind,
        targetLanguage,
        text,
        ...(translatedSegments ? { segments: translatedSegments } : {}),
        model: MODELS.fast,
        generatedAt: Date.now(),
      };
      await docRef.set(doc);

      logger.info("translateSummary: done", { episodeId, kind, targetLanguage });
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("translateSummary: failed", { episodeId, error: message });
      throw new HttpsError("internal", `translation failed: ${message}`);
    }
  },
);

function buildPrompt(
  ep: Episode,
  source: string,
  kind: "summary" | "transcript",
  target: string,
): string {
  const lang = target === "ja" ? "日本語" : target === "en" ? "英語" : target;
  return [
    `次の${kind === "summary" ? "ポッドキャストの要約" : "ポッドキャストの文字起こし"}を${lang}に翻訳してください。`,
    "原文の意味を保ちつつ、自然な訳文にしてください。固有名詞は元の表記を残すか、慣用的な表記を使ってください。",
    `番組: ${ep.title}`,
    "",
    "---原文---",
    source.slice(0, 200_000),
    "---原文ここまで---",
    "",
    "翻訳のみ出力してください。前置きや解説は不要です。",
  ].join("\n");
}

async function translateSegments(
  segments: { start: number; text: string }[],
  target: string,
): Promise<{ start: number; text: string }[]> {
  // Translate in batches to avoid massive prompts and to keep alignment.
  const BATCH = 60;
  const out: { start: number; text: string }[] = [];
  const lang = target === "ja" ? "日本語" : target === "en" ? "英語" : target;

  const vertex = getVertex();

  for (let i = 0; i < segments.length; i += BATCH) {
    const batch = segments.slice(i, i + BATCH);
    const numbered = batch.map((s, j) => `${j + 1}. ${s.text}`).join("\n");
    const { text } = await generateText({
      model: vertex(MODELS.fast),
      prompt: [
        `次の文を${lang}に翻訳してください。出力は同じ番号付きの箇条書き形式を保ち、行ごとに1対1対応させること。`,
        "",
        numbered,
      ].join("\n"),
    });

    const lines = text.split(/\r?\n/);
    const map = new Map<number, string>();
    for (const line of lines) {
      const m = /^(\d+)\.\s*(.+)$/.exec(line.trim());
      if (m) map.set(Number(m[1]), m[2]!.trim());
    }
    for (let j = 0; j < batch.length; j++) {
      const translated = map.get(j + 1) ?? batch[j]!.text;
      out.push({ start: batch[j]!.start, text: translated });
    }
  }
  return out;
}
