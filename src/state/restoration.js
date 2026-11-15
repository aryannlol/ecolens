import gsap from 'gsap';

/** Single source of truth for how healthy the environment is. rd (0..1) is the *displayed* value; every visual reads it. */
export class Restoration {
  constructor() { this.rd = 0.05; this.air = 0.15; }
  tweenTo(r, duration = 1.8) { gsap.to(this, { rd: r, duration, ease: 'power2.inOut', overwrite: true }); }
  jump(r) { gsap.killTweensOf(this); this.rd = r; }
  clearAir(amount = 0.28) { this.air = Math.min(1.0, this.air + amount); }
}

/** Per-world progress. r = r0 + (1 - r0) * sorted/total, so a world's start state is always the marker's state. */
export class WorldState {
  constructor(id, def, spawnItems) {
    this.id = id; this.r0 = def.r0; this.total = def.items; this.sorted = 0; this.items = spawnItems;
  }
  get r() { return this.r0 + (1 - this.r0) * (this.sorted / this.total); }
  get remaining() { return this.items.filter((i) => !i.done); }
}
