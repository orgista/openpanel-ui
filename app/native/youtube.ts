// Locked-down YouTube links for the kiosk. An admin can add a YouTube URL and it
// plays in an embedded, sandboxed player — playback controls only, no
// recommendations grid, channel browsing, or escape to the full YouTube site.
// Stored in localStorage (persists in the Capacitor WebView). Mirrors the legacy
// launcher's youtube-nocookie approach.

const KEY = "openpanel.youtube.v1";

export interface KioskVideo {
  videoId: string;
  title: string;
  addedAt: number;
}

// Strip query/fragment leftovers and accept only plausible 11-char-ish ids.
function cleanId(value: string | null | undefined): string {
  if (!value) return "";
  const id = value.split(/[?&/#]/)[0].trim();
  return /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : "";
}

/** Extract a YouTube video id from a watch/share/embed/shorts/live URL or bare id. */
export function parseYouTubeId(input: string): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return "";

  let url: URL | null = null;
  try {
    url = new URL(trimmed);
  } catch {
    return cleanId(trimmed); // bare id pasted directly
  }

  const host = url.hostname.toLowerCase();
  if (host.endsWith("youtu.be")) return cleanId(url.pathname.slice(1));
  if (host.includes("youtube")) {
    const v = url.searchParams.get("v");
    if (v) return cleanId(v);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "live");
    if (idx >= 0 && parts[idx + 1]) return cleanId(parts[idx + 1]);
  }
  return "";
}

export function isValidYouTubeUrl(input: string): boolean {
  return parseYouTubeId(input) !== "";
}

/** Privacy-domain embed with related content and branding minimized. */
export function embedUrl(videoId: string): string {
  return (
    `https://www.youtube-nocookie.com/embed/${videoId}` +
    `?autoplay=1&playsinline=1&controls=1&rel=0&modestbranding=1&fs=1&iv_load_policy=3`
  );
}

export function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function getVideos(): KioskVideo[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as KioskVideo[];
    return Array.isArray(list) ? list.filter((v) => v && v.videoId) : [];
  } catch {
    return [];
  }
}

function save(list: KioskVideo[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

/** Add a video by URL/id. Returns the stored entry, or null if the input was invalid. */
export function addVideo(input: string, title?: string): KioskVideo | null {
  const videoId = parseYouTubeId(input);
  if (!videoId) return null;

  const list = getVideos();
  const existing = list.find((v) => v.videoId === videoId);
  if (existing) {
    if (title && title.trim()) {
      existing.title = title.trim();
      save(list);
    }
    return existing;
  }

  const entry: KioskVideo = {
    videoId,
    title: title?.trim() || `YouTube Video ${videoId}`,
    addedAt: Date.now(),
  };
  save([...list, entry]);
  return entry;
}

export function removeVideo(videoId: string): void {
  save(getVideos().filter((v) => v.videoId !== videoId));
}
