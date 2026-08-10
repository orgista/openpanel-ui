import { motion, AnimatePresence } from "motion/react";
import { ListVideo, Play, Star } from "lucide-react";
import type { ContentItem } from "../App";

interface FeaturedHeroProps {
  item: ContentItem;
  onLaunch: () => void;
}

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

export function FeaturedHero({ item, onLaunch }: FeaturedHeroProps) {

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
                {item.youtubeItem?.kind === "channel"
                  ? <ListVideo className="w-5 h-5" />
                  : <Play className="w-5 h-5" fill="currentColor" />}
                {item.youtubeItem?.kind === "channel" ? "Explore" : item.youtubeItem ? "Play" : "Open"}
              </motion.button>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
