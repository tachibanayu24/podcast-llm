import { Bookmark, ChevronDown, Pause, Play, RotateCcw, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useWatchlistToggle } from "@/hooks/useWatchlistToggle";
import { usePlayerStore } from "@/lib/player-store";
import { cn } from "@/lib/utils";

const RATES = [1, 1.25, 1.5, 1.75, 2] as const;

function formatTime(sec: number): string {
  if (!sec || !isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlayerSheet() {
  const isExpanded = usePlayerStore((s) => s.isExpanded);
  const episode = usePlayerStore((s) => s.episode);
  const podcastTitle = usePlayerStore((s) => s.podcastTitle);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const toggle = usePlayerStore((s) => s.toggle);
  const seek = usePlayerStore((s) => s.seek);
  const skipBack = usePlayerStore((s) => s.skipBack);
  const skipForward = usePlayerStore((s) => s.skipForward);
  const setRate = usePlayerStore((s) => s.setRate);
  const collapse = usePlayerStore((s) => s.collapse);
  const close = usePlayerStore((s) => s.close);

  useEffect(() => {
    if (!isExpanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") collapse();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isExpanded, collapse]);

  useEffect(() => {
    if (!isExpanded) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = orig;
    };
  }, [isExpanded]);

  if (!episode) return null;

  const remaining = Math.max(0, duration - position);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-transform duration-300 ease-out",
        isExpanded ? "translate-y-0" : "translate-y-full pointer-events-none",
      )}
      aria-hidden={!isExpanded}
      role="dialog"
      aria-modal="true"
      aria-label="プレイヤー"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-background overflow-hidden">
        {episode.artwork && (
          <>
            <img
              src={episode.artwork}
              alt=""
              className="absolute inset-0 size-full object-cover opacity-30 blur-3xl scale-125"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
          </>
        )}
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col px-6 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={collapse}
            aria-label="閉じる"
            className="shrink-0"
          >
            <ChevronDown className="size-6" />
          </Button>
          <div className="text-xs text-muted-foreground truncate text-center flex-1">
            {podcastTitle ?? ""}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              close();
            }}
            aria-label="再生を終了"
            className="shrink-0 text-muted-foreground"
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Artwork */}
        <div className="flex-1 flex items-center justify-center py-6 sm:py-10 min-h-0">
          {episode.artwork ? (
            <img
              src={episode.artwork}
              alt=""
              className="aspect-square w-full max-w-[min(80vw,360px)] rounded-2xl object-cover shadow-2xl shadow-black/60 ring-1 ring-white/10"
            />
          ) : (
            <div className="aspect-square w-full max-w-[min(80vw,360px)] rounded-2xl bg-secondary" />
          )}
        </div>

        {/* Title + meta */}
        <div className="space-y-1 text-center">
          <h2 className="text-lg sm:text-xl font-bold leading-snug line-clamp-2">
            {episode.title}
          </h2>
          {podcastTitle && (
            <p className="text-xs text-muted-foreground truncate">
              {podcastTitle}
            </p>
          )}
        </div>

        {/* Seek */}
        <div className="mt-6 space-y-1.5">
          <input
            type="range"
            min={0}
            max={duration > 0 ? duration : 1}
            value={position}
            step={1}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="シーク"
            className="player-range w-full"
            style={
              {
                "--progress": `${duration > 0 ? (position / duration) * 100 : 0}%`,
              } as React.CSSProperties
            }
          />
          <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
            <span>{formatTime(position)}</span>
            <span>-{formatTime(remaining)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-4 flex items-center justify-center gap-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={skipBack}
            aria-label="15秒戻る"
            className="size-12"
          >
            <div className="relative">
              <RotateCcw className="size-7" />
              <span className="absolute inset-0 grid place-items-center text-[9px] font-bold mt-[1px]">
                15
              </span>
            </div>
          </Button>
          <Button
            variant="gradient"
            size="icon"
            onClick={toggle}
            aria-label={isPlaying ? "一時停止" : "再生"}
            className="size-16 shadow-xl shadow-primary/30"
          >
            {isPlaying ? (
              <Pause className="size-7" />
            ) : (
              <Play className="size-7 fill-current ml-0.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={skipForward}
            aria-label="30秒進む"
            className="size-12"
          >
            <div className="relative">
              <RotateCcw className="size-7 -scale-x-100" />
              <span className="absolute inset-0 grid place-items-center text-[9px] font-bold mt-[1px]">
                30
              </span>
            </div>
          </Button>
        </div>

        {/* Bottom row: watchlist + speed */}
        <div className="mt-6 grid grid-cols-3 items-center">
          <div className="justify-self-start">
            <WatchlistButton />
          </div>
          <div className="flex items-center justify-center gap-1">
            {RATES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRate(r)}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-semibold rounded-full transition-colors tabular-nums",
                  playbackRate === r
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r}x
              </button>
            ))}
          </div>
          <div className="justify-self-end" />
        </div>
      </div>
    </div>
  );
}

function WatchlistButton() {
  const episode = usePlayerStore((s) => s.episode);
  const mutation = useWatchlistToggle(episode!);
  if (!episode) return null;
  const inWatchlist = episode.isInWatchlist;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => mutation.mutate(!inWatchlist)}
      disabled={mutation.isPending}
      aria-label={inWatchlist ? "あとで聴くから外す" : "あとで聴く"}
      aria-pressed={inWatchlist}
      className="size-11"
    >
      <Bookmark
        className={cn(
          "size-5 transition-colors",
          inWatchlist
            ? "fill-primary text-primary"
            : "text-muted-foreground",
        )}
      />
    </Button>
  );
}
