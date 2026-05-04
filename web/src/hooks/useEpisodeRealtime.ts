import { useQueryClient } from "@tanstack/react-query";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useRef } from "react";
import type { Episode } from "@podcast-llm/shared";
import { auth, db } from "@/lib/firebase";

/**
 * エピソード doc の Firestore 変更をリアルタイムで react-query のキャッシュに反映する。
 *
 * - サーバ側で transcript/summary 生成中に status が変わると即 UI に伝わる
 * - PWA を閉じている間に Cloud Function が完了してもオンライン復帰直後に反映
 * - status が "done" に切り替わったタイミングで関連 doc (transcript/summary) を invalidate
 */
export function useEpisodeRealtime(episodeId: string | null | undefined): void {
  const queryClient = useQueryClient();
  const prevTranscriptStatus = useRef<string | undefined>(undefined);
  const prevSummaryStatus = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!episodeId) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const ref = doc(db, "users", uid, "episodes", episodeId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = { id: snap.id, ...snap.data() } as Episode;
      queryClient.setQueryData(["episode", episodeId], data);

      const tStatus = data.transcript?.status;
      const sStatus = data.summary?.status;

      // pending → done に切り替わったときだけ関連 doc を取り直す
      if (
        prevTranscriptStatus.current === "pending" &&
        tStatus === "done"
      ) {
        queryClient.invalidateQueries({
          queryKey: ["transcript", episodeId],
        });
      }
      if (prevSummaryStatus.current === "pending" && sStatus === "done") {
        queryClient.invalidateQueries({
          queryKey: ["summary", episodeId],
        });
      }
      prevTranscriptStatus.current = tStatus;
      prevSummaryStatus.current = sStatus;
    });

    return unsub;
  }, [episodeId, queryClient]);
}
