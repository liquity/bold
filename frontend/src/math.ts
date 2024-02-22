export type Point = [x: number, y: number];

export function distance([x1, y1]: Point, [x2, y2]: Point): number {
  var a = x1 - x2;
  var b = y1 - y2;
  return Math.sqrt(a * a + b * b);
}
