import { motion, AnimatePresence } from "motion/react";
import { Play, Star, X } from "lucide-react";
import type { ContentItem } from "../App";

export const formatDuration = (dur?: string) => {
  if (!dur) return null;
  const parts = dur.split(":");
  if (parts.length === 3) {
    const h = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  return dur;
};

interface ContentDetailsModalProps {
  item: ContentItem | null;
  onClose: () => void;
  onLaunch: (item: ContentItem) => void;
}

// Netflix-style preview card: tapping a tile (or the hero's "More Info") opens
// this; the content only starts from its Play/Open button (or a double-tap on
// the tile). Rendered once at the App root so no portal is needed.
export function ContentDetailsModal({ item, onClose, onLaunch }: ContentDetailsModalProps) {
  return (
    <AnimatePresence>
      {item && (
        <motion.div
          key={item.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] bg-[oklch(11%_0_0)]/80 backdrop-blur-sm flex items-center justify-center p-8"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg max-h-[85dvh] overflow-y-auto bg-[oklch(20.5%_0_0)] rounded-2xl border border-[oklch(26.9%_0_0)]"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-[oklch(11%_0_0)]/60 hover:bg-[oklch(11%_0_0)]/85 transition-colors"
            >
              <X className="w-5 h-5 text-[oklch(85%_0_0)]" />
            </button>

            {/* Artwork header */}
            {item.imageUrl ? (
              <div className="relative h-56">
                <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[oklch(20.5%_0_0)] via-transparent to-transparent" />
              </div>
            ) : (
              <div className="relative h-36" style={{ background: `linear-gradient(135deg, ${item.coverUrl})` }}>
                {item.iconUrl && (
                  <img
                    src={item.iconUrl}
                    alt=""
                    draggable={false}
                    className="absolute bottom-4 left-6 w-16 h-16 rounded-2xl shadow-2xl"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[oklch(20.5%_0_0)]/85 to-transparent" />
              </div>
            )}

            <div className="p-6 space-y-4">
              <h2 className="text-[oklch(98.5%_0_0)] text-2xl pr-8" style={{ fontWeight: 600 }}>
                {item.title}
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs px-2 py-1 rounded bg-[oklch(26.9%_0_0)] text-[oklch(80%_0_0)]" style={{ fontWeight: 500 }}>
                  {item.isVideo ? "YouTube video" : "App"}
                </span>
                {item.matchPct && (
                  <span className="flex items-center gap-1 text-[oklch(72%_0.19_142)] text-sm" style={{ fontWeight: 600 }}>
                    <Star className="w-3.5 h-3.5" fill="currentColor" />
                    {item.matchPct}%
                  </span>
                )}
                {/* Skip the genre when the type chip already says it (apps carry
                    genre "App", videos "YouTube"). */}
                {item.genre && item.genre !== "App" && item.genre !== "YouTube" && (
                  <span className="text-[oklch(65%_0_0)] text-sm">{item.genre}</span>
                )}
                {item.year && <span className="text-[oklch(65%_0_0)] text-sm">{item.year}</span>}
                {item.rating && (
                  <span className="border border-[oklch(50%_0_0)] text-[oklch(65%_0_0)] text-xs px-1.5 py-0.5 rounded">
                    {item.rating}
                  </span>
                )}
                {item.duration && <span className="text-[oklch(65%_0_0)] text-sm">{formatDuration(item.duration)}</span>}
              </div>

              <p className="text-[oklch(82%_0_0)]" style={{ fontWeight: 400, lineHeight: "1.6" }}>
                {item.description || "No description available."}
              </p>

              <button
                onClick={() => onLaunch(item)}
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
    </AnimatePresence>
  );
}
