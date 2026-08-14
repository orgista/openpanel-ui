// Restricted YouTube sources for the kiosk. Admins can add an individual
// video, a playlist, or a channel's uploads feed. Playback stays inside the
// sandboxed youtube-nocookie player and cannot navigate the kiosk to YouTube.

const KEY = "openpanel.youtube.v2";
const LEGACY_KEY = "openpanel.youtube.v1";
const REQUESTED_CHANNELS_SEED_KEY = "openpanel.youtube.requested-channels.v1";

const REQUESTED_CHANNELS = [
  {
    channelId: "UCrNnk0wFBnCS1awGjq_ijGQ",
    title: "PBS KIDS",
    thumbnailUrl: "https://yt3.googleusercontent.com/ZBcGbfxSEOigEe07nPd5AsSrYRO9NLqyxBZ1rGLtFC4Fr6eUqoL5D97U_aHLN4wO-p66Q7sO0g=s900-c-k-c0x00ffffff-no-rj",
  },
  {
    channelId: "UCsooa4yRKGN_zEE8iknghZA",
    title: "TED-Ed",
    thumbnailUrl: "https://yt3.googleusercontent.com/PKUi-Lc3VFjUfsIhjK3n-FJDNBf-XQLdg4G4bv4fPFF96D3MVnkbub9ePpLoWdmdFgl5I1Zd=s900-c-k-c0x00ffffff-no-rj",
  },
  {
    channelId: "UCoookXUzPciGrEZEXmh4Jjg",
    title: "Sesame Street",
    thumbnailUrl: "https://yt3.googleusercontent.com/UqIbNSghcysIlsbnGUxGMcY1Me7_bJ_zCrjz1oy9PueZVo63d1CnIk1tz8sAmTMNX9ojl4MhDQ=s900-c-k-c0x00ffffff-no-rj",
  },
  {
    channelId: "UCVzLLZkDuFGAE2BGdBuBNBg",
    title: "Bluey - Official Channel",
    thumbnailUrl: "https://yt3.googleusercontent.com/7Jlomy-7asRjE8WHiLbAqw-LJq5VdyRpBnXU7yxLi-lqXS_OSB5Kd7MLDv9ybsafyOdi5uzCCQ=s900-c-k-c0x00ffffff-no-rj",
  },
  {
    channelId: "UCfPyVJEBD7Di1YYjTdS2v8g",
    title: "Homeschool Pop",
    thumbnailUrl: "https://yt3.googleusercontent.com/yENC7nbCi2IqwCeDy8T7Kzpcubxt-iz_yR69dlKGXvwufaEJIbk7iYYseVAqMAAoLNrs4hjR=s900-c-k-c0x00ffffff-no-rj",
  },
] as const;

export type YouTubeSourceKind = "video" | "channel" | "playlist";
export type YouTubeListType = "playlist" | "user_uploads";

export interface YouTubeSource {
  kind: YouTubeSourceKind;
  sourceId: string;
  sourceLabel: string;
  listType?: YouTubeListType;
}

export interface KioskYouTubeItem extends YouTubeSource {
  id: string;
  title: string;
  thumbnailUrl?: string;
  addedAt: number;
}

function cleanVideoId(value: string | null | undefined): string {
  if (!value) return "";
  const id = value.split(/[?&/#]/)[0].trim();
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
}

function cleanPlaylistId(value: string | null | undefined): string {
  if (!value) return "";
  const id = value.trim();
  return /^[A-Za-z0-9_-]{10,80}$/.test(id) ? id : "";
}

function cleanChannelId(value: string | null | undefined): string {
  if (!value) return "";
  const id = value.trim();
  return /^UC[A-Za-z0-9_-]{22}$/.test(id) ? id : "";
}

function cleanChannelHandle(value: string | null | undefined): string {
  if (!value) return "";
  const handle = decodeURIComponent(value).trim();
  return /^@[^\s/?#]{3,30}$/u.test(handle) ? handle : "";
}

function cleanUsername(value: string | null | undefined): string {
  if (!value) return "";
  const username = decodeURIComponent(value).trim();
  return /^[A-Za-z0-9._-]{1,100}$/.test(username) ? username : "";
}

function youtubeUrl(input: string): URL | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

function cleanThumbnailUrl(value: string | null | undefined): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return "";
    if (host !== "yt3.googleusercontent.com" && host !== "yt3.ggpht.com") return "";
    return url.toString();
  } catch {
    return "";
  }
}

/** Extract a YouTube video id from a watch/share/embed/shorts/live URL or bare id. */
export function parseYouTubeId(input: string): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return "";

  const url = youtubeUrl(trimmed);
  if (!url) return cleanVideoId(trimmed);

  const host = url.hostname.toLowerCase();
  if (host === "youtu.be") return cleanVideoId(url.pathname.slice(1));
  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    const videoId = url.searchParams.get("v");
    if (videoId) return cleanVideoId(videoId);
    const parts = url.pathname.split("/").filter(Boolean);
    const index = parts.findIndex((part) =>
      part === "embed" || part === "shorts" || part === "live"
    );
    if (index >= 0 && parts[index + 1]) return cleanVideoId(parts[index + 1]);
  }
  return "";
}

/** Parse supported video, playlist, and channel URL forms. */
export function parseYouTubeSource(input: string): YouTubeSource | null {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return null;

  const url = youtubeUrl(trimmed);
  if (!url) {
    const videoId = cleanVideoId(trimmed);
    return videoId
      ? { kind: "video", sourceId: videoId, sourceLabel: videoId }
      : null;
  }

  const host = url.hostname.toLowerCase();
  if (host === "youtu.be") {
    const videoId = cleanVideoId(url.pathname.slice(1));
    return videoId
      ? { kind: "video", sourceId: videoId, sourceLabel: videoId }
      : null;
  }
  if (host !== "youtube.com" && !host.endsWith(".youtube.com")) return null;

  const parts = url.pathname.split("/").filter(Boolean);

  if (parts[0] === "playlist") {
    const playlistId = cleanPlaylistId(url.searchParams.get("list"));
    return playlistId
      ? {
          kind: "playlist",
          sourceId: playlistId,
          sourceLabel: playlistId,
          listType: "playlist",
        }
      : null;
  }

  if (parts[0] === "channel") {
    const channelId = cleanChannelId(parts[1]);
    return channelId
      ? {
          kind: "channel",
          sourceId: `UU${channelId.slice(2)}`,
          sourceLabel: channelId,
          listType: "playlist",
        }
      : null;
  }

  const handle = cleanChannelHandle(parts[0]);
  if (handle) {
    return {
      kind: "channel",
      // The iframe player expects the legacy username-shaped list value and
      // rejects the URL's leading @ character.
      sourceId: handle.slice(1),
      sourceLabel: handle,
      listType: "user_uploads",
    };
  }

  if (parts[0] === "user") {
    const username = cleanUsername(parts[1]);
    return username
      ? {
          kind: "channel",
          sourceId: username,
          sourceLabel: username,
          listType: "user_uploads",
        }
      : null;
  }

  const videoId = parseYouTubeId(trimmed);
  return videoId
    ? { kind: "video", sourceId: videoId, sourceLabel: videoId }
    : null;
}

export function isValidYouTubeUrl(input: string): boolean {
  return parseYouTubeSource(input) !== null;
}

export function channelIdForYouTubeItem(
  item: Pick<YouTubeSource, "kind" | "sourceId" | "sourceLabel">,
): string {
  if (item.kind !== "channel") return "";
  const labelId = cleanChannelId(item.sourceLabel);
  if (labelId) return labelId;
  if (/^UU[A-Za-z0-9_-]{22}$/.test(item.sourceId)) {
    return `UC${item.sourceId.slice(2)}`;
  }
  return "";
}

/** Older entries may contain a technical fallback instead of a channel name. */
export function channelMetadataNeedsRefresh(item: KioskYouTubeItem): boolean {
  if (item.kind !== "channel") return false;
  const title = item.title.trim();
  if (!title) return true;
  if (/^YouTube Channel(?:\s+UC[A-Za-z0-9_-]{22})?$/i.test(title)) return true;
  const identifiers = new Set([
    item.sourceId.trim(),
    item.sourceLabel.trim(),
    channelIdForYouTubeItem(item),
  ].filter(Boolean));
  return identifiers.has(title);
}

/** Keep internal channel IDs out of the launcher while metadata is repaired. */
export function displayTitleForYouTubeItem(item: KioskYouTubeItem): string {
  if (channelMetadataNeedsRefresh(item)) return "YouTube Channel";
  const title = item.title.trim();
  if (title) return title;
  return item.kind === "video"
    ? "YouTube Video"
    : item.kind === "playlist" ? "YouTube Playlist" : "YouTube Channel";
}

/** Privacy-domain embed with official JS controls and no kiosk navigation. */
export function embedUrl(source: YouTubeSource, appOrigin?: string): string {
  const params = new URLSearchParams({
    autoplay: "1",
    playsinline: "1",
    controls: "1",
    rel: "0",
    enablejsapi: "1",
    fs: "1",
    iv_load_policy: "3",
  });
  if (appOrigin && /^https?:\/\/[^/]+$/i.test(appOrigin)) {
    params.set("origin", appOrigin);
  }

  if (source.kind === "video") {
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(source.sourceId)}?${params}`;
  }

  params.set("listType", source.listType ?? "playlist");
  params.set("list", source.sourceId);
  return `https://www.youtube-nocookie.com/embed?${params}`;
}

export function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function itemId(source: YouTubeSource): string {
  return `${source.kind}:${source.sourceLabel}`;
}

function isStoredItem(value: unknown): value is KioskYouTubeItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<KioskYouTubeItem>;
  return (
    typeof item.id === "string" &&
    (item.kind === "video" || item.kind === "channel" || item.kind === "playlist") &&
    typeof item.sourceId === "string" &&
    typeof item.sourceLabel === "string" &&
    typeof item.title === "string" &&
    (item.thumbnailUrl === undefined || typeof item.thumbnailUrl === "string") &&
    typeof item.addedAt === "number"
  );
}

function save(list: KioskYouTubeItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

function migrateLegacyVideos(): KioskYouTubeItem[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const legacy = JSON.parse(raw) as Array<{
      videoId?: unknown;
      title?: unknown;
      addedAt?: unknown;
    }>;
    if (!Array.isArray(legacy)) return [];
    return legacy.flatMap((entry) => {
      const videoId = typeof entry?.videoId === "string"
        ? cleanVideoId(entry.videoId)
        : "";
      if (!videoId) return [];
      return [{
        id: `video:${videoId}`,
        kind: "video" as const,
        sourceId: videoId,
        sourceLabel: videoId,
        title: typeof entry.title === "string" && entry.title.trim()
          ? entry.title.trim()
          : `YouTube Video ${videoId}`,
        addedAt: typeof entry.addedAt === "number" ? entry.addedAt : Date.now(),
      }];
    });
  } catch {
    return [];
  }
}

export function getYouTubeItems(): KioskYouTubeItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const list = JSON.parse(raw) as unknown;
      return Array.isArray(list) ? list.filter(isStoredItem) : [];
    }
  } catch {
    // Fall through to the v1 migration instead of losing configured videos.
  }

  const migrated = migrateLegacyVideos();
  if (migrated.length > 0) save(migrated);
  return migrated;
}

/** Add this tablet's requested channels once while preserving later removals. */
export function initializeApprovedYouTubeItems(): KioskYouTubeItem[] {
  try {
    if (localStorage.getItem(REQUESTED_CHANNELS_SEED_KEY) !== "1") {
      for (const channel of REQUESTED_CHANNELS) {
        addYouTubeItem(
          `https://www.youtube.com/channel/${channel.channelId}`,
          channel.title,
          channel.thumbnailUrl,
        );
      }
      localStorage.setItem(REQUESTED_CHANNELS_SEED_KEY, "1");
    }
  } catch {
    // Storage may be unavailable in a restricted browser context. The caller
    // still receives whatever sources are currently readable.
  }
  return getYouTubeItems();
}

/** Add a supported URL/id. Returns null when the input is not a supported source. */
export function addYouTubeItem(
  input: string,
  title?: string,
  thumbnailUrl?: string | null,
): KioskYouTubeItem | null {
  const source = parseYouTubeSource(input);
  if (!source) return null;

  const list = getYouTubeItems();
  const id = itemId(source);
  const verifiedThumbnailUrl = cleanThumbnailUrl(thumbnailUrl);
  const existing = list.find((item) => item.id === id);
  if (existing) {
    if (title?.trim()) {
      existing.title = title.trim();
    }
    if (verifiedThumbnailUrl) existing.thumbnailUrl = verifiedThumbnailUrl;
    save(list);
    return existing;
  }

  const kindLabel = source.kind === "video"
    ? "Video"
    : source.kind === "channel" ? "Channel" : "Playlist";
  const entry: KioskYouTubeItem = {
    ...source,
    id,
    title: title?.trim() || `YouTube ${kindLabel} ${source.sourceLabel}`,
    ...(verifiedThumbnailUrl ? { thumbnailUrl: verifiedThumbnailUrl } : {}),
    addedAt: Date.now(),
  };
  save([...list, entry]);
  return entry;
}

export function removeYouTubeItem(id: string): void {
  save(getYouTubeItems().filter((item) => item.id !== id));
}
