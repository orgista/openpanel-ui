import { motion, AnimatePresence } from "motion/react";
import { Play, Info, Star, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { ContentItem } from "../App";

interface FeaturedHeroProps {
  item: ContentItem;
  onLaunch: () => void;
}

export function FeaturedHero({ item, onLaunch }: FeaturedHeroProps) {
  const [showInfo, setShowInfo] = useState(false);

  const formatDuration = (dur?: string) => {
    if (!dur) return null;
    const parts = dur.split(":");
    if (parts.length === 3) {
      const h = parseInt(parts[0]);
      const m = parseInt(parts[1]);
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    return dur;
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={item.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="relative h-[520px] overflow-hidden"
      >
        {/* Background */}
        <div className="absolute inset-0">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-full h-full object-cover object-center"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{ background: `linear-gradient(135deg, ${item.coverUrl})` }}
            />
          )}
          {!item.imageUrl && item.iconUrl && (
            <div className="absolute inset-0 flex items-center justify-end pr-32">
              <img
                src={item.iconUrl}
                alt=""
                className="w-48 h-48 rounded-[2rem] shadow-2xl opacity-90"
                draggable={false}
              />
            </div>
          )}
        </div>

        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-[oklch(11%_0_0)] via-[oklch(11%_0_0)]/75 to-[oklch(11%_0_0)]/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[oklch(11%_0_0)] via-transparent to-[oklch(11%_0_0)]/40" />

        {/* Content */}
        <div className="relative h-full flex items-end pb-14 px-14">
          <div className="max-w-xl">
            {/* Match % */}
            {item.matchPct && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="flex items-center gap-2 mb-3"
              >
                <Star className="w-3.5 h-3.5 text-[oklch(72%_0.19_142)]" fill="currentColor" />
                <span className="text-[oklch(72%_0.19_142)] text-sm tracking-wide" style={{ fontWeight: 600 }}>
                  {item.matchPct}% Match
                </span>
              </motion.div>
            )}

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-[oklch(98%_0_0)] mb-3 drop-shadow-2xl leading-none"
              style={{ fontWeight: 700, fontSize: "clamp(2.5rem, 5vw, 3.75rem)" }}
            >
              {item.title}
            </motion.h1>

            {/* Meta row */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="flex items-center gap-3 mb-4 flex-wrap"
            >
              {item.year && (
                <span className="text-[oklch(65%_0_0)] text-sm" style={{ fontWeight: 400 }}>{item.year}</span>
              )}
              {item.rating && (
                <span className="border border-[oklch(50%_0_0)] text-[oklch(65%_0_0)] text-xs px-1.5 py-0.5 rounded" style={{ fontWeight: 400 }}>
                  {item.rating}
                </span>
              )}
              {item.duration && (
                <span className="text-[oklch(65%_0_0)] text-sm" style={{ fontWeight: 400 }}>{formatDuration(item.duration)}</span>
              )}
              {item.genre && (
                <span className="text-[oklch(65%_0_0)] text-sm" style={{ fontWeight: 400 }}>{item.genre}</span>
              )}
            </motion.div>

            {/* Description */}
            {item.description && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.34 }}
                className="text-[oklch(82%_0_0)] mb-7 line-clamp-2"
                style={{ fontWeight: 400, fontSize: "0.9375rem", lineHeight: "1.6" }}
              >
                {item.description}
              </motion.p>
            )}

            {/* Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex gap-3"
            >
              <motion.button
                onClick={onLaunch}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2.5 px-7 py-3.5 bg-[oklch(98%_0_0)] text-[oklch(11%_0_0)] rounded-md transition-colors hover:bg-[oklch(90%_0_0)]"
                style={{ fontWeight: 600, fontSize: "0.9375rem" }}
              >
                <Play className="w-5 h-5" fill="currentColor" />
                {item.isVideo ? "Play" : "Open"}
              </motion.button>

              <motion.button
                onClick={() => setShowInfo(true)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2.5 px-7 py-3.5 bg-[oklch(98%_0_0)]/20 backdrop-blur-sm text-[oklch(95%_0_0)] rounded-md transition-colors hover:bg-[oklch(98%_0_0)]/30 border border-[oklch(98%_0_0)]/10"
                style={{ fontWeight: 500, fontSize: "0.9375rem" }}
              >
                <Info className="w-5 h-5" />
                More Info
              </motion.button>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* More Info details — portal so it isn't clipped by the hero's overflow/transform */}
      {createPortal(
        <AnimatePresence>
          {showInfo && (
            <motion.div
              key="info"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] bg-[oklch(11%_0_0)]/80 backdrop-blur-sm flex items-center justify-center p-8"
              onClick={() => setShowInfo(false)}
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-[oklch(20.5%_0_0)] rounded-2xl border border-[oklch(26.9%_0_0)] overflow-hidden"
              >
                <div className="flex items-start justify-between p-6 pb-4">
                  <h2 className="text-[oklch(98.5%_0_0)] text-2xl pr-4" style={{ fontWeight: 600 }}>{item.title}</h2>
                  <button
                    onClick={() => setShowInfo(false)}
                    aria-label="Close"
                    className="shrink-0 p-2 rounded-full hover:bg-[oklch(26.9%_0_0)] transition-colors"
                  >
                    <X className="w-5 h-5 text-[oklch(70.8%_0_0)]" />
                  </button>
                </div>
                <div className="px-6 pb-6 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded bg-[oklch(26.9%_0_0)] text-[oklch(80%_0_0)]" style={{ fontWeight: 500 }}>
                      {item.isVideo ? "YouTube video" : "App"}
                    </span>
                    {item.genre && <span className="text-[oklch(65%_0_0)] text-sm">{item.genre}</span>}
                    {item.year && <span className="text-[oklch(65%_0_0)] text-sm">{item.year}</span>}
                    {item.rating && <span className="border border-[oklch(50%_0_0)] text-[oklch(65%_0_0)] text-xs px-1.5 py-0.5 rounded">{item.rating}</span>}
                    {item.duration && <span className="text-[oklch(65%_0_0)] text-sm">{formatDuration(item.duration)}</span>}
                  </div>
                  <p className="text-[oklch(82%_0_0)]" style={{ fontWeight: 400, lineHeight: "1.6" }}>
                    {item.description || "No description available."}
                  </p>
                  <button
                    onClick={() => { setShowInfo(false); onLaunch(); }}
                    className="flex items-center gap-2.5 px-6 py-3 bg-[oklch(98%_0_0)] text-[oklch(11%_0_0)] rounded-md hover:bg-[oklch(90%_0_0)] transition-colors"
                    style={{ fontWeight: 600 }}
                  >
                    <Play className="w-5 h-5" fill="currentColor" />
                    {item.isVideo ? "Play" : "Open"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </AnimatePresence>
  );
}
