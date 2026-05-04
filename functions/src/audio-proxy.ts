import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { getAuth } from "firebase-admin/auth";
import { db } from "./lib/admin.js";
import { safeFetch } from "./lib/safe-fetch.js";
import type { Episode } from "./lib/types.js";

// ポッドキャスト配信ホストの多くは CORS ヘッダを返さないので
// ブラウザから直接 fetch できない。認証付きでサーバ側からダウンロードして
// streaming pipe するためのプロキシ。Range は通すので将来 player 側からも
// 使える設計だが、現状はオフラインダウンロード用。
export const audioProxy = onRequest(
  {
    region: "asia-northeast1",
    maxInstances: 5,
    timeoutSeconds: 540,
    memory: "512MiB",
    cors: true,
    invoker: "public",
  },
  async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
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
      logger.warn("audioProxy: invalid token", err);
      res.status(401).send("invalid token");
      return;
    }

    const episodeId = String(req.query.episodeId ?? "");
    if (!episodeId) {
      res.status(400).send("episodeId required");
      return;
    }

    const epSnap = await db.doc(`users/${uid}/episodes/${episodeId}`).get();
    if (!epSnap.exists) {
      res.status(404).send("episode not found");
      return;
    }
    const ep = epSnap.data() as Episode;
    if (!ep.audioUrl) {
      res.status(404).send("audioUrl missing");
      return;
    }

    const range = req.headers.range;
    try {
      const upstream = await safeFetch(ep.audioUrl, {
        timeoutMs: 5 * 60 * 1000,
        method: req.method,
        headers: range ? { Range: range } : undefined,
      });

      if (!upstream.ok && upstream.status !== 206) {
        await upstream.body?.cancel();
        res.status(upstream.status || 502).send(`upstream ${upstream.status}`);
        return;
      }

      const ct = upstream.headers.get("content-type") ?? "audio/mpeg";
      const cl = upstream.headers.get("content-length");
      const cr = upstream.headers.get("content-range");
      const ar = upstream.headers.get("accept-ranges");
      res.setHeader("Content-Type", ct);
      if (cl) res.setHeader("Content-Length", cl);
      if (cr) res.setHeader("Content-Range", cr);
      if (ar) res.setHeader("Accept-Ranges", ar);
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.status(upstream.status);

      if (req.method === "HEAD" || !upstream.body) {
        res.end();
        return;
      }

      const source = Readable.fromWeb(upstream.body as never);
      await pipeline(source, res);
    } catch (err) {
      logger.error("audioProxy: failed", {
        episodeId,
        err: err instanceof Error ? err.message : String(err),
      });
      if (!res.headersSent) {
        res.status(502).send("upstream failed");
      } else {
        res.end();
      }
    }
  },
);
