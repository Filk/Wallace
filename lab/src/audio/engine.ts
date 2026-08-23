import { fromBuffer, generateIR, SPACES, toBuffer, type SpaceSpec } from "./generateIR";
import { interpolateIRs, type InterpMethod } from "./interpolate";
import { concatFloat32, encodeWav } from "./wav";
import { weightsAt } from "./weights";

export type Mode = "mix" | "interp" | "ab";
export type SourceKind = "none" | "impulse" | "noise" | "pulse" | "file" | "mic";

export type Slot = {
  spec: SpaceSpec | null;
  name: string;
  samples: Float32Array;
  buffer: AudioBuffer;
};

const FADE = 0.04;

export class WallaceEngine {
  readonly ctx: AudioContext;
  readonly slots: Slot[] = [];

  mode: Mode = "mix";
  abSide: "mix" | "interp" = "mix";
  method: InterpMethod = "early-late";
  earlyMs = 40;
  x = 0.5;
  y = 0.5;

  hybrid: Float32Array = new Float32Array(1);
  mixIR: Float32Array = new Float32Array(1);

  private input: GainNode;
  private dry: GainNode;
  private mixBus: GainNode;
  private interpBus: GainNode;
  private wet: GainNode;
  private master: GainNode;
  private muteGain: GainNode;
  private capture: ScriptProcessorNode;
  private captureSink: GainNode;
  private mixConv: ConvolverNode[] = [];
  private mixGain: GainNode[] = [];
  private interpA: ConvolverNode;
  private interpB: ConvolverNode;
  private fadeA: GainNode;
  private fadeB: GainNode;
  private usingA = true;
  private fileBuffer: AudioBuffer | null = null;
  private fileSource: AudioBufferSourceNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micStream: MediaStream | null = null;
  private pulse: OscillatorNode | null = null;
  private noise: AudioBufferSourceNode | null = null;
  private rebuildTimer = 0;
  private onHybrid: ((ir: Float32Array, sr: number) => void) | null = null;
  private recChunks: Float32Array[] = [];
  private recStartedAt = 0;
  recording = false;
  muted = false;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.dry = ctx.createGain();
    this.mixBus = ctx.createGain();
    this.interpBus = ctx.createGain();
    this.wet = ctx.createGain();
    this.master = ctx.createGain();
    this.muteGain = ctx.createGain();
    this.captureSink = ctx.createGain();
    this.capture = ctx.createScriptProcessor(4096, 1, 1);

    this.input.connect(this.dry);
    this.dry.connect(this.master);
    this.mixBus.connect(this.wet);
    this.interpBus.connect(this.wet);
    this.wet.connect(this.master);
    this.master.connect(this.muteGain);
    this.muteGain.connect(ctx.destination);

    this.master.connect(this.capture);
    this.capture.connect(this.captureSink);
    this.captureSink.gain.value = 0;
    this.captureSink.connect(ctx.destination);
    this.capture.onaudioprocess = (ev) => {
      if (!this.recording) return;
      this.recChunks.push(new Float32Array(ev.inputBuffer.getChannelData(0)));
    };

    this.dry.gain.value = 0.05;
    this.wet.gain.value = 0.85;
    this.master.gain.value = 0.9;

    for (let i = 0; i < 4; i++) {
      const c = ctx.createConvolver();
      const g = ctx.createGain();
      this.input.connect(c);
      c.connect(g);
      g.connect(this.mixBus);
      this.mixConv.push(c);
      this.mixGain.push(g);
    }

    this.interpA = ctx.createConvolver();
    this.interpB = ctx.createConvolver();
    this.fadeA = ctx.createGain();
    this.fadeB = ctx.createGain();
    this.input.connect(this.interpA);
    this.input.connect(this.interpB);
    this.interpA.connect(this.fadeA).connect(this.interpBus);
    this.interpB.connect(this.fadeB).connect(this.interpBus);
    this.fadeA.gain.value = 1;
    this.fadeB.gain.value = 0;

    SPACES.forEach((spec, i) => this.setGenerated(i, spec));
    this.applyMixWeights();
    this.applyModeGains(true);
    this.rebuildHybrid(true);
  }

  onHybridChange(cb: (ir: Float32Array, sr: number) => void): void {
    this.onHybrid = cb;
    cb(this.hybrid, this.ctx.sampleRate);
  }

  setDry(v: number): void {
    this.dry.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  setWet(v: number): void {
    this.wet.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  setMaster(v: number): void {
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  setMuted(on: boolean): void {
    this.muted = on;
    this.muteGain.gain.setTargetAtTime(on ? 0 : 1, this.ctx.currentTime, 0.012);
  }

  startRecording(): void {
    if (this.recording) return;
    this.recChunks = [];
    this.recStartedAt = this.ctx.currentTime;
    this.recording = true;
  }

  stopRecording(): { blob: Blob; seconds: number } | null {
    if (!this.recording) return null;
    this.recording = false;
    const seconds = Math.max(0, this.ctx.currentTime - this.recStartedAt);
    const samples = concatFloat32(this.recChunks);
    this.recChunks = [];
    if (samples.length === 0) return null;
    return { blob: encodeWav(samples, this.ctx.sampleRate), seconds };
  }

  recordedSeconds(): number {
    if (!this.recording) return 0;
    return Math.max(0, this.ctx.currentTime - this.recStartedAt);
  }

  setPosition(x: number, y: number): void {
    this.x = clamp01(x);
    this.y = clamp01(y);
    this.applyMixWeights();
    this.scheduleHybrid();
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    if (mode !== "ab") this.abSide = mode === "interp" ? "interp" : "mix";
    this.applyModeGains(false);
  }

  flipAB(): void {
    if (this.mode !== "ab") return;
    this.abSide = this.abSide === "mix" ? "interp" : "mix";
    this.applyModeGains(false);
  }

  setMethod(method: InterpMethod): void {
    this.method = method;
    this.scheduleHybrid();
  }

  setEarlyMs(ms: number): void {
    this.earlyMs = ms;
    this.scheduleHybrid();
  }

  setGenerated(index: number, spec: SpaceSpec): void {
    const samples = generateIR(spec, this.ctx.sampleRate, index + 3);
    this.installSlot(index, {
      spec,
      name: spec.name,
      samples,
      buffer: toBuffer(this.ctx, samples),
    });
  }

  async loadSlot(index: number, file: File): Promise<void> {
    const raw = await file.arrayBuffer();
    const decoded = await this.ctx.decodeAudioData(raw.slice(0));
    const samples = fromBuffer(decoded);
    this.installSlot(index, {
      spec: null,
      name: file.name.replace(/\.[^.]+$/, ""),
      samples,
      buffer: toBuffer(this.ctx, samples),
    });
  }

  async loadFile(file: File): Promise<void> {
    const raw = await file.arrayBuffer();
    this.fileBuffer = await this.ctx.decodeAudioData(raw.slice(0));
    this.startSource("file");
  }

  async startSource(kind: SourceKind): Promise<void> {
    this.stopSources();
    if (kind === "none" || kind === "impulse") return;
    if (kind === "file") {
      if (!this.fileBuffer) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.fileBuffer;
      src.loop = true;
      src.connect(this.input);
      src.start();
      this.fileSource = src;
      return;
    }
    if (kind === "mic") {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      this.micSource = this.ctx.createMediaStreamSource(this.micStream);
      this.micSource.connect(this.input);
      return;
    }
    if (kind === "pulse") {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = 220;
      g.gain.value = 0.08;
      osc.connect(g).connect(this.input);
      osc.start();
      this.pulse = osc;
    }
    if (kind === "noise") {
      const src = this.ctx.createBufferSource();
      src.buffer = this.makeNoise(2);
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.value = 0.12;
      src.connect(g).connect(this.input);
      src.start();
      this.noise = src;
    }
  }

  fireImpulse(): void {
    const n = Math.round(this.ctx.sampleRate * 0.02);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    d[0] = 0.95;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.input);
    src.start();
  }

  fireNoiseBurst(): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.makeNoise(0.18);
    const g = this.ctx.createGain();
    g.gain.value = 0.35;
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
    src.connect(g).connect(this.input);
    src.start();
  }

  playHybrid(): void {
    const src = this.ctx.createBufferSource();
    src.buffer = toBuffer(this.ctx, this.heardIR());
    const g = this.ctx.createGain();
    g.gain.value = 0.7;
    src.connect(g).connect(this.master);
    src.start();
  }

  hearingMix(): boolean {
    return this.mode === "mix" || (this.mode === "ab" && this.abSide === "mix");
  }

  heardIR(): Float32Array {
    return this.hearingMix() ? this.mixIR : this.hybrid;
  }

  activeLabel(): string {
    if (this.mode === "ab") return this.abSide === "mix" ? "A · Mix" : "B · Interpolate";
    return this.mode === "mix" ? "Mix" : "Interpolate";
  }

  weights(): [number, number, number, number] {
    return weightsAt(this.x, this.y);
  }

  private installSlot(index: number, slot: Slot): void {
    this.slots[index] = slot;
    this.mixConv[index].buffer = slot.buffer;
    this.scheduleHybrid();
  }

  private applyMixWeights(): void {
    const w = this.weights();
    const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) this.mixGain[i].gain.setTargetAtTime(w[i], t, 0.015);
  }

  private applyModeGains(instant: boolean): void {
    const t = this.ctx.currentTime;
    const hearMix = this.mode === "mix" || (this.mode === "ab" && this.abSide === "mix");
    const mix = hearMix ? 1 : 0;
    const interp = hearMix ? 0 : 1;
    if (instant) {
      this.mixBus.gain.value = mix;
      this.interpBus.gain.value = interp;
      return;
    }
    this.mixBus.gain.setTargetAtTime(mix, t, 0.012);
    this.interpBus.gain.setTargetAtTime(interp, t, 0.012);
  }

  private scheduleHybrid(): void {
    window.clearTimeout(this.rebuildTimer);
    this.rebuildTimer = window.setTimeout(() => this.rebuildHybrid(false), 70);
  }

  private rebuildHybrid(instant: boolean): void {
    if (this.slots.length < 4 || this.slots.some((s) => !s)) return;
    const samples = this.slots.map((s) => s.samples);
    const w = this.weights();
    const sr = this.ctx.sampleRate;
    this.mixIR = interpolateIRs(samples, w, sr, "time", this.earlyMs);
    this.hybrid = interpolateIRs(samples, w, sr, this.method, this.earlyMs);
    const buf = toBuffer(this.ctx, this.hybrid);
    const t = this.ctx.currentTime;
    if (instant) {
      this.interpA.buffer = buf;
      this.fadeA.gain.value = 1;
      this.fadeB.gain.value = 0;
      this.usingA = true;
    } else if (this.usingA) {
      this.interpB.buffer = buf;
      this.fadeB.gain.cancelScheduledValues(t);
      this.fadeA.gain.cancelScheduledValues(t);
      this.fadeB.gain.setValueAtTime(this.fadeB.gain.value, t);
      this.fadeA.gain.setValueAtTime(this.fadeA.gain.value, t);
      this.fadeB.gain.linearRampToValueAtTime(1, t + FADE);
      this.fadeA.gain.linearRampToValueAtTime(0, t + FADE);
      this.usingA = false;
    } else {
      this.interpA.buffer = buf;
      this.fadeA.gain.cancelScheduledValues(t);
      this.fadeB.gain.cancelScheduledValues(t);
      this.fadeA.gain.setValueAtTime(this.fadeA.gain.value, t);
      this.fadeB.gain.setValueAtTime(this.fadeB.gain.value, t);
      this.fadeA.gain.linearRampToValueAtTime(1, t + FADE);
      this.fadeB.gain.linearRampToValueAtTime(0, t + FADE);
      this.usingA = true;
    }
    this.onHybrid?.(this.heardIR(), this.ctx.sampleRate);
  }

  private makeNoise(seconds: number): AudioBuffer {
    const n = Math.round(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private stopSources(): void {
    this.fileSource?.stop();
    this.fileSource?.disconnect();
    this.fileSource = null;
    this.pulse?.stop();
    this.pulse?.disconnect();
    this.pulse = null;
    this.noise?.stop();
    this.noise?.disconnect();
    this.noise = null;
    this.micSource?.disconnect();
    this.micSource = null;
    this.micStream?.getTracks().forEach((tr) => tr.stop());
    this.micStream = null;
  }
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
