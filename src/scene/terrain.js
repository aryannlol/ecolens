import * as THREE from 'three';
import { clamp, lerp, smooth, rng } from '../util/math.js';
import { tryTexture } from '../util/assets.js';

export const HALF = 1.5;
// Layout (local, y up, +z toward the viewer): waste clearing in front, bin station behind it,
// river running along the right side, road/town and hills at the back.
export const riverX = (z) => 0.82 + 0.08 * Math.sin(z * 1.8 + 0.4);
export const riverDist = (x, z) => Math.abs(x - riverX(z));
export const roadZ = (x) => -0.96 + 0.035 * Math.sin(x * 1.5);
export const STATION = { z0: -0.38, z1: 0.08 }; // flat slab holding the bins
export const CLEARING = { x: 0.8, z0: 0.28, z1: 1.3 }; // where loose waste lies

export function heightAt(x, z) {
  let h = 0.04 * Math.sin(x * 1.7 + 1) * Math.cos(z * 1.9) + 0.025 * Math.sin(x * 4.1 + z * 3.3);
  h += 0.18 * Math.exp(-((x - 1.1) ** 2 + (z + 0.8) ** 2) / 0.12);
  h += 0.12 * Math.exp(-((x + 1.05) ** 2 + (z - 0.4) ** 2) / 0.1);
  h += 0.1 * Math.exp(-((x - 1.1) ** 2 + (z - 0.5) ** 2) / 0.08);
  const carve = smooth(0.28, 0.09, riverDist(x, z)); // 1 inside the channel
  h = h * (1 - carve) + -0.07 * carve;
  if (x < 0.62) {
    h = lerp(h, 0.03, smooth(0.32, 0.1, Math.abs(z - roadZ(x))));
    h = lerp(h, 0.03, smooth(STATION.z0 - 0.08, STATION.z0 + 0.02, z) * smooth(STATION.z1 + 0.08, STATION.z1 - 0.02, z));
  }
  h = lerp(h, 0.015, smooth(0.2, 0.34, z) * smooth(0.62, 0.48, x) * smooth(-0.95, -0.8, x) * 0.9); // flat picking area
  h = lerp(h, -0.1, smooth(HALF - 0.07, HALF, Math.max(Math.abs(x), Math.abs(z))));
  return h;
}

const C = (r, g, b) => new THREE.Color(r, g, b);
const DEAD_A = C(0.33, 0.25, 0.15), DEAD_B = C(0.48, 0.4, 0.24), SLUDGE = C(0.15, 0.12, 0.08);
const LIVE_A = C(0.1, 0.3, 0.07), LIVE_B = C(0.3, 0.52, 0.14), PAVE = C(0.38, 0.38, 0.38);

function detailTexture(rand) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); const img = g.createImageData(256, 256);
  const ph = Array.from({ length: 6 }, () => [1 + Math.floor(rand() * 7), 1 + Math.floor(rand() * 7), rand() * 6.28]);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    let v = 0; for (const [kx, ky, p] of ph) v += Math.sin(2 * Math.PI * (kx * x + ky * y) / 256 + p);
    const n = 0.78 + 0.22 * (v / 6) + (rand() - 0.5) * 0.12; const i = (y * 256 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = clamp(n) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7, 7); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Terrain {
  constructor() {
    const N = 110, rand = rng(7);
    const geo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, N, N); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, n = pos.count;
    this.grassT = new Float32Array(n); this.wet = new Float32Array(n); this.pave = new Float32Array(n); this.noise = new Float32Array(n);
    this.deadR = new Float32Array(n); this.deadG = new Float32Array(n); this.deadB = new Float32Array(n);
    this.liveR = new Float32Array(n); this.liveG = new Float32Array(n); this.liveB = new Float32Array(n);
    this.sludgeFactor = new Float32Array(n);
    const dTmp = new THREE.Color(), lTmp = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, heightAt(x, z));
      const dr = riverDist(x, z), moist = smooth(0.65, 0.12, dr);
      this.grassT[i] = clamp(0.06 + 0.8 * (0.3 * rand() + 0.7 * (1 - moist)) + 0.1 * Math.sin(x * 5) * Math.cos(z * 4));
      this.wet[i] = smooth(0.32, 0.14, dr);
      this.pave[i] = x < 0.62 ? Math.max(smooth(0.09, 0.03, Math.abs(z - roadZ(x))), (z > STATION.z0 && z < STATION.z1) ? 0.85 : 0) : 0;
      const nz = 0.5 + 0.5 * Math.sin(x * 9.1 + z * 7.3) * Math.cos(x * 5.2 - z * 8.8);
      this.noise[i] = nz;
      dTmp.copy(DEAD_A).lerp(DEAD_B, nz);
      this.deadR[i] = dTmp.r; this.deadG[i] = dTmp.g; this.deadB[i] = dTmp.b;
      lTmp.copy(LIVE_A).lerp(LIVE_B, nz);
      this.liveR[i] = lTmp.r; this.liveG[i] = lTmp.g; this.liveB[i] = lTmp.b;
      this.sludgeFactor[i] = this.wet[i] * 0.8;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.computeVertexNormals();
    this.geo = geo;
    this.map = detailTexture(rand);
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, map: this.map, roughness: 0.95, metalness: 0 });
    this.mesh = new THREE.Mesh(geo, this.material); this.mesh.receiveShadow = true; this.mesh.castShadow = false;
    tryTexture('/assets/ground_dead.jpg').then((t) => { if (t) { t.repeat.set(5, 5); this.material.map = t; this.material.needsUpdate = true; } });
    this.last = -1; this.lastUpdateTime = 0; this.update(0.05, true);
  }
  update(rd, force = false) {
    const now = performance.now();
    if (!force) {
      if (Math.abs(rd - this.last) < 0.003) return;
      if (now - this.lastUpdateTime < 50) return;
    }
    this.last = rd; this.lastUpdateTime = now;
    const col = this.geo.attributes.color.array, n = this.noise.length;
    const paveR = PAVE.r, paveG = PAVE.g, paveB = PAVE.b;
    const sludgeR = SLUDGE.r, sludgeG = SLUDGE.g, sludgeB = SLUDGE.b;
    const wetScale = (1 - rd);
    for (let i = 0; i < n; i++) {
      const g = smooth(this.grassT[i] - 0.14, this.grassT[i] + 0.14, rd);
      const sf = this.sludgeFactor[i] * wetScale;
      const dR = this.deadR[i] + (sludgeR - this.deadR[i]) * sf;
      const dG = this.deadG[i] + (sludgeG - this.deadG[i]) * sf;
      const dB = this.deadB[i] + (sludgeB - this.deadB[i]) * sf;

      const mR = dR + (this.liveR[i] - dR) * g;
      const mG = dG + (this.liveG[i] - dG) * g;
      const mB = dB + (this.liveB[i] - dB) * g;

      const pv = this.pave[i] * 0.85;
      const idx = i * 3;
      col[idx] = mR + (paveR - mR) * pv;
      col[idx + 1] = mG + (paveG - mG) * pv;
      col[idx + 2] = mB + (paveB - mB) * pv;
    }
    this.geo.attributes.color.needsUpdate = true;
  }
}
