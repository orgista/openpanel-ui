import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OpenPanelBrand } from "./OpenPanelBrand";

export const STARTUP_ANIMATION_FALLBACK_MS = 2800;

interface StartupAnimationProps {
  onComplete: () => void;
}

// Media tiles that fly in and converge into the wordmark — a rebuilt, logo-free
// version of the original launch motion. Colours echo the app/media artwork
// palette; positions ring the centre so they collapse inward cleanly.
const TILE_DEFS = [
  { gradient: "linear-gradient(135deg,#0e7490,#0c4a6e)", w: 148, h: 92, angle: 158, rotate: -9 },
  { gradient: "linear-gradient(135deg,#6d28d9,#4c1d95)", w: 96, h: 128, angle: 120, rotate: 7 },
  { gradient: "linear-gradient(135deg,#1d4ed8,#1e3a8a)", w: 150, h: 94, angle: 196, rotate: 6 },
  { gradient: "linear-gradient(135deg,#be123c,#7f1d1d)", w: 92, h: 122, angle: 232, rotate: -8 },
  { gradient: "linear-gradient(135deg,#c2410c,#7c2d12)", w: 146, h: 90, angle: 292, rotate: 5 },
  { gradient: "linear-gradient(135deg,#15803d,#14532d)", w: 150, h: 92, angle: 336, rotate: -6 },
  { gradient: "linear-gradient(135deg,#0891b2,#155e75)", w: 96, h: 126, angle: 24, rotate: 8 },
  { gradient: "linear-gradient(135deg,#7c3aed,#5b21b6)", w: 144, h: 88, angle: 62, rotate: -7 },
  { gradient: "linear-gradient(135deg,#b45309,#78350f)", w: 92, h: 120, angle: 92, rotate: 6 },
  { gradient: "linear-gradient(135deg,#0369a1,#0c4a6e)", w: 140, h: 88, angle: 268, rotate: -5 },
  { gradient: "linear-gradient(135deg,#047857,#064e3b)", w: 96, h: 122, angle: 4, rotate: 9 },
] as const;

const RING_X = 460;
const RING_Y = 250;
const FLY_IN_SPREAD = 1.8;

export function StartupAnimation({ onComplete }: StartupAnimationProps) {
  const [finished, setFinished] = useState(false);
  const finishedRef = useRef(false);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFinished(true);
    onComplete();
  }, [onComplete]);

  const tiles = useMemo(
    () =>
      TILE_DEFS.map((tile, index) => {
        const radians = (tile.angle * Math.PI) / 180;
        const ringX = Math.cos(radians) * RING_X;
        const ringY = Math.sin(radians) * RING_Y;
        return {
          ...tile,
          key: index,
          ringX,
          ringY,
          startX: ringX * FLY_IN_SPREAD,
          startY: ringY * FLY_IN_SPREAD,
          delay: index * 0.04,
        };
      }),
    [],
  );

  useEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const timer = window.setTimeout(finish, reducedMotion ? 0 : STARTUP_ANIMATION_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [finish]);

  if (finished) return null;

  return (
    <motion.div
      data-openpanel-startup="true"
      className="fixed inset-0 z-[1000] grid place-items-center overflow-hidden bg-[#050607]"
      aria-hidden="true"
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0] }}
      transition={{ duration: STARTUP_ANIMATION_FALLBACK_MS / 1000, times: [0, 0.92, 1], ease: "easeInOut" }}
    >
      {/* Converging media tiles */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        {tiles.map((tile) => (
          <motion.div
            key={tile.key}
            className="absolute rounded-2xl shadow-2xl"
            style={{ width: tile.w, height: tile.h, backgroundImage: tile.gradient }}
            initial={{ x: tile.startX, y: tile.startY, scale: 0.4, opacity: 0, rotate: tile.rotate * 1.6 }}
            animate={{
              x: [tile.startX, tile.ringX, 0],
              y: [tile.startY, tile.ringY, 0],
              scale: [0.4, 1, 0.12],
              opacity: [0, 1, 0],
              rotate: [tile.rotate * 1.6, tile.rotate, 0],
            }}
            transition={{ duration: 1.7, times: [0, 0.5, 1], ease: "easeInOut", delay: tile.delay }}
          />
        ))}
      </div>

      {/* Wordmark resolves at centre as the tiles collapse in */}
      <motion.div
        className="relative"
        initial={{ opacity: 0, scale: 0.82, filter: "blur(8px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.7, delay: 1.5, ease: "easeOut" }}
      >
        <OpenPanelBrand wordmarkClassName="text-[2.75rem]" showByline />
      </motion.div>
    </motion.div>
  );
}
