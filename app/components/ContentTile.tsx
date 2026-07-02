import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Play } from "lucide-react";
import type { ContentItem } from "../App";
import type { TileAnchor } from "./TilePreview";

interface ContentTileProps {
  item: ContentItem;
  onLaunch: () => void;
  onPreview: (anchor: TileAnchor) => void;
  onFocus?: () => void;
}

// Netflix-style: one tap expands the tile into its hover-card preview; a
// quick second tap (double-tap) skips the preview and launches immediately.
const DOUBLE_TAP_MS = 300;

const BADGE_STYLES = {
  new: { label: "NEW", bg: "bg-[oklch(48.8%_0.243_264.376)]" },
  top10: { label: "TOP 10", bg: "bg-[oklch(63.7%_0.237_25.331)]" },
  trending: { label: "TRENDING", bg: "bg-[oklch(72%_0.19_142)]" },
};

export function ContentTile({ item, onLaunch, onPreview, onFocus }: ContentTileProps) {
  const isLandscape = item.tileType === "landscape";
  const tileRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef(0);
  const pendingTapRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (pendingTapRef.current) clearTimeout(pendingTapRef.current);
  }, []);

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      if (pendingTapRef.current) {
        clearTimeout(pendingTapRef.current);
        pendingTapRef.current = null;
      }
      onLaunch();
    } else {
      lastTapRef.current = now;
      pendingTapRef.current = setTimeout(() => {
        pendingTapRef.current = null;
        const r = tileRef.current?.getBoundingClientRect();
        if (r) onPreview({ left: r.left, top: r.top, width: r.width, height: r.height });
      }, DOUBLE_TAP_MS);
    }
  };

  return (
    <motion.div
      ref={tileRef}
      className={`relative flex-shrink-0 cursor-pointer group ${
        isLandscape ? "w-72 h-44" : "w-56 h-80"
      }`}
      whileHover={{ scale: 1.07, zIndex: 20 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      onClick={handleTap}
      onMouseEnter={onFocus}
    >
      <div className="relative w-full h-full rounded-lg overflow-hidden">
        {/* Poster background */}
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${item.coverUrl})` }}
          />
        )}

        {/* App icon centered over gradient */}
        {!item.imageUrl && item.iconUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={item.iconUrl}
              alt=""
              className="w-20 h-20 rounded-2xl shadow-2xl"
              draggable={false}
            />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300" />

        {/* Play button on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-11 h-11 rounded-full bg-white/95 flex items-center justify-center shadow-xl">
            <Play className="w-5 h-5 text-black ml-0.5" fill="currentColor" />
          </div>
        </div>

        {/* Bottom title gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/90 to-transparent" />

        {/* Title always visible */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p
            className="text-white text-sm leading-tight line-clamp-2"
            style={{ fontWeight: 500, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
          >
            {item.title}
          </p>
          {item.genre && (
            <p className="text-white/55 mt-0.5" style={{ fontSize: "0.72rem", fontWeight: 400 }}>
              {item.genre.split(" • ")[0]}
            </p>
          )}
        </div>

        {/* Badge */}
        {item.badge && (
          <div className={`absolute top-2 left-2 ${BADGE_STYLES[item.badge].bg} px-1.5 py-0.5 rounded`}>
            <span className="text-white" style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.05em" }}>
              {BADGE_STYLES[item.badge].label}
            </span>
          </div>
        )}

        {/* Focus ring */}
        <div className="absolute inset-0 rounded-lg ring-2 ring-transparent group-hover:ring-white/40 transition-all duration-300 pointer-events-none" />
      </div>
    </motion.div>
  );
}
