export type SpaceSpec = {
  id: string;
  name: string;
  blurb: string;
  duration: number;
  rt60: number;
  cutoff: number;
  lateCutoff: number;
  early: [number, number][];
};

export const SPACES: SpaceSpec[] = [
  {
    id: "tile",
    name: "Tile room",
    blurb: "short · bright",
    duration: 0.55,
    rt60: 0.38,
    cutoff: 9000,
    lateCutoff: 5000,
    early: [
      [0.005, 0.72],
      [0.009, 0.48],
      [0.014, 0.32],
      [0.021, 0.2],
      [0.029, 0.12],
    ],
  },
  {
    id: "chamber",
    name: "Chamber",
    blurb: "medium · neutral",
    duration: 1.15,
    rt60: 0.95,
    cutoff: 5200,
    lateCutoff: 2800,
    early: [
      [0.008, 0.55],
      [0.015, 0.38],
      [0.024, 0.28],
      [0.036, 0.18],
      [0.05, 0.1],
    ],
  },
  {
    id: "hall",
    name: "Hall",
    blurb: "long · warm",
    duration: 2.1,
    rt60: 1.85,
    cutoff: 3200,
    lateCutoff: 1400,
    early: [
      [0.012, 0.42],
      [0.023, 0.3],
      [0.038, 0.22],
      [0.055, 0.14],
      [0.078, 0.08],
    ],
  },
  {
    id: "nave",
    name: "Nave",
    blurb: "very long · dark",
    duration: 2.8,
    rt60: 2.7,
    cutoff: 1800,
    lateCutoff: 700,
    early: [
      [0.018, 0.35],
      [0.034, 0.24],
      [0.056, 0.16],
      [0.082, 0.1],
      [0.12, 0.06],
    ],
  },
];

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function onePole(x: Float32Array, cutoff: number, sr: number): void {
  const a = Math.exp((-2 * Math.PI * cutoff) / sr);
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    y = (1 - a) * x[i] + a * y;
    x[i] = y;
  }
}

export function generateIR(spec: SpaceSpec, sr: number, seed = 1): Float32Array {
  const n = Math.floor(spec.duration * sr);
  const ir = new Float32Array(n);
  const rnd = mulberry32(seed + spec.id.length * 97);

  ir[0] = 0.08;
  for (const [t, g] of spec.early) {
    const i = Math.min(n - 1, Math.round(t * sr));
    ir[i] += g * (rnd() > 0.5 ? 1 : -1);
  }

  const start = Math.round(0.02 * sr);
  for (let i = start; i < n; i++) {
    const t = i / sr;
    const env = Math.pow(10, (-3 * t) / spec.rt60);
    ir[i] += (rnd() * 2 - 1) * env * 0.22;
  }

  onePole(ir, spec.cutoff, sr);

  const late = Math.round(0.12 * sr);
  for (let i = late; i < n; i++) {
    const u = (i - late) / (n - late);
    const cut = spec.cutoff + (spec.lateCutoff - spec.cutoff) * u;
    const a = Math.exp((-2 * Math.PI * cut) / sr);
    if (i > 0) ir[i] = (1 - a) * ir[i] + a * ir[i - 1];
  }

  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(ir[i]));
  if (peak > 0) {
    const g = 0.92 / peak;
    for (let i = 0; i < n; i++) ir[i] *= g;
  }
  return ir;
}

export function toBuffer(ctx: BaseAudioContext, samples: Float32Array): AudioBuffer {
  const buf = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buf.getChannelData(0).set(samples);
  return buf;
}

export function fromBuffer(buf: AudioBuffer, maxSeconds = 3): Float32Array {
  const n = Math.min(buf.length, Math.floor(buf.sampleRate * maxSeconds));
  const out = new Float32Array(n);
  const ch0 = buf.getChannelData(0);
  if (buf.numberOfChannels === 1) {
    out.set(ch0.subarray(0, n));
    return out;
  }
  const ch1 = buf.getChannelData(1);
  for (let i = 0; i < n; i++) out[i] = 0.5 * (ch0[i] + ch1[i]);
  return out;
}
