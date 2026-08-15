import { useCallback, useEffect, useRef, useState } from "react";
import launchVideoUrl from "../../assets/openpanel-launch.mp4";

export const STARTUP_ANIMATION_FALLBACK_MS = 5750;

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
    if (reducedMotion) {
      finish();
      return;
    }

    const fallback = window.setTimeout(finish, STARTUP_ANIMATION_FALLBACK_MS);
    return () => window.clearTimeout(fallback);
  }, [finish]);

  if (finished) return null;

  return (
    <div
      data-openpanel-startup="true"
      className="fixed inset-0 z-[1000] grid place-items-center overflow-hidden bg-[#050607]"
      aria-hidden="true"
    >
      <video
        data-openpanel-startup-video="true"
        className="size-full object-contain"
        src={launchVideoUrl}
        autoPlay
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        onEnded={finish}
        onError={finish}
      />
    </div>
  );
}
