import gsap from 'gsap';
import { CONFIG } from '../config.js';
import { ecoMeters } from './meters.js';

const $ = (id) => document.getElementById(id);
const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

export class HUD {
  constructor() {
    this.cursor = $('cursor'); this.overlay = $('hand-overlay'); this.ctx = this.overlay.getContext('2d');
    this.showSkeleton = false; this.toastTimer = null;
    ecoMeters.init();
  }
  setTracking(text) { $('st-track').textContent = text; }
  setHand(text, on) { const e = $('st-hand'); if (!e) return; e.title = text; e.classList.toggle('active', !!on); }
  setWorld(id, label) { document.body.dataset.world = id; $('meter-world').textContent = label; }
  setProgress(sorted, total) { $('meter-count').textContent = `${sorted}/${total}`; }
  setAir(air) { ecoMeters.setAir(air); }
  setMeter(rd) { ecoMeters.setEco(rd); }
  setSmogVisual() {}
  hint(text) { $('hint').textContent = text; }
  toast(text, tone = 'good') {
    const t = $('toast'); t.textContent = text; t.dataset.tone = tone;
    gsap.killTweensOf(t); gsap.fromTo(t, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.2 }); gsap.to(t, { autoAlpha: 0, duration: 0.4, delay: tone === 'bad' ? 3 : 1.8 });
  }
  /** Cursor ring follows the pinch point; state classes: idle, hover, grab. */
  setCursor(input, state) {
    const c = this.cursor;
    if (!input.present) { c.style.opacity = 0; return; }
    const st = $('stage').getBoundingClientRect();
    c.style.opacity = 1; c.style.transform = `translate(${(input.ndc.x * 0.5 + 0.5) * st.width}px, ${(-input.ndc.y * 0.5 + 0.5) * st.height}px)`;
    c.dataset.state = state; c.dataset.src = input.source;
  }
  drawHand(landmarks) {
    const ctx = this.ctx, w = this.overlay.width, h = this.overlay.height; ctx.clearRect(0, 0, w, h);
    if (!this.showSkeleton || !landmarks) return;
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(220,255,225,0.6)'; ctx.fillStyle = 'rgba(220,255,225,0.9)';
    for (const [a, b] of BONES) { ctx.beginPath(); ctx.moveTo((1 - landmarks[a].x) * w, landmarks[a].y * h); ctx.lineTo((1 - landmarks[b].x) * w, landmarks[b].y * h); ctx.stroke(); }
    for (const p of landmarks) { ctx.beginPath(); ctx.arc((1 - p.x) * w, p.y * h, 3, 0, 7); ctx.fill(); }
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
export { CONFIG };
