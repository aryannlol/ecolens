import * as THREE from 'three';
import { stageToNdc } from '../util/stageMap.js';

/** Unified pointer: hand (primary) with mouse fallback. Stage coords are (0..1, y-down), NDC (-1..1, y-up). */
export class Input {
  constructor(hand, canvas) {
    this.hand = hand; this.canvas = canvas;
    this.ndc = new THREE.Vector2();
    this.stageCursor = { x: 0.5, y: 0.5 };
    this.stagePalm = { x: 0.5, y: 0.5 };
    this.brushPos = { x: 0.5, y: 0.5 };
    this.palmSpeed = 0;
    this.pinching = false; this.present = false; this.source = 'none';
    this.mouse = { x: 0.5, y: 0.5, down: false, active: false }; this.inspect = false;

    canvas.addEventListener('pointermove', (e) => { this._m(e); this.mouse.active = true; });
    canvas.addEventListener('pointerdown', (e) => { this._m(e); this.mouse.down = true; this.mouse.active = true; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointerup', () => { this.mouse.down = false; });
    canvas.addEventListener('pointerleave', () => { this.mouse.active = false; this.mouse.down = false; });
  }

  _m(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = Math.max(0, Math.min(1, (e.clientX - r.left) / (r.width || 1)));
    this.mouse.y = Math.max(0, Math.min(1, (e.clientY - r.top) / (r.height || 1)));
  }

  update() {
    if (this.hand.present) {
      this.source = 'hand'; this.present = true; this.pinching = this.hand.pinching;
      this.stageCursor = this.hand.cursor;
      this.stagePalm = this.hand.palm;
      this.brushPos = this.hand.brushPos;
      this.palmSpeed = this.hand.palmSpeed;
      const n = stageToNdc(this.stageCursor.x, this.stageCursor.y);
      this.ndc.set(n.x, n.y);
    } else if (this.mouse.active && !this.inspect) {
      this.source = 'mouse'; this.present = true; this.pinching = this.mouse.down;
      this.stageCursor = { x: this.mouse.x, y: this.mouse.y };
      this.stagePalm = this.stageCursor;
      this.brushPos = this.stageCursor;
      this.palmSpeed = 0;
      const n = stageToNdc(this.mouse.x, this.mouse.y);
      this.ndc.set(n.x, n.y);
    } else {
      this.source = 'none'; this.present = false; this.pinching = false;
    }
  }
}
