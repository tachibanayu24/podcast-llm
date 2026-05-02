import { onCall } from "firebase-functions/v2/https";

export const summarizeEpisode = onCall(
  {
    region: "asia-northeast1",
    maxInstances: 3,
    timeoutSeconds: 300,
  },
  async (_request) => {
    throw new Error("not implemented");
  },
);
