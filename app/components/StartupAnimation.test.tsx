import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STARTUP_ANIMATION_FALLBACK_MS, StartupAnimation } from "./StartupAnimation";

describe("StartupAnimation", () => {
  it("renders the OpenPanel wordmark splash (name only, no logo, no video)", () => {
    const html = renderToStaticMarkup(<StartupAnimation onComplete={() => {}} />);

    expect(html).toContain('data-openpanel-startup="true"');
    expect(html).toContain('aria-label="OpenPanel by Orgista"');
    expect(html).toContain("OpenPanel");
    expect(html).not.toContain("openpanel-launch.mp4");
    expect(html).not.toContain("data-openpanel-startup-video");
    expect(html).not.toContain("data-openpanel-brand-mark");
  });

  it("uses a brief splash duration", () => {
    expect(STARTUP_ANIMATION_FALLBACK_MS).toBeGreaterThan(1000);
    expect(STARTUP_ANIMATION_FALLBACK_MS).toBeLessThan(4000);
  });
});
