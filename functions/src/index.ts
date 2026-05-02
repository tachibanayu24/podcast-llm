import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({ region: "asia-northeast1", maxInstances: 10 });

export { searchPodcasts } from "./search";
export { subscribePodcast, refreshFeeds } from "./rss";
export { downloadEpisode } from "./ingest";
export { transcribeEpisode } from "./transcribe";
export { summarizeEpisode } from "./summarize";
export { translateSummary } from "./translate";
export { chatWithEpisode } from "./chat";
