import { CLEARING, riverX, riverDist } from '../scene/terrain.js';
import { KINDS } from './waste.js';
import { rng } from '../util/math.js';

export function spawnLayout(def) {
  const r = rng(def.seed), items = [];
  const numRiver = def.river || 0;

  // 1. River sludge items (organic, river: true)
  for (let i = 0; i < numRiver; i++) {
    const t = numRiver === 1 ? 0.5 : i / (numRiver - 1);
    const z = -0.7 + t * (0.9 - (-0.7));
    const jitter = (r() - 0.5) * 0.08;
    const x = riverX(z) + jitter;
    items.push({
      id: `${def.seed}-river-${i}`,
      kind: 'organic',
      variant: 0,
      x,
      z,
      rot: r() * 6.28,
      river: true,
      done: false,
    });
  }

  // 2. Remaining land items
  const kinds = [...KINDS];
  let guard = 0;
  const landCount = def.items - numRiver;
  while (items.length < def.items && guard++ < 800) {
    const x = -0.9 + r() * 1.6; // spawn x range -0.9..0.7
    const z = CLEARING.z0 + 0.05 + r() * (CLEARING.z1 - CLEARING.z0 - 0.1);
    if (riverDist(x, z) < 0.28 || items.some((i) => Math.hypot(i.x - x, i.z - z) < 0.26)) continue;
    const n = items.length;
    items.push({
      id: `${def.seed}-${n}`,
      kind: kinds[(n - numRiver) % 4],
      variant: Math.floor(r() * 2),
      x,
      z,
      rot: r() * 6.28,
      river: false,
      done: false,
    });
  }
  return items;
}
