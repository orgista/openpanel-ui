import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Loader2, Play, RefreshCw, Youtube } from "lucide-react";

import {
  SystemBridge,
  type YouTubeChannelVideoResult,
} from "../native/SystemBridge";
import {
  channelIdForYouTubeItem,
  type KioskYouTubeItem,
} from "../native/youtube";
import { recordDiagnostic } from "../native/diagnostics";

interface YouTubeChannelBrowserProps {
  item: KioskYouTubeItem;
  active?: boolean;
  onClose: () => void;
  onPlay: (video: YouTubeChannelVideoResult) => void;
}

const readableFeedError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/re-added|verified channel/i.test(message)) {
    return "Remove and re-add this channel in Admin to enable video browsing.";
  }
  if (/rate|limit|429/i.test(message)) {
    return "YouTube is temporarily limiting this channel. Try again shortly.";
  }
  if (/network|connect|timeout/i.test(message)) {
    return "OpenPanel could not reach YouTube. Check this device's network.";
  }
  return message || "OpenPanel could not load this channel's recent videos.";
};

const publishedLabel = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.trim() || "Upload";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export function mergeChannelVideos(
  current: YouTubeChannelVideoResult[],
  next: YouTubeChannelVideoResult[],
): YouTubeChannelVideoResult[] {
  const known = new Set(current.map((video) => video.videoId));
  return [...current, ...next.filter((video) => !known.has(video.videoId))];
}

export function channelGridTargetIndex(
  index: number,
  key: string,
  itemCount: number,
  columns: number,
): number | null {
  const offset = key === "ArrowLeft" ? -1
    : key === "ArrowRight" ? 1
      : key === "ArrowUp" ? -columns
        : key === "ArrowDown" ? columns : 0;
  if (!offset) return null;
  const targetIndex = index + offset;
  if (targetIndex < 0 || targetIndex >= itemCount) return null;
  if (key === "ArrowLeft" && index % columns === 0) return null;
  if (key === "ArrowRight" && index % columns === columns - 1) return null;
  return targetIndex;
}

export function YouTubeChannelBrowser({
  item,
  active = true,
  onClose,
  onPlay,
}: YouTubeChannelBrowserProps) {
  const [videos, setVideos] = useState<YouTubeChannelVideoResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [catalogSource, setCatalogSource] = useState<"channel-page" | "recent-feed">("channel-page");
  const videoRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const loadMoreRef = useRef<HTMLButtonElement | null>(null);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const channelId = channelIdForYouTubeItem(item);
      if (!channelId) throw new Error("This channel must be re-added before its videos can be explored.");
      const response = await SystemBridge.getYouTubeChannelVideos({ channelId });
      setVideos(response.videos);
      setNextPageToken(response.nextPageToken ?? null);
      setCatalogSource(response.catalogSource ?? "recent-feed");
      setLoadMoreError(null);
    } catch (feedError) {
      setVideos([]);
      setError(readableFeedError(feedError));
      recordDiagnostic("error", "YouTube channel videos failed to load", {
        channel: item.sourceLabel,
        error: feedError,
      });
    } finally {
      setLoading(false);
    }
  }, [item]);

  const loadMore = useCallback(async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const channelId = channelIdForYouTubeItem(item);
      if (!channelId) throw new Error("This channel must be re-added before its videos can be explored.");
      const response = await SystemBridge.getYouTubeChannelVideos({
        channelId,
        pageToken: nextPageToken,
      });
      setVideos((current) => mergeChannelVideos(current, response.videos));
      setNextPageToken(response.nextPageToken ?? null);
      setCatalogSource(response.catalogSource ?? "channel-page");
    } catch (pageError) {
      setLoadMoreError(readableFeedError(pageError));
      recordDiagnostic("error", "Older YouTube channel videos failed to load", {
        channel: item.sourceLabel,
        error: pageError,
      });
    } finally {
      setLoadingMore(false);
    }
  }, [item, loadingMore, nextPageToken]);

  useEffect(() => { loadVideos(); }, [loadVideos]);

  useEffect(() => {
    if (!active || videos.length === 0) return;
    const focusTimer = window.setTimeout(() => videoRefs.current[0]?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [active, loading]);

  useEffect(() => {
    const target = loadMoreRef.current;
    // After a failed page load, stop auto-fetching: the sentinel is still on
    // screen so the observer would otherwise re-fire loadMore in a tight loop
    // (and hammer a rate-limited channel). The visible "Load older videos"
    // button lets the user retry manually, which clears the error.
    if (!active || !target || !nextPageToken || loadingMore || loadMoreError) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "360px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [active, loadMore, loadingMore, loadMoreError, nextPageToken, videos.length]);

  const moveFocus = (index: number, key: string): boolean => {
    const columns = window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1;
    const targetIndex = channelGridTargetIndex(index, key, videos.length, columns);
    if (targetIndex === null) return false;
    const target = videoRefs.current[targetIndex];
    if (!target) return false;
    target.focus();
    target.scrollIntoView({ block: "nearest", inline: "nearest" });
    return true;
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      data-dpad-scope
      aria-label={`Explore ${item.title}`}
      aria-hidden={!active}
      className="fixed inset-0 z-[90] flex flex-col bg-[oklch(11%_0_0)] text-white"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <header className="shrink-0 flex items-center gap-4 px-6 sm:px-10 py-5 border-b border-white/10 bg-black/30">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to OpenPanel home"
          className="shrink-0 size-12 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
        >
          <ArrowLeft className="size-6" />
        </button>
        {item.thumbnailUrl ? (
          <img src={item.thumbnailUrl} alt="" className="size-14 rounded-xl object-cover bg-black" draggable={false} />
        ) : (
          <div className="size-14 rounded-xl bg-gradient-to-br from-red-600 to-red-950 flex items-center justify-center">
            <Youtube className="size-7" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl truncate" style={{ fontWeight: 650 }}>{item.title}</h2>
          <p className="text-white/55 text-sm">
            {videos.length > 0 ? `${videos.length} videos loaded` : "Browse channel videos"}
          </p>
        </div>
        <button
          type="button"
          onClick={loadVideos}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-7">
        {loading ? (
          <div role="status" className="h-full min-h-64 flex flex-col items-center justify-center text-white/65">
            <Loader2 className="size-9 animate-spin mb-4" />
            <p>Loading channel videos…</p>
          </div>
        ) : error ? (
          <div role="alert" className="h-full min-h-64 flex flex-col items-center justify-center text-center">
            <p className="text-[oklch(72%_0.18_22)] max-w-lg mb-5">{error}</p>
            <button
              type="button"
              onClick={loadVideos}
              className="px-5 py-3 rounded-lg bg-white text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
              style={{ fontWeight: 600 }}
            >
              Try again
            </button>
          </div>
        ) : videos.length === 0 ? (
          <div className="h-full min-h-64 flex items-center justify-center text-white/55">
            No videos are available for this channel.
          </div>
        ) : (
          <>
            {catalogSource === "recent-feed" && (
              <div role="status" className="mb-5 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-amber-100 text-sm">
                Showing recent uploads. YouTube's older channel catalog is temporarily unavailable.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {videos.map((video, index) => (
                <button
                  key={video.videoId}
                  ref={(element) => { videoRefs.current[index] = element; }}
                  type="button"
                  onClick={() => onPlay(video)}
                  onKeyDown={(event) => {
                    if (event.key.startsWith("Arrow") && moveFocus(index, event.key)) {
                      event.preventDefault();
                    }
                  }}
                  aria-label={`Play ${video.title}`}
                  className="group text-left rounded-xl overflow-hidden bg-[oklch(20%_0_0)] border border-white/10 hover:border-white/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/90 transition-all"
                >
                  <div className="relative aspect-video bg-black overflow-hidden">
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03] group-focus:scale-[1.03]"
                      draggable={false}
                    />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/35 group-focus:bg-black/35 transition-colors" />
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
                      <span className="size-14 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                        <Play className="size-6 ml-0.5" fill="currentColor" />
                      </span>
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="line-clamp-2 leading-snug min-h-11" style={{ fontWeight: 600 }}>{video.title}</h3>
                    <p className="text-white/50 text-xs mt-2">{publishedLabel(video.publishedAt)}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="min-h-32 py-8 flex flex-col items-center justify-center gap-3">
              {nextPageToken ? (
                <button
                  ref={loadMoreRef}
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-black disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
                  style={{ fontWeight: 650 }}
                >
                  {loadingMore && <Loader2 className="size-4 animate-spin" />}
                  {loadingMore ? "Loading older videos…" : "Load older videos"}
                </button>
              ) : catalogSource === "channel-page" ? (
                <p className="text-white/45 text-sm">All available channel videos loaded</p>
              ) : null}
              {loadMoreError && (
                <p role="alert" className="text-[oklch(72%_0.18_22)] text-sm text-center max-w-xl">
                  {loadMoreError}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </motion.section>
  );
}
