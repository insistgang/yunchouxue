export type Point = { x: number; y: number };
export type HalfPlane = { a1: number; a2: number; b: number };
export function objectiveValue(c: number[], p: Point): number {
  return c[0] * p.x + c[1] * p.y;
}
