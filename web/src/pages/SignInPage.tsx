import { useState } from "react";
import { GoogleIcon } from "../components/icons/GoogleIcon";
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
      <div className="w-full max-w-sm space-y-10">
        <div className="space-y-3 text-center">
          <h1 className="text-4xl font-bold tracking-tight leading-tight">
            AIで聴く、
            <br />
            あたらしいPodcast
          </h1>
          <p className="text-sm text-neutral-400">
            要約・文字起こし・対話で、エピソードを深く理解する。
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleSignIn}
            disabled={busy}
            className="w-full h-12 bg-white hover:bg-neutral-100 text-neutral-900 rounded-full font-medium transition flex items-center justify-center gap-3 disabled:opacity-60 shadow-sm"
          >
            <GoogleIcon />
            <span>{busy ? "サインイン中..." : "Googleでログイン"}</span>
          </button>
          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}
        </div>
      </div>
    </main>
  );
}
