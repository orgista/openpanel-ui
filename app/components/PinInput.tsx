import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";

interface PinInputProps {
  onComplete: (pin: string) => void;
  onCancel: () => void;
  title: string;
}

export function PinInput({ onComplete, onCancel, title }: PinInputProps) {
  const [pin, setPin] = useState(["", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newPin.every(digit => digit !== "")) {
      onComplete(newPin.join(""));
      // Clear for the next attempt (on success the parent navigates away;
      // on failure this leaves empty boxes ready to retry).
      setPin(["", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-[oklch(20.5%_0_0)] rounded-2xl p-12 w-full max-w-md border border-[oklch(26.9%_0_0)]"
    >
      <h2 className="text-3xl text-[oklch(98.5%_0_0)] mb-8 text-center" style={{ fontWeight: 500 }}>{title}</h2>

      <div className="flex gap-4 justify-center mb-8">
        {pin.map((digit, index) => (
          <input
            key={index}
            ref={el => inputRefs.current[index] = el}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className="w-16 h-20 text-4xl text-center bg-[oklch(26.9%_0_0)] text-[oklch(98.5%_0_0)] rounded-lg border-2 border-[oklch(43.9%_0_0)] focus:border-[oklch(48.8%_0.243_264.376)] focus:outline-none transition-colors"
            style={{ fontWeight: 400 }}
          />
        ))}
      </div>

      <button
        onClick={onCancel}
        className="w-full py-4 text-[oklch(70.8%_0_0)] hover:text-[oklch(87%_0_0)] transition-colors"
        style={{ fontWeight: 500 }}
      >
        Cancel
      </button>
    </motion.div>
  );
}
