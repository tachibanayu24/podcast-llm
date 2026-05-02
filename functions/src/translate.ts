import { onCall } from "firebase-functions/v2/https";

export const translateSummary = onCall(
  {
    region: "asia-northeast1",
    maxInstances: 3,
  },
  async (_request) => {
    throw new Error("not implemented");
  },
);
