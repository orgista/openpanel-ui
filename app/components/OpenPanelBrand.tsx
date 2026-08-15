import launcherIconUrl from "../../assets/openpanel-quad-mark.svg";

interface OpenPanelBrandProps {
  iconClassName?: string;
  wordmarkClassName?: string;
  showByline?: boolean;
}

/** Shared Quad mark used by the launcher, startup animation, and Android icon. */
export function OpenPanelBrand({
  iconClassName = "size-8",
  wordmarkClassName = "text-[1.375rem]",
  showByline = true,
}: OpenPanelBrandProps) {
  return (
    <div className="inline-flex items-center gap-2.5" aria-label="OpenPanel by Orgista">
      <img
        src={launcherIconUrl}
        alt=""
        draggable={false}
        data-openpanel-brand-mark="true"
        className={`${iconClassName} rounded-[22%] shrink-0`}
      />
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
