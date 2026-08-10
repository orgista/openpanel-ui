import { describe, expect, it } from "vitest";

import {
  parseDiagnosticEntries,
  sanitizeDiagnosticText,
  serializeDiagnosticDetails,
} from "./diagnostics";

describe("diagnostics", () => {
  it("redacts common credentials before they enter the bug log", () => {
    expect(sanitizeDiagnosticText('password="not-for-logs" token=abc123 Bearer xyz.456'))
      .toBe('password=[redacted] token=[redacted] Bearer [redacted]');
    expect(serializeDiagnosticDetails({ pin: "1234", nested: { secret: "value" } }))
      .toBe('{"pin":"[redacted]","nested":{"secret":"[redacted]"}}');
  });

  it("ignores malformed stored entries", () => {
    expect(parseDiagnosticEntries("not json")).toEqual([]);
    expect(parseDiagnosticEntries(JSON.stringify([
      { id: "1", timestamp: 1, level: "error", message: "kept" },
      { id: 2, timestamp: "wrong", level: "error", message: "dropped" },
    ]))).toEqual([
      { id: "1", timestamp: 1, level: "error", message: "kept" },
    ]);
  });
});
