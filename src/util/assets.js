import * as THREE from 'three';
const cache = new Map();
/** Loads a texture if the file exists (e.g. fetched by `npm run setup`); resolves null otherwise. Cached by URL. */
export function tryTexture(url, srgb = true) {
  if (cache.has(url)) return cache.get(url);
  const p = fetch(url, { method: 'HEAD' }).then((r) => {
    const ok = r.ok && (r.headers.get('content-type') || '').startsWith('image');
    if (!ok) return null;
    return new Promise((res) => new THREE.TextureLoader().load(url, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; res(t);
    }, undefined, () => res(null)));
  }).catch(() => null);
  cache.set(url, p); return p;
}
