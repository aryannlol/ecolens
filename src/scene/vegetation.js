import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt, riverDist, roadZ, STATION, CLEARING, HALF } from './terrain.js';
import { rng, smooth, lerp } from '../util/math.js';
import { CONFIG } from '../config.js';
import { spawnLayout } from '../gameplay/layout.js';

function bladeGeometry() {
  const seg = 4, pos = [], idx = [];
  for (let i = 0; i <= seg; i++) { const y = i / seg, w = 0.0085 * (1 - 0.88 * y * y); pos.push(-w, y, 0, w, y, 0); if (i < seg) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

/** Instanced, wind-animated grass. Each blade has a growth threshold; blades near the river wake up first. */
export class Grass {
  constructor(count = 16000) {
    const r = rng(101), geo = bladeGeometry();
    this.uniforms = { uTime: { value: 0 }, uRec: { value: 0 } };
    const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.uniforms);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aThr; attribute float aH; uniform float uTime; uniform float uRec; varying float vT; varying float vG;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float grow = smoothstep(aThr - 0.12, aThr + 0.2, uRec);
          float bh = aH * (0.16 + 0.84 * grow);
          vec4 ip = instanceMatrix * vec4(0., 0., 0., 1.);
          float yy = transformed.y;
          transformed.y = yy * bh;
          float sway = sin(uTime * 1.8 + ip.x * 6.0 + ip.z * 4.0) * 0.5 + sin(uTime * 3.1 + ip.x * 11.0) * 0.15;
          transformed.x += sway * 0.05 * yy * yy * (0.4 + grow);
          transformed.z += cos(uTime * 1.3 + ip.z * 5.0) * 0.025 * yy * yy;
          vT = yy; vG = grow;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vT; varying float vG; uniform float uRec;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 dry = mix(vec3(0.28, 0.21, 0.11), vec3(0.55, 0.45, 0.25), vT);
          vec3 live = mix(vec3(0.05, 0.2, 0.04), vec3(0.42, 0.7, 0.18), vT);
          diffuseColor.rgb = mix(dry, live, smoothstep(0.08, 0.85, uRec) * (0.35 + 0.65 * vG));`);
    };
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    const thr = new Float32Array(count), hh = new Float32Array(count), m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    let n = 0, guard = 0;
    while (n < count && guard++ < count * 8) {
      const x = (r() * 2 - 1) * (HALF - 0.06), z = (r() * 2 - 1) * (HALF - 0.06);
      const dr = riverDist(x, z);
      if (dr < 0.2 || Math.abs(z - roadZ(x)) < 0.07 || (z > STATION.z0 - 0.02 && z < STATION.z1 + 0.02) || z < -1.0) continue;
      const moist = smooth(0.8, 0.12, dr);
      thr[n] = Math.min(0.98, 0.04 + 0.82 * (0.3 * r() + 0.7 * (1 - moist)));
      hh[n] = (0.07 + r() * 0.07) * 0.85; p.set(x, heightAt(x, z), z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28); this.mesh.setMatrixAt(n, m.compose(p, q, s)); n++;
    }
    this.mesh.count = n;
    geo.setAttribute('aThr', new THREE.InstancedBufferAttribute(thr, 1)); geo.setAttribute('aH', new THREE.InstancedBufferAttribute(hh, 1));
    this.mesh.frustumCulled = false; this.mesh.receiveShadow = true;
  }
  update(t, rd) { this.uniforms.uTime.value = t; this.uniforms.uRec.value = rd; }
}

function noisy(geo, amp, seed) {
  const r = rng(seed), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + (r() - 0.5) * amp; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
  geo.computeVertexNormals(); return geo;
}

/** Trees (broadleaf + pine) and rocks. Foliage scale and colour are driven by recovery; dead trees stay as bare trunks. */
export class Forest {
  constructor() {
    const r = rng(303);
    const trunkG = new THREE.CylinderGeometry(0.011, 0.024, 0.22, 7).translate(0, 0.11, 0);
    const blobs = [[0, 0.3, 0, 0.1], [0.07, 0.26, 0.02, 0.075], [-0.06, 0.27, -0.03, 0.08], [0.01, 0.37, 0.01, 0.07]]
      .map(([x, y, z, rad], i) => noisy(new THREE.IcosahedronGeometry(rad, 2), 0.3, 40 + i).translate(x, y, z));
    const leafG = mergeGeometries(blobs);
    const pines = [0.17, 0.27, 0.36].map((y, i) => new THREE.ConeGeometry(0.115 - i * 0.03, 0.17, 8).translate(0, y + 0.05, 0));
    const pineG = mergeGeometries(pines);
    const bark = new THREE.MeshStandardMaterial({ color: 0x4b3624, roughness: 0.95 });
    const leafM = new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: false }), pineM = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    this.spots = [];
    const allSpawns = [
      ...spawnLayout(CONFIG.worlds.polluted),
      ...spawnLayout(CONFIG.worlds.recovering),
      ...spawnLayout(CONFIG.worlds.clean),
    ];
    let guard = 0;
    while (this.spots.length < 44 && guard++ < 6000) {
      const x = (r() * 2 - 1) * (HALF - 0.1), z = (r() * 2 - 1) * (HALF - 0.1);
      const inClearing = Math.abs(x) < CLEARING.x + 0.15 && z > CLEARING.z0 - 0.15 && z < CLEARING.z1 + 0.15;
      const inFrontCamera = z > CLEARING.z0 - 0.05 && Math.abs(x) < CLEARING.x + 0.15;
      const inStation = z > STATION.z0 - 0.1 && z < STATION.z1 + 0.1 && Math.abs(x) < 1.05;
      const inTown = z < -0.9 && x < 0.38;
      const nearSpawn = allSpawns.some((sp) => Math.hypot(sp.x - x, sp.z - z) < 0.32);
      if (riverDist(x, z) < 0.3 || Math.abs(z - roadZ(x)) < 0.13 || inClearing || inFrontCamera || inStation || inTown || nearSpawn) continue;

      const dx = Math.max(0, Math.abs(x) - CLEARING.x), dz = Math.max(0, Math.max(CLEARING.z0 - z, z - CLEARING.z1));
      const distClearing = Math.hypot(dx, dz);
      let s = 0.7 + r() * 0.7;
      if (distClearing < 0.5) s = Math.min(1.0, s);

      const pine = r() < 0.4, tone = r();
      const green = pine
        ? new THREE.Color(0.05 + 0.05 * tone, 0.26 + 0.1 * tone, 0.12)
        : new THREE.Color(0.1 + 0.15 * tone, 0.38 + 0.2 * tone, 0.08 + 0.05 * tone);

      this.spots.push({ x, z, y: heightAt(x, z), s, thr: 0.12 + r() * 0.7, pine, rot: r() * 6.28, ph: r() * 6.28, tone, green });
    }
    const nB = this.spots.filter((s) => !s.pine).length, nP = this.spots.length - nB;
    this.trunks = new THREE.InstancedMesh(trunkG, bark, this.spots.length);
    this.leaves = new THREE.InstancedMesh(leafG, leafM, nB); this.pinesM = new THREE.InstancedMesh(pineG, pineM, nP);
    [this.trunks, this.leaves, this.pinesM].forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
    this.spots.forEach((s, i) => { s.i = i; });
    let b = 0, p = 0; this.spots.forEach((s) => { s.li = s.pine ? p++ : b++; });
    // 6-8 grey flatShaded rocks near the river edge and front-left corner (TASK E)
    const rockG = noisy(new THREE.IcosahedronGeometry(0.07, 2), 0.5, 77); rockG.scale(1, 0.65, 1);
    this.rocks = new THREE.InstancedMesh(rockG, new THREE.MeshStandardMaterial({ color: 0x7b776f, roughness: 0.95, flatShading: true }), 8);
    this.rocks.castShadow = this.rocks.receiveShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    const rockLocs = [
      // 4 in front-left corner
      [-0.95, 0.95, 0.95], [-1.15, 0.85, 0.8], [-1.22, 1.12, 1.1], [-1.02, 1.25, 0.85],
      // 4 near river edge
      [0.73, -0.25, 0.9], [0.74, 0.22, 0.75], [0.76, 0.58, 1.05], [0.77, 0.98, 0.85]
    ];
    rockLocs.forEach(([rx, rz, rsc], idx) => {
      q.setFromEuler(new THREE.Euler(r() * 0.4, r() * 6.28, r() * 0.4));
      this.rocks.setMatrixAt(idx, m4.compose(new THREE.Vector3(rx, heightAt(rx, rz) + 0.015, rz), q, new THREE.Vector3(rsc, rsc, rsc)));
    });

    // ~120 tiny flat white/pink/yellow flower discs scattered on grass (TASK E)
    const flowerG = new THREE.CircleGeometry(0.016, 6).rotateX(-Math.PI / 2);
    const flowerM = new THREE.MeshStandardMaterial({ roughness: 0.6, side: THREE.DoubleSide });
    this.flowers = new THREE.InstancedMesh(flowerG, flowerM, 120);
    this.flowers.castShadow = false; this.flowers.receiveShadow = true;
    const flowerCols = [new THREE.Color(0xffffff), new THREE.Color(0xff8ec0), new THREE.Color(0xffeb64)];
    this.flowerSpots = [];
    let fn = 0, fguard = 0;
    while (fn < 120 && fguard++ < 2000) {
      const fx = (r() * 2 - 1) * (HALF - 0.12), fz = (r() * 2 - 1) * (HALF - 0.12);
      const inClearing = Math.abs(fx) < CLEARING.x + 0.12 && fz > CLEARING.z0 - 0.12 && fz < CLEARING.z1 + 0.12;
      const inStation = fz > STATION.z0 - 0.05 && fz < STATION.z1 + 0.05 && Math.abs(fx) < 1.0;
      if (riverDist(fx, fz) < 0.25 || Math.abs(fz - roadZ(fx)) < 0.1 || inClearing || inStation || fz < -1.0) continue;
      const fthr = 0.5 + r() * 0.35;
      const col = flowerCols[Math.floor(r() * 3)];
      this.flowerSpots.push({ x: fx, y: heightAt(fx, fz) + 0.006, z: fz, thr: fthr, s: 0.8 + r() * 0.5, i: fn });
      this.flowers.setColorAt(fn, col);
      this.flowers.setMatrixAt(fn, m4.compose(new THREE.Vector3(fx, -10, fz), q, new THREE.Vector3(0, 0, 0)));
      fn++;
    }
    this.flowers.count = fn;
    if (this.flowers.instanceColor) this.flowers.instanceColor.needsUpdate = true;

    this.group = new THREE.Group(); this.group.add(this.trunks, this.leaves, this.pinesM, this.rocks, this.flowers);
    this._m = m4; this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._e = new THREE.Euler(); this._c = new THREE.Color();
    this.lastRd = -1;
    this.update(0, 0.05, true);
  }
  update(t, rd, force = false) {
    const rdChanged = force || Math.abs(rd - this.lastRd) > 0.003;
    if (rdChanged) this.lastRd = rd;
    for (const s of this.spots) {
      const leaf = smooth(s.thr, s.thr + 0.3, rd), alive = lerp(0.82, 1, smooth(0.1, 0.6, rd));
      const sway = Math.sin(t * 1.4 + s.ph) * 0.012 * leaf;
      this._q.setFromEuler(this._e.set(sway, s.rot, sway * 0.7));
      this._p.set(s.x, s.y, s.z);
      this.trunks.setMatrixAt(s.i, this._m.compose(this._p, this._q, this._s.setScalar(s.s * alive)));
      const target = s.pine ? this.pinesM : this.leaves;
      target.setMatrixAt(s.li, this._m.compose(this._p, this._q, this._s.setScalar(s.s * (0.02 + 0.98 * leaf))));
      if (rdChanged) {
        this._c.setRGB(0.33, 0.25, 0.1).lerp(s.green, smooth(s.thr - 0.05, s.thr + 0.35, rd));
        target.setColorAt(s.li, this._c);
      }
    }
    if (rdChanged && this.flowerSpots) {
      for (const fs of this.flowerSpots) {
        const sc = rd > 0.5 ? fs.s * smooth(fs.thr, fs.thr + 0.15, rd) : 0;
        this._p.set(fs.x, sc > 0 ? fs.y : -10, fs.z);
        this.flowers.setMatrixAt(fs.i, this._m.compose(this._p, this._q, this._s.setScalar(sc)));
      }
      this.flowers.instanceMatrix.needsUpdate = true;
    }
    for (const m of [this.trunks, this.leaves, this.pinesM]) {
      m.instanceMatrix.needsUpdate = true;
      if (rdChanged && m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}
