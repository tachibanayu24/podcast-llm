import { onCall } from "firebase-functions/v2/https";

export const downloadEpisode = onCall(
  { region: "asia-northeast1", maxInstances: 5, timeoutSeconds: 540 },
  async (_request) => {
    throw new Error("not implemented");
  },
);
