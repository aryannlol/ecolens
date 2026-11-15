import * as THREE from 'three';
import gsap from 'gsap';

const N = 320;
/** Recycling effects: particle streams from the bin to the spot that heals, ground ripples, sparkles. */
export class FX {
  constructor(parent) {
    this.parent = parent;
    const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    this.pos = new Float32Array(N * 3).fill(-50); this.col = new Float32Array(N * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.05, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false; parent.add(this.points);
    this.ps = Array.from({ length: N }, () => ({ on: false, t: 0, dur: 1, delay: 0, a: new THREE.Vector3(), c: new THREE.Vector3(), b: new THREE.Vector3() }));
    this.cursor = 0; this.ringGeo = new THREE.RingGeometry(0.03, 0.05, 64).rotateX(-Math.PI / 2);
  }

  /** Stream of light from `from` arcing to `to`; resolves when the first wave arrives. */
  burst(from, to, colorHex, count = 26, delay = 0, spread = 0.1) {
    const c = new THREE.Color(colorHex), dur = 0.9;
    for (let i = 0; i < count; i++) {
      const p = this.ps[this.cursor]; const k = this.cursor; this.cursor = (this.cursor + 1) % N;
      p.on = true; p.t = 0; p.delay = delay + Math.random() * 0.25; p.dur = dur + Math.random() * 0.4;
      p.a.copy(from).add(new THREE.Vector3((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.08));
      p.b.copy(to).add(new THREE.Vector3((Math.random() - 0.5) * spread, 0.02, (Math.random() - 0.5) * spread));
      p.c.lerpVectors(p.a, p.b, 0.5); p.c.y += 0.5 + Math.random() * 0.4;
      this.col[k * 3] = c.r; this.col[k * 3 + 1] = c.g; this.col[k * 3 + 2] = c.b;
    }
    return new Promise((res) => gsap.delayedCall(delay + 0.25 + dur, res));
  }
  /** Expanding ground ring. */
  ripple(pos, colorHex, size = 0.9, delay = 0) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(pos); m.position.y += 0.012; m.scale.setScalar(0.2); this.parent.add(m);
    gsap.timeline({ delay, onComplete: () => { m.removeFromParent(); m.material.dispose(); } })
      .to(m.material, { opacity: 0.5, duration: 0.12 }).to(m.scale, { x: size * 10, y: size * 10, z: size * 10, duration: 1.3, ease: 'power2.out' }, 0).to(m.material, { opacity: 0, duration: 1.1, ease: 'power1.in' }, 0.15);
  }
  update(dt) {
    const q = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const p = this.ps[i]; if (!p.on) continue;
      if (p.delay > 0) { p.delay -= dt; this.pos[i * 3 + 1] = -50; continue; }
      p.t += dt / p.dur; const u = Math.min(p.t, 1), iu = 1 - u;
      q.set(iu * iu * p.a.x + 2 * iu * u * p.c.x + u * u * p.b.x, iu * iu * p.a.y + 2 * iu * u * p.c.y + u * u * p.b.y, iu * iu * p.a.z + 2 * iu * u * p.c.z + u * u * p.b.z);
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      if (p.t >= 1) { p.on = false; this.pos[i * 3 + 1] = -50; }
    }
    this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.color.needsUpdate = true;
  }
}
