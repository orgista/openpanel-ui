import { recordDiagnostic } from "./diagnostics";

export type DpadDirection = "up" | "down" | "left" | "right";

export interface DpadRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const center = (rect: DpadRect) => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
});

/**
 * Finds the nearest control in the requested visual direction. Advancing to
 * the next row or column matters more than perfect cross-axis alignment; this
 * prevents a wide control several rows away from stealing focus.
 */
export function findNextDpadTarget(
  current: DpadRect,
  candidates: DpadRect[],
  direction: DpadDirection,
): number | null {
  const origin = center(current);
  let bestIndex: number | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate, index) => {
    const target = center(candidate);
    const deltaX = target.x - origin.x;
    const deltaY = target.y - origin.y;
    const primary = direction === "left" ? -deltaX
      : direction === "right" ? deltaX
        : direction === "up" ? -deltaY : deltaY;
    if (primary <= 1) return;

    const crossAxis = direction === "left" || direction === "right"
      ? Math.abs(deltaY)
      : Math.abs(deltaX);
    const score = primary * 4 + crossAxis;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const isRendered = (element: HTMLElement): boolean => {
  if (element.closest("[aria-hidden='true'], [inert]")) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const scopeZIndex = (element: HTMLElement): number => {
  const value = Number.parseInt(window.getComputedStyle(element).zIndex, 10);
  return Number.isFinite(value) ? value : 0;
};

const topDpadScope = (): HTMLElement | null => {
  const scopes = Array.from(
    document.querySelectorAll<HTMLElement>("[data-dpad-scope]"),
  ).filter(isRendered);
  return scopes.reduce<HTMLElement | null>((top, scope) => {
    if (!top || scopeZIndex(scope) >= scopeZIndex(top)) return scope;
    return top;
  }, null);
};

const shouldKeepNativeArrowBehavior = (
  element: HTMLElement,
  direction: DpadDirection,
): boolean => {
  if (direction !== "left" && direction !== "right") return false;
  if (element instanceof HTMLTextAreaElement || element.isContentEditable) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return !["button", "checkbox", "radio", "range", "submit"].includes(element.type);
};

/**
 * Installs a WebView-safe spatial navigation fallback. Component-specific
 * handlers still win because this listener ignores already-prevented events.
 */
export function installDpadNavigation(enabled: boolean): () => void {
  if (!enabled || typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = event.key === "ArrowUp" ? "up"
      : event.key === "ArrowDown" ? "down"
        : event.key === "ArrowLeft" ? "left"
          : event.key === "ArrowRight" ? "right" : null;
    if (!direction) return;

    const active = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    if (active && shouldKeepNativeArrowBehavior(active, direction)) return;

    const topScope = topDpadScope();
    const activeScope = active?.closest<HTMLElement>("[data-dpad-scope]") ?? null;
    const scope = topScope ?? activeScope ?? document.body;
    const candidates = Array.from(
      scope.querySelectorAll<HTMLElement>(focusableSelector),
    ).filter((element) => element !== active && isRendered(element));
    if (candidates.length === 0) {
      if (!active || !isRendered(active)) {
        recordDiagnostic("warning", "D-pad scope has no usable focus target", {
          direction,
          scope: scope.getAttribute("aria-label") || scope.className || scope.tagName,
        });
      }
      return;
    }

    let target: HTMLElement | null = null;
    if (!active || !scope.contains(active) || !isRendered(active)) {
      target = candidates[0];
      recordDiagnostic("info", "D-pad focus recovered inside active screen", {
        direction,
        target: target.getAttribute("aria-label") || target.textContent?.trim().slice(0, 80),
      });
    } else {
      const targetIndex = findNextDpadTarget(
        active.getBoundingClientRect(),
        candidates.map((candidate) => candidate.getBoundingClientRect()),
        direction,
      );
      if (targetIndex !== null) target = candidates[targetIndex];
    }
    if (!target) return;

    event.preventDefault();
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}
