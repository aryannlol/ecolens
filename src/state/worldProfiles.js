import * as THREE from 'three';
import { clamp } from '../util/math.js';

// Look keyframes at recovery 0 / 0.5 / 1, matching the Polluted / Recovering / Clean markers.
const KEYS = [
  { at: 0.0, sun: 0xb88a55, sunI: 1.1, hemiSky: 0x7c6a58, hemiGround: 0x2b2118, hemiI: 0.75, exposure: 0.8, fog: 0x8a7458, fogK: 0.28, smog: 0.9, water: 0x165243, waterOpacity: 0.96, waterRough: 0.18, env: 0.45, mote: 0x9b8567, moteSize: 0.012, sheen: 1.0, sky: 0x6e6252 },
  { at: 0.5, sun: 0xf0d8a0, sunI: 2.1, hemiSky: 0xa8b9a0, hemiGround: 0x3b4a30, hemiI: 0.95, exposure: 0.95, fog: 0xb7c0a8, fogK: 0.15, smog: 0.35, water: 0x228080, waterOpacity: 0.88, waterRough: 0.10, env: 0.75, mote: 0xcfd9a0, moteSize: 0.014, sheen: 0.4, sky: 0xa9b8a0 },
  { at: 1.0, sun: 0xfff4dc, sunI: 3.2, hemiSky: 0xb5e6ff, hemiGround: 0x48a832, hemiI: 1.1, exposure: 1.15, fog: 0xd9efff, fogK: 0.07, smog: 0.0, water: 0x26c2e0, waterOpacity: 0.72, waterRough: 0.03, env: 1.0, mote: 0xfff2b0, moteSize: 0.018, sheen: 0.0, sky: 0xb0e8ff },
];
const COLOR_KEYS = ['sun', 'hemiSky', 'hemiGround', 'fog', 'water', 'mote', 'sky'];
const NUM_KEYS = ['sunI', 'hemiI', 'exposure', 'fogK', 'smog', 'waterOpacity', 'waterRough', 'env', 'moteSize', 'sheen'];
const _a = new THREE.Color(), _b = new THREE.Color();

/** Interpolated lighting/atmosphere/water profile for recovery rd. */
export function profileAt(rd, out = {}) {
  const r = clamp(rd);
  const i = r < 0.5 ? 0 : 1;
  const k0 = KEYS[i], k1 = KEYS[i + 1];
  const t = (r - k0.at) / (k1.at - k0.at);
  const e = t * t * (3 - 2 * t);
  for (const k of NUM_KEYS) out[k] = k0[k] + (k1[k] - k0[k]) * e;
  for (const k of COLOR_KEYS) { out[k] = out[k] || new THREE.Color(); out[k].copy(_a.set(k0[k])).lerp(_b.set(k1[k]), e); }
  return out;
}
