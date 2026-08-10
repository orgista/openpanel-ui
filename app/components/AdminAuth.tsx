import { useState } from "react";
import { motion } from "motion/react";
import { ShieldCheck, KeyRound, HelpCircle } from "lucide-react";
import { PinInput } from "./PinInput";
import {
  SECURITY_QUESTIONS,
  isAdminConfigured,
  getSecurityQuestion,
  setupAdmin,
  verifyPin,
  verifySecurityAnswer,
  resetPin,
  isLockedOut,
  getLockoutMsRemaining,
} from "../native/adminAuth";
import { dismissSoftKeyboard } from "../native/keyboard";

const lockoutMessage = () => {
  const secs = Math.ceil(getLockoutMsRemaining() / 1000);
  return `Too many attempts. Try again in ${secs}s.`;
};

interface AdminAuthProps {
  onAuthenticated: () => void;
  onCancel: () => void;
  remoteMode?: boolean;
  controllerName?: string | null;
  hasHardwareKeyboard?: boolean;
}

type Step =
  | "unlock"
  | "forgot-answer"
  | "reset-pin"
  | "reset-confirm"
  | "setup-pin"
  | "setup-confirm"
  | "setup-question";

const card =
  "admin-auth-card bg-[oklch(20.5%_0_0)] rounded-2xl p-6 sm:p-8 w-full max-w-md border border-[oklch(26.9%_0_0)]";

export function AdminAuth({
  onAuthenticated,
  onCancel,
  remoteMode = false,
  controllerName,
  hasHardwareKeyboard = false,
}: AdminAuthProps) {
  const configured = isAdminConfigured();
  const [step, setStep] = useState<Step>(configured ? "unlock" : "setup-pin");
  const [error, setError] = useState<string | null>(null);
  const [firstPin, setFirstPin] = useState("");
  const [question, setQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const pinInputDevice = { remoteMode, controllerName, hasHardwareKeyboard };

  const cancelAuth = async () => {
    await dismissSoftKeyboard();
    onCancel();
  };

  const finishAuthenticated = async () => {
    await dismissSoftKeyboard();
    onAuthenticated();
  };

  // ---- Unlock (existing PIN) ----
  const handleUnlock = async (pin: string) => {
    if (isLockedOut()) { setError(lockoutMessage()); return; }
    setBusy(true);
    const ok = await verifyPin(pin);
    setBusy(false);
    if (ok) await finishAuthenticated();
    else setError(getLockoutMsRemaining() > 0 ? lockoutMessage() : "Incorrect PIN. Try again or use “Forgot PIN”.");
  };

  // ---- Forgot -> security answer ----
  const handleVerifyAnswer = async () => {
    if (isLockedOut()) { setError(lockoutMessage()); return; }
    setBusy(true);
    const ok = await verifySecurityAnswer(answer);
    setBusy(false);
    if (ok) {
      setError(null);
      setAnswer("");
      setStep("reset-pin");
    } else {
      setError(getLockoutMsRemaining() > 0 ? lockoutMessage() : "That answer doesn't match.");
    }
  };

  // ---- Reset PIN after recovery ----
  const handleResetFirst = (pin: string) => {
    setFirstPin(pin);
    setError(null);
    setStep("reset-confirm");
  };
  const handleResetConfirm = async (pin: string) => {
    if (pin !== firstPin) {
      setError("PINs didn't match. Start over.");
      setStep("reset-pin");
      return;
    }
    await resetPin(pin);
    await finishAuthenticated();
  };

  // ---- First-time setup ----
  const handleSetupFirst = (pin: string) => {
    setFirstPin(pin);
    setError(null);
    setStep("setup-confirm");
  };
  const handleSetupConfirm = (pin: string) => {
    if (pin !== firstPin) {
      setError("PINs didn't match. Let's try again.");
      setStep("setup-pin");
      return;
    }
    setError(null);
    setStep("setup-question");
  };
  const handleFinishSetup = async () => {
    if (answer.trim().length < 2) {
      setError("Please enter a recovery answer.");
      return;
    }
    setBusy(true);
    await setupAdmin(firstPin, question, answer);
    setBusy(false);
    await finishAuthenticated();
  };

  // PinInput auto-submits at 4 digits; key forces a fresh component per step.
  if (step === "unlock") {
    return (
      <div className="w-full flex flex-col items-center">
        <PinInput key="unlock" title="Enter Admin PIN" onComplete={handleUnlock} onCancel={cancelAuth} {...pinInputDevice} />
        {error && <p className="mt-4 text-[oklch(70.4%_0.191_22.216)] text-sm">{error}</p>}
        <button
          onClick={() => { setError(null); setStep("forgot-answer"); }}
          className="mt-4 text-[oklch(60%_0_0)] hover:text-[oklch(85%_0_0)] text-sm transition-colors"
          style={{ fontWeight: 500 }}
        >
          Forgot PIN?
        </button>
      </div>
    );
  }

  if (step === "reset-pin") {
    return (
      <div className="w-full flex flex-col items-center">
        <PinInput key="reset-pin" title="Set a New PIN" onComplete={handleResetFirst} onCancel={cancelAuth} {...pinInputDevice} />
        {error && <p className="mt-4 text-[oklch(70.4%_0.191_22.216)] text-sm">{error}</p>}
      </div>
    );
  }
  if (step === "reset-confirm") {
    return (
      <div className="w-full flex flex-col items-center">
        <PinInput key="reset-confirm" title="Confirm New PIN" onComplete={handleResetConfirm} onCancel={cancelAuth} {...pinInputDevice} />
      </div>
    );
  }
  if (step === "setup-pin") {
    return (
      <div className="w-full flex flex-col items-center">
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="admin-auth-intro flex items-center gap-2 mb-5 text-[oklch(70.8%_0_0)]">
          <ShieldCheck className="w-5 h-5 text-[oklch(48.8%_0.243_264.376)]" />
          <span className="text-sm" style={{ fontWeight: 500 }}>First-time admin setup</span>
        </motion.div>
        <PinInput key="setup-pin" title="Create Admin PIN" onComplete={handleSetupFirst} onCancel={cancelAuth} {...pinInputDevice} />
        {error && <p className="mt-4 text-[oklch(70.4%_0.191_22.216)] text-sm">{error}</p>}
      </div>
    );
  }
  if (step === "setup-confirm") {
    return (
      <div className="w-full flex flex-col items-center">
        <PinInput key="setup-confirm" title="Confirm Admin PIN" onComplete={handleSetupConfirm} onCancel={cancelAuth} {...pinInputDevice} />
      </div>
    );
  }

  // setup-question and forgot-answer share a card layout
  if (step === "setup-question") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className={card}>
        <div className="admin-auth-copy">
          <div className="admin-auth-copy-heading flex items-center gap-2 mb-6 justify-center text-[oklch(98.5%_0_0)]">
            <KeyRound className="w-6 h-6 text-[oklch(48.8%_0.243_264.376)]" />
            <h2 className="text-2xl" style={{ fontWeight: 500 }}>Recovery Question</h2>
          </div>
          <p className="admin-auth-copy-description text-[oklch(60%_0_0)] text-sm text-center mb-6">
            Used to reset your PIN if you ever forget it.
          </p>
        </div>
        <div className="admin-auth-form">
          <label className="block text-[oklch(70.8%_0_0)] text-sm mb-2" style={{ fontWeight: 500 }}>Security question</label>
          <select
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full mb-4 px-4 py-3 bg-[oklch(14.5%_0_0)] text-[oklch(98.5%_0_0)] rounded-lg border border-[oklch(43.9%_0_0)] focus:border-[oklch(48.8%_0.243_264.376)] focus:outline-none"
          >
            {SECURITY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
          <label className="block text-[oklch(70.8%_0_0)] text-sm mb-2" style={{ fontWeight: 500 }}>Answer</label>
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            autoComplete="off"
            enterKeyHint="done"
            spellCheck={false}
            onKeyDown={(e) => { if (e.key === "Enter") handleFinishSetup(); }}
            className="w-full mb-6 px-4 py-3 bg-[oklch(14.5%_0_0)] text-[oklch(98.5%_0_0)] rounded-lg border border-[oklch(43.9%_0_0)] focus:border-[oklch(48.8%_0.243_264.376)] focus:outline-none"
          />
          {error && <p className="mb-4 text-[oklch(70.4%_0.191_22.216)] text-sm">{error}</p>}
          <div className="admin-auth-actions flex gap-3">
            <button onClick={cancelAuth} className="flex-1 py-3 bg-[oklch(26.9%_0_0)] text-[oklch(70.8%_0_0)] rounded-lg" style={{ fontWeight: 500 }}>Cancel</button>
            <button onClick={handleFinishSetup} disabled={busy} className="flex-1 py-3 bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)] rounded-lg disabled:opacity-50" style={{ fontWeight: 500 }}>
              {busy ? "Saving…" : "Finish Setup"}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // forgot-answer
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className={card}>
      <div className="admin-auth-copy">
        <div className="admin-auth-copy-heading flex items-center gap-2 mb-6 justify-center text-[oklch(98.5%_0_0)]">
          <HelpCircle className="w-6 h-6 text-[oklch(48.8%_0.243_264.376)]" />
          <h2 className="text-2xl" style={{ fontWeight: 500 }}>Reset PIN</h2>
        </div>
        <p className="admin-auth-copy-description text-[oklch(70.8%_0_0)] text-center mb-2" style={{ fontWeight: 400 }}>
          {getSecurityQuestion() ?? "Answer your security question"}
        </p>
      </div>
      <div className="admin-auth-form">
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Your answer"
          autoComplete="off"
          enterKeyHint="done"
          spellCheck={false}
          className="w-full my-4 px-4 py-3 bg-[oklch(14.5%_0_0)] text-[oklch(98.5%_0_0)] placeholder:text-[oklch(43.9%_0_0)] rounded-lg border border-[oklch(43.9%_0_0)] focus:border-[oklch(48.8%_0.243_264.376)] focus:outline-none"
          onKeyDown={(e) => { if (e.key === "Enter") handleVerifyAnswer(); }}
        />
        {error && <p className="mb-4 text-[oklch(70.4%_0.191_22.216)] text-sm">{error}</p>}
        <div className="admin-auth-actions flex gap-3">
          <button onClick={() => { setError(null); setAnswer(""); setStep("unlock"); }} className="flex-1 py-3 bg-[oklch(26.9%_0_0)] text-[oklch(70.8%_0_0)] rounded-lg" style={{ fontWeight: 500 }}>Back</button>
          <button onClick={handleVerifyAnswer} disabled={busy} className="flex-1 py-3 bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)] rounded-lg disabled:opacity-50" style={{ fontWeight: 500 }}>
            {busy ? "Checking…" : "Verify"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
