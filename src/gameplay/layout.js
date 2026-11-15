import { CLEARING } from '../scene/terrain.js';
import { KINDS } from './waste.js';
import { rng } from '../util/math.js';

export function spawnLayout(def) {
  const r = rng(def.seed), items = [], kinds = [...KINDS];
  let guard = 0;
  while (items.length < def.items && guard++ < 800) {
    const x = -0.9 + r() * 1.6; // spawn x range -0.9..0.7
    const z = CLEARING.z0 + 0.05 + r() * (CLEARING.z1 - CLEARING.z0 - 0.1);
    if (items.some((i) => Math.hypot(i.x - x, i.z - z) < 0.26)) continue;
    const n = items.length;
    items.push({ id: `${def.seed}-${n}`, kind: kinds[n % 4], variant: Math.floor(r() * 2), x, z, rot: r() * 6.28, done: false });
  }
  return items;
}
