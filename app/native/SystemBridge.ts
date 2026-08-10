import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface InstalledApp {
  packageName: string;
  label: string;
  isSystem: boolean;
  installer: string | null;
  lockTaskPermitted: boolean;
  icon: string | null; // base64 PNG
}

export interface BatteryInfo {
  level: number; // 0-100, -1 if unknown
  isCharging: boolean;
}

// Fully-style kiosk grants. deviceOwner/deviceAdmin/defaultLauncher and the two
// runtime perms (location, bluetooth) can be held or auto-granted; the rest are
// "special app access" the operator toggles in Settings via a deep link.
export interface PermissionStatus {
  deviceOwner: boolean;
  deviceAdmin: boolean;
  defaultLauncher: boolean;
  location: boolean;
  bluetooth: boolean;
  accessibility: boolean;
  overlay: boolean;
  usageAccess: boolean;
  writeSettings: boolean;
  batteryUnrestricted: boolean;
  keyguardDisabled: boolean;
}

// Pieces for a Device-Owner provisioning QR; the operator adds the hosted APK URL.
export interface ProvisioningPayload {
  packageName: string;
  component: string;
  checksum: string | null;
}

export interface WifiStatus {
  enabled: boolean;
  connected: boolean;
  ssid?: string;
  signal?: number; // 0-100
}

export interface WifiNetwork {
  ssid: string;
  signal: number; // 0-100
  secured: boolean;
  connected: boolean;
}

export interface BtDevice {
  name: string;
  address: string;
  paired: boolean;
  connected: boolean;
  unnamed?: boolean;
}

export interface BluetoothStatus {
  available: boolean;
  enabled: boolean;
  permissionGranted?: boolean;
  devices?: BtDevice[];
}

export interface KioskStatus {
  deviceOwner: boolean; // OpenPanel provisioned as Device Owner — strong, silent lock-task
  deviceAdmin: boolean; // OpenPanel device-admin enabled
  arborXrManaged: boolean; // ArborXR (app.xrdm.client) is the Device Owner
  defaultLauncher: boolean; // OpenPanel is the HOME launcher
  lockTaskActive: boolean;
  lockTaskMode: "locked" | "pinned" | "none";
  managementMode: "companion" | "standalone";
  kioskEnabled: boolean;
}

export interface YouTubeChannelResult {
  kind: "channel";
  sourceId: string;
  sourceUrl: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string | null;
}

export interface YouTubeChannelVideoResult {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
}

export interface DeviceProfile {
  deviceType: "television" | "tablet" | "handheld";
  isTelevision: boolean;
  isTablet: boolean;
  isHandheld: boolean;
  hasLeanback: boolean;
  hasTouchscreen: boolean;
  hasDpad: boolean;
  hasHardwareKeyboard: boolean;
  smallestScreenWidthDp: number;
  hasBattery: boolean;
  remoteUi: boolean;
  touchUi: boolean;
  showBattery: boolean;
  supportsLeanbackApps: boolean;
  voiceInputAvailable: boolean;
  controllerName: string | null;
}

interface SystemBridgePlugin {
  writeDiagnostic(opts: { level: "info" | "warning" | "error"; message: string }): Promise<void>;
  hideKeyboard(): Promise<void>;
  setKeepScreenOn(opts: { enabled: boolean }): Promise<void>;
  getDeviceProfile(): Promise<DeviceProfile>;
  requestVoiceInput(opts?: { prompt?: string }): Promise<{ text: string }>;
  resolveYouTubeChannel(opts: { input: string }): Promise<{ channel: YouTubeChannelResult }>;
  getYouTubeChannelVideos(opts: { channelId: string; pageToken?: string }): Promise<{
    channelTitle: string;
    videos: YouTubeChannelVideoResult[];
    nextPageToken: string | null;
    hasMore: boolean;
    catalogComplete: boolean;
    catalogSource: "channel-page" | "recent-feed";
  }>;
  getInstalledApps(): Promise<{ apps: InstalledApp[] }>;
  launchApp(opts: { packageName: string }): Promise<void>;
  getBatteryInfo(): Promise<BatteryInfo>;
  getWifiStatus(): Promise<WifiStatus>;
  scanWifi(): Promise<{ networks: WifiNetwork[] }>;
  connectWifi(opts: { ssid: string; password?: string }): Promise<{ status: string; code: number }>;
  forgetWifi(opts: { ssid: string }): Promise<void>;
  openWifiSettings(): Promise<void>;
  getBluetoothStatus(): Promise<BluetoothStatus>;
  setBluetoothEnabled(opts: { enabled: boolean }): Promise<void>;
  scanBluetooth(): Promise<{ devices: BtDevice[] }>;
  pairBluetooth(opts: { address: string }): Promise<{ status: string }>;
  unpairBluetooth(opts: { address: string }): Promise<{ status: string }>;
  openBluetoothSettings(): Promise<void>;
  openSystemSettings(): Promise<void>;
  // Standalone (non-ArborXR) kiosk lockdown:
  getKioskStatus(): Promise<KioskStatus>;
  setManagementMode(opts: { mode: "companion" | "standalone" }): Promise<{ mode: string }>;
  requestDeviceAdmin(): Promise<{ status?: string }>;
  openLauncherSettings(): Promise<void>;
  enableKioskLock(opts?: { packages?: string[] }): Promise<{ status: string }>;
  disableKioskLock(): Promise<void>;
  exitKioskToSystemHome(): Promise<{
    exited: boolean;
    launcherPackage: string | null;
    deviceOwnerRetained: boolean;
  }>;
  clearDeviceOwner(): Promise<{ cleared: boolean }>;
  // Fully-style permissions & special app access:
  getPermissionStatus(): Promise<PermissionStatus>;
  autoGrantSelfPermissions(): Promise<{ deviceOwner: boolean; granted: number }>;
  setKeyguardDisabled(opts: { disabled: boolean }): Promise<{ disabled: boolean; applied: boolean }>;
  openAccessibilitySettings(): Promise<void>;
  openOverlaySettings(): Promise<void>;
  openUsageAccessSettings(): Promise<void>;
  openWriteSettings(): Promise<void>;
  requestIgnoreBatteryOptimizations(): Promise<{ granted?: boolean }>;
  getProvisioningPayload(): Promise<ProvisioningPayload>;
  addListener(
    event: "bluetoothStateChanged",
    cb: (data: { enabled: boolean }) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "batteryChanged",
    cb: (data: BatteryInfo) => void
  ): Promise<PluginListenerHandle>;
}

const native = registerPlugin<SystemBridgePlugin>("SystemBridge");

export const isNative = Capacitor.isNativePlatform();

const webResolvedChannel: YouTubeChannelResult = {
  kind: "channel",
  sourceId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
  sourceUrl: "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw",
  title: "Google for Developers",
  channelTitle: "Google for Developers",
  thumbnailUrl: null,
};

const webHomeschoolPopChannel: YouTubeChannelResult = {
  kind: "channel",
  sourceId: "UCfPyVJEBD7Di1YYjTdS2v8g",
  sourceUrl: "https://www.youtube.com/channel/UCfPyVJEBD7Di1YYjTdS2v8g",
  title: "Homeschool Pop",
  channelTitle: "Homeschool Pop",
  thumbnailUrl: "https://yt3.googleusercontent.com/yENC7nbCi2IqwCeDy8T7Kzpcubxt-iz_yR69dlKGXvwufaEJIbk7iYYseVAqMAAoLNrs4hjR=s900-c-k-c0x00ffffff-no-rj",
};

const webKurzgesagtChannel: YouTubeChannelResult = {
  kind: "channel",
  sourceId: "UCsXVk37bltHxD1rDPwtNM8Q",
  sourceUrl: "https://www.youtube.com/channel/UCsXVk37bltHxD1rDPwtNM8Q",
  title: "Kurzgesagt – In a Nutshell",
  channelTitle: "Kurzgesagt – In a Nutshell",
  thumbnailUrl: "https://yt3.googleusercontent.com/ytc/AIdro_n1Ribd7LwdP_qKtqWL3ZDfIgv9M1d6g78VwpHGXVR2Ir4=s900-c-k-c0x00ffffff-no-rj",
};

const webPbsChannel: YouTubeChannelResult = {
  kind: "channel",
  sourceId: "UCgyeJxD05YnoDquRMNBfBqw",
  sourceUrl: "https://www.youtube.com/channel/UCgyeJxD05YnoDquRMNBfBqw",
  title: "PBS",
  channelTitle: "PBS",
  thumbnailUrl: "https://yt3.googleusercontent.com/ytc/AIdro_lbFFUNXtl50QGZiihGQlYmXWR7JpTh3E5wUg_uq9o7Ux8=s900-c-k-c0x00ffffff-no-rj",
};

const webPbsVideos: YouTubeChannelVideoResult[] = [
  {
    videoId: "kaC-n8BqNhs",
    title: "Tig Notaro and Stephanie Allynne Draw (and Roast) Each Other",
    thumbnailUrl: "https://i.ytimg.com/vi/kaC-n8BqNhs/hqdefault.jpg",
    publishedAt: "2 days ago",
  },
];

const webHomeschoolPopVideos: YouTubeChannelVideoResult[] = [
  {
    videoId: "Rf71QRZtVME",
    title: "School Supplies in Spanish for Kids | Spanish Vocabulary Lesson",
    thumbnailUrl: "https://i3.ytimg.com/vi/Rf71QRZtVME/hqdefault.jpg",
    publishedAt: "2026-07-21T14:01:06+00:00",
  },
  {
    videoId: "PI9tlYxluX0",
    title: "Cactus Facts for Kids | Learn About Cacti",
    thumbnailUrl: "https://i1.ytimg.com/vi/PI9tlYxluX0/hqdefault.jpg",
    publishedAt: "2026-07-01T15:32:04+00:00",
  },
  {
    videoId: "UhjYpF9hZJM",
    title: "Scorpions for Kids | Scorpion Facts and Anatomy",
    thumbnailUrl: "https://i2.ytimg.com/vi/UhjYpF9hZJM/hqdefault.jpg",
    publishedAt: "2026-06-16T13:54:35+00:00",
  },
  ...Array.from({ length: 45 }, (_, index) => ({
    videoId: `HSP${String(index + 1).padStart(8, "0")}`,
    title: `HomeSchool Pop archive lesson ${index + 1}`,
    thumbnailUrl: index % 2 === 0
      ? "https://i1.ytimg.com/vi/PI9tlYxluX0/hqdefault.jpg"
      : "https://i2.ytimg.com/vi/UhjYpF9hZJM/hqdefault.jpg",
    publishedAt: `${index + 2} months ago`,
  })),
];

// Browser fallback so the UI stays usable during web development.
const webMock: SystemBridgePlugin = {
  async writeDiagnostic() {},
  async hideKeyboard() {},
  async setKeepScreenOn() {},
  async getDeviceProfile() {
    return {
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
      controllerName: "Google TV Remote (browser preview)",
    };
  },
  async requestVoiceInput() {
    return { text: "Google Developers" };
  },
  async resolveYouTubeChannel({ input }) {
    const normalized = input.trim().toLowerCase().replace(/[\s@]/g, "");
    if (normalized.length < 3 || /missing|invalid|notreal/.test(normalized)) {
      throw new Error("That exact YouTube channel was not found. Try its unique @handle.");
    }
    if (normalized.includes("homeschoolpop")) {
      return { channel: webHomeschoolPopChannel };
    }
    if (normalized.includes("kurzgesagt")) {
      return { channel: webKurzgesagtChannel };
    }
    if (normalized === "pbs" || normalized.includes("youtube.com/channel/ucgyejxd05ynodqurmnbfbqw")) {
      return { channel: webPbsChannel };
    }
    return { channel: webResolvedChannel };
  },
  async getYouTubeChannelVideos({ channelId, pageToken }) {
    if (!/^UC[A-Za-z0-9_-]{22}$/.test(channelId)) {
      throw new Error("This channel must be re-added before its videos can be explored.");
    }
    if (channelId === webPbsChannel.sourceId) {
      return {
        channelTitle: webPbsChannel.title,
        videos: pageToken ? [] : webPbsVideos,
        nextPageToken: null,
        hasMore: false,
        catalogComplete: true,
        catalogSource: "channel-page" as const,
      };
    }
    const pageIndex = pageToken === "web-page-2" ? 1 : 0;
    const pageSize = 30;
    const videos = webHomeschoolPopVideos.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
    const hasMore = (pageIndex + 1) * pageSize < webHomeschoolPopVideos.length;
    return {
      channelTitle: channelId === webHomeschoolPopChannel.sourceId
        ? webHomeschoolPopChannel.title
        : channelId === webKurzgesagtChannel.sourceId
          ? webKurzgesagtChannel.title
          : webResolvedChannel.title,
      videos,
      nextPageToken: hasMore ? "web-page-2" : null,
      hasMore,
      catalogComplete: !hasMore,
      catalogSource: "channel-page" as const,
    };
  },
  async getInstalledApps() {
    return {
      apps: [
        { packageName: "com.example.one", label: "Sample Game", isSystem: false, installer: null, lockTaskPermitted: true, icon: null },
        { packageName: "com.example.two", label: "Another Game", isSystem: false, installer: null, lockTaskPermitted: true, icon: null },
      ],
    };
  },
  async launchApp() {},
  async getBatteryInfo() {
    return { level: 85, isCharging: false };
  },
  async getWifiStatus() {
    return { enabled: true, connected: true, ssid: "Dev Network", signal: 90 };
  },
  async scanWifi() {
    return {
      networks: [
        { ssid: "Dev Network", signal: 90, secured: true, connected: true },
        { ssid: "Guest", signal: 60, secured: false, connected: false },
      ],
    };
  },
  async connectWifi() {
    return { status: "suggested", code: 0 };
  },
  async forgetWifi() {},
  async openWifiSettings() {},
  async getBluetoothStatus() {
    return {
      available: true,
      enabled: true,
      devices: [{ name: "Dev Controller", address: "00:00:00:00:00:00", paired: true, connected: true }],
    };
  },
  async setBluetoothEnabled() {},
  async scanBluetooth() {
    return { devices: [{ name: "Dev Controller", address: "00:00:00:00:00:00", paired: true, connected: true }] };
  },
  async pairBluetooth() {
    return { status: "paired" };
  },
  async unpairBluetooth() {
    return { status: "unpaired" };
  },
  async openBluetoothSettings() {},
  async openSystemSettings() {},
  async getKioskStatus() {
    return {
      deviceOwner: false,
      deviceAdmin: false,
      arborXrManaged: false,
      defaultLauncher: false,
      lockTaskActive: false,
      lockTaskMode: "none" as const,
      managementMode: "companion" as const,
      kioskEnabled: false,
    };
  },
  async setManagementMode({ mode }) {
    return { mode };
  },
  async requestDeviceAdmin() {
    return { status: "mock" };
  },
  async openLauncherSettings() {},
  async enableKioskLock() {
    return { status: "pinned" };
  },
  async disableKioskLock() {},
  async exitKioskToSystemHome() {
    return { exited: true, launcherPackage: null, deviceOwnerRetained: false };
  },
  async clearDeviceOwner() { return { cleared: true }; },
  async getPermissionStatus() {
    return {
      deviceOwner: false,
      deviceAdmin: false,
      defaultLauncher: false,
      location: true,
      bluetooth: true,
      accessibility: false,
      overlay: false,
      usageAccess: false,
      writeSettings: false,
      batteryUnrestricted: false,
      keyguardDisabled: false,
    };
  },
  async autoGrantSelfPermissions() { return { deviceOwner: false, granted: 0 }; },
  async setKeyguardDisabled(opts: { disabled: boolean }) {
    return { disabled: opts.disabled, applied: opts.disabled };
  },
  async openAccessibilitySettings() {},
  async openOverlaySettings() {},
  async openUsageAccessSettings() {},
  async openWriteSettings() {},
  async requestIgnoreBatteryOptimizations() { return { granted: false }; },
  async getProvisioningPayload() {
    return {
      packageName: "com.orgista.openpanel",
      component: "com.orgista.openpanel/com.orgista.openpanel.OpenPanelDeviceAdminReceiver",
      checksum: null,
    };
  },
  async addListener() {
    return { remove: async () => {} } as PluginListenerHandle;
  },
};

export const SystemBridge: SystemBridgePlugin = isNative ? native : webMock;
