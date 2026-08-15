import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  LibrarySetupStep,
  onboardingStepsForDevice,
  permissionKeysForDevice,
  youtubeChannelSetupError,
} from "./StandaloneOnboarding";

describe("StandaloneOnboarding library setup", () => {
  it("offers local imports and an optional institutional OPDS catalog", () => {
    const html = renderToStaticMarkup(<LibrarySetupStep onNext={vi.fn()} />);

    expect(html).toContain("Connect the reading library");
    expect(html).toContain("No catalog is preloaded");
    expect(html).toContain("Import a local publication");
    expect(html).toContain("Institutional OPDS URL");
    expect(html).toContain("https://library.example.org/opds");
    expect(html).toContain("Licensed borrowing and DRM require the library");
    expect(html).toContain("Continue");
  });

  it("keeps tablet setup complete while shortening television setup", () => {
    expect(onboardingStepsForDevice(false)).toEqual([
      "pin",
      "permissions",
      "health",
      "apps",
      "library",
      "optional",
    ]);
    expect(onboardingStepsForDevice(true)).toEqual([
      "pin",
      "permissions",
      "apps",
      "optional",
    ]);
  });

  it("asks televisions only for the Home control they need during first run", () => {
    expect(permissionKeysForDevice(false, false)).toEqual([
      "launcher",
      "admin",
      "wifi",
      "bluetooth",
      "accessibility",
      "notifications",
      "overlay",
      "usage",
      "write",
      "battery",
    ]);
    expect(permissionKeysForDevice(true, false)).toEqual(["launcher"]);
    expect(permissionKeysForDevice(true, true)).toEqual(["launcher"]);
  });

  it("distinguishes a YouTube network failure from a missing channel", () => {
    expect(youtubeChannelSetupError(
      { code: "YOUTUBE_CHANNEL_LOOKUP_FAILED" },
      "Homeschool Pop",
    )).toContain("Check this TV’s connection");
    expect(youtubeChannelSetupError(
      { code: "YOUTUBE_CHANNEL_NOT_FOUND" },
      "Homeschool Pop",
    )).toContain("matching “Homeschool Pop”");
  });
});
