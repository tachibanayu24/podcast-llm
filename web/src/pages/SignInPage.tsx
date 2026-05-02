import { useState } from "react";
import { signInWithGoogle } from "../lib/auth";

export function SignInPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : "サインインに失敗しました");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="text-center space-y-8 max-w-sm">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Podcast LLM</h1>
          <p className="text-sm text-neutral-400">個人用ポッドキャストクライアント</p>
        </div>
        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          className="w-full px-6 py-3 bg-white text-neutral-900 rounded-lg font-medium hover:bg-neutral-200 transition disabled:opacity-50"
        >
          {busy ? "サインイン中..." : "Googleでサインイン"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </main>
  );
}
