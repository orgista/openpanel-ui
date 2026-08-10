import { SystemBridge } from "./SystemBridge";

const KEYBOARD_MIN_REDUCTION_PX = 120;

export function isSoftKeyboardViewport(largestHeight: number, currentHeight: number): boolean {
  const requiredReduction = Math.max(KEYBOARD_MIN_REDUCTION_PX, largestHeight * 0.2);
  return largestHeight - currentHeight >= requiredReduction;
}

function isEditableTextTarget(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

/**
 * Keep Android's resized WebView usable above a landscape keyboard and prevent
 * Chromium's selection handles from opening an oversized Android 14 popup on
 * a double-tapped kiosk field. Paste and ordinary caret movement remain intact.
 */
export function installKeyboardViewportTracking(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => undefined;

  const viewport = window.visualViewport;
  const root = document.documentElement;
  let largestHeight = viewport?.height ?? window.innerHeight;

  const update = () => {
    const currentHeight = viewport?.height ?? window.innerHeight;
    largestHeight = Math.max(largestHeight, currentHeight);
    const keyboardOpen = isSoftKeyboardViewport(largestHeight, currentHeight);

    root.classList.toggle("soft-keyboard-open", keyboardOpen);
    root.style.setProperty("--openpanel-viewport-height", `${currentHeight}px`);

    if (keyboardOpen && isEditableTextTarget(document.activeElement)) {
      const focused = document.activeElement;
      window.requestAnimationFrame(() => {
        focused.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      });
    }
  };

  const preventSelectionPopup = (event: Event) => {
    if (!isEditableTextTarget(event.target)) return;
    event.preventDefault();
    const field = event.target;
    window.requestAnimationFrame(() => {
      const cursor = field.selectionEnd ?? field.value.length;
      field.setSelectionRange(cursor, cursor);
    });
  };

  viewport?.addEventListener("resize", update);
  viewport?.addEventListener("scroll", update);
  window.addEventListener("resize", update);
  document.addEventListener("focusin", update);
  document.addEventListener("focusout", update);
  document.addEventListener("dblclick", preventSelectionPopup, true);
  document.addEventListener("selectstart", preventSelectionPopup, true);
  update();

  return () => {
    viewport?.removeEventListener("resize", update);
    viewport?.removeEventListener("scroll", update);
    window.removeEventListener("resize", update);
    document.removeEventListener("focusin", update);
    document.removeEventListener("focusout", update);
    document.removeEventListener("dblclick", preventSelectionPopup, true);
    document.removeEventListener("selectstart", preventSelectionPopup, true);
    root.classList.remove("soft-keyboard-open");
    root.style.removeProperty("--openpanel-viewport-height");
  };
}

export async function dismissSoftKeyboard(): Promise<void> {
  if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  try {
    await SystemBridge.hideKeyboard();
  } catch {
    // The browser mock and older builds may not expose a native keyboard.
  }
}
