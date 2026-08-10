import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Accessibility,
  Activity,
  ArrowRight,
  BatteryCharging,
  Bluetooth,
  Check,
  Home,
  Layers,
  LayoutGrid,
  Loader2,
  Lock,
  Shield,
  SlidersHorizontal,
  Wifi,
  Youtube,
} from "lucide-react";
import { SystemBridge, type InstalledApp, type PermissionStatus } from "../native/SystemBridge";
import type { DeviceProfile } from "../native/SystemBridge";
import { setupAdmin, SECURITY_QUESTIONS } from "../native/adminAuth";
import { isAllowedApp } from "../native/catalog";
import { addYouTubeItem } from "../native/youtube";
import { PinInput } from "./PinInput";

interface StandaloneOnboardingProps {
  deviceProfile: DeviceProfile | null;
  // Receives the packages the operator chose NOT to show, to seed hidden-apps.
  onComplete: (hiddenPackages: string[]) => void;
}

type StepId = "pin" | "permissions" | "apps" | "optional";
const STEPS: StepId[] = ["pin", "permissions", "apps", "optional"];
const STEP_TITLES: Record<StepId, string> = {
  pin: "Create an admin PIN",
  permissions: "Grant permissions",
  apps: "Choose apps",
  optional: "Wi-Fi & YouTube",
};

const cardClass =
  "bg-[oklch(20.5%_0_0)] rounded-2xl border border-[oklch(26.9%_0_0)]";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[oklch(48.8%_0.243_264.376)] text-white px-6 py-3 disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80 transition-colors";
const ghostBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[oklch(26.9%_0_0)] text-[oklch(90%_0_0)] px-5 py-3 hover:bg-[oklch(32%_0_0)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80 transition-colors";

// -------------------- Step 1: admin PIN --------------------

function PinStep({ onDone }: { onDone: () => void }) {
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
      />
    </div>
  );
}

// -------------------- Step 2: permissions --------------------

interface PermRow {
  key: string;
  label: string;
  detail: string;
  icon: typeof Home;
  granted: boolean;
  action: () => Promise<unknown>;
}

function PermissionsStep({ onNext }: { onNext: () => void }) {
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
  const isDO = !!s?.deviceOwner;

  const rows: PermRow[] = [
    {
      key: "launcher", label: "Set OpenPanel as Home", icon: Home,
      detail: "Return to the panel with the Home button.",
      granted: !!s?.defaultLauncher,
      action: () => SystemBridge.openLauncherSettings(),
    },
    {
      key: "admin", label: "Kiosk admin", icon: Shield,
      detail: isDO ? "OpenPanel is the device owner." : "Lets OpenPanel lock the device into kiosk mode.",
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
      detail: "Detects Home/Recents gestures to keep the kiosk contained.",
      granted: !!s?.accessibility,
      action: () => SystemBridge.openAccessibilitySettings(),
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

  return (
    <div className={`${cardClass} p-6 w-full max-w-2xl mx-auto`}>
      <p className="text-[oklch(70.8%_0_0)] text-sm mb-5">
        Grant these so the kiosk works fully. As device owner, OpenPanel grants what it
        can automatically — the rest open the matching Settings screen. Skip any and grant
        them later from the Admin panel.
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
                  <button type="button" onClick={() => void act(row.action)} className={ghostBtn}>
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
      <button type="button" onClick={onNext} className={`${primaryBtn} w-full`}>
        Continue <ArrowRight className="size-4" />
      </button>
    </div>
  );
}

// -------------------- Step 3: app selection --------------------

function AppsStep({ onNext }: { onNext: (hiddenPackages: string[]) => void }) {
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
    <div className={`${cardClass} p-6 w-full max-w-3xl mx-auto flex flex-col`} style={{ maxHeight: "78vh" }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[oklch(70.8%_0_0)] text-sm">
          Pick which apps appear in the panel. Editable later in the Admin Panel.
        </p>
        {apps && apps.length > 0 && (
          <div className="flex gap-2 shrink-0">
            <button type="button" className={`${ghostBtn} !py-2 !px-3 text-sm`} onClick={() => setSelected(new Set(apps.map((a) => a.packageName)))}>All</button>
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
        onClick={() => onNext((apps ?? []).filter((a) => !selected.has(a.packageName)).map((a) => a.packageName))}
        className={`${primaryBtn} w-full`}
      >
        Continue with {selected.size} app{selected.size === 1 ? "" : "s"} <ArrowRight className="size-4" />
      </button>
    </div>
  );
}

// -------------------- Step 4: optional Wi-Fi + YouTube --------------------

function OptionalStep({ onFinish }: { onFinish: () => void }) {
  const [channel, setChannel] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

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
    } catch {
      setError(`Couldn't find a channel matching “${value}”. Try the exact name or its @handle.`);
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
        <button type="button" onClick={() => void SystemBridge.openWifiSettings()} className={ghostBtn}>
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
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void addChannel(); }}
            placeholder="Channel name, @handle, or URL"
            disabled={resolving}
            className="flex-1 rounded-xl bg-[oklch(20%_0_0)] text-[oklch(95%_0_0)] border border-[oklch(43.9%_0_0)] px-4 py-2.5 disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
          />
          <button type="button" onClick={() => void addChannel()} disabled={resolving} className={ghostBtn}>
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

export function StandaloneOnboarding({ onComplete }: StandaloneOnboardingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [hiddenPackages, setHiddenPackages] = useState<string[]>([]);
  const step = STEPS[stepIndex];
  const goNext = useCallback(() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1)), []);

  const handleAppsNext = useCallback((hidden: string[]) => {
    setHiddenPackages(hidden);
    goNext();
  }, [goNext]);

  const progress = useMemo(
    () => STEPS.map((s, i) => ({ s, done: i < stepIndex, current: i === stepIndex })),
    [stepIndex],
  );

  return (
    <div data-dpad-scope className="fixed inset-0 bg-[oklch(11%_0_0)] z-[300] overflow-y-auto p-6 sm:p-10">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl text-[oklch(98.5%_0_0)] mb-2" style={{ fontWeight: 600 }}>
            Set up standalone kiosk
          </h1>
          <p className="text-[oklch(70.8%_0_0)]">
            Step {stepIndex + 1} of {STEPS.length} — {STEP_TITLES[step]}
          </p>
          <div className="flex items-center justify-center gap-2 mt-4" aria-hidden>
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

        <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          {step === "pin" && <PinStep onDone={goNext} />}
          {step === "permissions" && <PermissionsStep onNext={goNext} />}
          {step === "apps" && <AppsStep onNext={handleAppsNext} />}
          {step === "optional" && <OptionalStep onFinish={() => onComplete(hiddenPackages)} />}
        </motion.div>
      </div>
    </div>
  );
}
