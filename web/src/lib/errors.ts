/**
 * Map errors (FirebaseError, FunctionsError, generic Error, unknown)
 * into user-facing Japanese messages.
 */

interface FirebaseLikeError {
  code?: string;
  message?: string;
}

const FIREBASE_AUTH: Record<string, string> = {
  "auth/popup-closed-by-user": "ログインがキャンセルされました",
  "auth/popup-blocked": "ポップアップがブロックされました",
  "auth/network-request-failed": "ネットワークに接続できませんでした",
  "auth/internal-error": "認証で問題が発生しました",
};

const FUNCTIONS: Record<string, string> = {
  unauthenticated: "ログインが必要です",
  "permission-denied": "権限がありません",
  "not-found": "見つかりませんでした",
  "failed-precondition": "前提条件を満たしていません",
  "deadline-exceeded": "時間がかかりすぎたため中止しました",
  unavailable: "サービスに一時的に接続できません",
  internal: "サーバーで問題が発生しました",
  cancelled: "キャンセルされました",
  "resource-exhausted": "上限に達しました。しばらく待ってからやり直してください",
  "invalid-argument": "リクエスト内容が不正です",
};

export function friendlyError(err: unknown): string {
  if (!err) return "不明なエラーが発生しました";
  if (typeof err === "string") return err;

  const e = err as FirebaseLikeError;
  const code = e.code ?? "";

  if (code.startsWith("auth/")) {
    return FIREBASE_AUTH[code] ?? e.message ?? "認証エラー";
  }

  if (code.startsWith("functions/")) {
    const key = code.replace("functions/", "");
    return FUNCTIONS[key] ?? e.message ?? "関数の実行に失敗しました";
  }

  if (FUNCTIONS[code]) return FUNCTIONS[code]!;

  if (err instanceof TypeError && /failed to fetch|network/i.test(err.message)) {
    return "ネットワークに接続できませんでした";
  }

  if (err instanceof Error) return err.message;
  return "エラーが発生しました";
}
