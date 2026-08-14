import { motion } from "motion/react";
import { Monitor, Smartphone, Tv } from "lucide-react";
import type { AppMode } from "../appConfig";
import { OpenPanelBrand } from "./OpenPanelBrand";

interface ModeSetupProps {
  onChoose: (mode: AppMode) => void;
  isTelevision?: boolean;
}

// First-run prompt: "Do you use ArborXR?" decides whether OpenPanel runs as a
// companion (ArborXR manages lockdown) or standalone (OpenPanel locks the
// device itself). Shown once, then persisted.
export function ModeSetup({ onChoose, isTelevision = false }: ModeSetupProps) {
  const StandaloneIcon = isTelevision ? Tv : Smartphone;

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
        <div className="flex justify-center mb-5">
          <OpenPanelBrand iconClassName="size-14" wordmarkClassName="text-4xl" />
        </div>
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
            <StandaloneIcon className="w-9 h-9 text-[oklch(48.8%_0.243_264.376)] mb-4" />
            <div className="text-[oklch(98.5%_0_0)] text-xl mb-2" style={{ fontWeight: 500 }}>
              {isTelevision ? "Standalone TV" : "Standalone"}
            </div>
            <div className="text-[oklch(70.8%_0_0)] text-sm" style={{ fontWeight: 400 }}>
              {isTelevision
                ? "No ArborXR. OpenPanel becomes the TV home launcher; kiosk controls remain available in Admin."
                : "No ArborXR. OpenPanel becomes the home launcher and locks the device into kiosk mode itself."}
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
