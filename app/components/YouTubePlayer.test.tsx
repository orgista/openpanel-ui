import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  isPlaybackExitKey,
  shouldRevealPlaybackControls,
  shouldReturnToChannel,
  YouTubePlayer,
} from "./YouTubePlayer";

describe("YouTubePlayer", () => {
  it("renders a recommendation-minimized player with minimal auto-hidden controls", () => {
    const html = renderToStaticMarkup(
      <YouTubePlayer
        item={{
          id: "video:Rf71QRZtVME",
          kind: "video",
          sourceId: "Rf71QRZtVME",
          sourceLabel: "Rf71QRZtVME",
          title: "School Supplies in Spanish for Kids",
          addedAt: 1,
        }}
        allowSameChannelRecommendations
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain("/embed/Rf71QRZtVME?");
    expect(html).toContain("enablejsapi=1");
    expect(html).toContain("rel=0");
    expect(html).toContain('aria-label="Show playback controls"');
    expect(html).toContain('aria-label="Exit video"');
    expect(html).toContain('aria-label="Play in full screen"');
    expect(html).toContain('data-controls-visible="false"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('aria-label="Rewind 10 seconds"');
    expect(html).not.toContain('aria-label="Forward 10 seconds"');
    expect(html).not.toContain('aria-label="Playback speed');
    expect(html).not.toContain('aria-label="Pause video"');
    expect(html).not.toContain("Related videos stay on this channel");
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('id="openpanel-youtube-player"');
    expect(html).toContain('class="absolute inset-0 size-full border-0 bg-black"');
  });

  it("reveals controls for remote input while preserving Back as an immediate exit", () => {
    expect(shouldRevealPlaybackControls("Enter")).toBe(true);
    expect(shouldRevealPlaybackControls("ArrowUp")).toBe(true);
    expect(shouldRevealPlaybackControls("MediaPlayPause")).toBe(true);
    expect(shouldRevealPlaybackControls("Escape")).toBe(false);
    expect(isPlaybackExitKey("Escape")).toBe(true);
    expect(isPlaybackExitKey("BrowserBack")).toBe(true);
    expect(isPlaybackExitKey("Backspace")).toBe(true);
    expect(isPlaybackExitKey("Enter")).toBe(false);
  });

  it("only returns immediately after playback when recommendations are disabled", () => {
    expect(shouldReturnToChannel(0, false)).toBe(true);
    expect(shouldReturnToChannel(0, true)).toBe(false);
    expect(shouldReturnToChannel(1, false)).toBe(false);
    expect(shouldReturnToChannel(2, false)).toBe(false);
    expect(shouldReturnToChannel(3, false)).toBe(false);
  });
});
