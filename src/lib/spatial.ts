export type BBox = [number, number, number, number];

export type Relation = "on top of" | "below" | "beside";

/**
 * Topological spatial engine.
 * Compares two bounding boxes and decides whether object 1 is
 * "on top of", "below", or "beside" object 2, using vertical and
 * horizontal midpoint coordinates.
 */
export function resolveRelation(b1: BBox, b2: BBox): Relation {
  const midY1 = b1[1] + b1[3] / 2;
  const midY2 = b2[1] + b2[3] / 2;
  const midX1 = b1[0] + b1[2] / 2;
  const midX2 = b2[0] + b2[2] / 2;

  const verticalGap = Math.abs(midY1 - midY2);
  const horizontalGap = Math.abs(midX1 - midX2);

  // Clear vertical stacking: one midpoint sits above the other box's edge.
  if (midY1 < b2[1]) return "on top of";
  if (midY2 < b1[1]) return "below";

  // Otherwise fall back to the dominant axis between the midpoints.
  if (verticalGap > horizontalGap) {
    return midY1 < midY2 ? "on top of" : "below";
  }
  return "beside";
}

export function describeRelation(
  class1: string,
  bbox1: BBox,
  class2: string,
  bbox2: BBox,
 ): string {
  return `The ${class1} is ${resolveRelation(bbox1, bbox2)} the ${class2
                                                                }`;
}
