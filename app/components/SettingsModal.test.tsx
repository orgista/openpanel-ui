import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SettingsModal, wifiSignalLabel } from "./SettingsModal";

describe("SettingsModal", () => {
  it("gives its icon-only close control an accessible name", () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        isOpen
        onClose={vi.fn()}
        isStandalone={false}
        onExitKiosk={vi.fn()}
        isAdmin={false}
        onEnterAdmin={vi.fn()}
        onExitAdmin={vi.fn()}
        onOpenAdminPanel={vi.fn()}
      />,
    );

    expect(html).toContain('aria-label="Close settings"');
    expect(html).toContain("settings-modal-backdrop");
    expect(html).toContain("settings-modal-card");
    expect(html).toContain("data-dpad-scope");
    expect(html).toContain("Refresh networks");
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toContain("Wi-Fi network list is collapsed");
  });

  it("keeps the collapsed Wi-Fi picker only for televisions", () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        isOpen
        onClose={vi.fn()}
        isStandalone={false}
        onExitKiosk={vi.fn()}
        isAdmin={false}
        onEnterAdmin={vi.fn()}
        onExitAdmin={vi.fn()}
        onOpenAdminPanel={vi.fn()}
        deviceProfile={{
          deviceType: "television",
          isTelevision: true,
          isTablet: false,
          isHandheld: false,
          hasLeanback: true,
          hasTouchscreen: false,
          hasDpad: true,
          hasHardwareKeyboard: false,
          smallestScreenWidthDp: 960,
          hasBattery: false,
          remoteUi: true,
          touchUi: false,
          showBattery: false,
          supportsLeanbackApps: true,
          voiceInputAvailable: true,
          controllerName: "Google TV Remote",
        }}
      />,
    );

    expect(html).toContain("Browse networks");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Leave it collapsed to move directly to Admin Mode");
  });

  it("describes signal strength consistently for remote users", () => {
    expect(wifiSignalLabel(90)).toBe("Excellent");
    expect(wifiSignalLabel(60)).toBe("Good");
    expect(wifiSignalLabel(30)).toBe("Fair");
    expect(wifiSignalLabel(10)).toBe("Weak");
  });

  it("offers authenticated standalone users the full Android settings entry", () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        isOpen
        isStandalone
        isAdmin
        onClose={vi.fn()}
        onExitKiosk={vi.fn()}
        onEnterAdmin={vi.fn()}
        onExitAdmin={vi.fn()}
        onOpenAdminPanel={vi.fn()}
      />,
    );

    expect(html).toContain('aria-label="Open full Android system settings"');
    expect(html).toContain("Full system settings");
  });

  it("offers authenticated ArborXR tablet users the full Android settings entry", () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        isOpen
        isStandalone={false}
        isAdmin
        onClose={vi.fn()}
        onExitKiosk={vi.fn()}
        onEnterAdmin={vi.fn()}
        onExitAdmin={vi.fn()}
        onOpenAdminPanel={vi.fn()}
        deviceProfile={{
          deviceType: "tablet",
          isTelevision: false,
          isTablet: true,
          isHandheld: false,
          hasLeanback: false,
          hasTouchscreen: true,
          hasDpad: false,
          hasHardwareKeyboard: false,
          smallestScreenWidthDp: 600,
          hasBattery: true,
          remoteUi: false,
          touchUi: true,
          showBattery: true,
          supportsLeanbackApps: false,
          voiceInputAvailable: true,
          controllerName: null,
        }}
      />,
    );

    expect(html).toContain('aria-label="Open full Android system settings"');
    expect(html).toContain("Full system settings");
  });

  it("keeps full Android settings hidden on ArborXR television builds", () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        isOpen
        isStandalone={false}
        isAdmin
        onClose={vi.fn()}
        onExitKiosk={vi.fn()}
        onEnterAdmin={vi.fn()}
        onExitAdmin={vi.fn()}
        onOpenAdminPanel={vi.fn()}
        deviceProfile={{
          deviceType: "television",
          isTelevision: true,
          isTablet: false,
          isHandheld: false,
          hasLeanback: true,
          hasTouchscreen: false,
          hasDpad: true,
          hasHardwareKeyboard: false,
          smallestScreenWidthDp: 960,
          hasBattery: false,
          remoteUi: true,
          touchUi: false,
          showBattery: false,
          supportsLeanbackApps: true,
          voiceInputAvailable: true,
          controllerName: "Google TV Remote",
        }}
      />,
    );

    expect(html).not.toContain('aria-label="Open full Android system settings"');
  });
});
