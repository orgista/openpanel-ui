import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ContentTile } from "./ContentTile";
import type { ContentItem } from "../App";

interface ContentRowProps {
  title: string;
  items: ContentItem[];
  selectedId: string | null;
  onSelect: (item: ContentItem) => void;
  onLaunch: (item: ContentItem) => void;
  onArtFailure?: (item: ContentItem) => void;
}

export function ContentRow({ title, items, selectedId, onSelect, onLaunch, onArtFailure }: ContentRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 640;
    scrollRef.current.scrollTo({
      left: scrollRef.current.scrollLeft + (dir === "right" ? amount : -amount),
      behavior: "smooth",
    });
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeft(scrollLeft > 8);
    setShowRight(scrollLeft < scrollWidth - clientWidth - 8);
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener("resize", handleScroll);
    return () => window.removeEventListener("resize", handleScroll);
  }, [items.length]);

  const moveTileFocus = (index: number, direction: "left" | "right") => {
    const nextIndex = index + (direction === "right" ? 1 : -1);
    const next = tileRefs.current[nextIndex];
    if (!next) return;
    next.focus();
    next.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  return (
    <div className="mb-10 group/row">
      {/* Row header */}
      <div className="flex items-center gap-3 px-14 mb-3">
        <h2 className="text-[oklch(92%_0_0)] text-lg" style={{ fontWeight: 600 }}>{title}</h2>
        <span className="text-[oklch(48.8%_0.243_264.376)] text-sm opacity-0 group-hover/row:opacity-100 transition-opacity" style={{ fontWeight: 500 }}>
          Explore All ›
        </span>
      </div>

      <div className="relative">
        {/* Left arrow */}
        {showLeft && (
          <button
            onClick={() => scroll("left")}
            tabIndex={-1}
            aria-label={`Scroll ${title} left`}
            className="absolute left-0 top-0 bottom-0 z-10 w-14 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity bg-gradient-to-r from-[oklch(11%_0_0)] to-transparent"
          >
            <ChevronLeft className="w-7 h-7 text-white" strokeWidth={2.5} />
          </button>
        )}

        {/* Right arrow */}
        {showRight && (
          <button
            onClick={() => scroll("right")}
            tabIndex={-1}
            aria-label={`Scroll ${title} right`}
            className="absolute right-0 top-0 bottom-0 z-10 w-14 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity bg-gradient-to-l from-[oklch(11%_0_0)] to-transparent"
          >
            <ChevronRight className="w-7 h-7 text-white" strokeWidth={2.5} />
          </button>
        )}

        {/* Scrollable row */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="overflow-x-auto overflow-y-visible hide-scrollbar px-14 pb-4"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="flex gap-4">
            {items.map((item, index) => (
              <ContentTile
                key={item.id}
                item={item}
                isSelected={item.id === selectedId}
                onSelect={() => onSelect(item)}
                onLaunch={() => onLaunch(item)}
                onArtFailure={onArtFailure}
                onNavigate={(direction) => moveTileFocus(index, direction)}
                buttonRef={(element) => { tileRefs.current[index] = element; }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
