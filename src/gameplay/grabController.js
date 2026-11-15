import * as THREE from 'three';
import gsap from 'gsap';
import { CONFIG } from '../config.js';
import { heightAt, HALF, riverDist } from '../scene/terrain.js';
import { sound } from '../util/sound.js';

const HOVER_R = 0.13;   // in screen-height units
const BIN_R = 0.3;      // diorama units, measured on the ground plane
const LATCH_MS = 250;

/**
 * Pinch-to-grab. The cursor is a ray from the camera; a held item rides the intersection of that ray with a
 * horizontal plane just above the diorama, so moving your hand up the screen carries the item deeper toward the bins.
 */
export class GrabController {
  constructor({ stage, world, game, bins, haze }) {
    Object.assign(this, { stage, world, game, bins, haze });
    this.hover = null; this.held = null; this.latch = null; this.latchT = 0; this.prevPinch = false; this.overBin = null;
    this.hoverRiver = false;
    this.lastRiverCleanToast = 0;
    this.ray = new THREE.Raycaster(); this.inv = new THREE.Matrix4(); this.tmp = new THREE.Vector3(); this.target = new THREE.Vector3(); this.last = new THREE.Vector3(); this.lastX = 0;
    this.state = 'idle';
  }

  update(input, dt, now) {
    const pinchStart = input.pinching && !this.prevPinch, pinchEnd = !input.pinching && this.prevPinch; this.prevPinch = input.pinching;
    if (!this.held) {
      this._updateHover(input, now);
      if (pinchStart && input.present) {
        const pick = this.hover || (now - this.latchT < LATCH_MS ? this.latch : null);
        let checkNdc = input.ndc;
        if (pick) {
          this.tmp.set(0, 0.07, 0); pick.localToWorld(this.tmp); this.tmp.project(this.stage.camera);
          checkNdc = this.tmp;
        }
        if (this.haze && this.haze.densityAt(checkNdc) > 0.55) {
          this.game.emit('toast', { text: 'Haze here, wipe it away with your hand', tone: 'bad' });
        } else {
          if (pick && pick.userData.state === 'idle') this._grab(pick);
          else if (this._checkRiver(input)) {
            const remRiver = this.game.remainingRiverCount();
            if (remRiver > 0) {
              this.game.emit('toast', { text: 'Pick up the floating sludge', tone: 'bad' });
            } else if (now - this.lastRiverCleanToast > 5000) {
              this.lastRiverCleanToast = now;
              this.game.emit('toast', { text: 'The river is clean', tone: 'good' });
            }
          }
        }
      }
    } else if (!input.present || pinchEnd || !input.pinching) this._release();
    else this._drag(input, dt);
    this.state = this.held ? 'holding' : (this.hover || this.hoverRiver) ? 'hover' : 'idle';
  }

  _checkRiver(input) {
    const { o, d } = this._localRay(input.ndc);
    if (d.y >= -1e-4) return null;
    const t = (0.01 - o.y) / d.y;
    if (t <= 0) return null;
    const x = o.x + d.x * t, z = o.z + d.z * t;
    if (Math.abs(z) < HALF - 0.05 && riverDist(x, z) < 0.28) return new THREE.Vector3(x, 0.01, z);
    return null;
  }

  /** Drop whatever is held (used when the world changes). */
  cancel() { if (this.held) { this.held = null; } this.overBin?.setHover(false); this.overBin = null; this.hover = null; }

  _updateHover(input, now) {
    let best = null, bd = HOVER_R; const aspect = this.stage.aspect;
    if (input.present) for (const m of this.game.idle()) {
      this.tmp.set(0, 0.07, 0); m.localToWorld(this.tmp); this.tmp.project(this.stage.camera);
      const d = Math.hypot((this.tmp.x - input.ndc.x) * aspect, this.tmp.y - input.ndc.y);
      if (d < bd) { bd = d; best = m; }
    }
    if (best !== this.hover) { if (this.hover) gsap.to(this.hover.userData.halo.material, { opacity: 0, duration: 0.15 }); if (best) gsap.to(best.userData.halo.material, { opacity: 0.9, duration: 0.15 }); }
    this.hover = best; if (best) { this.latch = best; this.latchT = now; }
    this.hoverRiver = !best && input.present ? !!this._checkRiver(input) : false;
  }

  _grab(item) {
    this.held = item; item.userData.state = 'held'; gsap.killTweensOf(item.position);
    sound.grab();
    gsap.to(item.userData.halo.material, { opacity: 1, duration: 0.1 }); gsap.to(item.userData.halo.scale, { x: 0.46, y: 0.46, duration: 0.15 });
    if (item.userData.oilDisc) {
      gsap.to(item.userData.oilDisc.scale, { x: 0, y: 0, z: 0, duration: 0.15 });
    }
    this.target.copy(item.position); this.last.copy(item.position);
  }

  _localRay(ndc) {
    this.ray.setFromCamera(ndc, this.stage.camera);
    this.inv.copy(this.world.content.matrixWorld).invert();
    const o = this.ray.ray.origin.clone().applyMatrix4(this.inv), d = this.ray.ray.direction.clone().transformDirection(this.inv).normalize();
    return { o, d };
  }

  _drag(input, dt) {
    const item = this.held, { o, d } = this._localRay(input.ndc), holdY = CONFIG.diorama.holdHeight;
    if (d.y < -1e-3) { const t = (holdY - o.y) / d.y; if (t > 0) { this.target.set(THREE.MathUtils.clamp(o.x + d.x * t, -HALF + 0.1, HALF - 0.1), holdY, THREE.MathUtils.clamp(o.z + d.z * t, -HALF + 0.1, HALF - 0.1)); } }
    const k = 1 - Math.exp(-20 * dt); item.position.lerp(this.target, k);
    const vx = (item.position.x - this.last.x) / Math.max(dt, 1e-3); this.last.copy(item.position);
    item.rotation.z += (THREE.MathUtils.clamp(-vx * 0.25, -0.5, 0.5) - item.rotation.z) * 0.15; item.rotation.y += dt * 1.2;
    // which bin are we over?
    let near = null, nd = BIN_R;
    for (const b of this.bins) { const dd = Math.hypot(item.position.x - b.position.x, item.position.z - b.position.z); if (dd < nd) { nd = dd; near = b; } }
    if (near !== this.overBin) { this.overBin?.setHover(false); near?.setHover(true); this.overBin = near; }
  }

  _release() {
    const item = this.held; this.held = null; const bin = this.overBin; this.overBin?.setHover(false); this.overBin = null;
    gsap.to(item.userData.halo.scale, { x: 0.34, y: 0.34, duration: 0.15 }); gsap.to(item.userData.halo.material, { opacity: 0, duration: 0.2 });
    gsap.to(item.rotation, { z: 0, duration: 0.2 });
    if (bin) { this.game.attemptSort(item, bin); return; }
    sound.drop();
    const gy = heightAt(item.position.x, item.position.z);
    if (gy < 0.0) { // dropped in the river: put it back
      item.userData.state = 'busy'; const h = item.userData.home;
      if (item.userData.oilDisc) gsap.to(item.userData.oilDisc.scale, { x: 1, y: 1, z: 1, duration: 0.3, delay: 0.5 });
      gsap.to(item.position, { x: h.x, y: h.y + 0.15, z: h.z, duration: 0.5, ease: 'power2.inOut' }); gsap.to(item.position, { y: h.y, duration: 0.2, delay: 0.5, onComplete: () => { item.userData.state = 'idle'; } });
      this.game.emit('toast', { text: 'Not there. Drop it in a bin.', tone: 'bad' }); return;
    }
    // dropped on land: becomes a normal land item
    if (item.userData.isRiver) {
      item.userData.isRiver = false;
      if (item.userData.oilDisc) item.userData.oilDisc.visible = false;
    }
    item.userData.state = 'busy';
    gsap.to(item.position, { y: gy, duration: 0.3, ease: 'bounce.out', onComplete: () => { item.userData.state = 'idle'; item.userData.home.set(item.position.x, gy, item.position.z); } });
  }
}
