import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AdminPanel, kioskActionErrorMessage, resetAdminPanelScroll } from "./AdminPanel";

describe("AdminPanel", () => {
  it("returns the scrollable content to the top when changing sections", () => {
    const panel = { scrollTop: 280 } as HTMLDivElement;

    resetAdminPanelScroll(panel);

    expect(panel.scrollTop).toBe(0);
  });

  it("surfaces native kiosk failures without losing the useful explanation", () => {
    expect(kioskActionErrorMessage(new Error("Fire OS did not enter screen pinning.")))
      .toBe("Fire OS did not enter screen pinning.");
    expect(kioskActionErrorMessage("not-an-error")).toBe("The kiosk action failed.");
  });

  it("provides an accessible, authenticated Admin reset control", () => {
    const html = renderToStaticMarkup(
      <AdminPanel
        isOpen
        onClose={vi.fn()}
        apps={[]}
        availableApps={[]}
        onAddApp={vi.fn()}
        onRemoveApp={vi.fn()}
        inactivityTimeout={5}
        onSetInactivityTimeout={vi.fn()}
        allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()}
        videos={[]}
        onAddVideo={vi.fn(() => true)}
        onRemoveVideo={vi.fn()}
        standalone={false}
        appMode="companion"
        onSetAppMode={vi.fn()}
        kioskStatus={null}
        onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()}
        onRequestDeviceAdmin={vi.fn()}
        onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()}
        onResetAdmin={vi.fn()}
        initialTab="power"
      />,
    );

    expect(html).toContain("Security");
    expect(html).toContain("data-dpad-scope");
    expect(html).toContain('aria-label="Close Admin Panel"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('value="5"');
  });

  it("keeps an empty Applications section reachable by a TV remote", () => {
    const html = renderToStaticMarkup(
      <AdminPanel
        isOpen
        onClose={vi.fn()}
        apps={[]}
        availableApps={[]}
        onAddApp={vi.fn()}
        onRemoveApp={vi.fn()}
        inactivityTimeout={5}
        onSetInactivityTimeout={vi.fn()}
        allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()}
        videos={[]}
        onAddVideo={vi.fn(() => true)}
        onRemoveVideo={vi.fn()}
        standalone={true}
        appMode="standalone"
        onSetAppMode={vi.fn()}
        kioskStatus={null}
        onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()}
        onRequestDeviceAdmin={vi.fn()}
        onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()}
        onResetAdmin={vi.fn()}
      />,
    );

    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="No allowed applications"');
    expect(html).toContain('aria-label="No additional applications"');
    expect(html).toContain("data-dpad-content");
  });

  it("keeps Device Health and its notification policy reachable from admin", () => {
    const html = renderToStaticMarkup(
      <AdminPanel
        isOpen
        onClose={vi.fn()}
        apps={[]}
        availableApps={[]}
        onAddApp={vi.fn()}
        onRemoveApp={vi.fn()}
        inactivityTimeout={5}
        onSetInactivityTimeout={vi.fn()}
        allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()}
        manageNotifications
        onSetManageNotifications={vi.fn()}
        videos={[]}
        onAddVideo={vi.fn(() => true)}
        onRemoveVideo={vi.fn()}
        standalone
        appMode="standalone"
        onSetAppMode={vi.fn()}
        kioskStatus={null}
        onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()}
        onRequestDeviceAdmin={vi.fn()}
        onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()}
        onResetAdmin={vi.fn()}
        initialTab="health"
      />,
    );

    expect(html).toContain("Device Health");
    expect(html).toContain("Detecting this device");
  });

  it("shows DNS and telemetry controls only for the detected TV profile", () => {
    const html = renderToStaticMarkup(
      <AdminPanel
        isOpen
        onClose={vi.fn()}
        apps={[]}
        availableApps={[]}
        onAddApp={vi.fn()}
        onRemoveApp={vi.fn()}
        inactivityTimeout={5}
        onSetInactivityTimeout={vi.fn()}
        allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()}
        videos={[]}
        onAddVideo={vi.fn(() => true)}
        onRemoveVideo={vi.fn()}
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
        standalone
        appMode="standalone"
        onSetAppMode={vi.fn()}
        kioskStatus={null}
        onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()}
        onRequestDeviceAdmin={vi.fn()}
        onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()}
        onResetAdmin={vi.fn()}
        initialTab="health"
      />,
    );

    expect(html).toContain("DNS &amp; Telemetry");
    expect(html).toContain("personalDNSfilter");
    expect(html).toContain("Detecting network protection");
  });

  it("does not let the active management mode restart setup", () => {
    const html = renderToStaticMarkup(
      <AdminPanel
        isOpen
        onClose={vi.fn()}
        apps={[]}
        availableApps={[]}
        onAddApp={vi.fn()}
        onRemoveApp={vi.fn()}
        inactivityTimeout={5}
        onSetInactivityTimeout={vi.fn()}
        allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()}
        videos={[]}
        onAddVideo={vi.fn(() => true)}
        onRemoveVideo={vi.fn()}
        standalone
        appMode="standalone"
        onSetAppMode={vi.fn()}
        kioskStatus={null}
        onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()}
        onRequestDeviceAdmin={vi.fn()}
        onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()}
        onResetAdmin={vi.fn()}
        initialTab="kiosk"
      />,
    );

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-pressed="true"[^>]*>[^<]*<svg[^>]*>[\s\S]*?Standalone<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>[\s\S]*?Companion \(ArborXR\)<\/button>/);
  });

  it("exposes standards-based Books & Audio management", () => {
    const html = renderToStaticMarkup(
      <AdminPanel
        isOpen
        onClose={vi.fn()}
        apps={[]}
        availableApps={[]}
        onAddApp={vi.fn()}
        onRemoveApp={vi.fn()}
        inactivityTimeout={5}
        onSetInactivityTimeout={vi.fn()}
        allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()}
        videos={[]}
        onAddVideo={vi.fn(() => true)}
        onRemoveVideo={vi.fn()}
        standalone
        appMode="standalone"
        onSetAppMode={vi.fn()}
        kioskStatus={null}
        onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()}
        onRequestDeviceAdmin={vi.fn()}
        onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()}
        onResetAdmin={vi.fn()}
        initialTab="library"
      />,
    );

    expect(html).toContain("Books &amp; Audio");
    expect(html).toContain("OPDS 1/2 catalogs");
    expect(html).toContain("Import file");
    expect(html).toContain("Institutional catalogs");
    expect(html).toContain("Licensed Palace, Libby, Hoopla, cloudLibrary, or LCP collections");
  });

  it("explains that videos, channels, and playlists are supported", () => {
    const html = renderToStaticMarkup(
      <AdminPanel
        isOpen
        onClose={vi.fn()}
        apps={[]}
        availableApps={[]}
        onAddApp={vi.fn()}
        onRemoveApp={vi.fn()}
        inactivityTimeout={5}
        onSetInactivityTimeout={vi.fn()}
        allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()}
        videos={[]}
        onAddVideo={vi.fn(() => true)}
        onRemoveVideo={vi.fn()}
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
        standalone={false}
        appMode="companion"
        onSetAppMode={vi.fn()}
        kioskStatus={null}
        onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()}
        onRequestDeviceAdmin={vi.fn()}
        onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()}
        onResetAdmin={vi.fn()}
        initialTab="youtube"
      />,
    );

    expect(html).toContain("YouTube Videos, Channels &amp; Playlists");
    expect(html).toContain("Same-channel recommendations");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("Allowed YouTube Sources (0)");
    expect(html).toContain("Add a YouTube channel");
    expect(html).toContain("No API key");
    expect(html).toContain('aria-label="Enter channel by voice"');
    expect(html).toContain("press your remote&#x27;s microphone button");
    expect(html).toContain("Verify channel");
    expect(html).toContain("channel name, unique @handle, channel ID, or channel URL");
    expect(html).toContain("Paste a YouTube link");
    expect(html).toContain("youtube.com video, playlist, or channel URL");
    expect(html).not.toContain("YouTube Data API key");
  });

  it("shows an authenticated persistent bug log with remote-reachable controls", () => {
    const html = renderToStaticMarkup(
      <AdminPanel
        isOpen
        onClose={vi.fn()}
        apps={[]}
        availableApps={[]}
        onAddApp={vi.fn()}
        onRemoveApp={vi.fn()}
        inactivityTimeout={5}
        onSetInactivityTimeout={vi.fn()}
        allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()}
        videos={[]}
        onAddVideo={vi.fn(() => true)}
        onRemoveVideo={vi.fn()}
        standalone
        appMode="standalone"
        onSetAppMode={vi.fn()}
        kioskStatus={null}
        onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()}
        onRequestDeviceAdmin={vi.fn()}
        onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()}
        onResetAdmin={vi.fn()}
        initialTab="diagnostics"
      />,
    );

    expect(html).toContain("Persistent Bug Log");
    expect(html).toContain("latest 200");
    expect(html).toContain("Credentials are redacted automatically");
    expect(html).toContain("Refresh");
    expect(html).toContain("Clear");
  });
});
