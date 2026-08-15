import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAdminConfiguration, isAdminConfigured } from "./adminAuth";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("admin authentication", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("clears credentials and failed-attempt state together", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "openpanel.admin.v1",
      JSON.stringify({ pinHash: "pin", question: "question", answerHash: "answer" }),
    );
    storage.setItem(
      "openpanel.admin.throttle.v1",
      JSON.stringify({ failed: 9, lockedUntil: Date.now() + 60_000 }),
    );
    vi.stubGlobal("localStorage", storage);

    expect(isAdminConfigured()).toBe(true);

    clearAdminConfiguration();

    expect(isAdminConfigured()).toBe(false);
    expect(storage.getItem("openpanel.admin.throttle.v1")).toBeNull();
  });
});
