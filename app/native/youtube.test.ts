import { beforeEach, describe, expect, it } from "vitest";
import {
  addYouTubeItem,
  channelMetadataNeedsRefresh,
  channelIdForYouTubeItem,
  displayTitleForYouTubeItem,
  embedUrl,
  getYouTubeItems,
  initializeApprovedYouTubeItems,
  parseYouTubeId,
  parseYouTubeSource,
  removeYouTubeItem,
} from "./youtube";

describe("parseYouTubeId", () => {
  it("accepts official YouTube URL forms and bare IDs", () => {
    expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ?t=10")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("rejects lookalike hosts and malformed IDs", () => {
    expect(parseYouTubeId("https://youtube.example/watch?v=dQw4w9WgXcQ")).toBe("");
    expect(parseYouTubeId("https://notyoutu.be/dQw4w9WgXcQ")).toBe("");
    expect(parseYouTubeId("too-short")).toBe("");
  });
});

describe("parseYouTubeSource", () => {
  it("accepts canonical channel IDs and converts them to the uploads playlist", () => {
    expect(
      parseYouTubeSource("https://www.youtube.com/channel/UCBR8-60-B28hp2BmDPdntcQ"),
    ).toEqual({
      kind: "channel",
      sourceId: "UUBR8-60-B28hp2BmDPdntcQ",
      sourceLabel: "UCBR8-60-B28hp2BmDPdntcQ",
      listType: "playlist",
    });
  });

  it("accepts modern handle and legacy username channel URLs", () => {
    expect(parseYouTubeSource("https://www.youtube.com/@GoogleDevelopers/videos")).toEqual({
      kind: "channel",
      sourceId: "GoogleDevelopers",
      sourceLabel: "@GoogleDevelopers",
      listType: "user_uploads",
    });
    expect(parseYouTubeSource("https://www.youtube.com/user/GoogleDevelopers")).toEqual({
      kind: "channel",
      sourceId: "GoogleDevelopers",
      sourceLabel: "GoogleDevelopers",
      listType: "user_uploads",
    });
  });

  it("accepts playlist URLs without mistaking lookalike hosts for YouTube", () => {
    expect(
      parseYouTubeSource("https://www.youtube.com/playlist?list=PL590L5WQmH8fJ54F9f1TGlVallEFJbM5N"),
    ).toEqual({
      kind: "playlist",
      sourceId: "PL590L5WQmH8fJ54F9f1TGlVallEFJbM5N",
      sourceLabel: "PL590L5WQmH8fJ54F9f1TGlVallEFJbM5N",
      listType: "playlist",
    });
    expect(
      parseYouTubeSource("https://youtube.example/@GoogleDevelopers"),
    ).toBeNull();
  });

  it("builds restricted embeds for videos and channel feeds", () => {
    const videoUrl = new URL(
      embedUrl(
        { kind: "video", sourceId: "dQw4w9WgXcQ", sourceLabel: "dQw4w9WgXcQ" },
        "https://localhost",
      ),
    );
    expect(videoUrl.pathname).toBe("/embed/dQw4w9WgXcQ");
    expect(videoUrl.searchParams.get("enablejsapi")).toBe("1");
    expect(videoUrl.searchParams.get("rel")).toBe("0");
    expect(videoUrl.searchParams.get("origin")).toBe("https://localhost");
    const channelUrl = new URL(
      embedUrl({
        kind: "channel",
        sourceId: "UUBR8-60-B28hp2BmDPdntcQ",
        sourceLabel: "UCBR8-60-B28hp2BmDPdntcQ",
        listType: "playlist",
      }),
    );
    expect(channelUrl.searchParams.get("listType")).toBe("playlist");
    expect(channelUrl.searchParams.get("list")).toBe("UUBR8-60-B28hp2BmDPdntcQ");
  });

  it("derives a canonical channel ID for feed exploration", () => {
    expect(channelIdForYouTubeItem({
      kind: "channel",
      sourceId: "UUfPyVJEBD7Di1YYjTdS2v8g",
      sourceLabel: "UCfPyVJEBD7Di1YYjTdS2v8g",
    })).toBe("UCfPyVJEBD7Di1YYjTdS2v8g");
    expect(channelIdForYouTubeItem({
      kind: "channel",
      sourceId: "UUBR8-60-B28hp2BmDPdntcQ",
      sourceLabel: "legacy",
    })).toBe("UCBR8-60-B28hp2BmDPdntcQ");
  });
});

describe("YouTube storage migration", () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
  });

  it("keeps existing v1 videos when reading the new item format", () => {
    localStorage.setItem("openpanel.youtube.v1", JSON.stringify([
      { videoId: "dQw4w9WgXcQ", title: "Existing video", addedAt: 123 },
    ]));

    expect(getYouTubeItems()).toEqual([
      {
        id: "video:dQw4w9WgXcQ",
        kind: "video",
        sourceId: "dQw4w9WgXcQ",
        sourceLabel: "dQw4w9WgXcQ",
        title: "Existing video",
        addedAt: 123,
      },
    ]);
  });

  it("starts with no hardcoded channel approvals and preserves admin choices", () => {
    expect(initializeApprovedYouTubeItems()).toEqual([]);

    const existing = addYouTubeItem("dQw4w9WgXcQ", "Existing video");
    const channel = addYouTubeItem(
      "https://www.youtube.com/channel/UCsXVk37bltHxD1rDPwtNM8Q",
      "Kurzgesagt – In a Nutshell",
    );

    expect(initializeApprovedYouTubeItems()).toEqual([existing, channel]);

    removeYouTubeItem(channel!.id);
    expect(initializeApprovedYouTubeItems()).toEqual([existing]);
  });

  it("removes obsolete automatic approvals from older builds once", () => {
    const oldDefault = addYouTubeItem(
      "https://www.youtube.com/channel/UCrNnk0wFBnCS1awGjq_ijGQ",
      "PBS KIDS",
    );
    const requested = addYouTubeItem(
      "https://www.youtube.com/channel/UCfPyVJEBD7Di1YYjTdS2v8g",
      "Homeschool Pop",
    );
    localStorage.setItem("openpanel.youtube.requested-channels.v1", "1");

    expect(initializeApprovedYouTubeItems()).toEqual([requested]);
    expect(oldDefault).not.toBeNull();

    const readded = addYouTubeItem(
      "https://www.youtube.com/channel/UCrNnk0wFBnCS1awGjq_ijGQ",
      "PBS KIDS",
    );
    expect(initializeApprovedYouTubeItems()).toEqual([requested, readded]);
  });

  it("persists verified channel artwork for the home screen", () => {
    const item = addYouTubeItem(
      "https://www.youtube.com/channel/UCfPyVJEBD7Di1YYjTdS2v8g",
      "Homeschool Pop",
      "https://yt3.googleusercontent.com/homeschool-pop=s900-c-k-c0x00ffffff-no-rj",
    );

    expect(item).toMatchObject({
      kind: "channel",
      title: "Homeschool Pop",
      thumbnailUrl: "https://yt3.googleusercontent.com/homeschool-pop=s900-c-k-c0x00ffffff-no-rj",
    });
    expect(getYouTubeItems()).toEqual([item]);
  });

  it("hides canonical IDs while an older channel title is being refreshed", () => {
    const item = addYouTubeItem(
      "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw",
    );

    expect(item).not.toBeNull();
    expect(channelMetadataNeedsRefresh(item!)).toBe(true);
    expect(displayTitleForYouTubeItem(item!)).toBe("YouTube Channel");
  });

  it("replaces an older generic channel title with verified metadata", () => {
    addYouTubeItem(
      "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw",
    );
    const repaired = addYouTubeItem(
      "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw",
      "Google for Developers",
      "https://yt3.googleusercontent.com/google-for-developers=s900",
    );

    expect(repaired).toMatchObject({
      title: "Google for Developers",
      thumbnailUrl: "https://yt3.googleusercontent.com/google-for-developers=s900",
    });
    expect(channelMetadataNeedsRefresh(repaired!)).toBe(false);
    expect(displayTitleForYouTubeItem(repaired!)).toBe("Google for Developers");
  });
});
