import { motion } from "motion/react";
import { X } from "lucide-react";
import { embedUrl } from "../native/youtube";

interface YouTubePlayerProps {
  videoId: string;
  title: string;
  onClose: () => void;
}

// Locked full-screen YouTube playback. The iframe sandbox deliberately omits
// `allow-top-navigation` and `allow-popups`, so the embed cannot navigate the
// kiosk away to youtube.com or open new windows — the only way out is the
// in-app Close button. Combined with the youtube-nocookie + rel=0 embed, the
// user gets the video and playback controls but no recommendations/channel surf.
export function YouTubePlayer({ videoId, title, onClose }: YouTubePlayerProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-[100] flex flex-col"
    >
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/90 to-transparent">
        <span className="text-white text-lg truncate pr-4" style={{ fontWeight: 500 }}>
          {title}
        </span>
        <button
          onClick={onClose}
          aria-label="Close video"
          className="shrink-0 p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center bg-black">
        <iframe
          key={videoId}
          src={embedUrl(videoId)}
          title={title}
          className="w-full h-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation"
        />
      </div>
    </motion.div>
  );
}
