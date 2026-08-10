import { motion } from "motion/react";
import { Monitor, Smartphone } from "lucide-react";
import type { AppMode } from "../appConfig";

interface ModeSetupProps {
  onChoose: (mode: AppMode) => void;
}

// First-run prompt: "Do you use ArborXR?" decides whether OpenPanel runs as a
// companion (ArborXR manages lockdown) or standalone (OpenPanel locks the
// device itself). Shown once, then persisted.
export function ModeSetup({ onChoose }: ModeSetupProps) {
  return (
    <div
      data-dpad-scope
      className="fixed inset-0 bg-[oklch(11%_0_0)] z-[300] flex items-center justify-center p-8"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-3xl"
      >
        <h1 className="text-4xl text-[oklch(98.5%_0_0)] text-center mb-3" style={{ fontWeight: 600 }}>
          Welcome to OpenPanel
        </h1>
        <p className="text-[oklch(70.8%_0_0)] text-center mb-10 text-lg" style={{ fontWeight: 400 }}>
          How is this device managed?
        </p>

        <div className="grid grid-cols-2 gap-5">
          <button
            autoFocus
            onClick={() => onChoose("companion")}
            className="text-left p-7 bg-[oklch(20.5%_0_0)] rounded-2xl border border-[oklch(26.9%_0_0)] hover:border-[oklch(48.8%_0.243_264.376)] transition-colors"
          >
            <Monitor className="w-9 h-9 text-[oklch(48.8%_0.243_264.376)] mb-4" />
            <div className="text-[oklch(98.5%_0_0)] text-xl mb-2" style={{ fontWeight: 500 }}>I use ArborXR</div>
            <div className="text-[oklch(70.8%_0_0)] text-sm" style={{ fontWeight: 400 }}>
              ArborXR is the device owner and handles kiosk lockdown. OpenPanel is just the launcher.
            </div>
          </button>

          <button
            onClick={() => onChoose("standalone")}
            className="text-left p-7 bg-[oklch(20.5%_0_0)] rounded-2xl border border-[oklch(26.9%_0_0)] hover:border-[oklch(48.8%_0.243_264.376)] transition-colors"
          >
            <Smartphone className="w-9 h-9 text-[oklch(48.8%_0.243_264.376)] mb-4" />
            <div className="text-[oklch(98.5%_0_0)] text-xl mb-2" style={{ fontWeight: 500 }}>Standalone</div>
            <div className="text-[oklch(70.8%_0_0)] text-sm" style={{ fontWeight: 400 }}>
              No ArborXR. OpenPanel becomes the home launcher and locks the device into kiosk mode itself.
            </div>
          </button>
        </div>

        <p className="text-[oklch(55.6%_0_0)] text-center mt-8 text-sm" style={{ fontWeight: 400 }}>
          You can change this later in the Admin Panel.
        </p>
      </motion.div>
    </div>
  );
}
