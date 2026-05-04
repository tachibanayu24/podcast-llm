import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({ region: "asia-northeast1", maxInstances: 10 });

export { searchPodcasts } from "./search";
export { subscribePodcast, refreshMyFeeds } from "./rss";
export { unsubscribePodcast } from "./unsubscribe";
export { getEpisodeContext } from "./context";
export { transcribeEpisode } from "./transcribe";
export { summarizeEpisode } from "./summarize";
export { translateSummary } from "./translate";
export { chatWithEpisode } from "./chat";
export { audioProxy } from "./audio-proxy";
