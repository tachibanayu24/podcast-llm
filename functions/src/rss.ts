import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

export const subscribePodcast = onCall(
  { region: "asia-northeast1", maxInstances: 5 },
  async (_request) => {
    throw new Error("not implemented");
  },
);

export const refreshFeeds = onSchedule(
  {
    region: "asia-northeast1",
    schedule: "every 6 hours",
    timeZone: "Asia/Tokyo",
  },
  async () => {
    // TODO: 全ユーザーの購読を巡回してRSS再取得
  },
);
