import { Link, Outlet } from "@tanstack/react-router";
import { Library, LogOut, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";

export function AppShell() {
  const user = useAuth();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center gap-1">
          <Link
            to="/"
            className="text-base font-bold tracking-tight mr-3 brand-text"
          >
            Podcast LLM
          </Link>

          <nav className="flex items-center">
            <Button variant="ghost" size="sm" asChild>
              <Link
                to="/"
                activeOptions={{ exact: true }}
                activeProps={{ className: "text-foreground bg-accent" }}
                className="text-muted-foreground"
              >
                <Library className="size-4" />
                <span className="hidden sm:inline">ライブラリ</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link
                to="/search"
                activeProps={{ className: "text-foreground bg-accent" }}
                className="text-muted-foreground"
              >
                <Search className="size-4" />
                <span className="hidden sm:inline">検索</span>
              </Link>
            </Button>
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <Avatar className="size-8">
              {user?.photoURL && (
                <AvatarImage
                  src={user.photoURL}
                  alt={user.displayName ?? ""}
                  referrerPolicy="no-referrer"
                />
              )}
              <AvatarFallback>
                {user?.displayName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              title="ログアウト"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
