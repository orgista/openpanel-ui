const KEY = "openpanel.diagnostics.v1";
const MAX_ENTRIES = 200;
const MAX_TEXT_LENGTH = 1_200;

export type DiagnosticLevel = "info" | "warning" | "error";

export interface DiagnosticEntry {
  id: string;
  timestamp: number;
  level: DiagnosticLevel;
  message: string;
  details?: string;
}

const SENSITIVE_FIELD = /^(?:password|passcode|pin|token|secret|authorization)$/i;
let sequence = 0;
let installed = false;

export function sanitizeDiagnosticText(input: string): string {
  return input
    .replace(
      /("(?:password|passcode|pin|token|secret|authorization)"\s*:\s*)"[^"]*"/gi,
      '$1"[redacted]"',
    )
    .replace(
      /\b(password|passcode|pin|token|secret|authorization)\s*([=:])\s*["']?[^\s,"';}\]]+["']?/gi,
      "$1$2[redacted]",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .slice(0, MAX_TEXT_LENGTH);
}

export function serializeDiagnosticDetails(value: unknown): string {
  if (value === undefined) return "";
  try {
    const serialized = JSON.stringify(value, (key, item) => {
      if (SENSITIVE_FIELD.test(key)) return "[redacted]";
      if (item instanceof Error) {
        return { name: item.name, message: item.message, stack: item.stack };
      }
      return item;
    });
    return sanitizeDiagnosticText(serialized ?? String(value));
  } catch {
    return sanitizeDiagnosticText(String(value));
  }
}

const isDiagnosticEntry = (value: unknown): value is DiagnosticEntry => {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<DiagnosticEntry>;
  return typeof entry.id === "string"
    && typeof entry.timestamp === "number"
    && (entry.level === "info" || entry.level === "warning" || entry.level === "error")
    && typeof entry.message === "string"
    && (entry.details === undefined || typeof entry.details === "string");
};

export function parseDiagnosticEntries(raw: string | null): DiagnosticEntry[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter(isDiagnosticEntry).slice(-MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

export function getDiagnostics(): DiagnosticEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return parseDiagnosticEntries(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

export function clearDiagnostics(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Diagnostics must never interfere with the launcher.
  }
}

function sendToNative(entry: DiagnosticEntry): void {
  if (typeof window === "undefined") return;
  const capacitor = (window as Window & {
    Capacitor?: { Plugins?: { SystemBridge?: {
      writeDiagnostic?: (opts: { level: DiagnosticLevel; message: string }) => Promise<void>;
    } } };
  }).Capacitor;
  const write = capacitor?.Plugins?.SystemBridge?.writeDiagnostic;
  if (!write) return;
  const suffix = entry.details ? ` — ${entry.details}` : "";
  void write({ level: entry.level, message: `${entry.message}${suffix}` })
    .catch(() => {});
}

export function recordDiagnostic(
  level: DiagnosticLevel,
  message: string,
  details?: unknown,
): DiagnosticEntry {
  const entry: DiagnosticEntry = {
    id: `${Date.now()}-${sequence++}`,
    timestamp: Date.now(),
    level,
    message: sanitizeDiagnosticText(message || "Unknown diagnostic event"),
    ...(details === undefined ? {} : { details: serializeDiagnosticDetails(details) }),
  };
  if (typeof window === "undefined") return entry;
  try {
    const entries = [...getDiagnostics(), entry].slice(-MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Keep running even if private storage is unavailable or full.
  }
  sendToNative(entry);
  return entry;
}

function diagnosticMessage(args: unknown[]): { message: string; details?: string } {
  const [first, ...rest] = args;
  const message = first instanceof Error
    ? `${first.name}: ${first.message}`
    : sanitizeDiagnosticText(typeof first === "string" ? first : serializeDiagnosticDetails(first));
  const details = [
    first instanceof Error ? serializeDiagnosticDetails(first) : "",
    ...rest.map(serializeDiagnosticDetails),
  ].filter(Boolean).join(" ");
  return { message: message || "Console diagnostic", ...(details ? { details } : {}) };
}

/** Capture lifecycle events, browser failures, and console warnings/errors in a persistent ring buffer. */
export function installDiagnostics(): () => void {
  if (installed || typeof window === "undefined") return () => {};
  installed = true;
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);

  const wrappedWarn = (...args: unknown[]) => {
    const event = diagnosticMessage(args);
    recordDiagnostic("warning", event.message, event.details);
    originalWarn(...args);
  };
  const wrappedError = (...args: unknown[]) => {
    const event = diagnosticMessage(args);
    recordDiagnostic("error", event.message, event.details);
    originalError(...args);
  };
  console.warn = wrappedWarn;
  console.error = wrappedError;

  const onError = (event: ErrorEvent) => {
    recordDiagnostic("error", event.message || "Uncaught browser error", {
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      error: event.error,
    });
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    recordDiagnostic("error", "Unhandled promise rejection", event.reason);
  };
  const onVisibilityChange = () => {
    recordDiagnostic("info", "OpenPanel visibility changed", {
      visibilityState: document.visibilityState,
    });
  };
  const onPageShow = (event: PageTransitionEvent) => {
    recordDiagnostic("info", "OpenPanel page shown", { persisted: event.persisted });
  };
  const onPageHide = (event: PageTransitionEvent) => {
    recordDiagnostic("info", "OpenPanel page hidden", { persisted: event.persisted });
  };
  const onOnline = () => recordDiagnostic("info", "Network became available");
  const onOffline = () => recordDiagnostic("warning", "Network became unavailable");
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    if (console.warn === wrappedWarn) console.warn = originalWarn;
    if (console.error === wrappedError) console.error = originalError;
    installed = false;
  };
}
