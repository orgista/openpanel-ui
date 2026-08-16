import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PinInput } from "./PinInput";

describe("PinInput", () => {
  it("uses a keyboard-free keypad that is reachable from a TV remote", () => {
    const html = renderToStaticMarkup(
      <PinInput
        title="Create Admin PIN"
        onComplete={vi.fn()}
        onCancel={vi.fn()}
        remoteMode
        controllerName="Chromecast Voice Remote"
        hasHardwareKeyboard
      />,
    );

    expect(html).toContain("pin-entry-card");
    expect(html).toContain("pin-entry-title");
    expect(html).toContain("pin-entry-digits");
    expect(html).toContain("pin-keypad");
    expect(html).toContain("max-w-md");
    expect(html).toContain("h-16");
    expect(html).toContain("max-w-[21rem]");
    expect(html).toContain('aria-label="1"');
    expect(html).toContain('aria-label="Delete last digit"');
    expect(html).toContain("Chromecast Voice Remote");
    expect(html).toContain("use the D-pad and OK");
    expect(html).toContain("Number keys also work");
    expect(html).not.toContain("<input");
    expect(html).toContain("pin-entry-cancel");
    expect(html).toContain("h-12");
  });
});
