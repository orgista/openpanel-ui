const TELEVISION_DESIGN_WIDTH = 1600;

export function televisionCanvasScale(
  isTelevision: boolean,
  viewportWidth: number,
): number {
  if (!isTelevision || !Number.isFinite(viewportWidth) || viewportWidth <= 0) {
    return 1;
  }

  return Math.min(1, viewportWidth / TELEVISION_DESIGN_WIDTH);
}

export function televisionCanvasStyle(scale: number): {
  zoom: number;
  width: string;
  height: string;
} | undefined {
  if (!Number.isFinite(scale) || scale <= 0 || scale >= 1) return undefined;

  const expandedPercentage = `${Number((100 / scale).toFixed(4))}%`;
  return {
    zoom: scale,
    width: expandedPercentage,
    height: expandedPercentage,
  };
}
