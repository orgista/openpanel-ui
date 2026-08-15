import { describe, expect, it } from "vitest";

import { findNextDpadTarget, type DpadRect } from "./dpadNavigation";

const rect = (left: number, top: number, width = 100, height = 50): DpadRect => ({
  left,
  top,
  width,
  height,
});

describe("findNextDpadTarget", () => {
  it("moves from a horizontal tab into the nearest control below it", () => {
    expect(findNextDpadTarget(
      rect(500, 100),
      [
        rect(800, 100),
        rect(520, 300),
        rect(900, 600),
      ],
      "down",
    )).toBe(1);
  });

  it("prefers the same visual column in a controller grid", () => {
    expect(findNextDpadTarget(
      rect(300, 300),
      [
        rect(80, 470),
        rect(310, 500),
        rect(620, 430),
      ],
      "down",
    )).toBe(1);
  });

  it("enters the next menu row before a distant wide action", () => {
    expect(findNextDpadTarget(
      rect(575, 184, 136, 40),
      [
        rect(174, 267, 140, 46),
        rect(325, 267, 222, 46),
        rect(154, 609, 943, 56),
      ],
      "down",
    )).toBe(1);
  });

  it("never selects a control in the opposite direction", () => {
    expect(findNextDpadTarget(
      rect(300, 300),
      [rect(300, 100), rect(80, 250)],
      "down",
    )).toBeNull();
  });

  it("does not treat a one-pixel same-row offset as downward navigation", () => {
    const wifiTab = rect(98, 144, 185, 80);
    const browseNetworks = rect(1470, 145, 350, 80);
    const adminMode = rect(98, 700, 286, 88);

    expect(findNextDpadTarget(
      wifiTab,
      [browseNetworks, adminMode],
      "down",
    )).toBe(1);
    expect(findNextDpadTarget(
      wifiTab,
      [browseNetworks, adminMode],
      "right",
    )).toBe(0);
  });
});
