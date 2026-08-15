import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Accessibility,
  Activity,
  ArrowRight,
  BatteryCharging,
  BellOff,
  Bluetooth,
  Check,
  Home,
  Layers,
  LayoutGrid,
  Library,
  Loader2,
  Lock,
  Shield,
  SlidersHorizontal,
  Wifi,
  Youtube,
  Upload,
} from "lucide-react";
import { SystemBridge, type InstalledApp, type PermissionStatus } from "../native/SystemBridge";
import type { DeviceProfile } from "../native/SystemBridge";
import { isAdminConfigured, setupAdmin, SECURITY_QUESTIONS } from "../native/adminAuth";
import { isAllowedApp } from "../native/catalog";
import { addYouTubeItem } from "../native/youtube";
import { PinInput } from "./PinInput";
import { DeviceHealthPanel } from "./DeviceHealthPanel";
import { LibraryBridge } from "../native/LibraryBridge";
import { OpenPanelBrand } from "./OpenPanelBrand";

interface StandaloneOnboardingProps {
  deviceProfile: DeviceProfile | null;
  manageNotifications: boolean;
  onSetManageNotifications: (enabled: boolean) => void;
  // Receives the packages the operator chose NOT to show, to seed hidden-apps.
  onComplete: (hiddenPackages: string[]) => void;
}

export type StepId = "pin" | "permissions" | "health" | "apps" | "library" | "optional";
const TABLET_STEPS: StepId[] = ["pin", "permissions", "health", "apps", "library", "optional"];
const TELEVISION_STEPS: StepId[] = ["pin", "permissions", "apps", "optional"];

export function onboardingStepsForDevice(isTelevision: boolean): StepId[] {
  return [...(isTelevision ? TELEVISION_STEPS : TABLET_STEPS)];
}
const STEP_TITLES: Record<StepId, string> = {
  pin: "Create an admin PIN",
  permissions: "Grant permissions",
  health: "Optimize this device",
  apps: "Choose apps",
  library: "Books & Audio",
  optional: "Wi-Fi & YouTube",
};

const ONBOARDING_PROGRESS_KEY = "openpanel.standalone.onboarding.progress.v1";

interface OnboardingProgress {
  stepIndex: number;
  hiddenPackages: string[];
}

function readOnboardingProgress(): OnboardingProgress {
  try {
    const raw = localStorage.getItem(ONBOARDING_PROGRESS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<OnboardingProgress>;
      return {
        stepIndex: Number.isInteger(parsed.stepIndex) ? Math.max(0, parsed.stepIndex as number) : 0,
        hiddenPackages: Array.isArray(parsed.hiddenPackages)
          ? parsed.hiddenPackages.filter((item): item is string => typeof item === "string")
          : [],
      };
    }
  } catch {
    // A corrupt progress record should never block setup.
  }
  return { stepIndex: isAdminConfigured() ? 1 : 0, hiddenPackages: [] };
}

function writeOnboardingProgress(progress: OnboardingProgress): void {
  try { localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(progress)); }
  catch { /* setup still works for this session */ }
}

function clearOnboardingProgress(): void {
  try { localStorage.removeItem(ONBOARDING_PROGRESS_KEY); }
  catch { /* completion must not be blocked by storage cleanup */ }
}

const cardClass =
  "bg-[oklch(20.5%_0_0)] rounded-2xl border border-[oklch(26.9%_0_0)]";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[oklch(48.8%_0.243_264.376)] text-white px-6 py-3 disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80 transition-colors";
const ghostBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[oklch(26.9%_0_0)] text-[oklch(90%_0_0)] px-5 py-3 hover:bg-[oklch(32%_0_0)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80 transition-colors";

// -------------------- Step 1: admin PIN --------------------

function PinStep({
  deviceProfile,
  onDone,
}: {
  deviceProfile: DeviceProfile | null;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"enter" | "confirm" | "question">("enter");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  const handleEnter = useCallback((pin: string) => {
    setFirstPin(pin);
    setError(null);
    setPhase("confirm");
  }, []);

  const handleConfirm = useCallback((pin: string) => {
    if (pin !== firstPin) {
      setError("Those PINs didn't match. Start again.");
      setFirstPin("");
      setPhase("enter");
      return;
    }
    setError(null);
    setPhase("question");
  }, [firstPin]);

  const saveAdmin = useCallback(async () => {
    if (answer.trim().length < 2) {
      setError("Enter a recovery answer you'll remember.");
      return;
    }
    setSaving(true);
    try {
      await setupAdmin(firstPin, SECURITY_QUESTIONS[questionIndex], answer.trim());
      onDone();
    } catch {
      setError("Could not save the admin PIN. Try again.");
      setSaving(false);
    }
  }, [answer, firstPin, questionIndex, onDone]);

  if (phase === "question") {
    return (
      <div className={`${cardClass} p-7 w-full max-w-lg mx-auto`}>
        <h2 className="text-2xl text-[oklch(98.5%_0_0)] mb-1" style={{ fontWeight: 500 }}>
          Recovery question
        </h2>
        <p className="text-[oklch(70.8%_0_0)] text-sm mb-5">
          Used to reset the PIN if it's forgotten.
        </p>
        <label className="block text-[oklch(80%_0_0)] text-sm mb-2">Question</label>
        <select
          autoFocus={deviceProfile?.remoteUi === true}
          value={questionIndex}
          onChange={(e) => setQuestionIndex(Number(e.target.value))}
          className="w-full mb-4 rounded-xl bg-[oklch(26.9%_0_0)] text-[oklch(95%_0_0)] border border-[oklch(43.9%_0_0)] px-4 py-3 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
        >
          {SECURITY_QUESTIONS.map((q, i) => (
            <option key={q} value={i}>{q}</option>
          ))}
        </select>
        <label className="block text-[oklch(80%_0_0)] text-sm mb-2">Answer</label>
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          autoComplete="off"
          className="w-full mb-4 rounded-xl bg-[oklch(26.9%_0_0)] text-[oklch(95%_0_0)] border border-[oklch(43.9%_0_0)] px-4 py-3 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
          placeholder="Your answer"
        />
        {error && <p role="alert" className="text-[oklch(72%_0.18_22)] text-sm mb-3">{error}</p>}
        <button type="button" disabled={saving} onClick={() => void saveAdmin()} className={`${primaryBtn} w-full`}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save PIN & continue
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      {error && <p role="alert" className="text-[oklch(72%_0.18_22)] text-sm mb-3">{error}</p>}
      <PinInput
        key={phase}
        title={phase === "enter" ? "Set a 4-digit PIN" : "Re-enter to confirm"}
        onComplete={phase === "enter" ? handleEnter : handleConfirm}
        onCancel={() => { setFirstPin(""); setError(null); setPhase("enter"); }}
        remoteMode={deviceProfile?.remoteUi === true}
        controllerName={deviceProfile?.controllerName?.startsWith("sim-")
          ? null
          : deviceProfile?.controllerName}
        hasHardwareKeyboard={deviceProfile?.hasHardwareKeyboard === true}
      />
    </div>
  );
}

// -------------------- Step 2: permissions --------------------

interface PermRow {
  key: PermissionKey;
  label: string;
  detail: string;
  icon: typeof Home;
  granted: boolean;
  action: () => Promise<unknown>;
}

type PermissionKey = "launcher" | "admin" | "wifi" | "bluetooth" | "accessibility"
  | "notifications" | "overlay" | "usage" | "write" | "battery";

const TABLET_PERMISSION_KEYS: PermissionKey[] = [
  "launcher",
  "admin",
  "wifi",
  "bluetooth",
  "accessibility",
  "notifications",
  "overlay",
  "usage",
  "write",
  "battery",
];

export function permissionKeysForDevice(
  isTelevision: boolean,
  _fireHome: boolean,
): PermissionKey[] {
  // TV permissions are deliberately provisioned after first run from Admin or
  // the active MDM. Only HOME is essential to finish a usable remote setup.
  return [...(isTelevision ? ["launcher"] as PermissionKey[] : TABLET_PERMISSION_KEYS)];
}

function PermissionsStep({
  deviceProfile,
  onNext,
}: {
  deviceProfile: DeviceProfile | null;
  onNext: () => void;
}) {
  const [status, setStatus] = useState<PermissionStatus | null>(null);
  const initialActionRef = useRef<HTMLButtonElement | null>(null);

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
  const isDO = !!s?.deviceOwner;
  const fireHome = s?.homeControlMode === "fire-redirect"
    || s?.homeControlMode === "fire-needs-accessibility";

  const allRows: PermRow[] = [
    {
      key: "launcher", label: fireHome ? "Fire OS Home redirect" : "Set OpenPanel as Home", icon: Home,
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
      detail: isDO ? "OpenPanel has full managed-device control." : "Lets OpenPanel lock the device into kiosk mode.",
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
  const permissionKeys = permissionKeysForDevice(
    deviceProfile?.isTelevision === true,
    fireHome,
  );
  const rows = allRows.filter((row) => permissionKeys.includes(row.key));
  const firstGrantKey = rows.find((row) => !row.granted)?.key;

  useEffect(() => {
    if (status === null || deviceProfile?.remoteUi !== true) return;
    const frame = window.requestAnimationFrame(() => initialActionRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [deviceProfile?.remoteUi, firstGrantKey, status]);

  return (
    <div className={`${cardClass} p-6 w-full max-w-2xl mx-auto`}>
      <p className="text-[oklch(70.8%_0_0)] text-sm mb-5">
        {deviceProfile?.isTelevision
          ? "Set OpenPanel as this TV's Home app. Optional kiosk and privacy controls stay available in Admin after setup."
          : deviceProfile?.isFireOs
            ? "Grant the Fire Home redirect and kiosk access below. Skip any item now and grant it later from the Admin panel."
            : "Grant these so the kiosk works fully. Managed devices receive supported grants automatically; the rest open the matching Settings screen. Skip any and grant them later from the Admin panel."}
      </p>
      {s === null ? (
        <div className="flex items-center justify-center gap-2 py-10 text-[oklch(70%_0_0)]">
          <Loader2 className="size-5 animate-spin" /> Checking permissions…
        </div>
      ) : (
        <div className="flex flex-col gap-3 mb-6">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.key} className="flex items-center gap-4 rounded-xl bg-[oklch(24%_0_0)] px-4 py-3">
                <Icon className="size-6 text-[oklch(70%_0_0)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[oklch(95%_0_0)]" style={{ fontWeight: 500 }}>{row.label}</div>
                  <div className="text-[oklch(63%_0_0)] text-sm">{row.detail}</div>
                </div>
                {row.granted ? (
                  <span className="inline-flex items-center gap-1 text-[oklch(72%_0.15_150)] text-sm" style={{ fontWeight: 500 }}>
                    <Check className="size-4" /> Done
                  </span>
                ) : (
                  <button
                    ref={row.key === firstGrantKey ? initialActionRef : undefined}
                    type="button"
                    autoFocus={deviceProfile?.remoteUi === true && row.key === firstGrantKey}
                    onClick={() => void act(row.action)}
                    className={ghostBtn}
                  >
                    Grant
                  </button>
                )}
              </div>
            );
          })}

          {/* Only a device owner can suppress the swipe lock screen. */}
          {isDO && (
            <div className="flex items-center gap-4 rounded-xl bg-[oklch(24%_0_0)] px-4 py-3">
              <Lock className="size-6 text-[oklch(70%_0_0)] shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[oklch(95%_0_0)]" style={{ fontWeight: 500 }}>Hide lock screen</div>
                <div className="text-[oklch(63%_0_0)] text-sm">Wake straight into OpenPanel, skipping the swipe lock screen.</div>
              </div>
              <button
                type="button"
                onClick={() => void act(() => SystemBridge.setKeyguardDisabled({ disabled: !s?.keyguardDisabled }))}
                className={ghostBtn}
                aria-pressed={!!s?.keyguardDisabled}
              >
                {s?.keyguardDisabled ? "On" : "Off"}
              </button>
            </div>
          )}
        </div>
      )}
      <button
        ref={firstGrantKey === undefined ? initialActionRef : undefined}
        type="button"
        autoFocus={deviceProfile?.remoteUi === true && firstGrantKey === undefined}
        onClick={onNext}
        className={`${primaryBtn} w-full`}
      >
        Continue <ArrowRight className="size-4" />
      </button>
    </div>
  );
}

// -------------------- Step 3: device health --------------------

function DeviceHealthStep({
  manageNotifications,
  onSetManageNotifications,
  isFireOs,
  onNext,
}: {
  manageNotifications: boolean;
  onSetManageNotifications: (enabled: boolean) => void;
  isFireOs: boolean;
  onNext: () => void;
}) {
  return (
    <div className={`${cardClass} p-5 sm:p-7 w-full`}>
      <DeviceHealthPanel
        manageNotifications={manageNotifications}
        onSetManageNotifications={onSetManageNotifications}
        autoApply
        setupMode
        isFireOs={isFireOs}
      />
      <button type="button" onClick={onNext} className={`${primaryBtn} w-full mt-7`}>
        Continue <ArrowRight className="size-4" />
      </button>
    </div>
  );
}

// -------------------- Step 4: app selection --------------------

function AppsStep({
  isTelevision,
  onNext,
}: {
  isTelevision: boolean;
  onNext: (hiddenPackages: string[]) => void;
}) {
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    SystemBridge.getInstalledApps()
      .then(({ apps: installed }) => {
        if (cancelled) return;
        const eligible = installed
          .filter((a) => isAllowedApp(a, "standalone"))
          .sort((a, b) => a.label.localeCompare(b.label));
        setApps(eligible);
        // Default to everything selected so a distracted operator still gets a
        // usable panel; they uncheck what they don't want.
        setSelected(new Set(eligible.map((a) => a.packageName)));
      })
      .catch(() => { if (!cancelled) setApps([]); });
    return () => { cancelled = true; };
  }, []);

  const toggle = useCallback((pkg: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pkg)) next.delete(pkg); else next.add(pkg);
      return next;
    });
  }, []);

  return (
    <div
      className={`${cardClass} p-6 w-full max-w-3xl mx-auto flex flex-col`}
      style={{ maxHeight: isTelevision ? "68vh" : "78vh" }}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-[oklch(70.8%_0_0)] text-sm">
          Pick which apps appear in the panel. Editable later in the Admin Panel.
        </p>
        {apps && apps.length > 0 && (
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              autoFocus={isTelevision}
              className={`${ghostBtn} !py-2 !px-3 text-sm`}
              onClick={() => setSelected(new Set(apps.map((a) => a.packageName)))}
            >All</button>
            <button type="button" className={`${ghostBtn} !py-2 !px-3 text-sm`} onClick={() => setSelected(new Set())}>None</button>
          </div>
        )}
      </div>

      {apps === null ? (
        <div className="flex-1 flex items-center justify-center py-16 text-[oklch(63%_0_0)]">
          <Loader2 className="size-6 animate-spin mr-2" /> Loading apps…
        </div>
      ) : apps.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-[oklch(63%_0_0)]">
          <LayoutGrid className="size-10 mb-3 opacity-60" />
          No installable apps found yet. You can add them later from the Admin Panel.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto pr-1 mb-5">
          {apps.map((app) => {
            const on = selected.has(app.packageName);
            return (
              <button
                key={app.packageName}
                type="button"
                onClick={() => toggle(app.packageName)}
                aria-pressed={on}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left border transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70 ${
                  on
                    ? "bg-[oklch(30%_0.06_264)] border-[oklch(48.8%_0.243_264.376)]"
                    : "bg-[oklch(24%_0_0)] border-[oklch(30%_0_0)]"
                }`}
              >
                {app.icon ? (
                  <img src={`data:image/png;base64,${app.icon}`} alt="" className="size-9 rounded-lg shrink-0" />
                ) : (
                  <div className="size-9 rounded-lg bg-[oklch(35%_0_0)] shrink-0" />
                )}
                <span className="flex-1 min-w-0 truncate text-[oklch(93%_0_0)] text-sm" style={{ fontWeight: 500 }}>
                  {app.label}
                </span>
                <span className={`size-5 rounded-md border flex items-center justify-center shrink-0 ${on ? "bg-[oklch(48.8%_0.243_264.376)] border-transparent" : "border-[oklch(50%_0_0)]"}`}>
                  {on && <Check className="size-3.5 text-white" />}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        autoFocus={isTelevision && apps !== null && apps.length === 0}
        onClick={() => onNext((apps ?? []).filter((a) => !selected.has(a.packageName)).map((a) => a.packageName))}
        className={`${primaryBtn} w-full`}
      >
        Continue with {selected.size} app{selected.size === 1 ? "" : "s"} <ArrowRight className="size-4" />
      </button>
    </div>
  );
}

// -------------------- Step 5: optional library --------------------

export function LibrarySetupStep({ onNext }: { onNext: () => void }) {
  const [catalogUrl, setCatalogUrl] = useState("");
  const [busy, setBusy] = useState<"import" | "catalog" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const importPublication = useCallback(async () => {
    setBusy("import");
    setMessage(null);
    try {
      const { publication } = await LibraryBridge.importPublication();
      setMessage(`${publication.title} is ready offline.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The selected file could not be imported.");
    } finally {
      setBusy(null);
    }
  }, []);

  const addCatalog = useCallback(async () => {
    if (!catalogUrl.trim()) {
      setMessage("Enter an OPDS catalog URL, or continue and add one later.");
      return;
    }
    setBusy("catalog");
    setMessage(null);
    try {
      const { catalog } = await LibraryBridge.addCatalog({ url: catalogUrl.trim() });
      setCatalogUrl("");
      setMessage(`${catalog.title} was added.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That OPDS catalog could not be added.");
    } finally {
      setBusy(null);
    }
  }, [catalogUrl]);

  return (
    <div className={`${cardClass} p-6 w-full max-w-2xl mx-auto`}>
      <div className="flex items-start gap-4 mb-6">
        <div className="size-12 rounded-xl bg-[oklch(32%_0.08_264)] flex items-center justify-center shrink-0">
          <Library className="size-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl text-[oklch(98.5%_0_0)] mb-1" style={{ fontWeight: 500 }}>Connect the reading library</h2>
          <p className="text-[oklch(70.8%_0_0)] text-sm">
            No catalog is preloaded. Add an institution's OPDS feed or import a local EPUB, PDF, audiobook, MP3, or AAC file when you want one.
          </p>
        </div>
      </div>

      <button type="button" onClick={() => void importPublication()} disabled={busy !== null} className={`${ghostBtn} w-full mb-4`}>
        {busy === "import" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        Import a local publication
      </button>

      <div className="rounded-xl bg-[oklch(24%_0_0)] p-4 mb-4">
        <label className="block text-[oklch(84%_0_0)] text-sm mb-2" style={{ fontWeight: 500 }}>Institutional OPDS URL (optional)</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={catalogUrl}
            onChange={(event) => setCatalogUrl(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void addCatalog(); }}
            inputMode="url"
            autoComplete="off"
            placeholder="https://library.example.org/opds"
            disabled={busy !== null}
            className="flex-1 rounded-xl bg-[oklch(20%_0_0)] text-[oklch(95%_0_0)] border border-[oklch(43.9%_0_0)] px-4 py-2.5 disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
          />
          <button type="button" onClick={() => void addCatalog()} disabled={busy !== null} className={ghostBtn}>
            {busy === "catalog" ? <Loader2 className="size-4 animate-spin" /> : "Add catalog"}
          </button>
        </div>
        <p className="text-xs text-[oklch(58%_0_0)] mt-3">HTTPS only. Licensed borrowing and DRM require the library's approved authentication connector.</p>
      </div>

      {message && <p role="status" className="text-sm text-[oklch(78%_0_0)] mb-4">{message}</p>}

      <button type="button" onClick={onNext} className={`${primaryBtn} w-full`}>
        Continue <ArrowRight className="size-4" />
      </button>
    </div>
  );
}

// -------------------- Step 6: optional Wi-Fi + YouTube --------------------

export function youtubeChannelSetupError(error: unknown, value: string): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";
  if (code === "YOUTUBE_CHANNEL_LOOKUP_FAILED") {
    return "Couldn’t connect to YouTube. Check this TV’s connection and try again.";
  }
  if (code === "YOUTUBE_CHANNEL_RATE_LIMITED") {
    return "YouTube is temporarily limiting verification. Try again shortly.";
  }
  return `Couldn’t find a channel matching “${value}”. Try the exact name or its @handle.`;
}

function OptionalStep({
  isTelevision,
  onFinish,
}: {
  isTelevision: boolean;
  onFinish: () => void;
}) {
  const [channel, setChannel] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const channelInputRef = useRef<HTMLInputElement | null>(null);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const lookupStartedRef = useRef(false);

  useEffect(() => {
    if (resolving) {
      lookupStartedRef.current = true;
      return;
    }
    if (!isTelevision || !lookupStartedRef.current) return;
    const timer = window.setTimeout(() => addButtonRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isTelevision, resolving]);

  // Resolve the input first (channel name, @handle, or URL) — the same path the
  // Admin YouTube search uses — so a plain name like "Homeschool Pop" works and
  // the tile gets its real title, artwork, and canonical (browsable) channel id.
  const addChannel = useCallback(async () => {
    const value = channel.trim();
    if (value.length < 2) {
      setError("Enter a channel name, @handle, or URL.");
      return;
    }
    setResolving(true);
    setError(null);
    try {
      const { channel: resolved } = await SystemBridge.resolveYouTubeChannel({ input: value });
      const item = addYouTubeItem(resolved.sourceUrl, resolved.title, resolved.thumbnailUrl);
      if (!item) {
        setError("Could not add that channel.");
        return;
      }
      setAdded((prev) => [...prev, resolved.title]);
      setChannel("");
    } catch (lookupError) {
      setError(youtubeChannelSetupError(lookupError, value));
    } finally {
      setResolving(false);
    }
  }, [channel]);

  return (
    <div className={`${cardClass} p-6 w-full max-w-2xl mx-auto`}>
      <p className="text-[oklch(70.8%_0_0)] text-sm mb-5">
        Optional — you can also do these anytime from Settings and the Admin Panel.
      </p>

      <div className="rounded-xl bg-[oklch(24%_0_0)] px-4 py-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <Wifi className="size-5 text-[oklch(70%_0_0)]" />
          <span className="text-[oklch(93%_0_0)]" style={{ fontWeight: 500 }}>Connect Wi-Fi</span>
        </div>
        <button
          type="button"
          autoFocus={isTelevision}
          onClick={() => void SystemBridge.openWifiSettings()}
          className={ghostBtn}
        >
          Open Wi-Fi settings
        </button>
      </div>

      <div className="rounded-xl bg-[oklch(24%_0_0)] px-4 py-4 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <Youtube className="size-5 text-[oklch(70%_0_0)]" />
          <span className="text-[oklch(93%_0_0)]" style={{ fontWeight: 500 }}>Add YouTube channels</span>
        </div>
        <div className="flex gap-2">
          <input
            ref={channelInputRef}
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void addChannel();
                return;
              }
              if (
                isTelevision
                && event.key === "ArrowRight"
                && event.currentTarget.selectionStart === event.currentTarget.value.length
              ) {
                event.preventDefault();
                addButtonRef.current?.focus();
              }
            }}
            placeholder="Channel name, @handle, or URL"
            disabled={resolving}
            className="flex-1 rounded-xl bg-[oklch(20%_0_0)] text-[oklch(95%_0_0)] border border-[oklch(43.9%_0_0)] px-4 py-2.5 disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
          />
          <button
            ref={addButtonRef}
            type="button"
            onClick={() => void addChannel()}
            disabled={resolving}
            className={ghostBtn}
          >
            {resolving ? <Loader2 className="size-4 animate-spin" /> : "Add"}
          </button>
        </div>
        {error && <p role="alert" className="text-[oklch(72%_0.18_22)] text-sm mt-2">{error}</p>}
        {added.length > 0 && (
          <p className="text-[oklch(72%_0.15_150)] text-sm mt-2">Added: {added.join(", ")}</p>
        )}
      </div>

      <button type="button" onClick={onFinish} className={`${primaryBtn} w-full`}>
        Finish setup <Check className="size-4" />
      </button>
    </div>
  );
}

// -------------------- Wizard shell --------------------

export function StandaloneOnboarding({
  deviceProfile,
  manageNotifications,
  onSetManageNotifications,
  onComplete,
}: StandaloneOnboardingProps) {
  const initialProgress = useMemo(() => readOnboardingProgress(), []);
  const [stepIndex, setStepIndex] = useState(initialProgress.stepIndex);
  const [hiddenPackages, setHiddenPackages] = useState<string[]>(initialProgress.hiddenPackages);
  const isTelevision = deviceProfile?.isTelevision === true;
  const steps = useMemo(() => onboardingStepsForDevice(isTelevision), [isTelevision]);
  const safeStepIndex = Math.min(stepIndex, steps.length - 1);
  const step = steps[safeStepIndex];
  const goNext = useCallback(
    () => setStepIndex((i) => Math.min(steps.length - 1, i + 1)),
    [steps.length],
  );

  const handleAppsNext = useCallback((hidden: string[]) => {
    setHiddenPackages(hidden);
    goNext();
  }, [goNext]);

  const progress = useMemo(
    () => steps.map((s, i) => ({ s, done: i < safeStepIndex, current: i === safeStepIndex })),
    [safeStepIndex, steps],
  );

  useEffect(() => {
    writeOnboardingProgress({ stepIndex: safeStepIndex, hiddenPackages });
  }, [hiddenPackages, safeStepIndex]);

  const finishSetup = useCallback(() => {
    clearOnboardingProgress();
    onComplete(hiddenPackages);
  }, [hiddenPackages, onComplete]);

  return (
    <div
      data-dpad-scope
      data-input-mode={isTelevision ? "remote" : "touch"}
      className={`fixed inset-0 bg-[oklch(11%_0_0)] z-[300] overflow-y-auto ${isTelevision ? "p-5" : "p-6 sm:p-10"}`}
    >
      <div className="max-w-3xl mx-auto">
        <div className={`text-center ${isTelevision ? "mb-2" : "mb-8"}`}>
          {isTelevision ? (
            <div className="flex items-center justify-center gap-5">
              <OpenPanelBrand iconClassName="size-8" wordmarkClassName="text-2xl" />
              <div className="text-left">
                <h1 className="text-lg text-[oklch(85%_0_0)]" style={{ fontWeight: 500 }}>
                  Set up this TV
                </h1>
                <p className="text-sm text-[oklch(70.8%_0_0)]">
                  Step {safeStepIndex + 1} of {steps.length} — {STEP_TITLES[step]}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <OpenPanelBrand iconClassName="size-12" wordmarkClassName="text-3xl sm:text-4xl" />
              </div>
              <h1 className="text-xl sm:text-2xl text-[oklch(85%_0_0)] mb-2" style={{ fontWeight: 500 }}>
                Set up standalone kiosk
              </h1>
              <p className="text-[oklch(70.8%_0_0)]">
                Step {safeStepIndex + 1} of {steps.length} — {STEP_TITLES[step]}
              </p>
            </>
          )}
          <div className={`flex items-center justify-center gap-2 ${isTelevision ? "mt-2" : "mt-4"}`} aria-hidden>
            {progress.map(({ s, done, current }) => (
              <span
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  current ? "w-8 bg-[oklch(48.8%_0.243_264.376)]" : done ? "w-8 bg-[oklch(48.8%_0.243_264.376)]/50" : "w-4 bg-[oklch(35%_0_0)]"
                }`}
              />
            ))}
          </div>
        </div>

        <div key={step}>
          {step === "pin" && <PinStep deviceProfile={deviceProfile} onDone={goNext} />}
          {step === "permissions" && <PermissionsStep deviceProfile={deviceProfile} onNext={goNext} />}
          {step === "health" && (
            <DeviceHealthStep
              manageNotifications={manageNotifications}
              onSetManageNotifications={onSetManageNotifications}
              isFireOs={deviceProfile?.isFireOs === true}
              onNext={goNext}
            />
          )}
          {step === "apps" && <AppsStep isTelevision={isTelevision} onNext={handleAppsNext} />}
          {step === "library" && <LibrarySetupStep onNext={goNext} />}
          {step === "optional" && (
            <OptionalStep
              isTelevision={isTelevision}
              onFinish={finishSetup}
            />
          )}
        </div>
      </div>
    </div>
  );
}
