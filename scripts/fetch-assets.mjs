// Downloads the hand model + optional CC0 textures/HDRI into public/ so everything is served locally.
// The app runs without the textures (procedural fallbacks); the hand model is required for hand tracking.
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const UA = 'EcoLens-college-project/1.0 (local asset fetch)';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

async function download(url, dest) {
  if (existsSync(dest)) { console.log('  have', dest); return true; }
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    console.log('  ok  ', dest);
    return true;
  } catch (e) { console.warn('  FAIL', dest, '-', e.message); return false; }
}

async function polyhaven(id, kind, dest) {
  try {
    const res = await fetch('https://api.polyhaven.com/files/' + id, { headers: { 'User-Agent': UA } });
    const files = await res.json();
    const url = kind === 'hdri' ? files.hdri?.['1k']?.hdr?.url : files.Diffuse?.['1k']?.jpg?.url;
    if (!url) throw new Error('no 1k file in API response');
    return download(url, dest);
  } catch (e) { console.warn('  FAIL', id, '-', e.message); return false; }
}

console.log('[setup] hand model');
await download(MODEL_URL, 'public/models/hand_landmarker.task');

console.log('[setup] Poly Haven (CC0) - Powered by Poly Haven');
const manifest = [];
const PH = [
  ['kloofendal_48d_partly_cloudy', 'hdri', 'public/assets/env.hdr'],
  ['brown_mud_leaves_01', 'tex', 'public/assets/ground_dead.jpg'],
  ['aerial_grass_rock', 'tex', 'public/assets/ground_live.jpg'],
  ['aerial_asphalt_01', 'tex', 'public/assets/road.jpg'],
  ['rough_plasterbrick_05', 'tex', 'public/assets/wall.jpg'],
  ['rocks_ground_02', 'tex', 'public/assets/rock.jpg'],
];
for (const [id, kind, dest] of PH) {
  const ok = await polyhaven(id, kind, dest);
  manifest.push({ id, source: 'polyhaven.com', license: 'CC0-1.0', file: dest.replace('public/', ''), downloaded: ok });
}
writeFileSync('public/assets/MANIFEST.json', JSON.stringify(manifest, null, 2));
console.log('[setup] done. Missing files are fine: EcoLens falls back to procedural materials.');
