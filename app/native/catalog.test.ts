import { describe, expect, it } from "vitest";
import { isAllowedApp } from "./catalog";
import type { InstalledApp } from "./SystemBridge";

const app = (overrides: Partial<InstalledApp> = {}): InstalledApp => ({
  packageName: "com.example.game",
  label: "Example Game",
  isSystem: false,
  installer: null,
  lockTaskPermitted: false,
  icon: null,
  ...overrides,
});

describe("isAllowedApp", () => {
  it("shows ordinary user-installed apps in standalone mode", () => {
    expect(isAllowedApp(app(), "standalone")).toBe(true);
  });

  it("shows supported preinstalled Netflix apps in standalone mode", () => {
    expect(
      isAllowedApp(
        app({ packageName: "com.netflix.ninja", isSystem: true }),
        "standalone",
      ),
    ).toBe(true);
    expect(
      isAllowedApp(
        app({ packageName: "com.netflix.mediaclient", isSystem: true }),
        "standalone",
      ),
    ).toBe(true);
  });

  it("uses ArborXR's lock-task allowlist in companion mode", () => {
    expect(isAllowedApp(app(), "companion")).toBe(false);
    expect(isAllowedApp(app({ lockTaskPermitted: true }), "companion")).toBe(true);
    expect(
      isAllowedApp(
        app({ installer: "app.xrdm.client", lockTaskPermitted: false }),
        "companion",
      ),
    ).toBe(false);
    expect(
      isAllowedApp(
        app({
          packageName: "com.netflix.ninja",
          isSystem: true,
          lockTaskPermitted: true,
        }),
        "companion",
      ),
    ).toBe(true);
  });

  it("always excludes system apps and management utilities", () => {
    expect(isAllowedApp(app({ isSystem: true }), "standalone")).toBe(false);
    expect(isAllowedApp(app({ packageName: "app.xrdm.client" }), "standalone")).toBe(false);
  });
});
