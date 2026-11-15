// Animated canvas-based eco meters — extracted from eco-meters.html.
// Self-contained: injects its own CSS + DOM into the page.
// API: import { ecoMeters } from './meters.js';
//      ecoMeters.setAir(0–1)  ecoMeters.setEco(0–1)  ecoMeters.reset()

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function rgb(h) { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); }
function mix(a, b, t) { const x = rgb(a), y = rgb(b); return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',') + ')'; }
function rng(n) { return () => (n = n * 16807 % 2147483647) / 2147483647; }

// ---- Base gauge ----
function Base(el, caps) {
  this.root = el; this.caps = caps;
  const well = el.querySelector('.em-well');
  this.well = well; this.cv = well.querySelector('canvas'); this.cx = this.cv.getContext('2d'); this.pct = well.querySelector('.em-pct');
  this.cap = document.createElement('div'); this.cap.className = 'em-cap'; well.appendChild(this.cap);
  this.v = 0; this.vel = 0; this.target = 0; this.glow = 0; this.fx = [];
  const self = this; new ResizeObserver(() => self.resize()).observe(well); this.resize(); this.init();
}
Base.prototype.resize = function () {
  const r = this.well.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
  this.w = r.width; this.h = r.height; this.cv.width = r.width * d; this.cv.height = r.height * d; this.cx.setTransform(d, 0, 0, d, 0, 0);
};
Base.prototype.set = function (p) {
  p = Math.max(0, Math.min(100, p)) / 100;
  if (p > this.target + 0.001) {
    this.burst(); this.vel += 0.015; this.glow = 1;
    this.root.classList.remove('em-pulse'); void this.root.offsetWidth; this.root.classList.add('em-pulse');
  }
  this.target = p;
};
Base.prototype.frame = function (t) {
  this.vel += (this.target - this.v) * 0.012; this.vel *= 0.9; this.v += this.vel; this.v = Math.max(0, this.v);
  this.glow *= 0.96; this.root.style.setProperty('--glow', this.glow.toFixed(3));
  const lvl = Math.min(1, this.v); this.cx.clearRect(0, 0, this.w, this.h);
  this.draw(this.cx, t, lvl, this.w, this.h);
  const p = Math.round(lvl * 100); this.pct.textContent = p + '%';
  let cap = this.caps[0][1]; this.caps.forEach(c => { if (p >= c[0]) cap = c[1]; }); this.cap.textContent = cap;
};
function inherit(C, proto) { C.prototype = Object.create(Base.prototype); for (const k in proto) C.prototype[k] = proto[k]; }

// ---- AIR gauge ----
function AirG(el) { Base.call(this, el, [[0, 'Toxic smog'], [20, 'Heavy haze'], [45, 'Thinning'], [70, 'Clear'], [95, 'Fresh air']]); }
inherit(AirG, {
  init() {
    const r = rng(7); this.puffs = []; this.streaks = []; this.ash = [];
    for (let i = 0; i < 20; i++) this.puffs.push({ x: r(), y: r(), s: 0.25 + r() * 0.4, v: 0.01 + r() * 0.025 });
    for (let i = 0; i < 12; i++) this.streaks.push({ x: r(), y: r(), l: 0.18 + r() * 0.3, v: 0.4 + r() });
    for (let i = 0; i < 26; i++) this.ash.push({ x: r(), y: r(), v: 0.01 + r() * 0.03, r: 0.8 + r() * 1.8 });
  },
  burst() { for (let i = 0; i < 9; i++) this.fx.push({ x: -60, y: Math.random() * this.h, l: this.w * (0.4 + Math.random() * 0.5), v: 9 + Math.random() * 9, life: 1 }); },
  draw(c, t, lvl, w, h) {
    const by = h * (1 - lvl), amp = reduce ? 1 : 4 + Math.min(10, Math.abs(this.vel) * 700);
    const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, mix('#2a2018', '#1c6b8c', lvl)); bg.addColorStop(1, '#7a5a35');
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    this.puffs.forEach(p => {
      const x = ((p.x * w * 1.4 + t * p.v) % (w * 1.4)) - w * 0.2, y = p.y * h, r = p.s * w;
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(92,66,44,' + (0.5 * (0.4 + 0.6 * (1 - lvl))) + ')'); g.addColorStop(1, 'rgba(92,66,44,0)');
      c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    });
    c.fillStyle = 'rgba(30,22,16,.7)';
    this.ash.forEach(a => { const y = (a.y * h + t * a.v) % h; if (y < by) { c.beginPath(); c.arc(a.x * w + Math.sin(t * 0.001 + a.y * 9) * 6, y, a.r, 0, 6.28); c.fill(); } });
    function edge(x) { return by + Math.sin(x * 0.025 + t * 0.0012) * amp + Math.sin(x * 0.06 - t * 0.0009) * amp * 0.5; }
    if (lvl > 0.004) {
      c.save(); c.beginPath(); c.moveTo(0, h);
      for (let x = 0; x <= w; x += 4) c.lineTo(x, edge(x));
      c.lineTo(w, h); c.closePath(); c.clip();
      const sky = c.createLinearGradient(0, by, 0, h); sky.addColorStop(0, '#d2f5ff'); sky.addColorStop(0.35, '#6fd4f7'); sky.addColorStop(1, '#2aa6e6');
      c.fillStyle = sky; c.fillRect(0, 0, w, h);
      c.lineCap = 'round'; c.lineWidth = 2;
      this.streaks.forEach(s => {
        const len = s.l * w, x0 = ((s.x * w + t * s.v * 0.12) % (w + len + 40)) - len, y = by + 18 + s.y * Math.max(0, h - by - 30);
        const g = c.createLinearGradient(x0, 0, x0 + len, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.strokeStyle = g; c.beginPath(); c.moveTo(x0, y); c.quadraticCurveTo(x0 + len * 0.5, y - 7, x0 + len, y); c.stroke();
      });
      c.restore();
      const fade = Math.min(1, (1 - lvl) * 8);
      for (let x = -10; x <= w + 10; x += 24) {
        const cy = edge(x) - 4 + Math.sin(x * 0.2 + t * 0.002) * 3, r = 22 + (Math.sin(x * 0.13) + 1) * 12;
        const g2 = c.createRadialGradient(x, cy, 0, x, cy, r); g2.addColorStop(0, 'rgba(255,255,255,' + 0.6 * fade + ')'); g2.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g2; c.fillRect(x - r, cy - r, r * 2, r * 2);
      }
    }
    if (lvl > 0.6) {
      const k = (lvl - 0.6) / 0.4, sg = c.createRadialGradient(w * 0.78, h * 0.12, 0, w * 0.78, h * 0.12, w * 0.8);
      sg.addColorStop(0, 'rgba(255,248,200,' + 0.75 * k + ')'); sg.addColorStop(1, 'rgba(255,248,200,0)');
      c.fillStyle = sg; c.fillRect(0, 0, w, h);
    }
    this.fx = this.fx.filter(f => {
      f.x += f.v; f.life -= 0.012; if (f.x > w + 40 || f.life <= 0) return false;
      const g = c.createLinearGradient(f.x - f.l, 0, f.x, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,' + 0.8 * f.life + ')');
      c.strokeStyle = g; c.lineWidth = 2.5; c.beginPath(); c.moveTo(f.x - f.l, f.y); c.lineTo(f.x, f.y); c.stroke(); return true;
    });
  }
});

// ---- ECO gauge ----
function EcoG(el) { Base.call(this, el, [[0, 'Barren'], [10, 'Sprouting'], [35, 'Growing'], [60, 'Flourishing'], [85, 'Thriving']]); }
inherit(EcoG, {
  init() {
    const r = rng(3); this.plants = [];
    const cols = ['#ff6fa5', '#ffd23f', '#b78cff', '#ff8a5c', '#ffffff'];
    const add = (k, n, a, b) => { for (let j = 0; j < n; j++) this.plants.push({ k, x: 0.05 + r() * 0.9, thr: a + r() * (b - a), g: 0, ph: r() * 6, s: r(), col: cols[Math.floor(r() * cols.length)] }); };
    add('tree', 3, 0.5, 0.85); add('bush', 3, 0.38, 0.65); add('flower', 7, 0.28, 0.7); add('sprout', 7, 0.04, 0.32); add('tuft', 26, 0.0, 0.25);
    for (let i = 0; i < 4; i++) { const q = this.plants.filter(p => p.k === 'tuft')[i]; q.thr = i * 0.012; }
    this.plants.filter(p => p.k === 'tree').forEach((p, i) => { p.x = 0.18 + i * 0.32 + r() * 0.08; });
  },
  burst() { for (let i = 0; i < 14; i++) this.fx.push({ x: this.w * Math.random(), y: this.h * 0.9, vx: (Math.random() - 0.5) * 1.2, vy: -(0.8 + Math.random() * 2), life: 1, ph: Math.random() * 6 }); },
  draw(c, t, lvl, w, h) {
    const u = h / 500, gh = h * 0.1, y0 = h - gh, sw = reduce ? 0 : 1;
    const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, mix('#2b2a26', '#2f9db8', lvl)); bg.addColorStop(1, mix('#4a4538', '#f6e7ae', lvl));
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    if (lvl > 0.45) { const k = (lvl - 0.45) / 0.55, sg = c.createRadialGradient(w * 0.8, h * 0.18, 0, w * 0.8, h * 0.18, w * 0.8); sg.addColorStop(0, 'rgba(255,240,180,' + 0.8 * k + ')'); sg.addColorStop(1, 'rgba(255,240,180,0)'); c.fillStyle = sg; c.fillRect(0, 0, w, h); }
    const greens = ['#2f8f3a', '#46b14a', '#69d05a'];
    this.plants.forEach(p => {
      p.g += (Math.max(0, Math.min(1, (lvl - p.thr) / 0.2)) - p.g) * 0.05; if (p.g < 0.01) return;
      const g = p.g, x = p.x * w, sway = Math.sin(t * 0.0015 + p.ph) * sw, gc = mix('#8a8a3a', greens[Math.floor(p.s * 2.99)].replace(/^#/, '#'), Math.min(1, lvl * 1.4));
      c.fillStyle = gc; c.strokeStyle = gc;
      if (p.k === 'tuft') { const hh = (12 + 14 * p.s) * u * g; for (let j = -1; j <= 1; j++) { const bx = x + j * 4 * u; c.beginPath(); c.moveTo(bx - 2 * u, y0); c.quadraticCurveTo(bx + sway * 3 * u, y0 - hh * 0.6, bx + sway * 6 * u + j * 3 * u, y0 - hh); c.quadraticCurveTo(bx + sway * 3 * u + 2 * u, y0 - hh * 0.5, bx + 2 * u, y0); c.fill(); } }
      else if (p.k === 'sprout') { const sh = 34 * u * g * (0.8 + 0.4 * p.s); c.lineWidth = 2 * u; c.beginPath(); c.moveTo(x, y0); c.quadraticCurveTo(x + sway * 3 * u, y0 - sh * 0.5, x + sway * 5 * u, y0 - sh); c.stroke();
        [-1, 1].forEach(d => { c.beginPath(); c.ellipse(x + sway * 5 * u + d * 7 * u * g, y0 - sh, 8 * u * g, 4 * u * g, d * -0.5, 0, 6.28); c.fill(); }); }
      else if (p.k === 'flower') { const fh = (50 + 40 * p.s) * u * g, hx = x + sway * 4 * u; c.lineWidth = 2 * u; c.beginPath(); c.moveTo(x, y0); c.quadraticCurveTo(x + sway * 2 * u, y0 - fh * 0.5, hx, y0 - fh); c.stroke();
        c.fillStyle = p.col; for (let a = 0; a < 5; a++) { c.beginPath(); c.arc(hx + Math.cos(a * 1.257) * 5 * u * g, y0 - fh + Math.sin(a * 1.257) * 5 * u * g, 4 * u * g, 0, 6.28); c.fill(); }
        c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(hx, y0 - fh, 3 * u * g, 0, 6.28); c.fill(); }
      else if (p.k === 'bush') { const r0 = 16 * u * g * (1 + 0.3 * p.s); [[0, 0, 1], [-12, 3, 0.75], [12, 3, 0.75]].forEach((o, i) => { c.fillStyle = greens[i % 3]; c.beginPath(); c.arc(x + o[0] * u * g, y0 - 8 * u * g + o[1] * u, r0 * o[2], 0, 6.28); c.fill(); }); }
      else { const th = (70 + 50 * p.s) * u * g, cr = (28 + 12 * p.s) * u * g, tx = x + sway * 3 * u; c.fillStyle = '#6b4a2b'; c.fillRect(x - 3.5 * u, y0 - th, 7 * u, th + 3 * u);
        [[0, -14, 1, 0], [-16, -2, 0.75, 1], [16, -2, 0.75, 2], [0, -30, 0.7, 2]].forEach(o => { c.fillStyle = greens[o[3]]; c.beginPath(); c.arc(tx + o[0] * u * g, y0 - th + o[1] * u * g, cr * o[2], 0, 6.28); c.fill(); }); }
    });
    c.fillStyle = mix('#5a3d22', '#4a3220', lvl); c.fillRect(0, y0, w, gh);
    c.fillStyle = mix('#8a8240', '#3fbf3a', Math.pow(lvl, 0.6)); c.fillRect(0, y0 - 2 * u, w, 7 * u);
    if (lvl > 0.55) {
      const al = Math.min(1, (lvl - 0.55) * 4), cols = ['#ff8ad0', '#ffd23f', '#8fd3ff'];
      for (let i = 1; i <= 3; i++) {
        const bx = w * (0.5 + 0.34 * Math.sin(t * 0.0004 * i + i)), by = h * (0.5 + 0.12 * Math.cos(t * 0.0006 * i + 2 * i)), f = Math.abs(Math.sin(t * 0.016 + i)) * 6 * u + 1;
        c.globalAlpha = al; c.fillStyle = cols[i - 1]; c.beginPath(); c.ellipse(bx - 5 * u, by, 5 * u, f, 0.3, 0, 6.28); c.ellipse(bx + 5 * u, by, 5 * u, f, -0.3, 0, 6.28); c.fill(); c.globalAlpha = 1;
      }
    }
    if (lvl > 0.85) {
      const ba = Math.min(1, (lvl - 0.85) * 7); c.strokeStyle = 'rgba(255,255,255,' + ba + ')'; c.lineWidth = 2; c.lineCap = 'round';
      for (let i = 0; i < 2; i++) { const px = ((t * 0.03 + i * w * 0.5) % (w + 60)) - 30, py = h * (0.2 + 0.07 * i) + Math.sin(t * 0.002 + i) * 8, fl = Math.sin(t * 0.012 + i) * 3 * u;
        c.beginPath(); c.moveTo(px - 8 * u, py - 3 * u + fl); c.quadraticCurveTo(px - 2 * u, py - 1 * u, px, py); c.quadraticCurveTo(px + 2 * u, py - 1 * u, px + 8 * u, py - 3 * u + fl); c.stroke(); }
    }
    this.fx = this.fx.filter(f => {
      f.x += f.vx + Math.sin(t * 0.004 + f.ph) * 0.4; f.y += f.vy; f.vy += 0.012; f.life -= 0.01; if (f.life <= 0) return false;
      c.globalAlpha = f.life; c.fillStyle = '#9bff6a'; c.beginPath(); c.ellipse(f.x, f.y, 5, 2.4, f.ph + t * 0.003, 0, 6.28); c.fill(); c.globalAlpha = 1; return true;
    });
  }
});

// ---- CSS ----
const CSS = `
#eco-meters{position:absolute;right:clamp(16px,2.8vw,44px);top:50%;transform:translateY(-50%);display:flex;align-items:center;z-index:10;pointer-events:none;font-family:var(--font,'Bricolage Grotesque',system-ui,sans-serif)}
.em-gauge{position:relative;width:clamp(150px,17vw,285px);height:clamp(340px,62vh,590px);pointer-events:none;border-radius:36px;padding:clamp(46px,8.5vh,64px) 14px 16px;display:flex;flex-direction:column;align-items:center;
  background:linear-gradient(180deg,#0f3d27 0%,#072617 100%);border:3px solid #2e9a4f;
  box-shadow:0 0 28px rgba(60,220,110,0.45),inset 0 2px 0 rgba(255,255,255,0.22);transition:transform .3s ease}
.em-gauge.em-pulse{animation:em-pulse .9s ease-out}
@keyframes em-pulse{0%{transform:scale(1)}25%{transform:scale(1.03)}100%{transform:scale(1)}}
.em-head{position:absolute;top:14px;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:8px;font-weight:800;font-size:clamp(1.05rem,1.7vw,1.45rem);letter-spacing:.05em;color:#ffffff;text-transform:uppercase}
.em-head svg{width:clamp(20px,2.2vw,28px);height:clamp(20px,2.2vw,28px);color:#56ff78}
.em-well{position:relative;flex:1;width:100%;border-radius:28px;overflow:hidden;background:#031109;border:2px solid rgba(120,255,170,0.35);box-shadow:inset 0 0 16px rgba(0,0,0,0.7)}
.em-well canvas{position:absolute;inset:0;width:100%;height:100%}
.em-well::after{content:'';position:absolute;left:8px;top:12px;width:6px;height:65%;border-radius:99px;background:linear-gradient(180deg,rgba(255,255,255,0.45) 0%,rgba(255,255,255,0.05) 80%,transparent 100%);pointer-events:none;z-index:2}
.em-pct{position:absolute;top:42%;left:50%;transform:translate(-50%,-50%);font-weight:800;font-size:clamp(2.1rem,3.6vw,3.3rem);color:#ffffff;text-shadow:0 2px 14px rgba(0,0,0,0.7),0 0 24px rgba(0,0,0,0.4);z-index:3;pointer-events:none;letter-spacing:-0.02em}
.em-cap{position:absolute;top:calc(42% + clamp(1.8rem,2.7vw,2.4rem));left:0;right:0;text-align:center;font-weight:800;font-size:clamp(0.75rem,1.15vw,1.05rem);letter-spacing:.12em;text-transform:uppercase;color:#ffffff;text-shadow:0 2px 10px rgba(0,0,0,0.75);z-index:3;pointer-events:none}
.em-tick{display:none}
.em-link{position:relative;width:clamp(66px,7.5vw,94px);aspect-ratio:1;display:grid;place-content:center;text-align:center;z-index:12;margin:0 clamp(-26px,-2.2vw,-14px);background:rgba(10,38,24,0.92);border-radius:50%;box-shadow:0 6px 20px rgba(0,0,0,0.55)}
.em-link::before{content:'';position:absolute;inset:-3px;border-radius:50%;border:2.5px dashed #56ff78;animation:em-spin 20s linear infinite;box-shadow:0 0 14px rgba(86,255,120,0.4)}
.em-link-content{display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.15}
.em-link-leaf{width:clamp(14px,1.5vw,18px);height:clamp(14px,1.5vw,18px);color:#56ff78;margin-bottom:2px}
.em-link b{font-size:clamp(0.95rem,1.5vw,1.35rem);font-weight:800;color:#ffffff}
.em-link small{font-size:clamp(0.48rem,0.7vw,0.62rem);color:#9fe2a8;font-variant:all-small-caps;letter-spacing:.12em;font-weight:700}
@keyframes em-spin{to{transform:rotate(360deg)}}
@media (max-width:700px){
  .em-gauge{width:92px;height:260px;border-radius:24px;padding:36px 6px 8px}
  .em-pct{font-size:1.4rem;top:40%}
  .em-cap{font-size:0.55rem;top:calc(40% + 1.2rem)}
  .em-link{width:52px;margin:0 -12px}
}
@media(prefers-reduced-motion:reduce){.em-gauge.em-pulse,.em-link::before{animation:none}}`;

// ---- DOM ----
const WIND_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8a2.5 2.5 0 1 1-2.5 2.5"/></svg>';
const LEAF_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-8M12 13c-5 0-8-3-8-8 5 0 8 3 8 8zM12 15c0-4 3-7 8-7 0 4-3 7-8 7z"/></svg>';

function gaugeHTML(id, label, iconSVG) {
  return `<section class="em-gauge" id="em-${id}"><div class="em-head">${iconSVG} ${label}</div><div class="em-well"><canvas></canvas><div class="em-pct">0%</div></div></section>`;
}

let air, eco, avgEl, injected = false;

function inject() {
  if (injected) return;
  injected = true;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const panel = document.createElement('div'); panel.id = 'eco-meters';
  panel.innerHTML =
    gaugeHTML('air', 'AIR', WIND_SVG) +
    `<div class="em-link"><div class="em-link-content">${LEAF_SVG}<b id="em-avg">0%</b><small>BALANCE</small></div></div>` +
    gaugeHTML('eco', 'ECO', LEAF_SVG);

  // Insert into #stage if it exists, else body
  const stage = document.getElementById('stage');
  (stage || document.body).appendChild(panel);

  air = new AirG(document.getElementById('em-air'));
  eco = new EcoG(document.getElementById('em-eco'));
  avgEl = document.getElementById('em-avg');

  // animation loop
  function loop(t) {
    air.frame(t); eco.frame(t);
    avgEl.textContent = Math.round((Math.min(1, air.v) + Math.min(1, eco.v)) / 2 * 100) + '%';
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

export const ecoMeters = {
  /** Set air quality (0–1) */
  setAir(v) { inject(); air.set(v * 100); },
  /** Set eco/restoration (0–1) */
  setEco(v) { inject(); eco.set(v * 100); },
  /** Reset both to zero */
  reset() { if (air) { air.target = 0; eco.target = 0; } },
  /** Eagerly inject DOM (called once at startup) */
  init() { inject(); },
};
