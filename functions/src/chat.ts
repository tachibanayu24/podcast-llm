import { onRequest } from "firebase-functions/v2/https";
import { GEMINI_API_KEY } from "./lib/ai";

export const chatWithEpisode = onRequest(
  {
    region: "asia-northeast1",
    maxInstances: 3,
    timeoutSeconds: 300,
    secrets: [GEMINI_API_KEY],
    cors: true,
  },
  async (_req, res) => {
    res.status(501).send("not implemented");
  },
);
