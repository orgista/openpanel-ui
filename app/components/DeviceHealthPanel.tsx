import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  BellOff,
  CheckCircle2,
  HardDrive,
  Loader2,
  MemoryStick,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  SystemBridge,
  type DebloatApp,
  type DeviceHealthActionResult,
  type DeviceHealthSnapshot,
} from "../native/SystemBridge";

interface DeviceHealthPanelProps {
  manageNotifications: boolean;
  onSetManageNotifications: (enabled: boolean) => void;
  autoApply?: boolean;
  setupMode?: boolean;
}

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80 disabled:opacity-50 transition-colors";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "Unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unit = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / (1024 ** unit);
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function statusLabel(app: DebloatApp): string {
  if (app.status === "hidden") return "Hidden by policy";
  if (app.status === "disabled-externally") return "Disabled outside OpenPanel";
  return "Active";
}

export function DeviceHealthPanel({
  manageNotifications,
  onSetManageNotifications,
  autoApply = false,
  setupMode = false,
}: DeviceHealthPanelProps) {
  const [health, setHealth] = useState<DeviceHealthSnapshot | null>(null);
  const [apps, setApps] = useState<DebloatApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const autoApplied = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextHealth, debloat] = await Promise.all([
        SystemBridge.getDeviceHealth(),
        SystemBridge.getDebloatApps(),
      ]);
      setHealth(nextHealth);
      setApps(debloat.apps);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Device health could not be read.");
    } finally {
      setLoading(false);
    }
  }, []);

  const consumeResult = useCallback(async (result: DeviceHealthActionResult) => {
    setMessage(result.message);
    if (result.apps) setApps(result.apps);
    else if (result.app) {
      const updatedApp = result.app;
      setApps((current) => current.map((app) => (
        app.packageName === updatedApp.packageName ? updatedApp : app
      )));
    }
    const nextHealth = await SystemBridge.getDeviceHealth();
    setHealth(nextHealth);
  }, []);

  const optimize = useCallback(async () => {
    setBusyKey("optimize");
    try {
      await consumeResult(await SystemBridge.applyRecommendedDebloat({ manageNotifications }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Device optimization failed.");
    } finally {
      setBusyKey(null);
    }
  }, [consumeResult, manageNotifications]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!autoApply || loading || !health?.canManageApps || autoApplied.current) return;
    autoApplied.current = true;
    void optimize();
  }, [autoApply, health?.canManageApps, loading, optimize]);

  const toggleNotifications = async () => {
    const enabled = !manageNotifications;
    onSetManageNotifications(enabled);
    setBusyKey("notifications");
    try {
      await consumeResult(await SystemBridge.setNotificationManagement({ enabled }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Notification policy could not be updated.");
    } finally {
      setBusyKey(null);
    }
  };

  const updatePackage = async (app: DebloatApp, hidden: boolean) => {
    setBusyKey(app.packageName);
    try {
      await consumeResult(await SystemBridge.setDebloatPackageState({
        packageName: app.packageName,
        hidden,
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The app policy could not be updated.");
    } finally {
      setBusyKey(null);
    }
  };

  const restoreAll = async () => {
    setBusyKey("restore");
    try {
      await consumeResult(await SystemBridge.restoreDebloatApps());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Managed apps could not be restored.");
    } finally {
      setBusyKey(null);
    }
  };

  const uninstall = async (app: DebloatApp) => {
    setBusyKey(app.packageName);
    setMessage(`Android will ask you to confirm uninstalling ${app.label}.`);
    try {
      const result = await SystemBridge.requestUninstallPackage({ packageName: app.packageName });
      setMessage(result.uninstalled ? `${app.label} was uninstalled.` : `${app.label} was kept.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Android could not open uninstall confirmation.");
    } finally {
      setBusyKey(null);
    }
  };

  if (loading && !health) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-16 text-[oklch(70.8%_0_0)]">
        <Loader2 className="size-5 animate-spin" /> Detecting this device…
      </div>
    );
  }

  return (
    <section aria-labelledby="device-health-heading" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="size-5 text-[oklch(70%_0.18_255)]" />
            <h3 id="device-health-heading" className="text-xl text-[oklch(98.5%_0_0)]" style={{ fontWeight: 500 }}>
              Device Health
            </h3>
          </div>
          <p className="text-sm text-[oklch(70.8%_0_0)]">
            {health ? `${health.manufacturer} ${health.model} · Android ${health.androidVersion} · ${health.profile} policy` : "Device details unavailable"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading || busyKey !== null}
          className={`${buttonClass} bg-[oklch(26.9%_0_0)] text-[oklch(90%_0_0)] hover:bg-[oklch(33%_0_0)]`}
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {health && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[oklch(35%_0_0)] bg-[oklch(24%_0_0)] p-4">
            <div className="flex items-center gap-2 text-[oklch(88%_0_0)] mb-2">
              <MemoryStick className="size-5" /> RAM in use
            </div>
            <div className="text-2xl text-white" style={{ fontWeight: 600 }}>
              {formatBytes(health.ramUsedBytes)} <span className="text-sm text-[oklch(65%_0_0)]">of {formatBytes(health.ramTotalBytes)}</span>
            </div>
            <div className="h-2 rounded-full bg-[oklch(18%_0_0)] mt-3 overflow-hidden">
              <div className="h-full bg-[oklch(58%_0.2_255)]" style={{ width: `${Math.min(100, health.ramUsedPercent)}%` }} />
            </div>
          </div>
          <div className="rounded-xl border border-[oklch(35%_0_0)] bg-[oklch(24%_0_0)] p-4">
            <div className="flex items-center gap-2 text-[oklch(88%_0_0)] mb-2">
              <HardDrive className="size-5" /> Storage in use
            </div>
            <div className="text-2xl text-white" style={{ fontWeight: 600 }}>
              {formatBytes(health.storageUsedBytes)} <span className="text-sm text-[oklch(65%_0_0)]">of {formatBytes(health.storageTotalBytes)}</span>
            </div>
            <div className="h-2 rounded-full bg-[oklch(18%_0_0)] mt-3 overflow-hidden">
              <div className="h-full bg-[oklch(52%_0.16_150)]" style={{ width: `${Math.min(100, health.storageUsedPercent)}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className={`rounded-xl border p-4 ${health?.canManageApps
        ? "border-[oklch(55%_0.15_150)]/50 bg-[oklch(28%_0.08_150)]/40"
        : "border-[oklch(65%_0.16_70)]/50 bg-[oklch(28%_0.08_70)]/40"}`}>
        <div className="flex items-start gap-3">
          {health?.canManageApps
            ? <ShieldCheck className="size-5 shrink-0 mt-0.5 text-[oklch(72%_0.15_150)]" />
            : <ShieldAlert className="size-5 shrink-0 mt-0.5 text-[oklch(75%_0.16_70)]" />}
          <div>
            <p className="text-[oklch(94%_0_0)]" style={{ fontWeight: 500 }}>
              {health?.canManageApps ? "Device Owner controls available" : health?.arborXrManaged ? "Managed by ArborXR" : "Device Owner required"}
            </p>
            <p className="text-sm text-[oklch(72%_0_0)] mt-1">
              {health?.canManageApps
                ? "OpenPanel uses Android's on-device management APIs. Changes are tracked and reversible."
                : health?.arborXrManaged
                  ? "OpenPanel cannot override ArborXR's Device Policy Controller. Mirror this policy in ArborXR."
                  : "An Android app cannot run ADB against its own device. Provision OpenPanel as Device Owner for silent, on-device management."}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[oklch(43.9%_0_0)] bg-[oklch(26.9%_0_0)] p-4">
        <div className="flex items-start gap-3">
          <BellOff className="size-5 mt-0.5 text-[oklch(75%_0.16_255)]" />
          <div>
            <p className="text-[oklch(98%_0_0)]" style={{ fontWeight: 500 }}>Manage app notifications</p>
            <p className="text-xs sm:text-sm text-[oklch(70.8%_0_0)] mt-1">
              On by default. Suppresses eligible app notifications while preserving Android, emergency, launcher, management, and OpenPanel services.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={manageNotifications}
          aria-label="Manage app notifications"
          disabled={busyKey !== null}
          onClick={() => void toggleNotifications()}
          className={`relative h-10 w-[4.5rem] shrink-0 rounded-full border-2 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80 ${manageNotifications
            ? "border-[oklch(48.8%_0.243_264.376)] bg-[oklch(48.8%_0.243_264.376)]"
            : "border-[oklch(55.6%_0_0)] bg-[oklch(20.5%_0_0)]"}`}
        >
          <span className={`absolute top-1/2 size-7 -translate-y-1/2 rounded-full bg-white transition-transform ${manageNotifications ? "translate-x-8" : "translate-x-1"}`} />
          <span className="sr-only">{manageNotifications ? "On" : "Off"}</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void optimize()}
          disabled={!health?.canManageApps || busyKey !== null}
          className={`${buttonClass} bg-[oklch(48.8%_0.243_264.376)] text-white hover:brightness-110`}
        >
          {busyKey === "optimize" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          {autoApply && busyKey === "optimize" ? "Optimizing…" : "Optimize now"}
        </button>
        <button
          type="button"
          onClick={() => void restoreAll()}
          disabled={!health?.canManageApps || busyKey !== null || !apps.some((app) => app.managedByOpenPanel)}
          className={`${buttonClass} bg-[oklch(26.9%_0_0)] text-[oklch(90%_0_0)] hover:bg-[oklch(33%_0_0)]`}
        >
          {busyKey === "restore" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
          Restore apps
        </button>
      </div>

      {message && (
        <p role="status" className="rounded-lg bg-[oklch(24%_0_0)] px-4 py-3 text-sm text-[oklch(80%_0_0)]">
          {message}
        </p>
      )}

      <div>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h4 className="text-lg text-[oklch(98.5%_0_0)]" style={{ fontWeight: 500 }}>Detected optional apps</h4>
            <p className="text-xs text-[oklch(65%_0_0)] mt-1">Exact package matches only · {apps.length} installed</p>
          </div>
          {health && <span className="text-xs text-[oklch(65%_0_0)]">{health.hiddenBloatCount} hidden</span>}
        </div>
        {apps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[oklch(40%_0_0)] p-6 text-center text-sm text-[oklch(70.8%_0_0)]">
            No reviewed optional packages were detected for this device.
          </div>
        ) : (
          <div className="space-y-3">
            {apps.map((app) => (
              <div key={app.packageName} className="rounded-xl border border-[oklch(35%_0_0)] bg-[oklch(24%_0_0)] p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[oklch(96%_0_0)]" style={{ fontWeight: 500 }}>{app.label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${app.status === "active"
                        ? "bg-[oklch(45%_0.13_70)]/50 text-[oklch(85%_0.12_70)]"
                        : "bg-[oklch(40%_0.1_150)]/50 text-[oklch(82%_0.12_150)]"}`}>
                        {statusLabel(app)}
                      </span>
                    </div>
                    <p className="text-sm text-[oklch(70.8%_0_0)] mt-1">{app.reason}</p>
                    <p className="text-xs text-[oklch(55%_0_0)] mt-1 break-all">{app.packageName}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {app.status !== "disabled-externally" && (
                      <button
                        type="button"
                        onClick={() => void updatePackage(app, !app.hidden)}
                        disabled={!health?.canManageApps || busyKey !== null}
                        className={`${buttonClass} bg-[oklch(31%_0_0)] text-[oklch(90%_0_0)] hover:bg-[oklch(38%_0_0)]`}
                      >
                        {busyKey === app.packageName
                          ? <Loader2 className="size-4 animate-spin" />
                          : app.hidden ? <RotateCcw className="size-4" /> : <ShieldCheck className="size-4" />}
                        {app.hidden ? "Restore" : "Hide"}
                      </button>
                    )}
                    {app.canUninstall && app.status !== "disabled-externally" && (
                      <button
                        type="button"
                        onClick={() => void uninstall(app)}
                        disabled={busyKey !== null}
                        className={`${buttonClass} bg-[oklch(40%_0.14_25)]/70 text-[oklch(88%_0.1_25)] hover:bg-[oklch(48%_0.16_25)]/70`}
                      >
                        <Trash2 className="size-4" /> Uninstall…
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {setupMode && (
        <p className="text-xs text-[oklch(60%_0_0)]">
          You can revisit every setting later under Admin Panel → Device Health.
        </p>
      )}
    </section>
  );
}
