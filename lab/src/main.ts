import { SPACES } from "./audio/generateIR";
import { WallaceEngine, type Mode, type SourceKind } from "./audio/engine";
import type { InterpMethod } from "./audio/interpolate";
import { takeName } from "./audio/wav";
import { estimateRt60, formatWeights, schroederDb } from "./audio/analyze";
import { drawDecay, drawSpec, drawSquare, drawWave, squareFromEvent } from "./ui/draw";
import { Motion } from "./ui/motion";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const gate = $("#gate");
const startBtn = $("#start-btn");
const square = $<HTMLCanvasElement>("#square");
const wave = $<HTMLCanvasElement>("#wave");
const decay = $<HTMLCanvasElement>("#decay");
const spec = $<HTMLCanvasElement>("#spec");
const viewMeta = $("#view-meta");
const viewTitle = $("#view-title");
const abHint = $("#ab-hint");
const irSlots = $("#ir-slots");
const earlyVal = $("#early-val");
const recordBtn = $<HTMLButtonElement>("#record");
const recTime = $("#rec-time");
const muteBtn = $<HTMLButtonElement>("#mute");
const masterVal = $("#master-val");
const takes = $("#takes");

let recClock = 0;
let takeCount = 0;

let engine: WallaceEngine | null = null;
const motion = new Motion();
let source: SourceKind = "impulse";
let dragging = false;

function renderSlots(eng: WallaceEngine): void {
  irSlots.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const slot = eng.slots[i];
    const el = document.createElement("div");
    el.className = "ir-slot";
    el.innerHTML = `
      <header><span>${i + 1}</span><strong></strong></header>
      <p class="blurb"></p>
      <select></select>
      <button type="button">Load WAV</button>
      <input type="file" accept="audio/*" hidden />
    `;
    const strong = el.querySelector("strong")!;
    const blurb = el.querySelector(".blurb")!;
    const select = el.querySelector("select")!;
    const loadBtn = el.querySelector("button")!;
    const file = el.querySelector("input")!;

    strong.textContent = slot.name;
    blurb.textContent = slot.spec?.blurb ?? "custom file";

    for (const space of SPACES) {
      const opt = document.createElement("option");
      opt.value = space.id;
      opt.textContent = space.name;
      if (slot.spec?.id === space.id) opt.selected = true;
      select.appendChild(opt);
    }
    const custom = document.createElement("option");
    custom.value = "custom";
    custom.textContent = "Custom…";
    if (!slot.spec) custom.selected = true;
    select.appendChild(custom);

    select.addEventListener("change", () => {
      const spec = SPACES.find((s) => s.id === select.value);
      if (!spec) {
        file.click();
        return;
      }
      eng.setGenerated(i, spec);
      renderSlots(eng);
    });
    loadBtn.addEventListener("click", () => file.click());
    file.addEventListener("change", async () => {
      const f = file.files?.[0];
      if (!f) return;
      await eng.loadSlot(i, f);
      renderSlots(eng);
    });
    irSlots.appendChild(el);
  }
}

function paint(eng: WallaceEngine): void {
  const w = eng.weights();
  const ab = eng.mode === "ab" ? (eng.abSide === "mix" ? "A  mix" : "B  interp") : null;
  drawSquare(square, eng.x, eng.y, w, ab);
}

function paintIR(ir: Float32Array, sr: number, eng: WallaceEngine): void {
  drawWave(wave, ir);
  drawDecay(decay, ir);
  drawSpec(spec, ir);
  const rt = estimateRt60(schroederDb(ir, 400), ir.length / sr);
  const rtTxt = rt ? `RT60 ≈ ${rt.toFixed(2)} s` : "RT60 —";
  viewMeta.textContent = `${eng.activeLabel()}  ·  ${formatWeights(eng.weights())}  ·  ${rtTxt}`;
  viewTitle.textContent = eng.mode === "mix" ? "Mix (four rooms at once)" : "Hybrid IR";
  if (eng.mode === "ab") {
    viewTitle.textContent = eng.abSide === "mix" ? "A · Mix" : "B · Hybrid IR";
  }
}

function bind(eng: WallaceEngine): void {
  renderSlots(eng);
  paint(eng);
  eng.onHybridChange((ir, sr) => paintIR(ir, sr, eng));

  document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-mode]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const mode = btn.dataset.mode as Mode;
      eng.setMode(mode);
      abHint.hidden = mode !== "ab";
      paint(eng);
      paintIR(eng.heardIR(), eng.ctx.sampleRate, eng);
    });
  });

  $("#flip-ab").addEventListener("click", () => {
    eng.flipAB();
    paint(eng);
    paintIR(eng.heardIR(), eng.ctx.sampleRate, eng);
  });

  square.addEventListener("pointerdown", (ev) => {
    if (motion.kind !== "off") return;
    dragging = true;
    square.setPointerCapture(ev.pointerId);
    const p = squareFromEvent(square, ev);
    motion.setPoint(p.x, p.y);
    eng.setPosition(p.x, p.y);
    paint(eng);
  });
  square.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    const p = squareFromEvent(square, ev);
    motion.setPoint(p.x, p.y);
    eng.setPosition(p.x, p.y);
    paint(eng);
  });
  square.addEventListener("pointerup", () => {
    dragging = false;
  });

  $("#transition").addEventListener("change", (ev) => {
    motion.kind = (ev.target as HTMLSelectElement).value as Motion["kind"];
    dragging = false;
  });
  $("#rate").addEventListener("input", (ev) => {
    motion.rate = Number((ev.target as HTMLInputElement).value);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-source]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll("[data-source]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      source = btn.dataset.source as SourceKind;
      if (source === "file") {
        $("#file").click();
        return;
      }
      await eng.startSource(source);
    });
  });

  $("#fire").addEventListener("click", () => {
    if (source === "none") return;
    if (source === "noise") eng.fireNoiseBurst();
    else eng.fireImpulse();
  });
  $("#open-file").addEventListener("click", () => $("#file").click());
  $("#file").addEventListener("change", async () => {
    const f = ($("#file") as HTMLInputElement).files?.[0];
    if (!f) return;
    await eng.loadFile(f);
    source = "file";
    document.querySelectorAll("[data-source]").forEach((b) => b.classList.remove("active"));
    document.querySelector("[data-source=file]")?.classList.add("active");
  });

  $("#dry").addEventListener("input", (ev) => eng.setDry(Number((ev.target as HTMLInputElement).value)));
  $("#wet").addEventListener("input", (ev) => eng.setWet(Number((ev.target as HTMLInputElement).value)));
  $("#method").addEventListener("change", (ev) => {
    eng.setMethod((ev.target as HTMLSelectElement).value as InterpMethod);
  });
  $("#early").addEventListener("input", (ev) => {
    const ms = Number((ev.target as HTMLInputElement).value);
    earlyVal.textContent = `${ms} ms`;
    eng.setEarlyMs(ms);
  });
  $("#preview-ir").addEventListener("click", () => eng.playHybrid());

  recordBtn.addEventListener("click", () => toggleRecord(eng));
  muteBtn.addEventListener("click", () => toggleMute(eng));
  $("#master").addEventListener("input", (ev) => {
    const v = Number((ev.target as HTMLInputElement).value);
    masterVal.textContent = v.toFixed(2);
    eng.setMaster(v);
  });

  window.addEventListener("keydown", (ev) => {
    if (isTyping(ev)) return;
    if (ev.code === "KeyR") {
      ev.preventDefault();
      toggleRecord(eng);
      return;
    }
    if (ev.code === "KeyM") {
      ev.preventDefault();
      toggleMute(eng);
      return;
    }
    if (ev.code !== "Space") return;
    ev.preventDefault();
    if (eng.mode === "ab") {
      eng.flipAB();
      paint(eng);
      paintIR(eng.heardIR(), eng.ctx.sampleRate, eng);
    } else if (source !== "none") {
      if (source === "noise") eng.fireNoiseBurst();
      else eng.fireImpulse();
    }
  });

  motion.start((x, y) => {
    if (motion.kind === "off") return;
    eng.setPosition(x, y);
    paint(eng);
  });
}

async function boot(): Promise<void> {
  const ctx = new AudioContext();
  try {
    await ctx.resume();
  } catch {
    /* Headless or autoplay-blocked contexts stay suspended until a gesture. */
  }
  engine = new WallaceEngine(ctx);
  bind(engine);
  if (ctx.state === "running") engine.fireImpulse();
  gate.classList.add("hidden");
}

startBtn.addEventListener("click", () => {
  void boot().catch((err) => {
    startBtn.textContent = err instanceof Error ? err.message : String(err);
  });
});

function isTyping(ev: KeyboardEvent): boolean {
  const el = ev.target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA");
}

function formatClock(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function toggleMute(eng: WallaceEngine): void {
  eng.setMuted(!eng.muted);
  muteBtn.classList.toggle("active", eng.muted);
  muteBtn.textContent = eng.muted ? "Muted" : "Mute";
}

function toggleRecord(eng: WallaceEngine): void {
  if (eng.recording) {
    const take = eng.stopRecording();
    window.clearInterval(recClock);
    recordBtn.classList.remove("recording");
    recordBtn.textContent = "Record";
    recTime.textContent = "00:00";
    if (!take) return;
    takeCount += 1;
    const name = takeName();
    const url = URL.createObjectURL(take.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.textContent = `Take ${takeCount} · ${formatClock(take.seconds)} · WAV`;
    takes.hidden = false;
    takes.appendChild(link);
    link.click();
    return;
  }
  eng.startRecording();
  recordBtn.classList.add("recording");
  recordBtn.textContent = "Stop";
  recClock = window.setInterval(() => {
    recTime.textContent = formatClock(eng.recordedSeconds());
  }, 200);
}

if (new URLSearchParams(location.search).has("autostart")) {
  void boot().catch((err) => {
    startBtn.textContent = err instanceof Error ? err.message : String(err);
  });
}
