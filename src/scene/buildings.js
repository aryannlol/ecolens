import * as THREE from 'three';
import { heightAt, riverX, roadZ, HALF } from './terrain.js';
import { rng, smooth } from '../util/math.js';

const PALETTE = [0xe8c9a0, 0xc9dbe6, 0xe9b8a7, 0xd9e2b5, 0xf0e2c0, 0xb9c8d8, 0xe6c3d4];
const SOOT = new THREE.Color(0.17, 0.16, 0.15);

/** Back-row town, road and footbridge. Walls clean up and windows light up as recovery rises. */
export class Town {
  constructor() {
    const r = rng(404);
    this.group = new THREE.Group();
    this.houses = [];
    const xs = [-1.02, -0.76, -0.5, -0.24, 0.02, 0.28];
    xs.forEach((x, i) => this.houses.push({ x, z: -1.1, w: 0.2 + r() * 0.07, d: 0.15, h: 0.13 + r() * 0.09, c: new THREE.Color(PALETTE[i % PALETTE.length]) }));
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.9 }), this.houses.length);
    const roof = new THREE.InstancedMesh(new THREE.ConeGeometry(0.72, 0.5, 4).rotateY(Math.PI / 4).translate(0, 0.25, 0), new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.8 }), this.houses.length);
    this.win = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.045, 0.05), new THREE.MeshStandardMaterial({ color: 0x1b1f24, emissive: 0xffc46b, emissiveIntensity: 0, roughness: 0.3 }), this.houses.length * 2);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    this.houses.forEach((h, i) => {
      const y = heightAt(h.x, h.z);
      body.setMatrixAt(i, m.compose(p.set(h.x, y, h.z), q.identity(), s.set(h.w, h.h, h.d)));
      roof.setMatrixAt(i, m.compose(p.set(h.x, y + h.h, h.z), q.identity(), s.set(h.w * 0.78, h.h * 0.9, h.d * 0.9)));
      [-1, 1].forEach((k, j) => this.win.setMatrixAt(i * 2 + j, m.compose(p.set(h.x + k * h.w * 0.22, y + h.h * 0.5, h.z + h.d / 2 + 0.002), q.identity(), s.set(1, 1, 1))));
    });
    body.castShadow = roof.castShadow = true; body.receiveShadow = true;
    this.body = body;
    this.stacks = [this.houses[1], this.houses[4]].map((h) => ({ x: h.x + h.w * 0.25, y: heightAt(h.x, h.z) + h.h + 0.07, z: h.z - 0.02 }));
    const chim = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.12, 0.035), new THREE.MeshStandardMaterial({ color: 0x5a4a44, roughness: 0.9 }), 2);
    this.stacks.forEach((c, i) => chim.setMatrixAt(i, m.compose(p.set(c.x, c.y - 0.03, c.z), q.identity(), s.set(1, 1, 1))));
    chim.castShadow = true;

    // road with dashed centre line
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64; const g = cv.getContext('2d');
    g.fillStyle = '#34363a'; g.fillRect(0, 0, 512, 64); g.fillStyle = '#d8d3b0'; for (let x = 0; x < 512; x += 64) g.fillRect(x, 29, 32, 6);
    g.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 400; i++) g.fillRect(Math.random() * 512, Math.random() * 64, 2, 2);
    const rt = new THREE.CanvasTexture(cv); rt.colorSpace = THREE.SRGBColorSpace; rt.anisotropy = 8;
    const seg = 80, pos = [], uv = [], idx = [], W = 0.065;
    for (let i = 0; i <= seg; i++) { const x = -HALF + 0.03 + (i / seg) * (HALF + 0.58), z = roadZ(x); pos.push(x, 0.036, z - W, x, 0.036, z + W); uv.push(i / seg * 3, 0, i / seg * 3, 1); if (i < seg) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); rg.setIndex(idx); rg.computeVertexNormals();
    const road = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ map: rt, roughness: 0.92 })); road.receiveShadow = true;

    // footbridge across the side river
    const bz = -0.35, bx = riverX(bz), bridge = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.85 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.02, 0.2), wood); deck.position.set(bx, 0.05, bz); deck.castShadow = deck.receiveShadow = true;
    bridge.add(deck);
    [-0.09, 0.09].forEach((dz) => { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.012), wood); rail.position.set(bx, 0.085, bz + dz); rail.castShadow = true; bridge.add(rail); });
    this.group.add(body, roof, this.win, chim, road, bridge);
    this._c = new THREE.Color(); this.update(0.05, true);
  }
  update(rd) {
    const clean = smooth(0.2, 0.85, rd);
    this.houses.forEach((h, i) => { this._c.copy(SOOT).lerp(h.c, clean); this.body.setColorAt(i, this._c); });
    this.body.instanceColor.needsUpdate = true;
    this.win.material.emissiveIntensity = smooth(0.55, 1, rd) * 1.6;
  }
}
