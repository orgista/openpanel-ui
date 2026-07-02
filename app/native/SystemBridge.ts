import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface InstalledApp {
  packageName: string;
  label: string;
  isSystem: boolean;
  installer: string | null;
  icon: string | null; // base64 PNG
}

export interface BatteryInfo {
  level: number; // 0-100, -1 if unknown
  isCharging: boolean;
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
  devices?: BtDevice[];
}

export interface KioskStatus {
  deviceOwner: boolean; // OpenPanel provisioned as Device Owner — strong, silent lock-task
  deviceAdmin: boolean; // OpenPanel device-admin enabled
  arborXrManaged: boolean; // ArborXR (app.xrdm.client) is the Device Owner
  defaultLauncher: boolean; // OpenPanel is the HOME launcher
  lockTaskActive: boolean;
  lockTaskMode: "locked" | "pinned" | "none";
}

interface SystemBridgePlugin {
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
  // Standalone (non-ArborXR) kiosk lockdown:
  getKioskStatus(): Promise<KioskStatus>;
  requestDeviceAdmin(): Promise<{ status?: string }>;
  openLauncherSettings(): Promise<void>;
  enableKioskLock(opts?: { packages?: string[] }): Promise<{ status: string }>;
  disableKioskLock(): Promise<void>;
  addListener(
    event: "bluetoothStateChanged",
    cb: (data: { enabled: boolean }) => void
  ): Promise<PluginListenerHandle>;
}

const native = registerPlugin<SystemBridgePlugin>("SystemBridge");

export const isNative = Capacitor.isNativePlatform();

// Browser fallback so the UI stays usable during web development.
const webMock: SystemBridgePlugin = {
  async getInstalledApps() {
    return {
      apps: [
        { packageName: "com.example.one", label: "Sample Game", isSystem: false, installer: "app.xrdm.client", icon: null },
        { packageName: "com.example.two", label: "Another Game", isSystem: false, installer: "app.xrdm.client", icon: null },
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
  async getKioskStatus() {
    return { deviceOwner: false, deviceAdmin: false, arborXrManaged: false, defaultLauncher: false, lockTaskActive: false, lockTaskMode: "none" as const };
  },
  async requestDeviceAdmin() {
    return { status: "mock" };
  },
  async openLauncherSettings() {},
  async enableKioskLock() {
    return { status: "pinned" };
  },
  async disableKioskLock() {},
  async addListener() {
    return { remove: async () => {} } as PluginListenerHandle;
  },
};

export const SystemBridge: SystemBridgePlugin = isNative ? native : webMock;
