import { weightsAt } from "./audio/weights";
import { generateIR, SPACES } from "./audio/generateIR";
import { interpolateIRs } from "./audio/interpolate";
import { encodeWav } from "./audio/wav";

const left = weightsAt(0, 0.5);
const center = weightsAt(0.5, 0.5);
if (left[0] < 0.7) throw new Error(`left speaker not isolated: ${left}`);
if (Math.max(...center) - Math.min(...center) > 0.02) {
  throw new Error(`center not even: ${center}`);
}

const sr = 44100;
const irs = SPACES.map((s) => generateIR(s, sr));
const mix = interpolateIRs(irs, [...center], sr, "time", 40);
const morph = interpolateIRs(irs, [...center], sr, "log-mag", 40);
let diff = 0;
const n = Math.min(mix.length, morph.length);
for (let i = 0; i < n; i++) diff += Math.abs(mix[i] - morph[i]);
if (diff / n < 1e-4) throw new Error("interpolation collapsed to mix");

console.log("weights left", left.map((v) => v.toFixed(2)).join(" "));
console.log("weights center", center.map((v) => v.toFixed(2)).join(" "));
console.log("mix vs log-mag mean abs", (diff / n).toFixed(5));
const wav = encodeWav(new Float32Array([0, 0.5, -0.5, 1]), 44100);
if (wav.type !== "audio/wav" || wav.size !== 44 + 8) throw new Error("wav size");
const hdr = new Uint8Array(await wav.arrayBuffer());
const tag = String.fromCharCode(...hdr.subarray(0, 4));
if (tag !== "RIFF") throw new Error("wav header");

console.log("ok");
