import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { toThreeRows } from './pose.js';
import { OneEuro } from '../util/oneEuro.js';

/**
 * Marker state machine.  SEARCHING -> TRACKING(world) -> LOST(holding last pose).
 * Markers only choose the world and the anchor pose. Newest stable marker wins.
 */
export class MarkerManager extends EventTarget {
  constructor() {
    super();
    this.status = 'searching';
    this.activeId = null; this.activeWorld = null;
    this.counts = {}; this.lastSeen = 0; this.lastSwitch = 0;
    this.matrix = new THREE.Matrix4();
    this.frozen = false;
    this.locked = false;
    this.pf = Array.from({ length: 7 }, () => new OneEuro(1.4, 0.4, 1.0));
    this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._qPrev = new THREE.Quaternion();
    this.hasPose = false;
  }

  update(detections, now) {
    if (this.frozen || this.locked) return;
    const ids = new Set(detections.map((d) => d.id));
    for (const id of Object.keys(CONFIG.markers.ids)) this.counts[id] = ids.has(Number(id)) ? (this.counts[id] || 0) + 1 : 0;

    let target = detections.find((d) => d.id === this.activeId);
    if (!target || this.activeId === null) {
      // adopt the first stable marker
      const stable = detections.find((d) => this.counts[d.id] >= CONFIG.tracking.switchFrames);
      if (stable) { target = stable; this._switch(stable, now); }
    } else {
      // another stable marker while the active one is visible: switch only after cooldown
      const other = detections.find((d) => d.id !== this.activeId && this.counts[d.id] >= CONFIG.tracking.switchFrames);
      if (other && now - this.lastSwitch > CONFIG.tracking.switchCooldownMs) { target = other; this._switch(other, now); }
    }

    if (target) {
      this.lastSeen = now;
      this._applyPose(target.pose, now);
      this._setStatus('tracking');
    } else if (this.activeId !== null && now - this.lastSeen > CONFIG.tracking.lostAfterMs) {
      this._setStatus('lost');
    }
  }

  _switch(det, now) {
    const from = this.activeWorld;
    this.activeId = det.id; this.activeWorld = det.world; this.lastSwitch = now;
    this.pf.forEach((f) => f.reset()); this.hasPose = false;
    this.dispatchEvent(new CustomEvent('world', { detail: { world: det.world, from, source: 'marker' } }));
  }

  _applyPose(pose, now) {
    const raw = new THREE.Matrix4().set(...toThreeRows(pose));
    raw.decompose(this._p, this._q, this._s);
    if (this.hasPose && this._q.dot(this._qPrev) < 0) this._q.set(-this._q.x, -this._q.y, -this._q.z, -this._q.w);
    const f = this.pf;
    this._p.set(f[0].filter(this._p.x, now), f[1].filter(this._p.y, now), f[2].filter(this._p.z, now));
    this._q.set(f[3].filter(this._q.x, now), f[4].filter(this._q.y, now), f[5].filter(this._q.z, now), f[6].filter(this._q.w, now)).normalize();
    this._qPrev.copy(this._q);
    this.matrix.compose(this._p, this._q, new THREE.Vector3(1, 1, 1));
    this.hasPose = true;
  }

  /** Manual / demo selection (keyboard or no-camera mode). */
  selectManual(world, now = performance.now()) {
    const from = this.activeWorld;
    this.activeWorld = world; this.activeId = null; this.lastSwitch = now;
    this.dispatchEvent(new CustomEvent('world', { detail: { world, from, source: 'manual' } }));
  }

  _setStatus(s) {
    if (s === this.status) return;
    this.status = s; this.dispatchEvent(new CustomEvent('status', { detail: s }));
  }
  setFrozen(v) { this.frozen = v; }
  toggleLock() {
    if (!this.hasPose && !this.locked) return false;
    this.locked = !this.locked;
    return this.locked;
  }
}

/** Fixed pose used when no camera/marker is available: a tabletop in front of the viewer. */
export function demoMatrix() {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(0, -0.55, -4.3), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.95, 0, 0)), new THREE.Vector3(1, 1, 1));
  return m;
}
