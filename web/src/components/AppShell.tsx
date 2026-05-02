import { Outlet } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";

export function AppShell() {
  return (
    <div className="min-h-dvh flex flex-col">
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-6 sm:py-8 pb-28">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
