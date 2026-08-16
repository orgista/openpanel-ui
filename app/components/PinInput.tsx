import { useCallback, useEffect, useRef, useState } from "react";
import { Delete } from "lucide-react";

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
    ? `Use the D-pad and OK on the ${controllerLabel || "TV remote"}.${hasHardwareKeyboard ? " Number keys also work." : ""}`
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
    <div className="pin-entry-card bg-[oklch(19%_0_0)] rounded-3xl p-5 sm:p-6 w-full max-w-md border border-[oklch(28%_0_0)] shadow-2xl">
      <h2 className="pin-entry-title text-2xl text-[oklch(98.5%_0_0)] mb-1.5 text-center" style={{ fontWeight: 600 }}>{title}</h2>
      <p className="text-[oklch(62%_0_0)] text-sm text-center mb-5">
        {inputHint}
      </p>

      {/* Filled-dot indicator (fills left-to-right as digits are entered) */}
      <div
        className="pin-entry-digits flex gap-3.5 justify-center mb-6"
        role="status"
        aria-label={`${pin.length} of 4 PIN digits entered`}
      >
        {[0, 1, 2, 3].map((index) => {
          const filled = index < pin.length;
          const active = index === pin.length;
          return (
            <span
              key={index}
              aria-hidden="true"
              className={`pin-entry-dot size-3.5 rounded-full transition-all duration-150 ${
                filled
                  ? "bg-white scale-100"
                  : active
                    ? "bg-transparent ring-2 ring-[oklch(62%_0.19_264)] scale-90"
                    : "bg-[oklch(40%_0_0)] scale-75"
              }`}
            />
          );
        })}
      </div>

      {/* Gboard-style keypad: borderless, tactile keys with a press-pop. */}
      <div className="pin-keypad grid grid-cols-3 gap-2.5 max-w-[21rem] mx-auto" aria-label="PIN keypad">
        {KEYS.map((key, index) => {
          const isFn = key === "clear" || key === "delete";
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
              className={`pin-keypad-key inline-flex h-16 items-center justify-center rounded-2xl select-none transition-[transform,background-color,box-shadow] duration-75 focus:outline-none focus-visible:ring-4 focus-visible:ring-[oklch(62%_0.19_264)]/70 active:translate-y-px ${
                isFn
                  ? "bg-[oklch(23%_0_0)] text-[oklch(78%_0_0)] shadow-[0_2px_0_oklch(12%_0_0)] hover:bg-[oklch(27%_0_0)] active:bg-[oklch(30%_0_0)] active:shadow-none text-base"
                  : "bg-[oklch(32%_0_0)] text-[oklch(99%_0_0)] shadow-[0_2px_0_oklch(14%_0_0)] hover:bg-[oklch(37%_0_0)] active:bg-[oklch(42%_0_0)] active:shadow-none text-[1.6rem]"
              }`}
              style={{ fontWeight: isFn ? 500 : 400 }}
            >
              {key === "clear" ? "Clear" : key === "delete" ? <Delete className="size-6" aria-hidden="true" /> : key}
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
        className="pin-entry-cancel w-full h-12 mt-4 rounded-2xl text-[oklch(70.8%_0_0)] hover:bg-[oklch(26.9%_0_0)] hover:text-[oklch(95%_0_0)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[oklch(62%_0.19_264)]/70 transition-colors"
        style={{ fontWeight: 500 }}
      >
        Cancel
      </button>
    </div>
  );
}
