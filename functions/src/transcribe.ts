import { generateObject } from "ai";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { z } from "zod";
import { db } from "./lib/admin.js";
import { getVertex, MODELS } from "./lib/ai.js";
import { actualAudioCostUsd } from "./lib/cost.js";
import { ingestAudioToGcs } from "./lib/ingest.js";
import type { Episode, Podcast, TranscriptDoc } from "./lib/types.js";

// Flash-Lite は schema 維持力が弱く長尺で No object generated に頻発したので
// Flash に戻して安定優先。コストは 9x だが個人用では許容。
const TRANSCRIBE_MODEL = MODELS.fast;

const schema = z.object({
  language: z.string().describe("ISO 639-1 language code, e.g. 'ja' or 'en'"),
  segments: z
    .array(
      z.object({
        start: z.number().min(0).describe("開始秒"),
        end: z.number().min(0).describe("終了秒").optional(),
        speaker: z.string().describe("Speaker 1, Speaker 2 等").optional(),
        text: z.string().min(1),
      }),
    )
    .min(1),
});

export const transcribeEpisode = onCall<
  { episodeId: string; force?: boolean },
  Promise<{ ok: true; segments: number }>
>(
  {
    region: "asia-northeast1",
    maxInstances: 2,
    timeoutSeconds: 540,
    memory: "1GiB",
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

    if (!force && ep.transcript?.status === "done") {
      const t = await db.doc(`users/${uid}/transcripts/${episodeId}`).get();
      const segments = t.exists
        ? ((t.data() as TranscriptDoc).segments?.length ?? 0)
        : 0;
      return { ok: true, segments };
    }

    if (!ep.audioUrl) {
      throw new HttpsError("failed-precondition", "audioUrl missing");
    }

    await epRef.update({
      "transcript.status": "pending",
    });

    let gcsUri = ep.gcsUri;
    let expiresAt = ep.gcsExpiresAt ?? 0;
    let contentType = ep.gcsContentType;

    try {
      if (!gcsUri || expiresAt < Date.now() + 60_000) {
        logger.info("transcribeEpisode: ingesting audio", { episodeId });
        const ingest = await ingestAudioToGcs(
          ep.podcastId,
          episodeId,
          ep.audioUrl,
        );
        gcsUri = ingest.gcsUri;
        expiresAt = ingest.expiresAt;
        contentType = ingest.contentType;
        await epRef.update({
          gcsUri,
          gcsExpiresAt: expiresAt,
          gcsContentType: contentType,
        });
      }

      // 話者名を実名で当てさせるための手がかりを集める。
      // 番組情報・出演者がわかる Show Notes・自己紹介がよく入っている冒頭の
      // ヒントなどをまとめてプロンプトに同梱する。
      const podcastSnap = await db.doc(`users/${uid}/podcasts/${ep.podcastId}`).get();
      const podcast = podcastSnap.exists
        ? (podcastSnap.data() as Podcast)
        : null;

      const speakerHints: string[] = [];
      if (podcast?.title) speakerHints.push(`番組名: ${podcast.title}`);
      if (podcast?.author) {
        speakerHints.push(`番組オーナー/作者: ${podcast.author}`);
      }
      if (podcast?.description) {
        // 番組概要にはホスト/レギュラー出演者の名前が書かれていることが多い。
        speakerHints.push(
          `番組概要(常連ホストやパーソナリティ名が含まれることが多い):\n${podcast.description.slice(0, 2000)}`,
        );
      }
      if (ep.title) speakerHints.push(`エピソードタイトル: ${ep.title}`);
      if (ep.description) {
        speakerHints.push(
          `エピソード説明(ゲスト紹介が含まれることが多い):\n${ep.description.slice(0, 1200)}`,
        );
      }
      if (ep.showNotes?.text) {
        speakerHints.push(
          `Show Notes(出演者やゲスト名が含まれることが多い):\n${ep.showNotes.text.slice(0, 2000)}`,
        );
      }
      if (ep.showNotes?.links && ep.showNotes.links.length > 0) {
        // SNS / プロフィールページのリンクは話者の本名/ハンドルを示すことが多い。
        const links = ep.showNotes.links
          .slice(0, 20)
          .map((l) => `  - ${l.title} (${l.url})`)
          .join("\n");
        speakerHints.push(`Show Notes 内リンク(出演者のプロフィール等):\n${links}`);
      }

      const vertex = getVertex();
      const { object, usage } = await generateObject({
        model: vertex(TRANSCRIBE_MODEL),
        schema,
        // Gemini transcription best practices: low temperature for accuracy,
        // generous output budget so long episodes don't get truncated.
        temperature: 0.1,
        maxOutputTokens: 65_536,
        // Gemini 2.5 系は default で thinking が ON。長文 transcription のような
        // perception タスクでは思考トークンに output budget を食われて本体が
        // 空 response になる現象が起きるので明示的に 0 で無効化する。
        providerOptions: {
          vertex: {
            thinkingConfig: { thinkingBudget: 0 },
          },
        },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  "次のポッドキャスト音声をできる限り正確に書き起こしてください。",
                  "",
                  "## 話者ラベル",
                  "可能な限り **実際の名前**(例: 「橘」「Tachibana」「Naomi」など)で speaker を埋めてください。判別のヒント:",
                  "  1. 音声内の自己紹介や呼びかけ(「私は◯◯です」「◯◯さん、どう思いますか?」)",
                  "  2. 下に列挙する番組情報・Show Notes に出てくる出演者名やゲスト名",
                  "  3. 同一話者には常に同じラベルを付けること(途中でブレない)",
                  "どうしても判別できない話者だけ `Speaker 1`, `Speaker 2` のような汎用ラベルにする。",
                  "推測で名前を捏造しないこと(根拠が無いなら Speaker N を使う)。",
                  "",
                  "## セグメント",
                  "- おおむね1〜2文ごとに区切り、各セグメントに開始秒(start)を付ける",
                  "- フィラー(えーと、あの 等)は適度に整理してよいが、内容を勝手に省略しない",
                  "- 言語は元音声の言語のまま (ja の場合は日本語)",
                  "",
                  "## 話者推定のための番組情報",
                  speakerHints.length > 0
                    ? speakerHints.join("\n\n")
                    : "(なし — 音声内の自己紹介から判断してください)",
                ].join("\n"),
              },
              {
                type: "file",
                data: new URL(gcsUri),
                mediaType: contentType ?? "audio/mpeg",
              },
            ],
          },
        ],
        maxRetries: 2,
      });

      const segments = object.segments
        .map((s) => ({
          start: Math.max(0, s.start),
          ...(s.end != null ? { end: s.end } : {}),
          ...(s.speaker ? { speaker: s.speaker } : {}),
          text: s.text.trim(),
        }))
        .filter((s) => s.text.length > 0);

      const text = segments
        .map((s) => (s.speaker ? `${s.speaker}: ${s.text}` : s.text))
        .join("\n");

      const costUsd = actualAudioCostUsd(
        TRANSCRIBE_MODEL,
        usage,
        ep.duration ?? 0,
      );
      const usageMeta = {
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        costUsd,
      };

      const doc: TranscriptDoc = {
        episodeId,
        source: "gemini",
        language: object.language,
        text,
        segments,
        generatedAt: Date.now(),
        model: TRANSCRIBE_MODEL,
        usage: usageMeta,
      };
      await db.doc(`users/${uid}/transcripts/${episodeId}`).set(doc);

      await epRef.update({
        "transcript.status": "done",
        "transcript.source": "gemini",
        "transcript.model": TRANSCRIBE_MODEL,
        "transcript.language": object.language,
        "transcript.generatedAt": Date.now(),
      });

      logger.info("transcribeEpisode: done", {
        episodeId,
        segments: segments.length,
        inputTokens: usageMeta.inputTokens,
        outputTokens: usageMeta.outputTokens,
        costUsd,
      });
      return { ok: true, segments: segments.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await epRef.update({
        "transcript.status": "failed",
        "transcript.error": message.slice(0, 500),
      });
      logger.error("transcribeEpisode: failed", { episodeId, error: message });
      throw new HttpsError("internal", `transcription failed: ${message}`);
    }
  },
);
