import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";

export function SettingsPage() {
  const user = useAuth();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">設定</h1>

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            {user?.photoURL && (
              <AvatarImage
                src={user.photoURL}
                alt={user.displayName ?? ""}
                referrerPolicy="no-referrer"
              />
            )}
            <AvatarFallback className="text-lg">
              {user?.displayName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-semibold leading-tight">
              {user?.displayName ?? "ユーザー"}
            </div>
            <div className="text-sm text-muted-foreground truncate mt-0.5">
              {user?.email}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground px-1">
          アカウント
        </h2>
        <Card className="overflow-hidden">
          <button
            type="button"
            onClick={signOut}
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-accent transition-colors text-destructive"
          >
            <LogOut className="size-4" />
            <span className="font-medium">ログアウト</span>
          </button>
        </Card>
      </div>
    </div>
  );
}
