import gsap from 'gsap';
import { CONFIG } from '../config.js';
import { ecoMeters } from './meters.js';
import { videoToStage, STAGE_GEOM } from '../util/stageMap.js';

const $ = (id) => document.getElementById(id);
const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

export class HUD {
  constructor() {
    this.cursor = $('cursor'); this.overlay = $('hand-overlay'); this.ctx = this.overlay.getContext('2d');
    this.showSkeleton = false; this.toastTimer = null;
    this.debugHand = new URLSearchParams(location.search).get('debug') === 'hand';
    this.debugHandEl = null;
    ecoMeters.init();
  }
  setTracking(text) { $('st-track').textContent = text; }
  setHand(text, on) { const e = $('st-hand'); if (!e) return; e.title = text; e.classList.toggle('active', !!on); }
  setWorld(id, label) { document.body.dataset.world = id; $('meter-world').textContent = label; }
  setProgress(sorted, total) { $('meter-count').textContent = `${sorted}/${total}`; }
  setAir(air) { ecoMeters.setAir(air); }
  setMeter(rd) { ecoMeters.setEco(rd); }
  hint(text) { $('hint').textContent = text; }
  toast(text, tone = 'good') {
    const t = $('toast'); t.textContent = text; t.dataset.tone = tone;
    gsap.killTweensOf(t); gsap.fromTo(t, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.2 }); gsap.to(t, { autoAlpha: 0, duration: 0.4, delay: tone === 'bad' ? 3 : 1.8 });
  }
  /** Cursor ring follows fingertip pinch point; state classes: idle, hover, grab. */
  setCursor(input, state) {
    const c = this.cursor;
    if (!input.present) { c.style.opacity = 0; return; }
    const st = $('stage').getBoundingClientRect();
    c.style.opacity = 1;
    const px = Math.max(0, Math.min(st.width, input.stageCursor.x * st.width));
    const py = Math.max(0, Math.min(st.height, input.stageCursor.y * st.height));
    c.style.transform = `translate(${px}px, ${py}px)`;
    c.dataset.state = state; c.dataset.src = input.source;
  }

  _updateSelfTest() {
    if (!this.debugHandEl) {
      this.debugHandEl = document.createElement('div');
      this.debugHandEl.id = 'debug-hand';
      this.debugHandEl.style.cssText = 'position:fixed;top:68px;left:14px;background:rgba(0,0,0,0.85);color:#00ffff;font:11px/1.4 monospace;padding:8px 12px;border-radius:6px;z-index:9999;pointer-events:none;border:1px solid rgba(0,255,255,0.3);';
      document.body.appendChild(this.debugHandEl);
    }
    const c = videoToStage(0.5, 0.5);
    const centerPass = Math.abs(c.x - 0.5) <= 0.01 && Math.abs(c.y - 0.5) <= 0.01;
    const { cropX, cropY, visW, visH, mirrored } = STAGE_GEOM;
    const cl = (v) => Math.max(0, Math.min(1, v)); // videoToStage now clamps
    const c00 = videoToStage(0, 0);
    const expX0 = cl(mirrored ? (1 + cropX / visW) : (-cropX / visW));
    const expY0 = cl(-cropY / visH);
    const pass00 = Math.abs(c00.x - expX0) < 0.01 && Math.abs(c00.y - expY0) < 0.01;

    const c10 = videoToStage(1, 0);
    const expX10 = cl(mirrored ? (-cropX / visW) : (1 + cropX / visW));
    const pass10 = Math.abs(c10.x - expX10) < 0.01 && Math.abs(c10.y - expY0) < 0.01;

    const c01 = videoToStage(0, 1);
    const expY1 = cl(1 + cropY / visH);
    const pass01 = Math.abs(c01.x - expX0) < 0.01 && Math.abs(c01.y - expY1) < 0.01;

    const c11 = videoToStage(1, 1);
    const pass11 = Math.abs(c11.x - expX10) < 0.01 && Math.abs(c11.y - expY1) < 0.01;

    this.debugHandEl.innerHTML = `
<b>HAND MAPPING SELF-TEST (?debug=hand)</b><br>
Center (0.5, 0.5): (${c.x.toFixed(3)}, ${c.y.toFixed(3)}) [${centerPass ? '<span style="color:#56ff78">PASS</span>' : '<span style="color:#ff5555">FAIL</span>'}]<br>
Corner (0, 0): (${c00.x.toFixed(3)}, ${c00.y.toFixed(3)}) exp (${expX0.toFixed(3)}, ${expY0.toFixed(3)}) [${pass00 ? '<span style="color:#56ff78">PASS</span>' : '<span style="color:#ff5555">FAIL</span>'}]<br>
Corner (1, 0): (${c10.x.toFixed(3)}, ${c10.y.toFixed(3)}) exp (${expX10.toFixed(3)}, ${expY0.toFixed(3)}) [${pass10 ? '<span style="color:#56ff78">PASS</span>' : '<span style="color:#ff5555">FAIL</span>'}]<br>
Corner (0, 1): (${c01.x.toFixed(3)}, ${c01.y.toFixed(3)}) exp (${expX0.toFixed(3)}, ${expY1.toFixed(3)}) [${pass01 ? '<span style="color:#56ff78">PASS</span>' : '<span style="color:#ff5555">FAIL</span>'}]<br>
Corner (1, 1): (${c11.x.toFixed(3)}, ${c11.y.toFixed(3)}) exp (${expX10.toFixed(3)}, ${expY1.toFixed(3)}) [${pass11 ? '<span style="color:#56ff78">PASS</span>' : '<span style="color:#ff5555">FAIL</span>'}]
`;
  }

  drawHand(landmarks, input = null) {
    const ctx = this.ctx, w = this.overlay.width, h = this.overlay.height;
    ctx.clearRect(0, 0, w, h);

    if (this.debugHand) this._updateSelfTest();
    if (!landmarks || (!this.showSkeleton && !this.debugHand)) return;

    const mapped = landmarks.map((p) => {
      const pt = videoToStage(p.x, p.y);
      return { x: pt.x * w, y: pt.y * h };
    });

    if (this.showSkeleton) {
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(220,255,225,0.6)'; ctx.fillStyle = 'rgba(220,255,225,0.9)';
      for (const [a, b] of BONES) {
        ctx.beginPath(); ctx.moveTo(mapped[a].x, mapped[a].y); ctx.lineTo(mapped[b].x, mapped[b].y); ctx.stroke();
      }
      for (const p of mapped) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 6.28); ctx.fill();
      }
    }

    if (this.debugHand) {
      // (a) 21 raw landmarks as small dots
      ctx.fillStyle = '#ffffff';
      for (const p of mapped) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, 6.28); ctx.fill();
      }

      // (b) Magenta crosshair at the palm
      if (input?.stagePalm) {
        const px = input.stagePalm.x * w, py = input.stagePalm.y * h;
        ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(px - 14, py); ctx.lineTo(px + 14, py);
        ctx.moveTo(px, py - 14); ctx.lineTo(px, py + 14);
        ctx.stroke();
      }

      // (c) Cyan crosshair at the index tip (landmark 8)
      if (mapped[8]) {
        const ix = mapped[8].x, iy = mapped[8].y;
        ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ix - 14, iy); ctx.lineTo(ix + 14, iy);
        ctx.moveTo(ix, iy - 14); ctx.lineTo(ix, iy + 14);
        ctx.stroke();
      }

      // (d) Brush ring
      if (input?.brushPos) {
        const bx = input.brushPos.x * w, by = input.brushPos.y * h;
        const rad = Math.max(70, ((input.palmSpeed || 0) > 1.0 ? 0.28 : 0.14) * h);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(bx, by, rad, 0, 6.28); ctx.stroke();
      }
    }
  }

  setLocked(on) {
    const b = $('btn-lock');
    if (b) {
      b.dataset.locked = on ? '1' : '0';
      const lbl = $('lock-label');
      if (lbl) lbl.textContent = on ? 'Locked' : 'Lock';
      b.classList.toggle('top-active', !!on);
      b.classList.toggle('top-dimmed', !on);
      b.title = on ? 'Locked (L to unlock)' : 'Lock Marker (L)';
    }
  }
  hideStart() { gsap.to($('start'), { autoAlpha: 0, duration: 0.4 }); }
  startNote(t) { $('start-note').textContent = t; }
}
