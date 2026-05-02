import { Outlet } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { Player } from "@/components/Player";
import { PlayerSheet } from "@/components/PlayerSheet";
import { usePlayerHotkeys } from "@/hooks/usePlayerHotkeys";

export function AppShell() {
  usePlayerHotkeys();
  return (
    <div className="min-h-dvh">
      <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-6 sm:py-8 pb-44">
        <Outlet />
      </main>
      <div className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
        <Player />
        <BottomNav />
      </div>
      <PlayerSheet />
    </div>
  );
}
