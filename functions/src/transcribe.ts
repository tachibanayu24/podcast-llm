import { onCall } from "firebase-functions/v2/https";

export const transcribeEpisode = onCall(
  {
    region: "asia-northeast1",
    maxInstances: 3,
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (_request) => {
    throw new Error("not implemented");
  },
);
