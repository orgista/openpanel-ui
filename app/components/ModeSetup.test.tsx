import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ModeSetup } from "./ModeSetup";

describe("ModeSetup", () => {
  it("uses the shared OpenPanel brand and television-specific standalone copy", () => {
    const html = renderToStaticMarkup(
      <ModeSetup isTelevision onChoose={vi.fn()} />,
    );

    expect(html).toContain('data-openpanel-brand-mark="true"');
    expect(html).toContain("Standalone TV");
    expect(html).toContain("OpenPanel becomes the TV home launcher");
    expect(html).not.toContain("OpenPanel becomes the home launcher and locks the device");
  });
});
