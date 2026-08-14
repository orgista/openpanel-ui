import type { AppMode } from "../appConfig";
import type { InstalledApp } from "./SystemBridge";

const EXCLUDED = new Set(["app.xrdm.client", "app.revanced.android.gms"]);
const SUPPORTED_SYSTEM_APPS = new Set([
  "com.netflix.mediaclient",
  "com.netflix.ninja",
]);

/**
 * Decide which launchable user apps are eligible for the panel in the selected
 * management mode. In standalone mode all non-system user apps are eligible;
 * which of those actually appear is a separate per-operator choice (the
 * onboarding app picker seeds the hidden-apps set, editable later in Admin).
 */
export function isAllowedApp(app: InstalledApp, mode: AppMode): boolean {
  if (EXCLUDED.has(app.packageName)) return false;
  if (app.isSystem && !SUPPORTED_SYSTEM_APPS.has(app.packageName)) return false;
  if (mode === "standalone") return true;
  // ArborXR's Device Owner policy is the source of truth. Install-source
  // metadata is frequently null for APKs that ArborXR deploys successfully.
  return app.lockTaskPermitted;
}

/**
 * Build the visible launcher catalog without letting a stale Companion setting
 * strand a device on an empty screen. Companion mode's lock-task allowlist is
 * authoritative only while ArborXR is actually the Device Owner. If ArborXR
 * is absent and its allowlist yields no apps, use the standalone catalog as a
 * safe display fallback; package launches still pass through Android itself.
 */
export function allowedAppsForDevice(
  apps: InstalledApp[],
  mode: AppMode,
  arborXrManaged: boolean,
): InstalledApp[] {
  const allowed = apps.filter((app) => isAllowedApp(app, mode));
  if (mode !== "companion" || arborXrManaged || allowed.length > 0) {
    return allowed;
  }
  return apps.filter((app) => isAllowedApp(app, "standalone"));
}
