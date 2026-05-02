import { Link } from "@tanstack/react-router";
import { Bookmark, Library, Search, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/feed" as const, icon: Sparkles, label: "新着", exact: false },
  { to: "/" as const, icon: Library, label: "ライブラリ", exact: true },
  { to: "/search" as const, icon: Search, label: "検索", exact: false },
  { to: "/watchlist" as const, icon: Bookmark, label: "あとで", exact: false },
  { to: "/settings" as const, icon: Settings, label: "設定", exact: false },
];

export function BottomNav() {
  return (
    <nav className="border-t border-border bg-background/85 backdrop-blur-xl">
      <ul className="mx-auto max-w-md grid grid-cols-5">
        {items.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              activeOptions={{ exact: item.exact }}
              className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{
                className:
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] text-foreground",
              }}
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "grid place-items-center size-9 rounded-full transition-all duration-200",
                      isActive && "bg-primary/15",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "size-5 transition-colors",
                        isActive && "text-primary",
                      )}
                    />
                  </span>
                  <span className="font-medium">{item.label}</span>
                </>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
