import { streamText } from "ai";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { getAuth } from "firebase-admin/auth";
import { db } from "./lib/admin.js";
import { getVertex, MODELS } from "./lib/ai.js";
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

    const { episodeId, messages } = req.body as {
      episodeId?: string;
      messages?: ChatMessage[];
    };
    if (!episodeId || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).send("episodeId and messages required");
      return;
    }

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
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        tools: { google_search: vertex.tools.googleSearch({}) },
      });

      result.pipeUIMessageStreamToResponse(res);
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
    parts.push(transcript.text.slice(0, 200_000));
  }

  return parts.join("\n");
}

function formatTs(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
