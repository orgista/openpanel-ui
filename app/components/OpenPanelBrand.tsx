interface OpenPanelBrandProps {
  iconClassName?: string;
  wordmarkClassName?: string;
  showByline?: boolean;
}

/** Wordmark used by the launcher and startup animation. The Quad logo mark was
 *  dropped from the on-screen brand (the launcher icon still uses it); only the
 *  "OpenPanel" name and byline show here. */
export function OpenPanelBrand({
  iconClassName: _iconClassName,
  wordmarkClassName = "text-[1.375rem]",
  showByline = true,
}: OpenPanelBrandProps) {
  return (
    <div className="inline-flex items-center gap-2.5" aria-label="OpenPanel by Orgista">
      <span className="inline-flex items-baseline gap-2">
        <span
          className={`text-[oklch(97%_0_0)] tracking-tight ${wordmarkClassName}`}
          style={{ fontWeight: 700 }}
        >
          OpenPanel
        </span>
        {showByline && (
          <span
            className="text-[oklch(38%_0_0)] tracking-widest uppercase"
            style={{ fontSize: "0.6rem", fontWeight: 500 }}
          >
            by Orgista™
          </span>
        )}
      </span>
    </div>
  );
}
