import { Outlet } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { Player } from "@/components/Player";

export function AppShell() {
  return (
    <div className="min-h-dvh flex flex-col">
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-6 sm:py-8 pb-44">
        <Outlet />
      </main>
      <Player />
      <BottomNav />
    </div>
  );
}
