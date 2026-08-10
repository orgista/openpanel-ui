import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

interface PinInputProps {
  onComplete: (pin: string) => void;
  onCancel: () => void;
  title: string;
  remoteMode?: boolean;
  controllerName?: string | null;
  hasHardwareKeyboard?: boolean;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "delete"] as const;

export function PinInput({
  onComplete,
  onCancel,
  title,
  remoteMode = false,
  controllerName,
  hasHardwareKeyboard = false,
}: PinInputProps) {
  const [pin, setPin] = useState("");
  const pinRef = useRef("");
  const keyRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const controllerLabel = controllerName?.trim();
  const inputHint = remoteMode
    ? `${controllerLabel || "TV remote"} — use the D-pad and OK.${hasHardwareKeyboard ? " Number keys also work." : ""}`
    : hasHardwareKeyboard
      ? "Use the keypad or number keys"
      : "Tap the keypad to enter your PIN";

  const updatePin = useCallback((next: string) => {
    pinRef.current = next;
    setPin(next);
  }, []);

  const addDigit = useCallback((digit: string) => {
    if (pinRef.current.length >= 4) return;
    const next = `${pinRef.current}${digit}`;
    if (next.length === 4) {
      onComplete(next);
      updatePin("");
      keyRefs.current[0]?.focus();
      return;
    }
    updatePin(next);
  }, [onComplete, updatePin]);

  const deleteDigit = useCallback(() => {
    updatePin(pinRef.current.slice(0, -1));
  }, [updatePin]);

  useEffect(() => {
    keyRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    const handlePhysicalKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        addDigit(event.key);
      } else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        deleteDigit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handlePhysicalKey);
    return () => window.removeEventListener("keydown", handlePhysicalKey);
  }, [addDigit, deleteDigit, onCancel]);

  const moveKeypadFocus = (index: number, event: React.KeyboardEvent<HTMLButtonElement>) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    let target = index;
    if (event.key === "ArrowLeft") target = row * 3 + Math.max(0, column - 1);
    else if (event.key === "ArrowRight") target = row * 3 + Math.min(2, column + 1);
    else if (event.key === "ArrowUp") target = Math.max(0, row - 1) * 3 + column;
    else if (event.key === "ArrowDown") {
      if (row === 3) {
        event.preventDefault();
        cancelRef.current?.focus();
        return;
      }
      target = Math.min(3, row + 1) * 3 + column;
    } else {
      return;
    }
    event.preventDefault();
    keyRefs.current[target]?.focus();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="pin-entry-card bg-[oklch(20.5%_0_0)] rounded-2xl p-5 sm:p-6 w-full max-w-sm border border-[oklch(26.9%_0_0)]"
    >
      <h2 className="pin-entry-title text-2xl text-[oklch(98.5%_0_0)] mb-2 text-center" style={{ fontWeight: 500 }}>{title}</h2>
      <p className="text-[oklch(60%_0_0)] text-xs sm:text-sm text-center mb-3">
        {inputHint}
      </p>

      <div
        className="pin-entry-digits flex gap-2 justify-center mb-3"
        role="status"
        aria-label={`${pin.length} of 4 PIN digits entered`}
      >
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            aria-label={`PIN digit ${index + 1} ${index < pin.length ? "filled" : "empty"}`}
            className={`pin-entry-digit size-11 flex items-center justify-center text-2xl bg-[oklch(26.9%_0_0)] text-[oklch(98.5%_0_0)] rounded-lg border-2 transition-colors ${
              index === pin.length
                ? "border-[oklch(48.8%_0.243_264.376)]"
                : "border-[oklch(43.9%_0_0)]"
            }`}
          >
            {index < pin.length ? "•" : ""}
          </div>
        ))}
      </div>

      <div className="pin-keypad grid grid-cols-3 gap-2 max-w-[14rem] mx-auto" aria-label="PIN keypad">
        {KEYS.map((key, index) => {
          const label = key === "clear" ? "Clear PIN" : key === "delete" ? "Delete last digit" : key;
          return (
            <button
              key={key}
              ref={(element) => { keyRefs.current[index] = element; }}
              type="button"
              aria-label={label}
              onClick={() => {
                if (key === "clear") updatePin("");
                else if (key === "delete") deleteDigit();
                else addDigit(key);
              }}
              onKeyDown={(event) => moveKeypadFocus(index, event)}
              className={`pin-keypad-key h-12 rounded-xl border focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80 transition-colors ${
                key === "clear" || key === "delete"
                  ? "bg-[oklch(17%_0_0)] border-[oklch(32%_0_0)] text-[oklch(65%_0_0)] text-xs"
                  : "bg-[oklch(26.9%_0_0)] border-[oklch(43.9%_0_0)] text-[oklch(98.5%_0_0)] text-xl hover:bg-[oklch(35%_0_0)]"
              }`}
              style={{ fontWeight: 500 }}
            >
              {key === "clear" ? "Clear" : key === "delete" ? "⌫" : key}
            </button>
          );
        })}
      </div>

      <button
        ref={cancelRef}
        type="button"
        onClick={onCancel}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") {
            event.preventDefault();
            keyRefs.current[10]?.focus();
          }
        }}
        className="pin-entry-cancel w-full mt-3 py-2 rounded-lg text-[oklch(70.8%_0_0)] hover:text-[oklch(87%_0_0)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80 transition-colors"
        style={{ fontWeight: 500 }}
      >
        Cancel
      </button>
    </motion.div>
  );
}
