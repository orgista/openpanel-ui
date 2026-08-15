import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { OpenPanelBrand } from "./OpenPanelBrand";

export const STARTUP_ANIMATION_FALLBACK_MS = 2200;

interface StartupAnimationProps {
  onComplete: () => void;
}

export function StartupAnimation({ onComplete }: StartupAnimationProps) {
  const [finished, setFinished] = useState(false);
  const finishedRef = useRef(false);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFinished(true);
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const timer = window.setTimeout(finish, reducedMotion ? 0 : STARTUP_ANIMATION_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [finish]);

  if (finished) return null;

  return (
    <div
      data-openpanel-startup="true"
      className="fixed inset-0 z-[1000] grid place-items-center overflow-hidden bg-[#050607]"
      aria-hidden="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <OpenPanelBrand wordmarkClassName="text-[2.75rem]" showByline />
      </motion.div>
    </div>
  );
}
