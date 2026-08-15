import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STARTUP_ANIMATION_FALLBACK_MS, StartupAnimation } from "./StartupAnimation";

describe("StartupAnimation", () => {
  it("renders the approved muted inline launch video", () => {
    const html = renderToStaticMarkup(<StartupAnimation onComplete={() => {}} />);

    expect(html).toContain("data-openpanel-startup=\"true\"");
    expect(html).toContain("data-openpanel-startup-video=\"true\"");
    expect(html).toContain("autoplay");
    expect(html).toContain("muted");
    expect(html).toContain("playsinline");
    expect(html).toContain("openpanel-launch.mp4");
  });

  it("allows enough time for the five-second source animation to finish", () => {
    expect(STARTUP_ANIMATION_FALLBACK_MS).toBeGreaterThan(5000);
    expect(STARTUP_ANIMATION_FALLBACK_MS).toBeLessThan(6000);
  });
});
