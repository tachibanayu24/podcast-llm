import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Download, Loader2, LogOut, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import { refreshMyFeedsFn } from "@/lib/functions";

export function SettingsPage() {
  const user = useAuth();
  const queryClient = useQueryClient();
  const [lastResult, setLastResult] = useState<string | null>(null);

  const refresh = useMutation({
    mutationFn: () => refreshMyFeedsFn({}).then((r) => r.data),
    onSuccess: (r) => {
      setLastResult(
        `${r.podcasts}番組を再取得・新規${r.newEpisodes}件${r.errors > 0 ? `（${r.errors}件失敗）` : ""}`,
      );
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["episodes"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
    onError: (err) => {
      setLastResult(`失敗: ${(err as Error).message}`);
    },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">設定</h1>

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            {user?.photoURL && (
              <AvatarImage
                src={user.photoURL}
                alt={user.displayName ?? ""}
                referrerPolicy="no-referrer"
              />
            )}
            <AvatarFallback className="text-lg">
              {user?.displayName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-semibold leading-tight">
              {user?.displayName ?? "ユーザー"}
            </div>
            <div className="text-sm text-muted-foreground truncate mt-0.5">
              {user?.email}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground px-1">
          フィード
        </h2>
        <Card className="overflow-hidden">
          <button
            type="button"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-accent transition-colors disabled:opacity-60"
          >
            {refresh.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            <div className="flex-1">
              <div className="font-medium">
                {refresh.isPending ? "再取得中…" : "購読中のフィードを再取得"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                新エピソード追加と既存メタデータの更新
              </div>
            </div>
          </button>
        </Card>
        {lastResult && (
          <p className="text-xs text-muted-foreground px-1">{lastResult}</p>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground px-1">
          オフライン
        </h2>
        <Card className="overflow-hidden">
          <Link
            to="/downloads"
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-accent transition-colors"
          >
            <Download className="size-4" />
            <div className="flex-1">
              <div className="font-medium">ダウンロード済みエピソード</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                オフラインで聴けるエピソードを管理
              </div>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground px-1">
          アカウント
        </h2>
        <Card className="overflow-hidden">
          <button
            type="button"
            onClick={signOut}
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-accent transition-colors text-destructive"
          >
            <LogOut className="size-4" />
            <span className="font-medium">ログアウト</span>
          </button>
        </Card>
      </div>
    </div>
  );
}
