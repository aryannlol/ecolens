import * as THREE from 'three';
import { rng } from '../util/math.js';

export const KINDS = ['plastic', 'paper', 'metal', 'organic'];
export const KIND_NOUN = { plastic: 'plastic', paper: 'paper', metal: 'metal', organic: 'organic waste' };
const geoCache = new Map(), matCache = new Map();
const G = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
const M = (key, make) => { if (!matCache.has(key)) { const m = make(); m.fog = false; matCache.set(key, m); } return matCache.get(key); };

function crumple(geo, amp, seed) {
  const r = rng(seed), p = geo.attributes.position, seen = new Map();
  for (let i = 0; i < p.count; i++) { const k = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3); if (!seen.has(k)) seen.set(k, 1 + (r() - 0.5) * amp); const f = seen.get(k); p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f); }
  geo.computeVertexNormals(); return geo;
}

const BUILDERS = {
  plastic(v) {
    const col = [0x7cc4ff, 0x7be0a8][v % 2];
    const body = new THREE.Mesh(G('bottle', () => new THREE.LatheGeometry([[0, 0], [0.034, 0], [0.04, 0.02], [0.04, 0.11], [0.03, 0.145], [0.016, 0.168], [0.016, 0.19], [0, 0.19]].map(([x, y]) => new THREE.Vector2(x, y)), 24)),
      M('pet' + v, () => new THREE.MeshPhysicalMaterial({ color: col, transparent: true, opacity: 0.78, roughness: 0.08, clearcoat: 1, transmission: 0, envMapIntensity: 1.4 })));
    const cap = new THREE.Mesh(G('cap', () => new THREE.CylinderGeometry(0.019, 0.019, 0.024, 16).translate(0, 0.2, 0)), M('cap', () => new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 })));
    const label = new THREE.Mesh(G('label', () => new THREE.CylinderGeometry(0.0412, 0.0412, 0.05, 24, 1, true).translate(0, 0.075, 0)), M('lab' + v, () => new THREE.MeshStandardMaterial({ color: v ? 0x2e8b57 : 0x1f6fb5, roughness: 0.6, side: THREE.DoubleSide })));
    const g = new THREE.Group(); g.add(body, cap, label); return g;
  },
  metal(v) {
    const can = new THREE.Mesh(G('can', () => new THREE.CylinderGeometry(0.032, 0.032, 0.115, 28).translate(0, 0.0575, 0)), M('can' + v, () => new THREE.MeshStandardMaterial({ color: v ? 0xc9302c : 0xd3d6da, metalness: 1, roughness: 0.22, envMapIntensity: 1.6 })));
    const top = new THREE.Mesh(G('canTop', () => new THREE.CylinderGeometry(0.026, 0.026, 0.006, 24).translate(0, 0.118, 0)), M('rim', () => new THREE.MeshStandardMaterial({ color: 0xaeb2b8, metalness: 1, roughness: 0.3 })));
    const band = new THREE.Mesh(G('canBand', () => new THREE.CylinderGeometry(0.0325, 0.0325, 0.035, 28).translate(0, 0.06, 0)), M('band' + v, () => new THREE.MeshStandardMaterial({ color: v ? 0xf1f1f1 : 0x2b6cb0, metalness: 0.6, roughness: 0.35 })));
    const g = new THREE.Group(); g.add(can, top, band); return g;
  },
  paper(v) {
    if (v % 2 === 0) { // crumpled paper ball
      const m = new THREE.Mesh(G('ball', () => crumple(new THREE.IcosahedronGeometry(0.055, 2), 0.38, 12).translate(0, 0.05, 0)), M('paper', () => new THREE.MeshStandardMaterial({ color: 0xf1eee4, roughness: 0.95, flatShading: true })));
      const g = new THREE.Group(); g.add(m); return g;
    }
    const box = new THREE.Mesh(G('box', () => new THREE.BoxGeometry(0.12, 0.07, 0.09).translate(0, 0.035, 0)), M('card', () => new THREE.MeshStandardMaterial({ color: 0xb98a55, roughness: 0.9 })));
    const tape = new THREE.Mesh(G('tape', () => new THREE.BoxGeometry(0.024, 0.0015, 0.091).translate(0, 0.0705, 0)), M('tape', () => new THREE.MeshStandardMaterial({ color: 0xd6b98a, roughness: 0.5 })));
    const g = new THREE.Group(); g.add(box, tape); return g;
  },
  organic(v) {
    if (v % 2 === 0) { // apple core
      const a = new THREE.Mesh(G('apple', () => new THREE.SphereGeometry(0.05, 24, 18).scale(1, 0.88, 1).translate(0, 0.045, 0)), M('apple', () => new THREE.MeshStandardMaterial({ color: 0xd2362e, roughness: 0.35 })));
      const bite = new THREE.Mesh(G('bite', () => new THREE.SphereGeometry(0.03, 16, 12).translate(0.035, 0.06, 0.03)), M('flesh', () => new THREE.MeshStandardMaterial({ color: 0xf3e6b3, roughness: 0.7 })));
      const stem = new THREE.Mesh(G('stem', () => new THREE.CylinderGeometry(0.004, 0.004, 0.03).translate(0, 0.095, 0)), M('stem', () => new THREE.MeshStandardMaterial({ color: 0x4a3b24 })));
      const g = new THREE.Group(); g.add(a, bite, stem); return g;
    }
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.07, 0.01, 0), new THREE.Vector3(-0.03, 0.045, 0.01), new THREE.Vector3(0.03, 0.045, -0.01), new THREE.Vector3(0.07, 0.01, 0)]);
    const peel = new THREE.Mesh(G('banana', () => new THREE.TubeGeometry(curve, 24, 0.019, 10)), M('banana', () => new THREE.MeshStandardMaterial({ color: 0xf2cf3c, roughness: 0.6 })));
    const g = new THREE.Group(); g.add(peel); return g;
  },
};

let haloTex = null;
function halo() {
  if (!haloTex) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(190,255,200,0.9)'); gr.addColorStop(0.45, 'rgba(150,240,170,0.35)'); gr.addColorStop(1, 'rgba(150,240,170,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); haloTex = new THREE.CanvasTexture(c); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); s.scale.set(0.34, 0.34, 1); s.position.y = 0.07; return s;
}

/** One loose piece of waste. Shared geometry/materials, so spawning never allocates new assets. */
export function createWaste(kind, variant, id) {
  const root = new THREE.Group(), model = BUILDERS[kind](variant);
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const h = halo(); root.add(model, h); root.scale.setScalar(1.55);
  root.userData = { kind, variant, id, state: 'idle', home: new THREE.Vector3(), model, halo: h, baseScale: 1.55 };
  return root;
}
