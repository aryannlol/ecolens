// One-Euro filter: low jitter when still, low lag when moving.
class LowPass {
  constructor() { this.y = null; }
  filter(x, alpha) { this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y; return this.y; }
}
const alphaOf = (cutoff, dt) => 1 / (1 + 1 / (2 * Math.PI * cutoff) / dt);

export class OneEuro {
  constructor(minCutoff = 1.2, beta = 0.02, dCutoff = 1.0) {
    this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff;
    this.x = new LowPass(); this.dx = new LowPass(); this.last = null; this.prev = null;
  }
  reset() { this.x = new LowPass(); this.dx = new LowPass(); this.last = null; this.prev = null; }
  filter(value, tMs) {
    const dt = this.last === null ? 1 / 30 : Math.max((tMs - this.last) / 1000, 1e-3);
    this.last = tMs;
    const d = this.prev === null ? 0 : (value - this.prev) / dt;
    this.prev = value;
    const ed = this.dx.filter(d, alphaOf(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(ed);
    return this.x.filter(value, alphaOf(cutoff, dt));
  }
}
