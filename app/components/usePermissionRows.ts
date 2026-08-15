import { useCallback, useEffect, useState } from "react";
import {
  Accessibility,
  Activity,
  BatteryCharging,
  BellOff,
  Bluetooth,
  Home,
  Layers,
  Shield,
  SlidersHorizontal,
  Wifi,
} from "lucide-react";
import { SystemBridge, type PermissionStatus } from "../native/SystemBridge";

// Single source of truth for the Fully-style permission rows shown both in the
// standalone onboarding wizard (StandaloneOnboarding) and in ongoing Admin-panel
// management (PermissionsManager). Both call sites render the same rows and rely
// on the same auto-grant / visibility-refresh lifecycle, so it lives here once.

export type PermissionKey =
  | "launcher"
  | "admin"
  | "wifi"
  | "bluetooth"
  | "accessibility"
  | "notifications"
  | "overlay"
  | "usage"
  | "write"
  | "battery";

export interface PermRow {
  key: PermissionKey;
  label: string;
  detail: string;
  icon: typeof Home;
  granted: boolean;
  action: () => Promise<unknown>;
}

interface UsePermissionRowsOptions {
  // The two call sites label the Home-launcher row differently when it is not the
  // Fire OS redirect: Admin management says "Home launcher", first-run onboarding
  // says "Set OpenPanel as Home". Everything else is identical.
  homeLauncherLabel?: string;
}

export interface UsePermissionRows {
  status: PermissionStatus | null;
  rows: PermRow[];
  isDeviceOwner: boolean;
  fireHome: boolean;
  refresh: () => Promise<void>;
  act: (fn: () => Promise<unknown>) => Promise<void>;
}

export function usePermissionRows(
  { homeLauncherLabel = "Home launcher" }: UsePermissionRowsOptions = {},
): UsePermissionRows {
  const [status, setStatus] = useState<PermissionStatus | null>(null);

  const refresh = useCallback(async () => {
    try { setStatus(await SystemBridge.getPermissionStatus()); }
    catch { /* ignore */ }
  }, []);

  // On entry, let a Device Owner silently grant its own runtime permissions
  // (Wi-Fi/Bluetooth) so the operator sees fewer prompts, then read real state.
  // Re-check whenever we return from a Settings screen we deep-linked into.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try { await SystemBridge.autoGrantSelfPermissions(); } catch { /* ignore */ }
      if (!cancelled) await refresh();
    })();
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  const act = useCallback(async (fn: () => Promise<unknown>) => {
    try { await fn(); } catch { /* ignore */ } finally { await refresh(); }
  }, [refresh]);

  const s = status;
  const isDeviceOwner = !!s?.deviceOwner;
  const fireHome = s?.homeControlMode === "fire-redirect"
    || s?.homeControlMode === "fire-needs-accessibility";

  const rows: PermRow[] = [
    {
      key: "launcher", label: fireHome ? "Fire OS Home redirect" : homeLauncherLabel, icon: Home,
      detail: fireHome
        ? "Fire OS reserves Home; accessibility returns it to OpenPanel."
        : "Return to the panel with the Home button.",
      granted: !!s?.defaultLauncher || s?.homeControlMode === "fire-redirect",
      action: fireHome
        ? () => SystemBridge.openAccessibilitySettings()
        : () => SystemBridge.openLauncherSettings(),
    },
    {
      key: "admin", label: "Kiosk admin", icon: Shield,
      detail: isDeviceOwner ? "OpenPanel has full managed-device control." : "Lets OpenPanel lock the device into kiosk mode.",
      granted: !!(s?.deviceOwner || s?.deviceAdmin),
      action: () => SystemBridge.requestDeviceAdmin(),
    },
    {
      key: "wifi", label: "Wi-Fi & nearby", icon: Wifi,
      detail: "Scan and join Wi-Fi networks.",
      granted: !!s?.location,
      action: () => SystemBridge.scanWifi(),
    },
    {
      key: "bluetooth", label: "Bluetooth", icon: Bluetooth,
      detail: "Pair keyboards, controllers, and audio.",
      granted: !!s?.bluetooth,
      action: () => SystemBridge.scanBluetooth(),
    },
    {
      key: "accessibility", label: "Accessibility service", icon: Accessibility,
      detail: "Keeps Home in OpenPanel and blocks the Fire OS notification shade.",
      granted: !!s?.accessibility,
      action: () => SystemBridge.openAccessibilitySettings(),
    },
    {
      key: "notifications", label: "Notification blocking", icon: BellOff,
      detail: "Cancels nonessential app notifications while preserving kiosk and system services.",
      granted: !!s?.notificationAccess,
      action: () => SystemBridge.openNotificationListenerSettings(),
    },
    {
      key: "overlay", label: "Display over other apps", icon: Layers,
      detail: "Lets OpenPanel draw over launched apps when needed.",
      granted: !!s?.overlay,
      action: () => SystemBridge.openOverlaySettings(),
    },
    {
      key: "usage", label: "Usage access", icon: Activity,
      detail: "Detects the foreground app so the kiosk can recover focus.",
      granted: !!s?.usageAccess,
      action: () => SystemBridge.openUsageAccessSettings(),
    },
    {
      key: "write", label: "Modify system settings", icon: SlidersHorizontal,
      detail: "Controls screen brightness and timeout.",
      granted: !!s?.writeSettings,
      action: () => SystemBridge.openWriteSettings(),
    },
    {
      key: "battery", label: "Unrestricted battery", icon: BatteryCharging,
      detail: "Keeps OpenPanel and the network awake in the background.",
      granted: !!s?.batteryUnrestricted,
      action: () => SystemBridge.requestIgnoreBatteryOptimizations(),
    },
  ];

  return { status, rows, isDeviceOwner, fireHome, refresh, act };
}
