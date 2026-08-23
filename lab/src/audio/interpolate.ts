import { fft, ifft, nextPow2 } from "./fft";
import { dominantIndex } from "./weights";

export type InterpMethod = "early-late" | "log-mag" | "time";

const EPS = 1e-8;

function energy(x: Float32Array): number {
  let e = 0;
  for (let i = 0; i < x.length; i++) e += x[i] * x[i];
  return e;
}

function normalizeTo(target: Float32Array, refs: Float32Array[], w: number[]): void {
  let te = 0;
  for (let i = 0; i < refs.length; i++) te += w[i] * energy(refs[i]);
  const he = energy(target);
  if (he < EPS || te < EPS) return;
  const g = Math.sqrt(te / he);
  for (let i = 0; i < target.length; i++) target[i] *= g;
}

function timeMix(irs: Float32Array[], w: number[], n: number): Float32Array {
  const out = new Float32Array(n);
  for (let k = 0; k < irs.length; k++) {
    const ir = irs[k];
    const g = w[k];
    if (g < 1e-5) continue;
    const m = Math.min(n, ir.length);
    for (let i = 0; i < m; i++) out[i] += ir[i] * g;
  }
  return out;
}

function spectralMorph(irs: Float32Array[], w: number[], n: number): Float32Array {
  const nfft = nextPow2(n);
  const logMag = new Float64Array(nfft);
  const phases: { re: Float64Array; im: Float64Array }[] = [];

  for (let k = 0; k < irs.length; k++) {
    const re = new Float64Array(nfft);
    const im = new Float64Array(nfft);
    const src = irs[k];
    const m = Math.min(src.length, nfft);
    for (let i = 0; i < m; i++) re[i] = src[i];
    fft(re, im);
    phases.push({ re, im });
    const wk = w[k];
    for (let i = 0; i < nfft; i++) {
      const mag = Math.hypot(re[i], im[i]);
      logMag[i] += wk * Math.log(mag + EPS);
    }
  }

  const dom = phases[dominantIndex(w)];
  const re = new Float64Array(nfft);
  const im = new Float64Array(nfft);
  for (let i = 0; i < nfft; i++) {
    const mag = Math.exp(logMag[i]);
    const pr = dom.re[i];
    const pi = dom.im[i];
    const pmag = Math.hypot(pr, pi) + EPS;
    re[i] = (mag * pr) / pmag;
    im[i] = (mag * pi) / pmag;
  }
  ifft(re, im);

  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = re[i];
  return out;
}

export function interpolateIRs(
  irs: Float32Array[],
  w: number[],
  sr: number,
  method: InterpMethod,
  earlyMs: number,
): Float32Array {
  const n = irs.reduce((m, ir) => Math.max(m, ir.length), 0);
  if (n === 0) return new Float32Array(1);

  let out: Float32Array;
  if (method === "time") {
    out = timeMix(irs, w, n);
  } else if (method === "log-mag") {
    out = spectralMorph(irs, w, n);
  } else {
    const earlyN = Math.max(8, Math.round((earlyMs / 1000) * sr));
    const early = timeMix(irs, w, Math.min(earlyN, n));
    const tails = irs.map((ir) => ir.subarray(Math.min(ir.length, earlyN)));
    const tailN = Math.max(1, n - earlyN);
    const tail = spectralMorph(tails, w, tailN);
    out = new Float32Array(earlyN + tail.length);
    out.set(early, 0);
    out.set(tail, earlyN);
  }

  normalizeTo(out, irs, w);
  return out;
}
