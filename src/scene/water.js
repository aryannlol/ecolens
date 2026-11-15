import * as THREE from 'three';
import { riverX, HALF } from './terrain.js';
import { rng } from '../util/math.js';

function normalMapTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), rand = rng(5);
  const waves = Array.from({ length: 7 }, () => ({ kx: 1 + Math.floor(rand() * 9), ky: 1 + Math.floor(rand() * 9), p: rand() * 6.28, a: 0.5 + rand() }));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let dx = 0, dy = 0;
    for (const w of waves) { const ph = 2 * Math.PI * (w.kx * x + w.ky * y) / S + w.p; const d = Math.cos(ph) * w.a; dx += d * w.kx; dy += d * w.ky; }
    const nx = -dx * 0.012, ny = -dy * 0.012, l = Math.hypot(nx, ny, 1), i = (y * S + x) * 4;
    img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

/** River ribbon: physical water with animated normals, oil sheen and murk driven by the profile. */
export class River {
  constructor() {
    const SEG = 140, W = 0.22, pos = [], uv = [], idx = [], col = [];
    for (let i = 0; i <= SEG; i++) {
      const z = -HALF + 0.02 + (i / SEG) * (HALF * 2 - 0.04), xc = riverX(z);
      for (const s of [-1, 1]) { pos.push(xc + s * W, 0, z); uv.push(s < 0 ? 0 : 1, (i / SEG) * 8); const dark = 0.92; col.push(dark, dark, dark); }
      if (i < SEG) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    this.normal = normalMapTexture(); this.normal.repeat.set(1.5, 3.0);
    this.material = new THREE.MeshPhysicalMaterial({
      color: 0x165243, roughness: 0.14, metalness: 0.1, transparent: true, opacity: 0.94, normalMap: this.normal, normalScale: new THREE.Vector2(0.8, 0.8),
      clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 1.0, iridescenceIOR: 1.55, vertexColors: true, envMapIntensity: 1.6,
    });
    this.mesh = new THREE.Mesh(g, this.material); this.mesh.position.y = 0.008; this.mesh.receiveShadow = true;
    // floating debris (toxic oil clumps, plastic bottles, foam) that thins out as the river recovers
    this.debris = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.048, 1), new THREE.MeshStandardMaterial({ color: 0xc4c787, roughness: 0.5, metalness: 0.2 }), 32);
    this.debris.castShadow = true; this.deb = [];
    const r = rng(9);
    for (let i = 0; i < 32; i++) this.deb.push({ z: -1.1 + r() * 2.2, off: (r() - 0.5) * 0.28, sp: 0.04 + r() * 0.06, thr: 0.1 + r() * 0.8, s: 0.8 + r() * 0.8, rot: r() * 6 });
    this.group = new THREE.Group(); this.group.add(this.mesh, this.debris);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._e = new THREE.Euler();
  }
  update(t, dt, rd, prof, riverMurk = 0) {
    this.normal.offset.y -= dt * 0.045; this.normal.offset.x += dt * 0.008;
    const m = this.material;
    const murky = new THREE.Color(0x3d3522);
    const targetColor = prof.water.clone().lerp(murky, Math.min(1, riverMurk * 0.8));
    m.color.copy(targetColor);
    m.opacity = prof.waterOpacity;
    m.roughness = THREE.MathUtils.lerp(prof.waterRough, 0.35, riverMurk);
    m.iridescence = Math.max(0.02, prof.sheen * (1 - riverMurk * 0.75));
    m.envMapIntensity = 0.6 + rd;
    for (let i = 0; i < this.deb.length; i++) {
      const d = this.deb[i]; d.z += d.sp * dt; if (d.z > HALF - 0.05) d.z = -HALF + 0.05;
      const vis = 1 - Math.min(1, Math.max(0, (rd - (d.thr - 0.08)) / 0.08)); // gone once rd passes its threshold
      this._p.set(riverX(d.z) + d.off, 0.012 + Math.sin(t * 1.5 + d.rot) * 0.004, d.z);
      this._q.setFromEuler(this._e.set(0, d.rot + t * 0.1, 0)); this._s.setScalar(d.s * vis + 0.0001);
      this.debris.setMatrixAt(i, this._m.compose(this._p, this._q, this._s));
    }
    this.debris.instanceMatrix.needsUpdate = true;
  }
}
