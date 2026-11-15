// src/ui/haze.js
// 192x108 cell density grid (0..1), upscaled onto a <canvas id="haze"> with smooth drift,
// hand/mouse wiping, soft white dust particles, warm grey-brown smoke rgb(110,92,74),
// and sound/wind triggering. No green/additive glare.

export class Haze {
  constructor(stageEl) {
    this.gw = 192;
    this.gh = 108;
    this.density = new Float32Array(this.gw * this.gh);
    this.lastWipeTime = 0;
    this.lastGustTime = 0;
    this.air = 1.0;
    this.world = 'polluted';

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

    // Soft white dust particles (0.5s fade)
    this.particles = [];
    this.prevCursor = null;

    this.resize();
    new ResizeObserver(() => this.resize()).observe(stageEl);
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const d = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor((r.width || 1280) * d);
    this.canvas.height = Math.floor((r.height || 720) * d);
  }

  setCoverage(world) {
    this.world = world;
    const base = world === 'polluted' ? 0.85 : world === 'recovering' ? 0.4 : 0.0;
    if (base === 0) {
      this.density.fill(0);
      this.air = 1.0;
      this.canvas.style.display = 'none';
      return;
    }
    let sum = 0;
    for (let y = 0; y < this.gh; y++) {
      const v = y / this.gh;
      for (let x = 0; x < this.gw; x++) {
        const u = x / this.gw;
        // 2 octaves of smooth noise for wispy smoke
        const n1 = Math.sin(u * 12.56 + 0.5) * 0.35 + Math.sin(v * 12.56 + 1.2) * 0.35;
        const n2 = Math.sin((u + v) * 25.13 + 0.8) * 0.2 + Math.sin((u - v) * 25.13 + 2.1) * 0.2;
        const n = n1 + n2;
        const d = Math.max(0, Math.min(1, base + n * 0.28));
        this.density[y * this.gw + x] = d;
        sum += d;
      }
    }
    const mean = sum / (this.gw * this.gh);
    this.air = Math.max(0, Math.min(1, 1 - mean));
    this.canvas.style.display = mean < 0.02 ? 'none' : 'block';
  }

  meanDensity() {
    let sum = 0;
    for (let i = 0; i < this.density.length; i++) sum += this.density[i];
    return sum / this.density.length;
  }

  densityAt(ndc) {
    if (!ndc) return 0;
    const nx = ndc.x * 0.5 + 0.5;
    const ny = -ndc.y * 0.5 + 0.5;
    const gx = Math.floor(Math.max(0, Math.min(this.gw - 1, nx * this.gw)));
    const gy = Math.floor(Math.max(0, Math.min(this.gh - 1, ny * this.gh)));
    return this.density[gy * this.gw + gx];
  }

  wipeSegment(x0, y0, x1, y1, speed, now, sound, atmo) {
    const R = 0.12 * this.gh;
    const strength = Math.min(1, speed * 0.9) * 0.6;
    let removed = 0;

    const minX = Math.max(0, Math.floor(Math.min(x0, x1) - R));
    const maxX = Math.min(this.gw - 1, Math.ceil(Math.max(x0, x1) + R));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1) - R));
    const maxY = Math.min(this.gh - 1, Math.ceil(Math.max(y0, y1) + R));

    const dx = x1 - x0, dy = y1 - y0;
    const lenSq = dx * dx + dy * dy;

    for (let gy = minY; gy <= maxY; gy++) {
      for (let gx = minX; gx <= maxX; gx++) {
        let t = lenSq > 1e-4 ? ((gx - x0) * dx + (gy - y0) * dy) / lenSq : 0;
        t = Math.max(0, Math.min(1, t));
        const px = x0 + t * dx, py = y0 + t * dy;
        const d = Math.hypot(gx - px, gy - py);
        if (d < R) {
          const falloff = 1 - d / R;
          const idx = gy * this.gw + gx;
          const oldVal = this.density[idx];
          const decr = strength * falloff;
          const newVal = Math.max(0, oldVal - decr);
          this.density[idx] = newVal;
          removed += (oldVal - newVal);
        }
      }
    }

    if (removed > 0.05) {
      this.lastWipeTime = now;
      // 6-8 tiny soft white dust particles at wipe point (0.5s fade)
      const count = 6 + Math.floor(Math.random() * 3);
      for (let p = 0; p < count; p++) {
        this.particles.push({
          x: x1 / this.gw + (Math.random() - 0.5) * 0.02,
          y: y1 / this.gh + (Math.random() - 0.5) * 0.02,
          vx: (Math.random() - 0.5) * 0.03,
          vy: (Math.random() - 0.5) * 0.03,
          r: 2 + Math.random() * 2.5,
          t: now,
        });
      }
      if (removed > 0.9 && now - this.lastGustTime > 600) {
        this.lastGustTime = now;
        if (sound?.wind) sound.wind();
        if (atmo?.gust) atmo.gust(Math.sign(dx) || 1);
      }
    }
  }

  wipeAll(amount = 0.28, now = performance.now()) {
    for (let i = 0; i < this.density.length; i++) {
      this.density[i] = Math.max(0, this.density[i] - amount);
    }
    this.lastWipeTime = now;
  }

  update(now, dt, input, grab, rd, sound, atmo) {
    const timeSec = now / 1000;
    const driftX = (timeSec * 0.01) % 1;
    const wobble = 1 + 0.08 * Math.sin(timeSec * 1.5);

    let canWipe = false;
    let currX = 0, currY = 0;
    if (input && input.present) {
      if (input.source === 'hand' && !input.pinching) {
        canWipe = true;
      } else if (input.source === 'mouse' && input.mouse.down && (!grab || grab.state !== 'holding')) {
        canWipe = true;
      }
      currX = (input.ndc.x * 0.5 + 0.5) * this.gw;
      currY = (-input.ndc.y * 0.5 + 0.5) * this.gh;
    }

    if (canWipe) {
      if (this.prevCursor) {
        const segDist = Math.hypot(currX - this.prevCursor.x, currY - this.prevCursor.y);
        const speed = dt > 0 ? (segDist / this.gh) / dt : 1.0;
        this.wipeSegment(this.prevCursor.x, this.prevCursor.y, currX, currY, speed, now, sound, atmo);
      }
      this.prevCursor = { x: currX, y: currY };
    } else {
      this.prevCursor = null;
    }

    // Regrowth: only in polluted world, while rd < 0.85, rate 0.002 * (1 - rd)/sec, paused 15s after last wipe
    // Cleared cells stay clear (density > 0.02)
    if (this.world === 'polluted' && rd < 0.85 && (now - this.lastWipeTime > 15000)) {
      const regr = 0.002 * (1 - rd) * dt;
      for (let i = 0; i < this.density.length; i++) {
        if (this.density[i] > 0.02) {
          this.density[i] = Math.min(0.95, this.density[i] + regr);
        }
      }
    }

    const mean = this.meanDensity();
    this.air = Math.max(0, Math.min(1, 1 - mean));
    if (mean < 0.02) {
      this.canvas.style.display = 'none';
      return this.air;
    } else {
      this.canvas.style.display = 'block';
    }

    // Write density to offscreen ImageData
    // Warm grey-brown rgb(110,92,74), max alpha 0.7
    const data = this.imgData.data;
    const gw = this.gw, gh = this.gh;
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const sx = Math.floor((x + driftX * gw) % gw);
        const d = this.density[y * gw + sx];
        const i = (y * gw + x) * 4;
        data[i] = 110;
        data[i + 1] = 92;
        data[i + 2] = 74;
        data[i + 3] = Math.max(0, Math.min(255, Math.round(d * 0.7 * wobble * 255)));
      }
    }
    this.offCtx.putImageData(this.imgData, 0, 0);

    // Upscale to canvas
    const W = this.canvas.width, H = this.canvas.height;
    this.ctx.clearRect(0, 0, W, H);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.offCanvas, 0, 0, W, H);

    // Soft white dust particles (0.5s fade) - no green, standard composite
    if (this.particles.length > 0) {
      this.particles = this.particles.filter((p) => {
        const age = (now - p.t) / 1000;
        if (age > 0.5) return false;
        const alpha = (1 - age / 0.5) * 0.45;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
        this.ctx.beginPath();
        this.ctx.arc(p.x * W, p.y * H, p.r, 0, 6.28);
        this.ctx.fill();
        return true;
      });
    }

    return this.air;
  }
}
