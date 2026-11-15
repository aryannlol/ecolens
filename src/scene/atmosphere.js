import * as THREE from 'three';
import { rng, smooth, lerp } from '../util/math.js';
import { HALF } from './terrain.js';

function puffTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}

/** Smog (chimneys + ambient haze) and floating motes (ash when polluted, pollen and sparkles when clean). */
export class Atmosphere {
  constructor(stacks) {
    this.stacks = stacks; const tex = puffTexture(), r = rng(808);
    const NS = 120; this.smogN = NS;
    this.smogPos = new Float32Array(NS * 3); this.smogCol = new Float32Array(NS * 4); this.smogState = [];
    for (let i = 0; i < NS; i++) {
      const isChim = (i % 3 !== 0);
      this.smogState.push({
        life: r(), sp: 0.07 + r() * 0.08,
        st: isChim ? (i % stacks.length) : -1,
        ox: (r() * 2 - 1) * 1.05, oz: -0.85 + r() * 0.75, oy: 0.45 + r() * 0.35,
      });
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(this.smogPos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(this.smogCol, 4));
    this.smogMat = new THREE.PointsMaterial({ size: 0.9, map: tex, vertexColors: true, transparent: true, depthWrite: false, fog: false, sizeAttenuation: true });
    this.smog = new THREE.Points(sg, this.smogMat); this.smog.frustumCulled = false;
    const NM = 160; this.moteN = NM; this.motePos = new Float32Array(NM * 3); this.moteData = [];
    for (let i = 0; i < NM; i++) { this.moteData.push({ x: (r() * 2 - 1) * HALF, y: 0.05 + r() * 0.9, z: (r() * 2 - 1) * HALF, vx: (r() - 0.5) * 0.05, vy: (r() - 0.3) * 0.02, ph: r() * 6, tw: r() }); }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3));
    this.moteMat = new THREE.PointsMaterial({ size: 0.014, map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8, sizeAttenuation: true });
    this.motes = new THREE.Points(mg, this.moteMat); this.motes.frustumCulled = false;
    this.group = new THREE.Group(); this.group.add(this.smog, this.motes);
    this.wind = 0; this.windDir = 1;
  }
  gust(dir = 1) { this.wind = Math.min(this.wind + 1.8, 3.2); this.windDir = dir; }
  update(t, dt, rd, prof, air = 1) {
    if (this.wind > 0.01) this.wind -= dt * 0.65; else this.wind = 0;
    const polluted = prof.smog;
    for (let i = 0; i < this.smogN; i++) {
      const s = this.smogState[i]; s.life += dt * (s.sp + this.wind * 0.3); if (s.life > 1) s.life -= 1;
      const chim = (s.st >= 0 && s.st < this.stacks.length) ? this.stacks[s.st] : null;
      let x, y, z;
      if (chim) {
        const rise = s.life;
        x = chim.x + Math.sin(t * 1.2 + i * 0.6) * (0.05 + rise * 0.12) + rise * 0.14 + this.wind * this.windDir * 0.6;
        y = chim.y + rise * 0.55 + this.wind * 0.16;
        z = chim.z + rise * 0.2;
      } else {
        x = s.ox + Math.sin(t * 0.2 + i) * 0.08 + this.wind * this.windDir * 0.6;
        y = s.oy + Math.sin(t * 0.3 + i) * 0.03 + this.wind * 0.16;
        z = s.oz;
      }
      const pIdx = i * 3;
      this.smogPos[pIdx] = x; this.smogPos[pIdx + 1] = y; this.smogPos[pIdx + 2] = z;

      const bell = Math.sin(s.life * Math.PI);
      const windFade = Math.max(0.08, 1 - this.wind * 0.75);
      const capA = chim ? 0.35 : 0.2;
      const camFade = smooth(0.8, 0.2, z);
      const a = capA * bell * polluted * windFade * Math.max(0, 1 - air) * camFade;
      const c = lerp(0.2, 0.48, 1 - polluted);
      const cIdx = i * 4;
      this.smogCol[cIdx] = c * 1.05; this.smogCol[cIdx + 1] = c * 0.95; this.smogCol[cIdx + 2] = c * 0.85; this.smogCol[cIdx + 3] = a;
    }
    this.smog.geometry.attributes.position.needsUpdate = true; this.smog.geometry.attributes.color.needsUpdate = true;
    // motes
    this.moteMat.color.copy(prof.mote); this.moteMat.size = prof.moteSize * (1 + smooth(0.7, 1, rd) * 1.5); this.moteMat.opacity = 0.35 + 0.65 * smooth(0.0, 1, rd);
    for (let i = 0; i < this.moteN; i++) {
      const m = this.moteData[i];
      m.x += (m.vx + Math.sin(t * 0.3 + m.ph) * 0.01) * dt; m.y += (m.vy + Math.cos(t * 0.4 + m.ph) * 0.008) * dt;
      if (m.x > HALF) m.x = -HALF; if (m.x < -HALF) m.x = HALF; if (m.y > 1) m.y = 0.05; if (m.y < 0.03) m.y = 0.9;
      const mIdx = i * 3;
      this.motePos[mIdx] = m.x; this.motePos[mIdx + 1] = m.y + Math.sin(t * 2 + m.ph) * 0.006; this.motePos[mIdx + 2] = m.z;
    }
    this.motes.geometry.attributes.position.needsUpdate = true;
  }
}
