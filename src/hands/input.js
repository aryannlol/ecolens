import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Reach: the hand can't physically get to the very edge of the camera frame (tracking is lost as it leaves the picture), so the
// cursor/brush move REACH times faster than the hand around the screen centre and clamp at the edges. The hand skeleton overlay
// still shows the true hand position. Default 1.4; override with ?reach=1.2 (less) .. 2 (more); 1 turns it off.
const REACH = (() => { const n = parseFloat(new URLSearchParams(location.search).get('reach')); return Number.isFinite(n) && n >= 1 && n <= 3 ? n : 1.4; })();
const REACH_X = REACH, REACH_Y = 1 + (REACH - 1) * 0.75;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const reach = (p) => ({ x: clamp01(0.5 + (p.x - 0.5) * REACH_X), y: clamp01(0.5 + (p.y - 0.5) * REACH_Y) });

/** Unified pointer: hand (primary) with mouse fallback. Cursor is in NDC (-1..1, y up). */
export class Input {
  constructor(hand, canvas, stage = null) {
    this.hand = hand; this.canvas = canvas; this.stage = stage;
    this.ndc = new THREE.Vector2(); this.rayNdc = new THREE.Vector2(); this.palmNdc = new THREE.Vector2(); this.pinching = false; this.present = false; this.source = 'none';
    this.mouse = { x: 0, y: 0, down: false, active: false }; this.inspect = false;
    canvas.addEventListener('pointermove', (e) => { this._m(e); this.mouse.active = true; });
    canvas.addEventListener('pointerdown', (e) => { this._m(e); this.mouse.down = true; this.mouse.active = true; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointerup', () => { this.mouse.down = false; });
    canvas.addEventListener('pointerleave', () => { this.mouse.active = false; this.mouse.down = false; });
  }
  _m(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    this.mouse.y = Math.max(-1, Math.min(1, -(((e.clientY - r.top) / r.height) * 2 - 1)));
  }
  update(dt = 1 / 60) {
    if (this.hand.present) {
      this.source = 'hand'; this.present = true; this.pinching = this.hand.pinching;
      let sx, sy;
      if (this.stage && this.hand.rawVideoCursor) {
        const pt = reach(this.stage.videoToStage(this.hand.rawVideoCursor.x, this.hand.rawVideoCursor.y));
        sx = pt.x; sy = pt.y;
      } else {
        const pt = reach(this.hand.cursor);
        sx = pt.x; sy = pt.y;
      }
      const tx = Math.max(-1, Math.min(1, sx * 2 - 1)), ty = Math.max(-1, Math.min(1, -(sy * 2 - 1)));
      // Hand updates arrive ~20x/s but we render ~60x/s: damp toward the target so the cursor glides instead of stepping.
      const k = this._wasHand ? 1 - Math.exp(-dt * 30) : 1;
      this.ndc.set(this.ndc.x + (tx - this.ndc.x) * k, this.ndc.y + (ty - this.ndc.y) * k);
      // Palm NDC: same mapping as the cursor, so the brush always sits where the cursor ring is
      if (this.stage && this.hand.palm) {
        const pp = reach(this.stage.videoToStage(this.hand.palm.x, this.hand.palm.y));
        const px = Math.max(-1, Math.min(1, pp.x * 2 - 1)), py = Math.max(-1, Math.min(1, -(pp.y * 2 - 1)));
        this.palmNdc.set(this.palmNdc.x + (px - this.palmNdc.x) * k, this.palmNdc.y + (py - this.palmNdc.y) * k);
      } else {
        this.palmNdc.copy(this.ndc);
      }
      this._wasHand = true;
    } else if (this.mouse.active && !this.inspect) {
      this._wasHand = false;
      this.source = 'mouse'; this.present = true; this.pinching = this.mouse.down; this.ndc.set(this.mouse.x, this.mouse.y);
    } else { this._wasHand = false; this.source = 'none'; this.present = false; this.pinching = false; }
    // ndc = SCREEN space (cursor ring, haze). rayNdc = RENDER space (raycasts into the 3D scene); the canvas is CSS-mirrored.
    this.rayNdc.set(CONFIG.hand.mirror ? -this.ndc.x : this.ndc.x, this.ndc.y);
  }
}