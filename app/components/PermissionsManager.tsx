import { useCallback, useEffect, useState } from "react";
import {
  Accessibility,
  Activity,
  BatteryCharging,
  BellOff,
  Bluetooth,
  Check,
  Home,
  Layers,
  Loader2,
  Lock,
  Shield,
  SlidersHorizontal,
  Wifi,
} from "lucide-react";
import { SystemBridge, type PermissionStatus } from "../native/SystemBridge";

interface PermRow {
  key: string;
  label: string;
  detail: string;
  icon: typeof Home;
  granted: boolean;
  action: () => Promise<unknown>;
}

const rowClass = "flex items-center justify-between gap-4 p-4 bg-[oklch(26.9%_0_0)] rounded-lg";
const grantBtn =
  "shrink-0 px-4 py-2 bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)] rounded-lg hover:bg-[oklch(48.8%_0.243_264.376)]/80 transition-colors text-sm";

// Ongoing management of the Fully-style grants, reachable from the Admin panel.
// A device owner auto-grants its runtime permissions and can hide the lock
// screen; the special-access rows deep-link the matching Settings screen.
// Fully managed provisioning lives in the repository documentation because a
// QR displayed by the target tablet disappears when that tablet is reset.
export function PermissionsManager() {
  const [status, setStatus] = useState<PermissionStatus | null>(null);

  const refresh = useCallback(async () => {
    try { setStatus(await SystemBridge.getPermissionStatus()); }
    catch { /* ignore */ }
  }, []);

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
  const isDO = !!s?.deviceOwner;
  const fireHome = s?.homeControlMode === "fire-redirect"
    || s?.homeControlMode === "fire-needs-accessibility";

  const rows: PermRow[] = [
    { key: "launcher", label: fireHome ? "Fire OS Home redirect" : "Home launcher", icon: Home,
      detail: fireHome
        ? "Fire OS reserves Home; accessibility returns it to OpenPanel."
        : "Return to the panel with the Home button.",
      granted: !!s?.defaultLauncher || s?.homeControlMode === "fire-redirect",
      action: fireHome
        ? () => SystemBridge.openAccessibilitySettings()
        : () => SystemBridge.openLauncherSettings() },
    { key: "admin", label: "Kiosk admin", icon: Shield,
      detail: isDO ? "OpenPanel has full managed-device control." : "Lets OpenPanel lock the device into kiosk mode.",
      granted: !!(s?.deviceOwner || s?.deviceAdmin), action: () => SystemBridge.requestDeviceAdmin() },
    { key: "wifi", label: "Wi-Fi & nearby", icon: Wifi,
      detail: "Scan and join Wi-Fi networks.",
      granted: !!s?.location, action: () => SystemBridge.scanWifi() },
    { key: "bluetooth", label: "Bluetooth", icon: Bluetooth,
      detail: "Pair keyboards, controllers, and audio.",
      granted: !!s?.bluetooth, action: () => SystemBridge.scanBluetooth() },
    { key: "accessibility", label: "Accessibility service", icon: Accessibility,
      detail: "Keeps Home in OpenPanel and blocks the Fire OS notification shade.",
      granted: !!s?.accessibility, action: () => SystemBridge.openAccessibilitySettings() },
    { key: "notifications", label: "Notification blocking", icon: BellOff,
      detail: "Cancels nonessential app notifications while preserving kiosk and system services.",
      granted: !!s?.notificationAccess,
      action: () => SystemBridge.openNotificationListenerSettings() },
    { key: "overlay", label: "Display over other apps", icon: Layers,
      detail: "Lets OpenPanel draw over launched apps when needed.",
      granted: !!s?.overlay, action: () => SystemBridge.openOverlaySettings() },
    { key: "usage", label: "Usage access", icon: Activity,
      detail: "Detects the foreground app so the kiosk can recover focus.",
      granted: !!s?.usageAccess, action: () => SystemBridge.openUsageAccessSettings() },
    { key: "write", label: "Modify system settings", icon: SlidersHorizontal,
      detail: "Controls screen brightness and timeout.",
      granted: !!s?.writeSettings, action: () => SystemBridge.openWriteSettings() },
    { key: "battery", label: "Unrestricted battery", icon: BatteryCharging,
      detail: "Keeps OpenPanel and the network awake in the background.",
      granted: !!s?.batteryUnrestricted, action: () => SystemBridge.requestIgnoreBatteryOptimizations() },
  ];

  if (s === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-[oklch(70.8%_0_0)]">
        <Loader2 className="w-5 h-5 animate-spin" /> Checking permissions…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const Icon = row.icon;
        return (
          <div key={row.key} className={rowClass}>
            <div className="flex items-center gap-3 min-w-0">
              {row.granted
                ? <Check className="w-5 h-5 text-[oklch(72%_0.19_142)] shrink-0" />
                : <Icon className="w-5 h-5 text-[oklch(70.8%_0_0)] shrink-0" />}
              <div className="min-w-0">
                <div className="text-[oklch(98.5%_0_0)] text-sm" style={{ fontWeight: 500 }}>{row.label}</div>
                <div className="text-[oklch(55.6%_0_0)] text-xs" style={{ fontWeight: 400 }}>{row.detail}</div>
              </div>
            </div>
            {row.granted ? (
              <span className="shrink-0 text-[oklch(72%_0.19_142)] text-sm" style={{ fontWeight: 500 }}>Granted</span>
            ) : (
              <button type="button" onClick={() => void act(row.action)} className={grantBtn}>Grant</button>
            )}
          </div>
        );
      })}

      {/* Only a device owner can suppress the swipe lock screen. */}
      {isDO && (
        <div className={rowClass}>
          <div className="flex items-center gap-3 min-w-0">
            <Lock className="w-5 h-5 text-[oklch(70.8%_0_0)] shrink-0" />
            <div className="min-w-0">
              <div className="text-[oklch(98.5%_0_0)] text-sm" style={{ fontWeight: 500 }}>Hide lock screen</div>
              <div className="text-[oklch(55.6%_0_0)] text-xs" style={{ fontWeight: 400 }}>Wake straight into OpenPanel, skipping the swipe lock screen.</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void act(() => SystemBridge.setKeyguardDisabled({ disabled: !s.keyguardDisabled }))}
            className={grantBtn}
            aria-pressed={s.keyguardDisabled}
          >
            {s.keyguardDisabled ? "On" : "Off"}
          </button>
        </div>
      )}
    </div>
  );
}
