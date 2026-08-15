// OpenPanel ships in two modes that share this one codebase:
//
//  - "companion": runs alongside the ArborXR Client, which is the device owner
//    and provides kiosk/lock-task lockdown. OpenPanel is just the content
//    launcher UI — no Exit Kiosk button, no self-managed lock task.
//
//  - "standalone": OpenPanel is itself the device launcher and runs its own
//    lock task / screen-pinning lockdown. It exposes an (admin-gated) Exit
//    Kiosk button and a Kiosk tab in the Admin Panel to grant launcher /
//    device-admin permissions. For people who are NOT using ArborXR.
//
// The mode is chosen once on first run ("Do you use ArborXR?") and persisted.
// Default is companion until the operator picks.

export type AppMode = "companion" | "standalone";

const MODE_KEY = "openpanel.appMode.v1";
const DEFAULT_MODE: AppMode = "companion";

export function getAppMode(): AppMode {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    return raw === "standalone" || raw === "companion" ? raw : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function setAppMode(mode: AppMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* storage unavailable — mode falls back to default next read */
  }
}

/** Whether the operator has answered the first-run "Do you use ArborXR?" prompt. */
export function isAppModeConfigured(): boolean {
  try {
    return localStorage.getItem(MODE_KEY) !== null;
  } catch {
    return false;
  }
}

const STANDALONE_ONBOARDED_KEY = "openpanel.standalone.onboarded.v1";

/**
 * Whether the standalone first-run onboarding (admin PIN, permissions, app
 * selection) has been completed. Only relevant in standalone mode; companion
 * devices are configured entirely by ArborXR.
 */
export function isStandaloneOnboarded(): boolean {
  try {
    return localStorage.getItem(STANDALONE_ONBOARDED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setStandaloneOnboarded(done: boolean): void {
  try {
    if (done) localStorage.setItem(STANDALONE_ONBOARDED_KEY, "1");
    else localStorage.removeItem(STANDALONE_ONBOARDED_KEY);
  } catch {
    /* storage unavailable */
  }
}
