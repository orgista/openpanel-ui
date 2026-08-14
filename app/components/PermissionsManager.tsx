import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Accessibility,
  Activity,
  AlertTriangle,
  BatteryCharging,
  BellOff,
  Bluetooth,
  Check,
  Home,
  Layers,
  Loader2,
  Lock,
  QrCode,
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
// screen; the special-access rows deep-link the matching Settings screen. When
// OpenPanel is not yet the device owner, a provisioning QR is offered so a
// factory-reset device can be made owner without adb.
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
      detail: isDO ? "OpenPanel is the device owner." : "Lets OpenPanel lock the device into kiosk mode.",
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

      {!isDO && <ProvisioningQr />}
    </div>
  );
}

// Renders a Device-Owner provisioning QR for the factory-reset setup flow, so a
// fresh device can be made owner on-device (no adb). The operator supplies the
// hosted APK URL; the admin component + signing checksum come from this build.
function ProvisioningQr() {
  const [apkUrl, setApkUrl] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [checksum, setChecksum] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const payload = await SystemBridge.getProvisioningPayload();
      setChecksum(payload.checksum);
      const provisioning: Record<string, unknown> = {
        "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": payload.component,
        "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": true,
        "android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED": true,
      };
      if (payload.checksum) {
        provisioning["android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM"] = payload.checksum;
      }
      const url = apkUrl.trim();
      if (url) provisioning["android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION"] = url;
      const dataUrl = await QRCode.toDataURL(JSON.stringify(provisioning), { width: 340, margin: 1 });
      setQr(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the QR code.");
    } finally {
      setBusy(false);
    }
  }, [apkUrl]);

  return (
    <div className="mt-2 p-4 bg-[oklch(70.4%_0.191_22.216)]/10 border border-[oklch(70.4%_0.191_22.216)]/30 rounded-lg space-y-4">
      <div className="flex items-start gap-3">
        <QrCode className="w-5 h-5 text-[oklch(70.4%_0.191_22.216)] shrink-0 mt-0.5" />
        <div>
          <div className="text-[oklch(98.5%_0_0)] text-sm" style={{ fontWeight: 500 }}>Make this a device owner without adb</div>
          <p className="text-[oklch(87%_0_0)] text-sm" style={{ fontWeight: 400 }}>
            Factory reset the target device, then on the first setup screen tap the
            same spot 6 times to open the QR reader and scan the code below.
          </p>
        </div>
      </div>

      <label className="block">
        <span className="text-[oklch(70.8%_0_0)] text-xs" style={{ fontWeight: 500 }}>OpenPanel APK download URL (HTTPS, same signing key as this build)</span>
        <input
          type="url"
          inputMode="url"
          value={apkUrl}
          onChange={(e) => setApkUrl(e.target.value)}
          placeholder="https://…/openpanel.apk"
          className="mt-1 w-full px-3 py-2 rounded-lg bg-[oklch(20.5%_0_0)] text-[oklch(95%_0_0)] border border-[oklch(43.9%_0_0)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        />
      </label>

      <button type="button" onClick={() => void generate()} disabled={busy} className={`${grantBtn} disabled:opacity-50`}>
        {busy ? "Generating…" : "Generate provisioning QR"}
      </button>

      {error && (
        <div className="flex items-center gap-2 text-[oklch(70.4%_0.191_22.216)] text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {qr && (
        <div className="space-y-2">
          <img src={qr} alt="Device owner provisioning QR" className="w-[240px] h-[240px] rounded-lg bg-white p-2" />
          <p className="text-[oklch(55.6%_0_0)] text-xs break-all" style={{ fontWeight: 400 }}>
            Signature checksum: {checksum ?? "unavailable"}
          </p>
          {!apkUrl.trim() && (
            <p className="text-[oklch(70.4%_0.191_22.216)] text-xs" style={{ fontWeight: 400 }}>
              Add the APK URL above so the fresh device can download OpenPanel during setup.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
