import { Pause, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { savePlaybackPosition } from "@/lib/episodes";
import { getOfflineAudioBlob } from "@/lib/offline";
import { usePlayerStore } from "@/lib/player-store";

function formatTime(sec: number): string {
  if (!sec || !isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Player() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const episode = usePlayerStore((s) => s.episode);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const podcastTitle = usePlayerStore((s) => s.podcastTitle);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const toggle = usePlayerStore((s) => s.toggle);
  const seek = usePlayerStore((s) => s.seek);
  const skipBack = usePlayerStore((s) => s.skipBack);
  const skipForward = usePlayerStore((s) => s.skipForward);
  const setPosition = usePlayerStore((s) => s.setPosition);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const expand = usePlayerStore((s) => s.expand);
  const close = usePlayerStore((s) => s.close);

  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  // Prefer offline blob if downloaded, fall back to remote audioUrl
  useEffect(() => {
    if (!episode) {
      setResolvedSrc(null);
      return;
    }
    let cancelled = false;
    let blobUrl: string | null = null;
    (async () => {
      try {
        const blob = await getOfflineAudioBlob(episode.id);
        if (cancelled) return;
        if (blob) {
          blobUrl = URL.createObjectURL(blob);
          setResolvedSrc(blobUrl);
        } else {
          setResolvedSrc(episode.audioUrl);
        }
      } catch {
        if (!cancelled) setResolvedSrc(episode.audioUrl);
      }
    })();
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [episode?.id, episode?.audioUrl]);

  // Sync isPlaying → audio element
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !episode) return;
    if (isPlaying) {
      el.play().catch((err) => {
        console.error("playback failed", err);
        pause();
      });
    } else {
      el.pause();
    }
  }, [isPlaying, episode?.id, pause]);

  // Sync seek (when external seek triggers)
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (Math.abs(el.currentTime - position) > 1.5) {
      el.currentTime = position;
    }
  }, [position]);

  // Sync playback rate
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = playbackRate;
  }, [playbackRate]);

  // Media Session API
  useEffect(() => {
    if (!episode || !("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: episode.title,
      artist: podcastTitle ?? "",
      artwork: episode.artwork
        ? [{ src: episode.artwork, sizes: "512x512" }]
        : [],
    });

    navigator.mediaSession.setActionHandler("play", play);
    navigator.mediaSession.setActionHandler("pause", pause);
    navigator.mediaSession.setActionHandler("seekbackward", () => skipBack());
    navigator.mediaSession.setActionHandler("seekforward", () => skipForward());
    navigator.mediaSession.setActionHandler("seekto", (e) => {
      if (typeof e.seekTime === "number") seek(e.seekTime);
    });

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("seekbackward", null);
      navigator.mediaSession.setActionHandler("seekforward", null);
      navigator.mediaSession.setActionHandler("seekto", null);
    };
  }, [episode, podcastTitle, play, pause, seek, skipBack, skipForward]);

  // Periodic position save (every 10s while playing)
  useEffect(() => {
    if (!episode || !isPlaying) return;
    const interval = setInterval(() => {
      const pos = usePlayerStore.getState().position;
      savePlaybackPosition(episode.id, pos).catch(() => {});
    }, 10_000);
    return () => clearInterval(interval);
  }, [episode?.id, isPlaying]);

  // Best-effort save on unmount / episode change
  useEffect(() => {
    if (!episode) return;
    return () => {
      const pos = usePlayerStore.getState().position;
      savePlaybackPosition(episode.id, pos).catch(() => {});
    };
  }, [episode?.id]);

  if (!episode) return null;

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <>
      <audio
        ref={audioRef}
        src={resolvedSrc ?? undefined}
        preload="auto"
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (isFinite(d)) setDuration(d);
        }}
        onPlay={() => play()}
        onPause={() => pause()}
        onEnded={() => {
          savePlaybackPosition(episode.id, duration, true).catch(() => {});
          close();
        }}
      />

      <div className="px-2 sm:px-4 pb-2">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card/90 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
          <div className="h-0.5 bg-secondary">
            <div
              className="h-full brand-gradient transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center gap-3 p-2 pl-3">
            <button
              type="button"
              onClick={expand}
              aria-label="プレイヤーを開く"
              className="flex-1 flex items-center gap-3 min-w-0 text-left"
            >
              {episode.artwork && (
                <img
                  src={episode.artwork}
                  alt=""
                  className="size-10 rounded-lg shrink-0 object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-tight truncate">
                  {episode.title}
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                  {formatTime(position)} / {formatTime(duration)}
                </div>
              </div>
            </button>
            <Button
              variant="gradient"
              size="icon"
              onClick={toggle}
              aria-label={isPlaying ? "一時停止" : "再生"}
              className="shrink-0 size-9"
            >
              {isPlaying ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4 fill-current" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={close}
              aria-label="閉じる"
              className="shrink-0 size-9 text-muted-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
