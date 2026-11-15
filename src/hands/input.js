import * as THREE from 'three';

/** Unified pointer: hand (primary) with mouse fallback. Cursor is in NDC (-1..1, y up). */
export class Input {
  constructor(hand, canvas) {
    this.hand = hand; this.canvas = canvas;
    this.ndc = new THREE.Vector2(); this.pinching = false; this.present = false; this.source = 'none';
    this.mouse = { x: 0, y: 0, down: false, active: false }; this.inspect = false;
    canvas.addEventListener('pointermove', (e) => { this._m(e); this.mouse.active = true; });
    canvas.addEventListener('pointerdown', (e) => { this._m(e); this.mouse.down = true; this.mouse.active = true; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointerup', () => { this.mouse.down = false; });
    canvas.addEventListener('pointerleave', () => { this.mouse.active = false; this.mouse.down = false; });
  }
  _m(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.mouse.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
  }
  update() {
    if (this.hand.present) {
      this.source = 'hand'; this.present = true; this.pinching = this.hand.pinching;
      this.ndc.set(this.hand.cursor.x * 2 - 1, -(this.hand.cursor.y * 2 - 1));
    } else if (this.mouse.active && !this.inspect) {
      this.source = 'mouse'; this.present = true; this.pinching = this.mouse.down; this.ndc.set(this.mouse.x, this.mouse.y);
    } else { this.source = 'none'; this.present = false; this.pinching = false; }
  }
}
