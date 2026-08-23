/** Speaker positions on the square, matching Wallace: left, top, right, bottom. */
export const SPEAKERS: [number, number][] = [
  [0, 0.5],
  [0.5, 0],
  [1, 0.5],
  [0.5, 1],
];

/**
 * Inverse-distance weights. Isolated at a speaker, equal at the centre.
 */
export function weightsAt(x: number, y: number): [number, number, number, number] {
  const raw = SPEAKERS.map(([sx, sy]) => {
    const d = Math.hypot(x - sx, y - sy);
    return 1 / (d * d + 0.018);
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => v / sum) as [number, number, number, number];
}

export function dominantIndex(w: number[]): number {
  let i = 0;
  for (let k = 1; k < w.length; k++) if (w[k] > w[i]) i = k;
  return i;
}
