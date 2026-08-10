import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  channelGridTargetIndex,
  mergeChannelVideos,
  YouTubeChannelBrowser,
} from "./YouTubeChannelBrowser";

describe("YouTubeChannelBrowser", () => {
  it("renders a restricted channel explorer with a clear return path", () => {
    const html = renderToStaticMarkup(
      <YouTubeChannelBrowser
        item={{
          id: "channel:UCfPyVJEBD7Di1YYjTdS2v8g",
          kind: "channel",
          sourceId: "UUfPyVJEBD7Di1YYjTdS2v8g",
          sourceLabel: "UCfPyVJEBD7Di1YYjTdS2v8g",
          listType: "playlist",
          title: "Homeschool Pop",
          thumbnailUrl: "https://yt3.googleusercontent.com/homeschool-pop",
          addedAt: 1,
        }}
        onClose={vi.fn()}
        onPlay={vi.fn()}
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Explore Homeschool Pop"');
    expect(html).toContain('aria-label="Back to OpenPanel home"');
    expect(html).toContain("Browse channel videos");
    expect(html).toContain("Loading channel videos");
  });

  it("releases boundary arrows so the global D-pad fallback can reach the header", () => {
    expect(channelGridTargetIndex(0, "ArrowUp", 6, 3)).toBeNull();
    expect(channelGridTargetIndex(0, "ArrowLeft", 6, 3)).toBeNull();
    expect(channelGridTargetIndex(2, "ArrowRight", 6, 3)).toBeNull();
    expect(channelGridTargetIndex(1, "ArrowRight", 6, 3)).toBe(2);
    expect(channelGridTargetIndex(1, "ArrowDown", 6, 3)).toBe(4);
  });

  it("appends older pages without duplicating videos", () => {
    const first = [{ videoId: "Rf71QRZtVME", title: "First", thumbnailUrl: "one", publishedAt: "now" }];
    const next = [
      { videoId: "Rf71QRZtVME", title: "Duplicate", thumbnailUrl: "one", publishedAt: "now" },
      { videoId: "PI9tlYxluX0", title: "Older", thumbnailUrl: "two", publishedAt: "then" },
    ];

    expect(mergeChannelVideos(first, next).map((video) => video.videoId)).toEqual([
      "Rf71QRZtVME",
      "PI9tlYxluX0",
    ]);
  });
});
