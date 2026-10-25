// Arithmetic on a wrapping board, where each axis is a ring of `size` cells.

/** Wrap any value into [0, size). */
export const mod = (v, size) => ((v % size) + size) % size;

/** Signed shortest step from a to b on a ring of `size`. */
export function ringDelta(a, b, size) {
  let d = b - a;
  if (d > size / 2) d -= size;
  if (d < -size / 2) d += size;
  return d;
}
