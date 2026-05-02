import { useState } from "react";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/auth";

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
    <main className="relative min-h-dvh grid place-items-center p-6 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/4 size-[480px] rounded-full bg-primary/30 blur-[120px]" />
        <div className="absolute -bottom-40 right-1/4 size-[480px] rounded-full bg-pink/25 blur-[120px]" />
      </div>

      <div className="w-full max-w-md space-y-12">
        <div className="space-y-5 text-center">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
            <span className="brand-text">AIで聴く、</span>
            <br />
            あたらしいPodcast
          </h1>
          <p className="text-base text-muted-foreground">
            要約・文字起こし・対話で、
            <br />
            エピソードを深く理解する。
          </p>
        </div>

        <div className="space-y-3">
          <Button
            type="button"
            variant="light"
            size="lg"
            onClick={handleSignIn}
            disabled={busy}
            className="w-full"
          >
            <GoogleIcon size={18} />
            {busy ? "サインイン中..." : "Googleでログイン"}
          </Button>
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </div>
      </div>
    </main>
  );
}
