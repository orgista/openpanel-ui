import { describe, expect, it } from "vitest";

import { SystemBridge } from "./SystemBridge";

describe("SystemBridge web fallback", () => {
  it("supports an atomic kiosk exit to the standard system launcher", async () => {
    await expect(SystemBridge.exitKioskToSystemHome()).resolves.toMatchObject({
      exited: true,
      launcherPackage: null,
    });
  });

  it("supports the playback screen-awake contract", async () => {
    await expect(SystemBridge.setKeepScreenOn({ enabled: true })).resolves.toBeUndefined();
    await expect(SystemBridge.setKeepScreenOn({ enabled: false })).resolves.toBeUndefined();
  });

  it("reports the TV DNS filter without claiming that encrypted DNS is filtering", async () => {
    await expect(SystemBridge.getDnsFilterStatus()).resolves.toMatchObject({
      filterPackage: "dnsfilter.android",
      installed: true,
      enabled: true,
      vpnActive: true,
      filterActive: true,
      alwaysOn: true,
      lockdown: false,
      privateDnsMode: "off",
      privateDnsHost: null,
      canManageAlwaysOn: true,
    });

    await expect(SystemBridge.setDnsFilterAlwaysOn({ enabled: true }))
      .resolves.toMatchObject({ alwaysOn: true, filterActive: true });
    await expect(SystemBridge.openDnsFilter()).resolves.toBeUndefined();
    await expect(SystemBridge.openVpnSettings()).resolves.toBeUndefined();
    await expect(SystemBridge.openPrivateDnsSettings()).resolves.toBeUndefined();
  });

  it("detects device health and reversibly manages reviewed optional apps", async () => {
    await expect(SystemBridge.getDeviceHealth()).resolves.toMatchObject({
      manufacturer: "Lenovo",
      model: "Tab M10 Plus",
      profile: "lenovo",
      ramUsedPercent: 50,
      canManageApps: true,
      manageNotifications: true,
    });

    const detected = await SystemBridge.getDebloatApps();
    expect(detected.apps.map((app) => app.packageName)).toEqual(expect.arrayContaining([
      "com.google.android.youtube",
      "com.google.android.keep",
      "com.lenovo.hec.lenovoextend",
    ]));

    const optimized = await SystemBridge.applyRecommendedDebloat({ manageNotifications: true });
    expect(optimized.available).toBe(true);
    expect(optimized.apps?.every((app) => app.hidden)).toBe(true);

    const restored = await SystemBridge.restoreDebloatApps();
    expect(restored.restored).toBeGreaterThan(0);
    expect(restored.apps?.every((app) => !app.hidden)).toBe(true);

    await expect(SystemBridge.setNotificationManagement({ enabled: false }))
      .resolves.toMatchObject({ available: true, enabled: false });
  });

  it("exposes Google TV input capabilities and API-key-free channel resolution", async () => {
    await expect(SystemBridge.getDeviceProfile()).resolves.toMatchObject({
      deviceType: "television",
      isTelevision: true,
      isTablet: false,
      hasDpad: true,
      hasBattery: false,
      remoteUi: true,
      touchUi: false,
      showBattery: false,
      supportsLeanbackApps: true,
      voiceInputAvailable: true,
    });
    await expect(SystemBridge.requestVoiceInput({ prompt: "Search YouTube" })).resolves.toEqual({
      text: "Google Developers",
    });
    await expect(SystemBridge.resolveYouTubeChannel({ input: "Google Developers" }))
      .resolves.toMatchObject({
        channel: expect.objectContaining({
          kind: "channel",
          title: "Google for Developers",
          sourceUrl: "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw",
        }),
      });
    await expect(SystemBridge.resolveYouTubeChannel({ input: "homeschoolpop" }))
      .resolves.toMatchObject({
        channel: expect.objectContaining({
          kind: "channel",
          title: "Homeschool Pop",
          sourceUrl: "https://www.youtube.com/channel/UCfPyVJEBD7Di1YYjTdS2v8g",
        }),
      });
    await expect(SystemBridge.resolveYouTubeChannel({ input: "@kurzgesagt" }))
      .resolves.toMatchObject({
        channel: expect.objectContaining({
          kind: "channel",
          title: "Kurzgesagt – In a Nutshell",
          sourceUrl: "https://www.youtube.com/channel/UCsXVk37bltHxD1rDPwtNM8Q",
        }),
      });
    await expect(SystemBridge.resolveYouTubeChannel({ input: "PBS" }))
      .resolves.toMatchObject({
        channel: expect.objectContaining({
          kind: "channel",
          title: "PBS",
          sourceUrl: "https://www.youtube.com/channel/UCgyeJxD05YnoDquRMNBfBqw",
        }),
      });
    const pbsVideos = await SystemBridge.getYouTubeChannelVideos({
      channelId: "UCgyeJxD05YnoDquRMNBfBqw",
    });
    expect(pbsVideos).toMatchObject({
      channelTitle: "PBS",
      hasMore: false,
      catalogComplete: true,
      catalogSource: "channel-page",
    });
    expect(pbsVideos.videos[0]).toMatchObject({
      videoId: "kaC-n8BqNhs",
      title: "Tig Notaro and Stephanie Allynne Draw (and Roast) Each Other",
    });
    const channelVideos = await SystemBridge.getYouTubeChannelVideos({
      channelId: "UCfPyVJEBD7Di1YYjTdS2v8g",
    });
    expect(channelVideos.channelTitle).toBe("Homeschool Pop");
    expect(channelVideos.videos[0]).toMatchObject({
      videoId: "Rf71QRZtVME",
      title: "School Supplies in Spanish for Kids | Spanish Vocabulary Lesson",
    });
    expect(channelVideos.videos).toHaveLength(30);
    expect(channelVideos).toMatchObject({
      nextPageToken: "web-page-2",
      hasMore: true,
      catalogSource: "channel-page",
    });
    const olderVideos = await SystemBridge.getYouTubeChannelVideos({
      channelId: "UCfPyVJEBD7Di1YYjTdS2v8g",
      pageToken: channelVideos.nextPageToken!,
    });
    expect(olderVideos.videos).toHaveLength(18);
    expect(olderVideos.hasMore).toBe(false);
    await expect(SystemBridge.resolveYouTubeChannel({ input: "missing channel" }))
      .rejects.toThrow("not found");
  });
});
