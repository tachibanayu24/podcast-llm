import { onRequest } from "firebase-functions/v2/https";

export const chatWithEpisode = onRequest(
  {
    region: "asia-northeast1",
    maxInstances: 3,
    timeoutSeconds: 300,
    cors: true,
  },
  async (_req, res) => {
    res.status(501).send("not implemented");
  },
);
