import { downsample, schroederDb, spectrogram } from "../audio/analyze";
import { SPEAKERS } from "../audio/weights";

export function drawSquare(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  weights: number[],
  abLabel: string | null,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const pad = 36;
  const s = w - pad * 2;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f4efe4";
  ctx.fillRect(pad, pad, s, s);
  ctx.strokeStyle = "#2a241c";
  ctx.lineWidth = 2;
  ctx.strokeRect(pad, pad, s, s);

  ctx.strokeStyle = "rgba(42,36,28,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad + s / 2, pad);
  ctx.lineTo(pad + s / 2, pad + s);
  ctx.moveTo(pad, pad + s / 2);
  ctx.lineTo(pad + s, pad + s / 2);
  ctx.stroke();

  SPEAKERS.forEach(([sx, sy], i) => {
    const px = pad + sx * s;
    const py = pad + sy * s;
    const r = 10 + weights[i] * 14;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(176, 72, 32, ${0.18 + weights[i] * 0.7})`;
    ctx.fill();
    ctx.strokeStyle = "#2a241c";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  const cx = pad + x * s;
  const cy = pad + y * s;
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#14110e";
  ctx.fill();

  if (abLabel) {
    ctx.fillStyle = "#b04820";
    ctx.font = "700 18px Iowan Old Style, Palatino, Georgia, serif";
    ctx.fillText(abLabel, pad + 12, pad + 28);
  }
}

export function drawWave(canvas: HTMLCanvasElement, ir: Float32Array): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#1a1612";
  ctx.fillRect(0, 0, w, h);
  const peaks = downsample(ir, w);
  ctx.strokeStyle = "#e6d7b8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const mid = h / 2;
  for (let i = 0; i < peaks.length; i++) {
    const y = peaks[i] * (h * 0.46);
    ctx.moveTo(i, mid - y);
    ctx.lineTo(i, mid + y);
  }
  ctx.stroke();
}

export function drawDecay(canvas: HTMLCanvasElement, ir: Float32Array): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#1a1612";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(230,215,184,0.15)";
  ctx.beginPath();
  for (const db of [-20, -40, -60]) {
    const y = ((-db) / 80) * (h - 16) + 8;
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();

  const curve = schroederDb(ir, w);
  ctx.strokeStyle = "#d97a45";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < curve.length; i++) {
    const y = 8 + ((-curve[i]) / 80) * (h - 16);
    const yy = Math.min(h - 2, Math.max(2, y));
    if (i === 0) ctx.moveTo(i, yy);
    else ctx.lineTo(i, yy);
  }
  ctx.stroke();

  ctx.fillStyle = "rgba(230,215,184,0.45)";
  ctx.font = "11px ui-monospace, Menlo, monospace";
  ctx.fillText("0 dB", 8, 14);
  ctx.fillText("−60", 8, h - 8);
}

export function drawSpec(canvas: HTMLCanvasElement, ir: Float32Array): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const frames = w;
  const bins = 72;
  const spec = spectrogram(ir, bins, frames);
  const img = ctx.createImageData(w, h);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < spec.length; i++) {
    min = Math.min(min, spec[i]);
    max = Math.max(max, spec[i]);
  }
  const span = Math.max(1e-6, max - min);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const b = Math.min(bins - 1, Math.floor(((h - 1 - y) / h) * bins));
      const v = (spec[x * bins + b] - min) / span;
      const i = (y * w + x) * 4;
      img.data[i] = 26 + v * 200;
      img.data[i + 1] = 20 + v * 110;
      img.data[i + 2] = 16 + v * 40;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function squareFromEvent(canvas: HTMLCanvasElement, ev: PointerEvent): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  const pad = 36 * (r.width / canvas.width);
  const s = r.width - pad * 2;
  return {
    x: clamp01((ev.clientX - r.left - pad) / s),
    y: clamp01((ev.clientY - r.top - pad) / s),
  };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
