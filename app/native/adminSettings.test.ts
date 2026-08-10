import { describe, expect, it } from "vitest";
import {
  DEFAULT_INACTIVITY_TIMEOUT_MINUTES,
  loadAdminSettings,
  saveAdminSettings,
} from "./adminSettings";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("admin settings", () => {
  it("persists hidden apps and the screen-saver timeout", () => {
    const storage = new MemoryStorage();
    saveAdminSettings(
      {
        hiddenAppIds: ["com.example.game"],
        inactivityTimeoutMinutes: 12,
        allowSameChannelRecommendations: false,
        manageNotifications: false,
      },
      storage,
    );

    expect(loadAdminSettings(storage)).toEqual({
      hiddenAppIds: ["com.example.game"],
      inactivityTimeoutMinutes: 12,
      allowSameChannelRecommendations: false,
      manageNotifications: false,
    });
  });

  it("sanitizes corrupt or out-of-range stored values", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "openpanel.adminSettings.v1",
      JSON.stringify({ hiddenAppIds: ["ok", "ok", 42], inactivityTimeoutMinutes: 999 }),
    );

    expect(loadAdminSettings(storage)).toEqual({
      hiddenAppIds: ["ok"],
      inactivityTimeoutMinutes: 60,
      allowSameChannelRecommendations: true,
      manageNotifications: true,
    });
  });

  it("falls back safely when no settings exist", () => {
    expect(loadAdminSettings(new MemoryStorage())).toEqual({
      hiddenAppIds: [],
      inactivityTimeoutMinutes: DEFAULT_INACTIVITY_TIMEOUT_MINUTES,
      allowSameChannelRecommendations: true,
      manageNotifications: true,
    });
  });
});
