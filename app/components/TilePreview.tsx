import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, ChevronDown } from "lucide-react";
import type { ContentItem } from "../App";
import { formatDuration } from "./ContentDetailsModal";

export interface TileAnchor {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface TilePreviewProps {
  item: ContentItem | null;
  anchor: TileAnchor | null;
  onClose: () => void;
  onLaunch: (item: ContentItem) => void;
  onMoreInfo: (item: ContentItem) => void;
}

// Netflix-style hover card: the tapped tile expands in place into a floating
// card anchored over its spot in the row — artwork up top, a round Play, and
// quick metadata. The page stays visible (no dimmed backdrop); tapping
// anywhere else collapses it. The chevron opens the full details modal.
export function TilePreview({ item, anchor, onClose, onLaunch, onMoreInfo }: TilePreviewProps) {
  // The anchor goes stale if the viewport changes (rotation, keyboard).
  useEffect(() => {
    if (!item) return;
    window.addEventListener("resize", onClose);
    return () => window.removeEventListener("resize", onClose);
  }, [item, onClose]);

  return (
    <AnimatePresence>
      {item && anchor && (() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const margin = 12;
        const cardW = Math.min(Math.max(anchor.width * 1.5, 320), vw - margin * 2);
        const artH = (cardW * 9) / 16;
        const panelH = 128;
        const cardH = artH + panelH;
        const cx = anchor.left + anchor.width / 2;
        const cy = anchor.top + anchor.height / 2;
        const left = Math.min(Math.max(cx - cardW / 2, margin), vw - cardW - margin);
        const top = Math.min(Math.max(cy - cardH / 2, margin), vh - cardH - margin);
        const scaleFrom = anchor.width / cardW;

        return (
          <div className="fixed inset-0 z-[110]" onClick={onClose}>
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: scaleFrom }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: scaleFrom, transition: { duration: 0.16 } }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute rounded-xl overflow-hidden bg-[oklch(20.5%_0_0)] border border-[oklch(30%_0_0)] shadow-2xl shadow-black/70"
              style={{ left, top, width: cardW }}
            >
              {/* Artwork */}
              <div className="relative" style={{ height: artH }}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${item.coverUrl})` }}
                  >
                    {item.iconUrl && (
                      <img
                        src={item.iconUrl}
                        alt=""
                        draggable={false}
                        className="w-20 h-20 rounded-2xl shadow-2xl"
                      />
                    )}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[oklch(20.5%_0_0)] to-transparent" />
              </div>

              {/* Actions + metadata */}
              <div className="p-4 space-y-2.5">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onLaunch(item)}
                    aria-label={item.isVideo ? "Play" : "Open"}
                    className="shrink-0 w-11 h-11 rounded-full bg-white flex items-center justify-center hover:bg-[oklch(90%_0_0)] transition-colors"
                  >
                    <Play className="w-5 h-5 text-black ml-0.5" fill="currentColor" />
                  </button>
                  <p
                    className="flex-1 min-w-0 text-[oklch(96%_0_0)] leading-tight line-clamp-1"
                    style={{ fontWeight: 600, fontSize: "0.9375rem" }}
                  >
                    {item.title}
                  </p>
                  <button
                    onClick={() => onMoreInfo(item)}
                    aria-label="More info"
                    className="shrink-0 w-11 h-11 rounded-full border-2 border-[oklch(45%_0_0)] flex items-center justify-center text-[oklch(80%_0_0)] hover:border-[oklch(70%_0_0)] hover:text-white transition-colors"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[oklch(65%_0_0)]" style={{ fontSize: "0.8rem" }}>
                  <span className="border border-[oklch(45%_0_0)] px-1.5 py-0.5 rounded text-xs">
                    {item.isVideo ? "YouTube" : "App"}
                  </span>
                  {item.genre && item.genre !== "App" && item.genre !== "YouTube" && <span>{item.genre}</span>}
                  {item.year && <span>{item.year}</span>}
                  {item.rating && <span>{item.rating}</span>}
                  {item.duration && <span>{formatDuration(item.duration)}</span>}
                </div>
              </div>
            </motion.div>
          </div>
        );
      })()}
    </AnimatePresence>
  );
}
