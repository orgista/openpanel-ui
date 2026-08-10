import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hideKeyboard: vi.fn<() => Promise<void>>(),
}));

vi.mock("./SystemBridge", () => ({
  SystemBridge: { hideKeyboard: mocks.hideKeyboard },
}));

import { dismissSoftKeyboard, isSoftKeyboardViewport } from "./keyboard";

describe("dismissSoftKeyboard", () => {
  beforeEach(() => {
    mocks.hideKeyboard.mockReset();
    mocks.hideKeyboard.mockResolvedValue();
  });

  it("asks the native bridge to hide the Android keyboard", async () => {
    await dismissSoftKeyboard();

    expect(mocks.hideKeyboard).toHaveBeenCalledOnce();
  });

  it("recognizes the Lenovo landscape keyboard viewport without flagging small browser changes", () => {
    expect(isSoftKeyboardViewport(1228, 464)).toBe(true);
    expect(isSoftKeyboardViewport(720, 650)).toBe(false);
    expect(isSoftKeyboardViewport(720, 719)).toBe(false);
  });
});
