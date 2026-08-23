import { fftReal, nextPow2 } from "./fft";

export function downsample(ir: Float32Array, points: number): Float32Array {
  const out = new Float32Array(points);
  const step = ir.length / points;
  for (let i = 0; i < points; i++) {
    const a = Math.floor(i * step);
    const b = Math.min(ir.length, Math.floor((i + 1) * step));
    let peak = 0;
    for (let j = a; j < b; j++) peak = Math.max(peak, Math.abs(ir[j]));
    out[i] = peak;
  }
  return out;
}

/** Schroeder backwards integration, in dB. */
export function schroederDb(ir: Float32Array, points = 240): Float32Array {
  const n = ir.length;
  const energy = new Float64Array(n);
  let acc = 0;
  for (let i = n - 1; i >= 0; i--) {
    acc += ir[i] * ir[i];
    energy[i] = acc;
  }
  const max = energy[0] || 1;
  const out = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const idx = Math.min(n - 1, Math.floor((i / (points - 1)) * (n - 1)));
    out[i] = 10 * Math.log10(energy[idx] / max + 1e-12);
  }
  return out;
}

export function spectrogram(ir: Float32Array, bins = 64, frames = 160): Float32Array {
  const win = nextPow2(Math.max(64, Math.floor(ir.length / frames) * 2));
  const hop = Math.max(1, Math.floor((ir.length - win) / Math.max(1, frames - 1)));
  const out = new Float32Array(frames * bins);
  const window = new Float32Array(win);
  for (let i = 0; i < win; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1));

  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    const frame = new Float32Array(win);
    for (let i = 0; i < win && start + i < ir.length; i++) frame[i] = ir[start + i] * window[i];
    const { re, im } = fftReal(frame, win);
    for (let b = 0; b < bins; b++) {
      const k0 = Math.floor((b / bins) * (win / 2));
      const k1 = Math.floor(((b + 1) / bins) * (win / 2));
      let e = 0;
      for (let k = k0; k < Math.max(k0 + 1, k1); k++) e += re[k] * re[k] + im[k] * im[k];
      out[f * bins + b] = 10 * Math.log10(e + 1e-12);
    }
  }
  return out;
}

export function estimateRt60(decayDb: Float32Array, durationSec: number): number | null {
  let i5 = -1;
  let i25 = -1;
  for (let i = 0; i < decayDb.length; i++) {
    if (i5 < 0 && decayDb[i] <= -5) i5 = i;
    if (i25 < 0 && decayDb[i] <= -25) i25 = i;
  }
  if (i5 < 0 || i25 < 0 || i25 <= i5) return null;
  const t = ((i25 - i5) / (decayDb.length - 1)) * durationSec;
  return t * 3;
}

export function formatWeights(w: number[]): string {
  return w.map((v, i) => `${i + 1}:${(v * 100).toFixed(0)}%`).join("  ");
}
