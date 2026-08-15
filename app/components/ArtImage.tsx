import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface ArtImageProps {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  draggable?: boolean;
  /** Rendered when every retry fails (e.g. a letter avatar). Never the broken-image glyph. */
  fallback?: ReactNode;
  /** Called once when retries are exhausted, so callers can re-resolve fresh art. */
  onPermanentFailure?: () => void;
}

const RETRY_DELAYS_MS = [1_500, 6_000, 20_000];

/**
 * An <img> that survives kiosk reality: tiles mount while Wi-Fi is still
 * associating after boot, and remote art URLs occasionally rot. A failed load
 * retries with backoff (cache-busted so Chromium's negative cache doesn't
 * replay the failure), retries again the moment the device comes online, and
 * renders a provided fallback instead of the broken-image glyph if it never
 * recovers.
 */
export function ArtImage({ src, alt = "", className, style, draggable = false, fallback, onPermanentFailure }: ArtImageProps) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<number | null>(null);
  const reportedRef = useRef(false);

  // A new src is a new life.
  useEffect(() => {
    setAttempt(0);
    setFailed(false);
    reportedRef.current = false;
  }, [src]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (!failed) return;
    const retryOnline = () => {
      setAttempt((current) => current + 1);
      setFailed(false);
    };
    window.addEventListener("online", retryOnline);
    return () => window.removeEventListener("online", retryOnline);
  }, [failed]);

  const handleError = () => {
    if (attempt < RETRY_DELAYS_MS.length) {
      timerRef.current = window.setTimeout(() => {
        setAttempt((current) => current + 1);
      }, RETRY_DELAYS_MS[attempt]);
      setFailed(true); // show the fallback while the retry waits
      return;
    }
    setFailed(true);
    if (!reportedRef.current) {
      reportedRef.current = true;
      onPermanentFailure?.();
    }
  };

  if (failed && attempt >= RETRY_DELAYS_MS.length) {
    return <>{fallback ?? null}</>;
  }

  // Cache-bust retries so a cached failure is not replayed. Attempt 0 uses the
  // pristine URL so normal loads stay cache-friendly.
  const effectiveSrc = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}op_retry=${attempt}`;

  return (
    <>
      {failed && (fallback ?? null)}
      <img
        src={effectiveSrc}
        alt={alt}
        className={className}
        style={failed ? { ...style, display: "none" } : style}
        draggable={draggable}
        onError={handleError}
        onLoad={() => setFailed(false)}
      />
    </>
  );
}

/** Round letter avatar used when channel art is unavailable. */
export function LetterAvatar({ label, className }: { label: string; className?: string }) {
  const letter = (label.trim()[0] ?? "?").toUpperCase();
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center bg-[oklch(32%_0.06_264)] text-white ${className ?? ""}`}
      style={{ fontWeight: 700 }}
    >
      {letter}
    </div>
  );
}
