// Local admin credentials for the OpenPanel kiosk. Stored in localStorage
// (persists in the Capacitor WebView). The PIN and security answer are kept as
// salted, slow-KDF (PBKDF2) verifiers so a copy of the stored record can't be
// reversed with a fast hash sweep, and failed attempts are rate-limited with a
// persistent lockout so the four-digit space can't be brute-forced online.
//
// This guards a local kiosk against a curious user — it is not a defense against
// someone with full device access, which is what Device Owner / ArborXR lockdown
// is for. App backup is disabled (see AndroidManifest) so this record does not
// leave the device.

const KEY = "openpanel.admin.v1";
const THROTTLE_KEY = "openpanel.admin.throttle.v1";

// PBKDF2 work factor. Four-digit PINs have a tiny keyspace, so the slow KDF is
// the offline backstop and the throttle below is the online one.
const PBKDF2_ITERATIONS = 210_000;

// Online brute-force throttle: FREE_ATTEMPTS with no delay, then exponential
// backoff from BACKOFF_BASE_MS, capped at BACKOFF_MAX_MS. Persisted so it
// survives reload and app restart. PIN and recovery answer share one counter so
// alternating them doesn't double an attacker's budget.
const FREE_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 30_000; // 30s
const BACKOFF_MAX_MS = 15 * 60_000; // 15 min

export const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What was the make of your first car?",
  "What is your mother's maiden name?",
  "What was the name of your elementary school?",
  "What is your favorite movie?",
];

interface AdminRecord {
  // v2 records carry a salt and use PBKDF2. Legacy (v1) records have no salt and
  // store bare SHA-256 hashes; they still verify, and upgrade on first success.
  salt?: string;
  pinHash: string;
  question: string;
  answerHash: string;
}

interface ThrottleState {
  failed: number;
  lockedUntil: number; // epoch ms; 0 = not locked
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSaltHex(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return toHex(salt);
}

// Legacy v1 verifier (kept only so existing kiosks can still unlock + upgrade).
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

// v2 verifier: salted PBKDF2-HMAC-SHA256.
async function deriveHash(input: string, saltHex: string): Promise<string> {
  const salt = Uint8Array.from(
    saltHex.match(/.{1,2}/g)?.map((h) => parseInt(h, 16)) ?? []
  );
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(input),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return toHex(new Uint8Array(bits));
}

// Constant-time-ish string compare so verification time doesn't leak how many
// leading characters of the verifier matched.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Security answers are normalized so casing/whitespace don't trip recovery.
const normalizeAnswer = (a: string) => a.trim().toLowerCase().replace(/\s+/g, " ");

function read(): AdminRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AdminRecord) : null;
  } catch {
    return null;
  }
}

function write(rec: AdminRecord): void {
  localStorage.setItem(KEY, JSON.stringify(rec));
}

// ---- Throttle ----

function readThrottle(): ThrottleState {
  try {
    const raw = localStorage.getItem(THROTTLE_KEY);
    if (raw) return JSON.parse(raw) as ThrottleState;
  } catch {
    /* fall through to default */
  }
  return { failed: 0, lockedUntil: 0 };
}

function writeThrottle(state: ThrottleState): void {
  localStorage.setItem(THROTTLE_KEY, JSON.stringify(state));
}

/** Milliseconds until the next attempt is allowed, or 0 if attempts are open. */
export function getLockoutMsRemaining(): number {
  const { lockedUntil } = readThrottle();
  return Math.max(0, lockedUntil - Date.now());
}

export function isLockedOut(): boolean {
  return getLockoutMsRemaining() > 0;
}

function recordFailure(): void {
  const state = readThrottle();
  state.failed += 1;
  if (state.failed > FREE_ATTEMPTS) {
    const overage = state.failed - FREE_ATTEMPTS - 1; // 0 on first throttled miss
    const delay = Math.min(BACKOFF_BASE_MS * 2 ** overage, BACKOFF_MAX_MS);
    state.lockedUntil = Date.now() + delay;
  }
  writeThrottle(state);
}

function recordSuccess(): void {
  writeThrottle({ failed: 0, lockedUntil: 0 });
}

// ---- Public API ----

export function isAdminConfigured(): boolean {
  return read() !== null;
}

export function getSecurityQuestion(): string | null {
  return read()?.question ?? null;
}

export async function setupAdmin(pin: string, question: string, answer: string): Promise<void> {
  const salt = randomSaltHex();
  const record: AdminRecord = {
    salt,
    pinHash: await deriveHash(pin, salt),
    question,
    answerHash: await deriveHash(normalizeAnswer(answer), salt),
  };
  write(record);
  recordSuccess();
}

// Verifies `value` against `stored`, transparently handling legacy (unsalted)
// records. Returns the verifier mode so the caller can upgrade in place.
async function matches(
  rec: AdminRecord,
  stored: string,
  value: string
): Promise<boolean> {
  if (rec.salt) return safeEqual(stored, await deriveHash(value, rec.salt));
  return safeEqual(stored, await sha256(value)); // legacy v1
}

export async function verifyPin(pin: string): Promise<boolean> {
  if (isLockedOut()) return false;
  const rec = read();
  if (!rec) return false;
  const ok = await matches(rec, rec.pinHash, pin);
  if (ok) {
    recordSuccess();
    // Upgrade legacy PIN verifier in place.
    if (!rec.salt) {
      const salt = randomSaltHex();
      write({ ...rec, salt, pinHash: await deriveHash(pin, salt) });
    }
  } else {
    recordFailure();
  }
  return ok;
}

export async function verifySecurityAnswer(answer: string): Promise<boolean> {
  if (isLockedOut()) return false;
  const rec = read();
  if (!rec) return false;
  // A salted record hashes both fields with the same salt; a legacy record (or a
  // PIN-only upgrade) still has an unsalted answer hash, so fall back to sha256.
  let ok: boolean;
  if (rec.salt) {
    ok = safeEqual(rec.answerHash, await deriveHash(normalizeAnswer(answer), rec.salt));
    if (!ok) ok = safeEqual(rec.answerHash, await sha256(normalizeAnswer(answer))); // pre-upgrade answer
  } else {
    ok = safeEqual(rec.answerHash, await sha256(normalizeAnswer(answer)));
  }
  if (ok) recordSuccess();
  else recordFailure();
  return ok;
}

export async function resetPin(newPin: string): Promise<void> {
  const rec = read();
  if (!rec) return;
  const salt = rec.salt ?? randomSaltHex();
  write({ ...rec, salt, pinHash: await deriveHash(newPin, salt) });
  recordSuccess();
}
