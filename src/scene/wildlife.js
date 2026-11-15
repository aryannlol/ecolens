import * as THREE from 'three';
import { rng, smooth } from '../util/math.js';
import { riverX, heightAt, HALF } from './terrain.js';

/** Butterflies, birds and fish. Each species appears once recovery passes its own threshold. */
export class Wildlife {
  constructor() {
    this.group = new THREE.Group(); const r = rng(606);
    const wingG = new THREE.PlaneGeometry(0.05, 0.035).translate(0.025, 0, 0);
    const makeButterfly = (c) => { const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: 0.6, emissive: c, emissiveIntensity: 0.15 });
      const a = new THREE.Mesh(wingG, m), b = new THREE.Mesh(wingG, m); b.scale.x = -1; a.rotation.x = b.rotation.x = -Math.PI / 2; g.add(a, b); g.userData = { a, b }; return g; };
    this.butterflies = Array.from({ length: 9 }, (_, i) => { const g = makeButterfly([0xffb347, 0xff6fae, 0xf7f06d, 0x7fd1ff][i % 4]); g.userData.t = r() * 6; g.userData.c = [(r() * 2 - 1) * 0.9, 0.18 + r() * 0.25, 0.2 + r() * 0.8]; g.userData.thr = 0.5 + i * 0.04; this.group.add(g); return g; });
    const birdWing = new THREE.PlaneGeometry(0.09, 0.03).translate(0.045, 0, 0), bm = new THREE.MeshStandardMaterial({ color: 0x2d2d33, side: THREE.DoubleSide, roughness: 0.7 });
    this.birds = Array.from({ length: 5 }, (_, i) => { const g = new THREE.Group(), a = new THREE.Mesh(birdWing, bm), b = new THREE.Mesh(birdWing, bm); b.scale.x = -1; a.rotation.x = b.rotation.x = -Math.PI / 2; g.add(a, b); g.userData = { a, b, ph: r() * 6, rad: 0.5 + r() * 0.5, h: 0.75 + r() * 0.3, sp: 0.25 + r() * 0.15, thr: 0.68 + i * 0.05 }; this.group.add(g); return g; });
    const fishG = new THREE.ConeGeometry(0.018, 0.075, 6).rotateX(Math.PI / 2).scale(0.6, 0.6, 1), fm = new THREE.MeshStandardMaterial({ color: 0xf08a3c, roughness: 0.5 });
    this.fish = Array.from({ length: 7 }, (_, i) => { const m = new THREE.Mesh(fishG, fm); m.userData = { z0: -1 + r() * 2, sp: 0.06 + r() * 0.05, off: (r() - 0.5) * 0.16, thr: 0.58 + i * 0.05, ph: r() * 6 }; this.group.add(m); return m; });
  }
  update(t, rd) {
    for (const g of this.butterflies) {
      const u = g.userData, k = smooth(u.thr, u.thr + 0.06, rd); g.visible = k > 0.01; if (!g.visible) continue;
      const a = t * 0.5 + u.t; g.position.set(u.c[0] + Math.sin(a * 1.3) * 0.25, u.c[1] + Math.sin(a * 2.1) * 0.05, u.c[2] + Math.cos(a) * 0.2);
      g.rotation.y = -a; const f = Math.sin(t * 22 + u.t) * 0.9; u.a.rotation.z = f; u.b.rotation.z = -f; g.scale.setScalar(k);
    }
    for (const g of this.birds) {
      const u = g.userData, k = smooth(u.thr, u.thr + 0.06, rd); g.visible = k > 0.01; if (!g.visible) continue;
      const a = t * u.sp + u.ph; g.position.set(Math.cos(a) * u.rad, u.h + Math.sin(a * 2) * 0.04, -0.2 + Math.sin(a) * u.rad * 0.7);
      g.rotation.y = -a + Math.PI; const f = Math.sin(t * 7 + u.ph) * 0.5; u.a.rotation.z = f; u.b.rotation.z = -f; g.scale.setScalar(k);
    }
    for (const m of this.fish) {
      const u = m.userData, k = smooth(u.thr, u.thr + 0.06, rd); m.visible = k > 0.01; if (!m.visible) continue;
      const z = ((u.z0 + t * u.sp + 1.2) % 2.4) - 1.2; m.position.set(riverX(z) + u.off, -0.015 + Math.sin(t * 2 + u.ph) * 0.006, z); m.rotation.y = Math.cos(t * 3 + u.ph) * 0.15; m.scale.setScalar(k);
    }
  }
}
