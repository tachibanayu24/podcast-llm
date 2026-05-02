import { onCall } from "firebase-functions/v2/https";
import { GEMINI_API_KEY } from "./lib/ai";

export const summarizeEpisode = onCall(
  {
    region: "asia-northeast1",
    maxInstances: 3,
    timeoutSeconds: 300,
    secrets: [GEMINI_API_KEY],
  },
  async (_request) => {
    throw new Error("not implemented");
  },
);
