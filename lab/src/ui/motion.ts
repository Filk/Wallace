export type Transition = "off" | "circular" | "rectilinear" | "random";

export class Motion {
  kind: Transition = "off";
  rate = 0.12;
  x = 0.5;
  y = 0.5;
  private phase = 0;
  private last = 0;
  private targetX = 0.8;
  private targetY = 0.2;
  private raf = 0;

  start(onMove: (x: number, y: number) => void): void {
    const tick = (t: number) => {
      const dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 0;
      this.last = t;
      this.step(dt);
      onMove(this.x, this.y);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.last = 0;
  }

  setPoint(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  private step(dt: number): void {
    if (this.kind === "off") return;
    this.phase += dt * this.rate * Math.PI * 2;

    if (this.kind === "circular") {
      this.x = 0.5 + Math.cos(this.phase) * 0.42;
      this.y = 0.5 + Math.sin(this.phase) * 0.42;
      return;
    }

    if (this.kind === "rectilinear") {
      const u = 0.5 + 0.5 * Math.sin(this.phase);
      this.x = 0.08 + u * 0.84;
      this.y = 0.5;
      return;
    }

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const d = Math.hypot(dx, dy);
    const step = dt * (0.15 + this.rate * 1.1);
    if (d < 0.02) {
      this.targetX = 0.08 + Math.random() * 0.84;
      this.targetY = 0.08 + Math.random() * 0.84;
      return;
    }
    this.x += (dx / d) * Math.min(d, step);
    this.y += (dy / d) * Math.min(d, step);
  }
}
