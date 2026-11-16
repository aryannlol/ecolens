// src/ui/haze.js
// Screen-space 192x108 density field drawn on <canvas id="haze">.
// Full rewrite conforming strictly to specification:
// - State per world stored externally (states[id].haze).
// - Forgiving wiping with smoothed cursor, segment sweep, dynamic brush radius & strength.
// - Visible white outline brush ring around cursor + pale grey dust motes.
// - Strict regrowth: 30s delay, polluted only, rd < 0.5, 0.0008/sec, capped at 0.35 total coverage.
// - ?debug=haze on-screen diagnostic readout.

export function createInitialHaze(world) {
  const gw = 192, gh = 108;
  const grid = new Float32Array(gw * gh);
  const base = world === 'polluted' ? 0.85 : world === 'recovering' ? 0.35 : 0.0;
  if (base === 0) return grid;

  for (let y = 0; y < gh; y++) {
    const v = y / gh;
    for (let x = 0; x < gw; x++) {
      const u = x / gw;
      // 2 octaves of smooth noise for wispy smoke
      const n1 = Math.sin(u * 12.56 + 0.5) * 0.35 + Math.sin(v * 12.56 + 1.2) * 0.35;
      const n2 = Math.sin((u + v) * 25.13 + 0.8) * 0.2 + Math.sin((u - v) * 25.13 + 2.1) * 0.2;
      const d = Math.max(0, Math.min(1, base + (n1 + n2) * 0.28));
      grid[y * gw + x] = d;
    }
  }
  return grid;
}

export class Haze {
  constructor(stageEl) {
    this.stageEl = stageEl;
    this.gw = 192;
    this.gh = 108;
    this.density = new Float32Array(this.gw * this.gh);
    this.world = 'polluted';
    this.lastWipeTime = 0;
    this.lastGustTime = 0;
    this.air = 1.0;
    this.drift = 0; // field offset in grid cells; used by draw, wipe and lookup so they always agree

    // Offscreen 192x108 canvas for density upload
    this.offCanvas = document.createElement('canvas');
    this.offCanvas.width = this.gw;
    this.offCanvas.height = this.gh;
    this.offCtx = this.offCanvas.getContext('2d');
    this.imgData = this.offCtx.createImageData(this.gw, this.gh);

    // Visible canvas inside #stage
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'haze';
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;';
    stageEl.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // Wipe smoothing & feedback
    this.smoothCursor = null;
    this.prevCursor = null;
    this.motes = [];
    this.wKeyAnim = null;

    // Debug readout (?debug=haze)
    this.showDebug = new URLSearchParams(location.search).get('debug') === 'haze';
    this.debugEl = null;
    this.debugStats = { mean: 0, x: 0, y: 0, speed: 0, strength: 0, lastWipeSec: 0 };
    this._warnCooldown = 0;
    this._handMovingSince = 0;
    this._prevMeanForWarn = 1;
    this._cellsClearedBucket = 0;
    this._cellsClearedSec = 0;
    this._bucketResetTime = 0;
    if (this.showDebug) {
      this.debugEl = document.createElement('div');
      this.debugEl.id = 'debug-haze';
      this.debugEl.style.cssText = 'position:fixed;bottom:10px;left:10px;background:rgba(0,0,0,0.85);color:#5dff6a;font:11px/1.4 monospace;padding:6px 10px;border-radius:6px;z-index:9999;pointer-events:none;border:1px solid rgba(255,255,255,0.2);';
      document.body.appendChild(this.debugEl);
    }

    this.resize();
    new ResizeObserver(() => this.resize()).observe(stageEl);
  }

  resize(w, h) {
    const r = this.stageEl.getBoundingClientRect();
    const width = w || r.width || innerWidth;
    const height = h || r.height || innerHeight;
    this.canvas.width = Math.floor(width);
    this.canvas.height = Math.floor(height);
  }

  setDensityArray(density, world) {
    this.density = density;
    this.world = world;
    this.air = Math.max(0, Math.min(1, 1 - this.meanDensity()));
  }

  meanDensity() {
    if (!this.density) return 0;
    let sum = 0;
    const len = this.density.length;
    for (let i = 0; i < len; i++) sum += this.density[i];
    return sum / len;
  }

  densityAt(ndc) {
    if (!ndc || !this.density) return 0;
    const nx = ndc.x * 0.5 + 0.5;
    const ny = -ndc.y * 0.5 + 0.5;
    const gx = Math.floor(Math.max(0, Math.min(this.gw - 1, nx * this.gw + this.drift)));
    const gy = Math.floor(Math.max(0, Math.min(this.gh - 1, ny * this.gh)));
    return this.density[gy * this.gw + gx];
  }

  triggerWKey(now = performance.now()) {
    this.wKeyAnim = { start: now, duration: 600, amount: 0.25, applied: 0 };
  }

  _sweep(x0, y0, x1, y1, radiusPx, strength, dt, now, W, H, sound, atmo) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (radiusPx * 0.35)));
    const subDt = dt / steps;
    let removedTotal = 0;

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const px = x0 + (x1 - x0) * t;
      const py = y0 + (y1 - y0) * t;

      const gx = (px / W) * this.gw + this.drift;
      const gy = (py / H) * this.gh;
      const gr = (radiusPx / H) * this.gh;

      const minX = Math.max(0, Math.floor(gx - gr));
      const maxX = Math.min(this.gw - 1, Math.ceil(gx + gr));
      const minY = Math.max(0, Math.floor(gy - gr));
      const maxY = Math.min(this.gh - 1, Math.ceil(gy + gr));

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const d = Math.hypot(x - gx, y - gy);
          if (d < gr) {
            // flat core (full strength inside 55% of the radius) with a soft edge, so a pass leaves a clean path
            const falloff = d < gr * 0.55 ? 1 : (1 - d / gr) / 0.45;
            const idx = y * this.gw + x;
            const oldVal = this.density[idx];
            const decr = 7.0 * strength * falloff * subDt;
            let newVal = Math.max(0, oldVal - decr);
            if (newVal < 0.08) newVal = 0; // snap thin leftovers to clear so wiping actually finishes
            this.density[idx] = newVal;
            removedTotal += (oldVal - newVal);
          }
        }
      }
    }

    if (removedTotal > 0.04) {
      this.lastWipeTime = now;
      this._cellsClearedBucket = (this._cellsClearedBucket || 0) + removedTotal * this.gw * this.gh;
      // Spawn 6-8 tiny pale grey dust motes at the wipe point (fade in 0.5s)
      const moteCount = 6 + Math.floor(Math.random() * 3);
      for (let m = 0; m < moteCount; m++) {
        this.motes.push({
          x: x1 + (Math.random() - 0.5) * radiusPx * 0.5,
          y: y1 + (Math.random() - 0.5) * radiusPx * 0.5,
          vx: (Math.random() - 0.5) * 35,
          vy: (Math.random() - 0.5) * 35,
          r: 1.5 + Math.random() * 2,
          t: now,
        });
      }

      if (removedTotal > 0.8 && now - this.lastGustTime > 600) {
        this.lastGustTime = now;
        if (sound?.wind) sound.wind();
        if (atmo?.gust) atmo.gust(Math.sign(x1 - x0) || 1);
      }
    }
  }

  update(now, dt, input, grab, rd, sound, atmo) {
    const W = this.canvas.width || 1280;
    const H = this.canvas.height || 720;
    const timeSec = now / 1000;
    // Bounded drift (+-1.4 cells, ~0.7% of the width). It used to scroll the whole field up to 100% of the
    // width, so the hole you wiped slid away from your hand and the smog seemed to come back.
    this.drift = Math.sin(timeSec * 0.35) * 1.4;
    const wobble = 1 + 0.06 * Math.sin(timeSec * 1.5);

    // 1. W key animation: 25% clear over 0.6s
    if (this.wKeyAnim) {
      const elapsed = now - this.wKeyAnim.start;
      const progress = Math.min(1, elapsed / this.wKeyAnim.duration);
      const targetApplied = this.wKeyAnim.amount * progress;
      const delta = targetApplied - this.wKeyAnim.applied;
      this.wKeyAnim.applied = targetApplied;
      for (let i = 0; i < this.density.length; i++) {
        this.density[i] = Math.max(0, this.density[i] - delta);
      }
      this.lastWipeTime = now;
      if (progress >= 1) this.wKeyAnim = null;
    }

    // 2. Cursor tracking & wiping
    let canWipe = false;
    let handPresent = false;
    let rawX = 0, rawY = 0;
    let palmSpeed = 0;

    if (input && input.present) {
      handPresent = true;
      const isHolding = grab && grab.state === 'holding';
      if (input.source === 'hand' && !isHolding) {
        // No pinch gate — wipe whenever hand present and not holding
        canWipe = true;
      } else if (input.source === 'mouse' && input.mouse.down && !isHolding) {
        canWipe = true;
      }
      // Use palm NDC for brush position when hand mode; fallback to cursor ndc
      const brushNdc = (input.source === 'hand' && input.palmNdc) ? input.palmNdc : input.ndc;
      rawX = (brushNdc.x * 0.5 + 0.5) * W;
      rawY = (-brushNdc.y * 0.5 + 0.5) * H;
      palmSpeed = (input.source === 'hand' && input.hand?.palmSpeed != null) ? input.hand.palmSpeed : 0;
    }

    let speedStageH = 0;
    let strength = 0.25;
    let radiusPx = Math.max(70, 0.16 * H);

    if (handPresent) {
      // Light low-pass smoothing (alpha 0.5)
      if (!this.smoothCursor) {
        this.smoothCursor = { x: rawX, y: rawY };
        this.prevCursor = { x: rawX, y: rawY };
      } else {
        this.smoothCursor.x = this.smoothCursor.x * 0.5 + rawX * 0.5;
        this.smoothCursor.y = this.smoothCursor.y * 0.5 + rawY * 0.5;
      }

      if (this.prevCursor) {
        const segDist = Math.hypot(this.smoothCursor.x - this.prevCursor.x, this.smoothCursor.y - this.prevCursor.y);
        // Use hand.palmSpeed (computed at detection time) if available, else frame delta fallback
        speedStageH = palmSpeed > 0 ? palmSpeed : (dt > 0 ? (segDist / H) / dt : 0);
        if (speedStageH > 1.0) radiusPx *= 2;
        strength = Math.max(0.3, Math.min(1, speedStageH / 0.4));

        if (canWipe) {
          this._sweep(this.prevCursor.x, this.prevCursor.y, this.smoothCursor.x, this.smoothCursor.y, radiusPx, strength, dt, now, W, H, sound, atmo);
        }
      }
      this.prevCursor = { x: this.smoothCursor.x, y: this.smoothCursor.y };
    } else {
      this.smoothCursor = null;
      this.prevCursor = null;
    }

    // 3. Strict Regrowth:
    // - No regrowth for 30s after last wipe
    // - Only in polluted world while rd < 0.5
    // - 0.0008 density/sec per cell
    // - Total coverage can never regrow above 0.35
    const mean = this.meanDensity();
    if (this.world === 'polluted' && rd < 0.5 && (now - this.lastWipeTime > 30000)) {
      if (mean < 0.35) {
        const regr = 0.0008 * (1 - rd * 2) * dt;
        for (let i = 0; i < this.density.length; i++) {
          if (this.density[i] > 0.01) {
            this.density[i] = Math.min(0.85, this.density[i] + regr);
          }
        }
      }
    }

    this.air = Math.max(0, Math.min(1, 1 - mean));

    // When mean density < 0.02, set display:none
    if (mean < 0.02) {
      this.canvas.style.display = 'none';
    } else {
      this.canvas.style.display = 'block';
    }

    // 4. Render density to offscreen ImageData and upscale
    if (this.canvas.style.display !== 'none') {
      const data = this.imgData.data;
      const gw = this.gw, gh = this.gh;
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const fx = x + this.drift;
          const x0 = Math.max(0, Math.min(gw - 1, Math.floor(fx)));
          const x1 = Math.min(gw - 1, x0 + 1);
          const tx = Math.max(0, Math.min(1, fx - x0));
          const d = this.density[y * gw + x0] * (1 - tx) + this.density[y * gw + x1] * tx;
          const i = (y * gw + x) * 4;
          data[i] = 110;
          data[i + 1] = 92;
          data[i + 2] = 74;
          data[i + 3] = Math.max(0, Math.min(255, Math.round(d * 0.7 * wobble * 255)));
        }
      }
      this.offCtx.putImageData(this.imgData, 0, 0);

      this.ctx.clearRect(0, 0, W, H);
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.drawImage(this.offCanvas, 0, 0, W, H);
    } else {
      this.ctx.clearRect(0, 0, W, H);
    }

    // 5. Draw soft outlined brush ring around cursor while an open hand is present
    if (handPresent && this.smoothCursor && (input.source === 'hand' && !input.pinching || input.source === 'mouse')) {
      this.ctx.save();
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = canWipe ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 255, 255, 0.35)';
      this.ctx.beginPath();
      this.ctx.arc(this.smoothCursor.x, this.smoothCursor.y, radiusPx, 0, 6.28);
      this.ctx.stroke();
      this.ctx.restore();
    }

    // 6. Pale grey dust motes fading in 0.5s (no green, no glow)
    if (this.motes.length > 0) {
      this.motes = this.motes.filter((m) => {
        const age = (now - m.t) / 1000;
        if (age > 0.5) return false;
        const alpha = (1 - age / 0.5) * 0.45;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        this.ctx.fillStyle = `rgba(220, 220, 220, ${alpha.toFixed(3)})`;
        this.ctx.beginPath();
        this.ctx.arc(m.x, m.y, m.r, 0, 6.28);
        this.ctx.fill();
        return true;
      });
    }

    // 7. Update ?debug=haze readout
    if (this.debugEl) {
      const lastWipeSec = ((now - this.lastWipeTime) / 1000).toFixed(1);
      const h = input?.hand;
      const isHolding = grab && grab.state === 'holding';
      // Cells cleared per second bucket
      if (now - this._bucketResetTime > 1000) {
        this._cellsClearedSec = this._cellsClearedBucket;
        this._cellsClearedBucket = 0;
        this._bucketResetTime = now;
      }
      this.debugEl.innerHTML = `HAZE DEBUG<br>
Hand: ${h?.present ? 'YES' : 'NO'} | Pinching: ${h?.pinching ? 'YES' : 'NO'} | Holding: ${isHolding ? 'YES' : 'NO'}<br>
Palm: ${h?.palm ? h.palm.x.toFixed(3) + ', ' + h.palm.y.toFixed(3) : 'n/a'} | PalmSpeed: ${(h?.palmSpeed || 0).toFixed(2)} h/s<br>
Strength: ${strength.toFixed(2)} | Radius: ${radiusPx.toFixed(0)}px<br>
Mean Density: ${mean.toFixed(3)} (Air: ${(this.air * 100).toFixed(0)}%)<br>
Cells cleared/s: ${this._cellsClearedSec.toFixed(0)} | Last wipe: ${lastWipeSec}s ago`;

      // Warn if hand moving but density not dropping
      const palmSp = h?.palmSpeed || 0;
      if (h?.present && palmSp > 0.3) {
        if (!this._handMovingSince) this._handMovingSince = now;
        const movingMs = now - this._handMovingSince;
        if (movingMs > 1000 && mean >= this._prevMeanForWarn - 0.001 && now - this._warnCooldown > 5000) {
          const gate = isHolding ? 'item held' : !h?.present ? 'no hand mode' : strength <= 0 ? 'strength=0' : 'unknown';
          console.warn(`[Haze] Hand present+moving (speed=${palmSp.toFixed(2)}) for ${(movingMs/1000).toFixed(1)}s but density not dropping. Gate: ${gate}`);
          this._warnCooldown = now;
        }
      } else {
        this._handMovingSince = 0;
      }
      this._prevMeanForWarn = mean;
    }

    return this.air;
  }
}
