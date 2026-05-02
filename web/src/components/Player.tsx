import { Pause, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { savePlaybackPosition } from "@/lib/episodes";
import { formatTimestamp } from "@/lib/format";
import { getOfflineAudioBlob } from "@/lib/offline";
import { usePlayerStore } from "@/lib/player-store";

export function Player() {
  const audioRef = useRef<HTMLAudioElement>(null);

  const {
    episode,
    podcastTitle,
    isPlaying,
    position,
    duration,
    playbackRate,
    error,
    loadVersion,
  } = usePlayerStore(
    useShallow((s) => ({
      episode: s.episode,
      podcastTitle: s.podcastTitle,
      isPlaying: s.isPlaying,
      position: s.position,
      duration: s.duration,
      playbackRate: s.playbackRate,
      error: s.error,
      loadVersion: s.loadVersion,
    })),
  );
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const toggle = usePlayerStore((s) => s.toggle);
  const seek = usePlayerStore((s) => s.seek);
  const skipBack = usePlayerStore((s) => s.skipBack);
  const skipForward = usePlayerStore((s) => s.skipForward);
  const setPosition = usePlayerStore((s) => s.setPosition);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setError = usePlayerStore((s) => s.setError);
  const expand = usePlayerStore((s) => s.expand);
  const close = usePlayerStore((s) => s.close);

  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  // If true, we already attempted blob playback and should now use remote URL.
  const [blobFailed, setBlobFailed] = useState(false);

  // Resolve audio src: prefer offline blob unless already failed
  useEffect(() => {
    if (!episode) {
      setResolvedSrc(null);
      setBlobFailed(false);
      return;
    }
    let cancelled = false;
    let blobUrl: string | null = null;
    (async () => {
      try {
        const blob = blobFailed ? null : await getOfflineAudioBlob(episode.id);
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
  }, [episode?.id, episode?.audioUrl, blobFailed, loadVersion]);

  // Sync isPlaying → audio element
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !episode) return;
    if (isPlaying) {
      el.play().catch((err) => {
        console.error("playback failed", err);
        setError({ kind: "playback", message: friendlyError(err) });
      });
    } else {
      el.pause();
    }
  }, [isPlaying, episode?.id, setError, loadVersion]);

  // Apply pending seek during playback (chapters, slider commit, skip buttons).
  // pendingSeek before audio is ready is consumed in onLoadedMetadata.
  const pendingSeek = usePlayerStore((s) => s.pendingSeek);
  useEffect(() => {
    if (pendingSeek == null) return;
    const el = audioRef.current;
    if (!el || el.readyState < 1) return;
    if (Math.abs(el.currentTime - pendingSeek) > 0.5) {
      el.currentTime = pendingSeek;
    }
    usePlayerStore.getState().consumePendingSeek();
  }, [pendingSeek]);

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
      savePlaybackPosition(episode.id, pos).catch((e) => {
        console.warn("savePlaybackPosition failed", e);
      });
    }, 10_000);
    return () => clearInterval(interval);
  }, [episode?.id, isPlaying]);

  // Best-effort save on unmount / episode change
  useEffect(() => {
    if (!episode) return;
    return () => {
      const pos = usePlayerStore.getState().position;
      savePlaybackPosition(episode.id, pos).catch((e) => {
        console.warn("savePlaybackPosition failed (cleanup)", e);
      });
    };
  }, [episode?.id]);

  if (!episode) return null;

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  function consumePendingSeek() {
    const el = audioRef.current;
    if (!el) return;
    const pending = usePlayerStore.getState().consumePendingSeek();
    if (pending != null && Math.abs(el.currentTime - pending) > 1) {
      el.currentTime = pending;
    }
  }

  return (
    <>
      <audio
        ref={audioRef}
        src={resolvedSrc ?? undefined}
        preload="auto"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (isFinite(d)) setDuration(d);
          consumePendingSeek();
        }}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (isFinite(d)) setDuration(d);
        }}
        onPlay={() => play()}
        onPause={() => pause()}
        onEnded={() => {
          savePlaybackPosition(episode.id, duration, true).catch(() => {});
          // Stop but keep episode loaded so user can replay
          pause();
          seek(0);
        }}
        onError={() => {
          if (resolvedSrc?.startsWith("blob:") && !blobFailed) {
            // Offline blob is corrupted — fallback to remote URL
            console.warn("blob playback failed, falling back to remote");
            setBlobFailed(true);
          } else {
            setError({
              kind: "load",
              message: "音声を読み込めませんでした",
            });
          }
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
          {error && (
            <div className="px-3 py-1.5 text-[11px] text-destructive border-b border-border bg-destructive/5">
              {error.message}
            </div>
          )}
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
                  {formatTimestamp(position)} / {formatTimestamp(duration)}
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
              aria-label="再生を終了"
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

function friendlyError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError")
      return "ブラウザが自動再生を拒否しました。再生ボタンを押してください。";
    if (err.name === "NotSupportedError") return "音声フォーマット未対応です";
    if (err.name === "AbortError") return "読み込みが中断されました";
  }
  return err instanceof Error ? err.message : "再生に失敗しました";
}
