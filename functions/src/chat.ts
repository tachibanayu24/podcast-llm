import { streamText } from "ai";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { getAuth } from "firebase-admin/auth";
import { db } from "./lib/admin.js";
import { getVertex, MODELS } from "./lib/ai.js";
import { formatTs } from "./lib/format.js";
import type { Episode, SummaryDoc, TranscriptDoc } from "./lib/types.js";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const chatWithEpisode = onRequest(
  {
    region: "asia-northeast1",
    maxInstances: 3,
    timeoutSeconds: 300,
    memory: "512MiB",
    cors: true,
    invoker: "public",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("method not allowed");
      return;
    }

    const idToken = req.headers.authorization?.replace(/^Bearer\s+/, "");
    if (!idToken) {
      res.status(401).send("missing token");
      return;
    }

    let uid: string;
    try {
      const decoded = await getAuth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (err) {
      logger.warn("chatWithEpisode: invalid token", err);
      res.status(401).send("invalid token");
      return;
    }

    // Body may arrive as parsed object, Buffer, or string depending on the
    // hosting rewrite path. Normalize before validation.
    let parsed: {
      episodeId?: string;
      messages?: ChatMessage[];
      useSearch?: boolean;
    } = {};
    try {
      if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
        parsed = req.body as typeof parsed;
      } else if (typeof req.body === "string" && req.body.length > 0) {
        parsed = JSON.parse(req.body);
      } else if (req.rawBody && req.rawBody.length > 0) {
        parsed = JSON.parse(req.rawBody.toString("utf-8"));
      }
    } catch (e) {
      logger.warn("chatWithEpisode: body parse failed", e);
    }
    const { episodeId, messages, useSearch } = parsed;
    if (!episodeId || !Array.isArray(messages) || messages.length === 0) {
      logger.warn("chatWithEpisode: invalid payload", {
        bodyType: typeof req.body,
        hasRaw: !!req.rawBody,
        contentType: req.get("content-type"),
        episodeIdType: typeof episodeId,
        messagesType: Array.isArray(messages)
          ? `array(${messages.length})`
          : typeof messages,
      });
      res.status(400).send("episodeId and messages required");
      return;
    }
    // Cap message history length to bound context size and cost.
    const MAX_HISTORY = 20;
    const trimmed =
      messages.length > MAX_HISTORY ? messages.slice(-MAX_HISTORY) : messages;

    const epSnap = await db.doc(`users/${uid}/episodes/${episodeId}`).get();
    if (!epSnap.exists) {
      res.status(404).send("episode not found");
      return;
    }
    const ep = epSnap.data() as Episode;

    const [transcriptSnap, summarySnap] = await Promise.all([
      db.doc(`users/${uid}/transcripts/${episodeId}`).get(),
      db.doc(`users/${uid}/summaries/${episodeId}`).get(),
    ]);
    const transcript = transcriptSnap.exists
      ? (transcriptSnap.data() as TranscriptDoc)
      : null;
    const summary = summarySnap.exists
      ? (summarySnap.data() as SummaryDoc)
      : null;

    const system = buildSystemPrompt(ep, transcript, summary);

    try {
      const vertex = getVertex();
      const result = streamText({
        model: vertex(MODELS.smart),
        system,
        messages: trimmed.map((m) => ({ role: m.role, content: m.content })),
        // Search is opt-in to bound LLM cost; default relies on episode context.
        ...(useSearch
          ? { tools: { google_search: vertex.tools.googleSearch({}) } }
          : {}),
      });

      result.pipeTextStreamToResponse(res);
    } catch (err) {
      logger.error("chatWithEpisode: stream failed", err);
      if (!res.headersSent) {
        res.status(500).send("chat failed");
      }
    }
  },
);

function buildSystemPrompt(
  ep: Episode,
  transcript: TranscriptDoc | null,
  summary: SummaryDoc | null,
): string {
  const parts: string[] = [
    "あなたは特定のPodcastエピソードの内容について答えるアシスタントです。",
    "ユーザーの質問にはまずコンテキスト(エピソードの内容)から答えること。コンテキストに無い事実は推測せず、必要に応じてgoogle_searchツールで補完して根拠を示すこと。",
    "回答は日本語、Markdown可。簡潔に。",
    "",
    `## エピソード`,
    `タイトル: ${ep.title}`,
  ];
  if (ep.duration) parts.push(`長さ: 約${Math.round(ep.duration / 60)}分`);

  if (ep.chapters && ep.chapters.length > 0) {
    parts.push("", "## チャプター");
    for (const c of ep.chapters) {
      parts.push(`- ${formatTs(c.start)} ${c.title}`);
    }
  }

  if (summary) {
    parts.push("", "## 要約");
    parts.push(summary.tldr);
    parts.push("");
    parts.push(summary.body);
  }

  if (ep.showNotes?.text) {
    parts.push("", "## Show Notes");
    parts.push(ep.showNotes.text.slice(0, 4000));
  }

  if (ep.showNotes?.links && ep.showNotes.links.length > 0) {
    parts.push("", "## 参考リンク (Show Notes)");
    for (const l of ep.showNotes.links.slice(0, 30)) {
      parts.push(`- [${l.title}](${l.url})`);
    }
  }

  if (transcript) {
    parts.push("", "## 文字起こし");
    const TRANSCRIPT_CAP = 200_000;
    if (transcript.text.length > TRANSCRIPT_CAP) {
      logger.warn("chat: transcript truncated", {
        original: transcript.text.length,
        kept: TRANSCRIPT_CAP,
      });
    }
    parts.push(transcript.text.slice(0, TRANSCRIPT_CAP));
  }

  return parts.join("\n");
}
