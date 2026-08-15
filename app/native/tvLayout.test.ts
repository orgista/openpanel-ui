import { describe, expect, it } from "vitest";
import { televisionCanvasScale, televisionCanvasStyle } from "./tvLayout";

describe("TV layout density", () => {
  it("expands Castillo TV's 960px CSS viewport to a 1600px design canvas", () => {
    expect(televisionCanvasScale(true, 960)).toBe(0.6);
    expect(televisionCanvasStyle(0.6)).toEqual({
      zoom: 0.6,
      width: "166.6667%",
      height: "166.6667%",
    });
  });

  it("does not shrink a TV that already exposes a wide viewport", () => {
    expect(televisionCanvasScale(true, 1920)).toBe(1);
    expect(televisionCanvasStyle(1)).toBeUndefined();
  });

  it("never changes a tablet canvas", () => {
    expect(televisionCanvasScale(false, 960)).toBe(1);
  });
});
