import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ListVideo, Maximize, X } from "lucide-react";
import { channelIdForYouTubeItem, embedUrl, thumbnailUrl, type KioskYouTubeItem } from "../native/youtube";
import { SystemBridge, type YouTubeChannelVideoResult } from "../native/SystemBridge";
import { ArtImage, LetterAvatar } from "./ArtImage";
import { recordDiagnostic } from "../native/diagnostics";

interface YouTubePlayerProps {
  item: KioskYouTubeItem;
  allowSameChannelRecommendations: boolean;
  onClose: () => void;
}

interface YouTubePlayerInstance {
  destroy(): void;
  getVideoData?(): { title?: string; video_id?: string };
  loadVideoById?(videoId: string): void;
}

interface YouTubePlayerEvent {
  data: number;
  target: YouTubePlayerInstance;
}

interface YouTubeApi {
  Player: new (
    element: string | HTMLIFrameElement,
    options: {
      events: {
        onReady: (event: YouTubePlayerEvent) => void;
        onStateChange: (event: YouTubePlayerEvent) => void;
        onError: (event: YouTubePlayerEvent) => void;
      };
    },
  ) => YouTubePlayerInstance;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let iframeApiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeIframeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (iframeApiPromise) return iframeApiPromise;

  iframeApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => {
      iframeApiPromise = null;
      reject(new Error("YouTube player controls timed out"));
    }, 15_000);
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      window.clearTimeout(timeout);
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube player controls were unavailable"));
    };

    // We only get here on a fresh attempt — an in-flight load returns the cached
    // promise above. So any tag already in the DOM is a corpse from a previous
    // attempt that errored or timed out (both reset iframeApiPromise to null but
    // used to leave the tag behind, which made every retry find `existing`,
    // bail without re-appending, wait 15s, and reject). Remove the stale tag and
    // append a fresh one so recovery works without an app restart.
    document.querySelector('script[data-openpanel-youtube-api="true"]')?.remove();
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.dataset.openpanelYoutubeApi = "true";
    script.onerror = () => {
      window.clearTimeout(timeout);
      iframeApiPromise = null;
      script.remove();
      reject(new Error("YouTube player controls could not load"));
    };
    document.head.appendChild(script);
  });

  return iframeApiPromise;
}

export function shouldReturnToChannel(
  playerState: number,
  allowSameChannelRecommendations: boolean,
): boolean {
  return playerState === 0 && !allowSameChannelRecommendations;
}

export function isPlaybackExitKey(key: string): boolean {
  return key === "Escape" || key === "BrowserBack" || key === "Backspace";
}

export function shouldRevealPlaybackControls(key: string): boolean {
  return key.length > 0 && !isPlaybackExitKey(key);
}

// Locked full-screen playback. The official YouTube iframe fills the entire
// viewport behind OpenPanel's auto-hiding Exit / Full Screen bar. The
// iframe sandbox omits top-navigation and popups so playback cannot leave the
// kiosk. YouTube's rel=0 mode restricts recommendations to the current
// channel; admins can instead make ENDED return to OpenPanel immediately.
export function YouTubePlayer({ item, allowSameChannelRecommendations, onClose }: YouTubePlayerProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const controlsRef = useRef<HTMLElement | null>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const hideControlsTimerRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  const closedRef = useRef(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(item.title);
  const [relatedVideos, setRelatedVideos] = useState<YouTubeChannelVideoResult[]>([]);
  const relatedVideosRef = useRef<YouTubeChannelVideoResult[]>([]);
  const [relatedChannelTitle, setRelatedChannelTitle] = useState("");
  const [showRelated, setShowRelated] = useState(false);
  const [videoOverride, setVideoOverride] = useState<string | null>(null);
  const channelId = allowSameChannelRecommendations ? channelIdForYouTubeItem(item) : "";

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const closePlayer = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    recordDiagnostic("info", "YouTube playback closed", { sourceId: item.sourceId });
    if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
      void document.exitFullscreen().catch(() => undefined);
    }
    onCloseRef.current();
  }, [item.sourceId]);

  const hideControls = useCallback(() => {
    if (hideControlsTimerRef.current !== null) {
      window.clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
    if (controlsRef.current?.contains(document.activeElement)) {
      surfaceRef.current?.focus({ preventScroll: true });
    }
    setControlsVisible(false);
  }, []);

  const revealControls = useCallback((focusFirstControl = false) => {
    setControlsVisible(true);
    if (hideControlsTimerRef.current !== null) {
      window.clearTimeout(hideControlsTimerRef.current);
    }
    hideControlsTimerRef.current = window.setTimeout(hideControls, 5_000);
    if (focusFirstControl) {
      window.setTimeout(() => {
        controlsRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
      }, 0);
    }
  }, [hideControls]);

  useEffect(() => {
    surfaceRef.current?.focus({ preventScroll: true });
    return () => {
      if (hideControlsTimerRef.current !== null) {
        window.clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    closedRef.current = false;
    setCurrentTitle(item.title);
    setVideoOverride(null);
    setShowRelated(false);
    recordDiagnostic("info", "YouTube playback opened", {
      kind: item.kind,
      sourceId: item.sourceId,
      title: item.title,
    });
  }, [item]);

  // Same-channel picker: preload the approved channel's videos so the viewer
  // can choose another one from inside the player (and when playback ends).
  useEffect(() => {
    if (!channelId) {
      setRelatedVideos([]);
      return;
    }
    let cancelled = false;
    SystemBridge.getYouTubeChannelVideos({ channelId })
      .then((response) => {
        if (cancelled) return;
        setRelatedChannelTitle(response.channelTitle.trim());
        const videos = response.videos.slice(0, 12);
        setRelatedVideos(videos);
        relatedVideosRef.current = videos;
      })
      .catch(() => {
        if (!cancelled) setRelatedVideos([]);
      });
    return () => { cancelled = true; };
  }, [channelId]);

  const playRelatedVideo = useCallback((video: YouTubeChannelVideoResult) => {
    setShowRelated(false);
    setCurrentTitle(video.title);
    recordDiagnostic("info", "Same-channel video selected in player", { videoId: video.videoId });
    const player = playerRef.current;
    if (player?.loadVideoById) {
      player.loadVideoById(video.videoId);
    } else {
      // No JS API (script blocked/slow) — swap the iframe to the chosen video.
      setVideoOverride(video.videoId);
    }
    surfaceRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let disposed = false;
    let player: YouTubePlayerInstance | null = null;

    loadYouTubeIframeApi()
      .then((api) => {
        if (disposed) return;
        player = new api.Player(iframe.id, {
          events: {
            onReady: (event) => {
              if (disposed) return;
              playerRef.current = event.target;
              const videoData = event.target.getVideoData?.();
              if (videoData?.title) setCurrentTitle(videoData.title);
            },
            onStateChange: (event) => {
              if (disposed) return;
              if (event.data === 1) {
                const videoData = event.target.getVideoData?.();
                if (videoData?.title) setCurrentTitle(videoData.title);
                setShowRelated(false);
              }
              if (shouldReturnToChannel(event.data, allowSameChannelRecommendations)) {
                recordDiagnostic("info", "YouTube playback ended; returning to channel", {
                  sourceId: item.sourceId,
                });
                closePlayer();
                return;
              }
              // Video ended with same-channel picks allowed: surface OUR picker
              // instead of relying on the embed's end screen.
              if (event.data === 0 && item.kind === "video") {
                setShowRelated((current) => current || relatedVideosRef.current.length > 0);
              }
            },
            onError: (event) => {
              recordDiagnostic("error", "YouTube player reported an error", {
                sourceId: item.sourceId,
                code: event.data,
              });
            },
          },
        });
        playerRef.current = player;
      })
      .catch((error) => {
        recordDiagnostic("warning", "Enhanced YouTube controls unavailable", { error });
      });

    return () => {
      disposed = true;
      playerRef.current = null;
      try { player?.destroy(); } catch { /* iframe is already leaving */ }
    };
  }, [allowSameChannelRecommendations, closePlayer, item.sourceId]);

  const playInFullScreen = async () => {
    try {
      if (!document.fullscreenElement && surfaceRef.current?.requestFullscreen) {
        await surfaceRef.current.requestFullscreen();
      }
    } catch (error) {
      recordDiagnostic("warning", "Full-screen playback request was unavailable", { error });
    } finally {
      hideControls();
      surfaceRef.current?.focus({ preventScroll: true });
    }
  };

  const appOrigin = typeof window === "undefined" ? undefined : window.location.origin;

  return (
    <motion.div
      ref={surfaceRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={`Playing ${currentTitle}`}
      data-dpad-scope
      data-controls-visible={controlsVisible}
      tabIndex={-1}
      className="fixed inset-0 bg-black z-[100]"
      onKeyDownCapture={(event) => {
        if (isPlaybackExitKey(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          closePlayer();
          return;
        }
        if (!shouldRevealPlaybackControls(event.key)) return;
        if (!controlsVisible) {
          event.preventDefault();
          event.stopPropagation();
          revealControls(true);
          return;
        }
        revealControls(false);
      }}
    >
      <iframe
        id="openpanel-youtube-player"
        ref={iframeRef}
        key={videoOverride ?? item.id}
        src={videoOverride
          ? embedUrl({ kind: "video", sourceId: videoOverride, sourceLabel: videoOverride }, appOrigin)
          : embedUrl(item, appOrigin)}
        title={item.title}
        tabIndex={-1}
        className="absolute inset-0 size-full border-0 bg-black"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation"
      />

      {!controlsVisible && (
        <button
          type="button"
          aria-label="Show playback controls"
          onClick={() => revealControls(true)}
          className="absolute inset-0 z-10 cursor-default bg-transparent focus:outline-none"
        />
      )}

      <header
        ref={controlsRef}
        aria-hidden={!controlsVisible}
        className={`absolute inset-x-0 top-0 z-20 flex h-20 items-center justify-end gap-3 border-b border-white/10 bg-black/90 px-5 py-3 text-white transition-transform duration-200 ${
          controlsVisible ? "translate-y-0" : "pointer-events-none -translate-y-full"
        }`}
      >
        {relatedVideos.length > 0 && (
          <button
            type="button"
            onClick={() => { setShowRelated(true); hideControls(); }}
            aria-label="More videos from this channel"
            tabIndex={controlsVisible ? 0 : -1}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/90"
          >
            <ListVideo className="size-5" /> <span>More videos</span>
          </button>
        )}
        <button
          type="button"
          onClick={closePlayer}
          aria-label="Exit video"
          tabIndex={controlsVisible ? 0 : -1}
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/90"
        >
          <X className="size-5" /> <span>Exit</span>
        </button>
        <button
          type="button"
          onClick={() => void playInFullScreen()}
          aria-label="Play in full screen"
          tabIndex={controlsVisible ? 0 : -1}
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white/90"
        >
          <Maximize className="size-5" /> <span>Full Screen</span>
        </button>
      </header>

      {/* Same-channel picker: kiosk-controlled "watch next" (shown on demand
          and when a video ends), instead of YouTube's embed end screen. */}
      {showRelated && relatedVideos.length > 0 && (
        <div
          role="dialog"
          aria-label={`More videos from ${relatedChannelTitle || item.title}`}
          className="absolute inset-0 z-30 flex flex-col bg-black/95 text-white"
        >
          <header className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-6">
            <h2 className="truncate text-xl" style={{ fontWeight: 650 }}>
              More from {relatedChannelTitle || item.title}
            </h2>
            <button
              type="button"
              onClick={() => setShowRelated(false)}
              aria-label="Close video picker"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/90"
            >
              <X className="size-5" /> <span>Close</span>
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {relatedVideos.map((video) => (
                <button
                  key={video.videoId}
                  type="button"
                  onClick={() => playRelatedVideo(video)}
                  aria-label={`Play ${video.title}`}
                  className="group overflow-hidden rounded-xl border border-white/10 bg-[oklch(20%_0_0)] text-left transition-all hover:border-white/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/90"
                >
                  <div className="relative aspect-video overflow-hidden bg-black">
                    <ArtImage
                      src={video.thumbnailUrl || thumbnailUrl(video.videoId)}
                      className="size-full object-cover"
                      fallback={<LetterAvatar label={video.title} className="size-full text-3xl" />}
                    />
                  </div>
                  <p className="line-clamp-2 p-3 text-sm leading-snug" style={{ fontWeight: 600 }}>
                    {video.title}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
