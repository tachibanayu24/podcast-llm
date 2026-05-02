import { Link, Outlet } from "@tanstack/react-router";
import { useAuth } from "../hooks/useAuth";
import { signOut } from "../lib/auth";

export function AppShell() {
  const user = useAuth();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
        <nav className="flex items-center gap-4">
          <Link to="/" className="font-bold">
            Podcast LLM
          </Link>
          <Link
            to="/search"
            className="text-sm text-neutral-400 hover:text-neutral-100"
            activeProps={{ className: "text-sm text-neutral-100" }}
          >
            検索
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          {user?.photoURL && (
            <img
              src={user.photoURL}
              alt={user.displayName ?? ""}
              className="w-7 h-7 rounded-full"
              referrerPolicy="no-referrer"
            />
          )}
          <button
            type="button"
            onClick={signOut}
            className="text-sm text-neutral-400 hover:text-neutral-100"
          >
            ログアウト
          </button>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
