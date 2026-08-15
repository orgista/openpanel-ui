interface ToggleSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
}

/**
 * Pill toggle. Uses flex alignment (justify-start/end) rather than an
 * absolutely-positioned + translated knob: under Tailwind v4 the translate
 * utilities composed with a stray inset and pushed the knob off the track's
 * right edge. Flex keeps the knob inside the track in every state.
 */
export function ToggleSwitch({ checked, onChange, ariaLabel, disabled = false }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-10 w-[4.5rem] shrink-0 items-center rounded-full border-2 px-1 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80 disabled:opacity-50 ${
        checked
          ? "justify-end border-[oklch(48.8%_0.243_264.376)] bg-[oklch(48.8%_0.243_264.376)]"
          : "justify-start border-[oklch(55.6%_0_0)] bg-[oklch(20.5%_0_0)]"
      }`}
    >
      <span className="size-7 rounded-full bg-white shadow" />
      <span className="sr-only">{checked ? "On" : "Off"}</span>
    </button>
  );
}
