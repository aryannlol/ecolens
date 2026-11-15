import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { CONFIG } from '../config.js';
import { OneEuro } from '../util/oneEuro.js';
import { videoToStage } from '../util/stageMap.js';

const THUMB_TIP = 4, INDEX_TIP = 8;

/** MediaPipe Hand Landmarker wrapper + stable pinch detection (metric thresholds with hysteresis). */
export class HandTracker {
  constructor() {
    this.landmarker = null; this.ready = false; this.error = null;
    this.fx = new OneEuro(1.6, 0.8, 1.0); this.fy = new OneEuro(1.6, 0.8, 1.0);
    this.fpx = new OneEuro(2.5, 1.0); this.fpy = new OneEuro(2.5, 1.0);
    this.present = false; this.pinching = false;
    this.cursor = { x: 0.5, y: 0.5 };
    this.palm = { x: 0.5, y: 0.5 };
    this.brushPos = { x: 0.5, y: 0.5 };
    this.palmVelocity = { x: 0, y: 0 };
    this.palmSpeed = 0;
    this.landmarks = null; this.lastSeen = 0; this.onCount = 0; this.offCount = 0; this.pinchMeters = 1;
    this.lastVideoTime = -1;
  }

  async init() {
    try {
      const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
      const base = { modelAssetPath: '/models/hand_landmarker.task' };
      const opts = { runningMode: 'VIDEO', numHands: 1, minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.6 };
      try { this.landmarker = await HandLandmarker.createFromOptions(vision, { ...opts, baseOptions: { ...base, delegate: 'GPU' } }); }
      catch { this.landmarker = await HandLandmarker.createFromOptions(vision, { ...opts, baseOptions: { ...base, delegate: 'CPU' } }); }
      this.ready = true;
    } catch (e) {
      this.error = e;
      console.warn('[EcoLens] Hand tracking unavailable:', e.message || e, '- run `npm run setup` to download the model. Mouse fallback is active.');
    }
    return this.ready;
  }

  /** Call once per new video frame. */
  detect(video, now) {
    if (!this.ready || video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = video.currentTime;
    let res;
    try { res = this.landmarker.detectForVideo(video, now); } catch { return; }
    const lm = res.landmarks?.[0], wl = res.worldLandmarks?.[0];
    if (!lm || !wl) {
      if (this.present && now - this.lastSeen > CONFIG.hand.lostGraceMs) this._lose();
      return;
    }
    this.present = true;
    const dt = Math.max(0.001, (now - this.lastSeen) / 1000);
    this.lastSeen = now; this.landmarks = lm;

    // 1. Fingertip (for grabbing/cursor)
    const t = lm[THUMB_TIP], i = lm[INDEX_TIP];
    const rawTip = videoToStage((t.x + i.x) / 2, (t.y + i.y) / 2);
    this.cursor.x = this.fx.filter(rawTip.x, now);
    this.cursor.y = this.fy.filter(rawTip.y, now);

    // 2. Palm center (mean of landmarks 0, 5, 9, 13, 17)
    const palmLMs = [0, 5, 9, 13, 17];
    const rawPalmX = palmLMs.reduce((s, k) => s + lm[k].x, 0) / 5;
    const rawPalmY = palmLMs.reduce((s, k) => s + lm[k].y, 0) / 5;
    const stageP = videoToStage(rawPalmX, rawPalmY);

    // Single OneEuro filter on palm (minCutoff 2.5, beta 1.0)
    const px = this.fpx.filter(stageP.x, now);
    const py = this.fpy.filter(stageP.y, now);

    // Palm velocity from last two detection timestamps
    const rawVx = (px - this.palm.x) / dt;
    const rawVy = (py - this.palm.y) / dt;
    this.palm.x = px;
    this.palm.y = py;

    const sp = Math.hypot(rawVx, rawVy);
    const clampedSp = Math.min(1.5, sp);
    const scale = sp > 1.5 ? 1.5 / sp : 1;
    this.palmVelocity = { x: rawVx * scale, y: rawVy * scale };
    this.palmSpeed = clampedSp;

    // Extrapolate with lookahead: brushPos = palm + palmVelocity * 0.05 s
    this.brushPos = {
      x: px + this.palmVelocity.x * 0.05,
      y: py + this.palmVelocity.y * 0.05,
    };

    const a = wl[THUMB_TIP], b = wl[INDEX_TIP];
    this.pinchMeters = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    if (this.pinchMeters < CONFIG.hand.grabMeters) { this.onCount++; this.offCount = 0; } else if (this.pinchMeters > CONFIG.hand.releaseMeters) { this.offCount++; this.onCount = 0; }
    if (!this.pinching && this.onCount >= 2) this.pinching = true;
    if (this.pinching && this.offCount >= 2) this.pinching = false;
  }

  /** Hold state through brief dropouts; release if the hand has been gone too long. */
  tick(now) { if (this.present && now - this.lastSeen > CONFIG.hand.lostGraceMs) this._lose(); }
  _lose() {
    this.present = false; this.pinching = false; this.landmarks = null;
    this.fx.reset(); this.fy.reset(); this.fpx.reset(); this.fpy.reset();
    this.palmSpeed = 0; this.palmVelocity = { x: 0, y: 0 };
    this.onCount = this.offCount = 0;
  }
}
