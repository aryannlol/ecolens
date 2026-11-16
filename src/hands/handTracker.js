import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { CONFIG } from '../config.js';
import { OneEuro } from '../util/oneEuro.js';

const THUMB_TIP = 4, INDEX_TIP = 8;

/** MediaPipe Hand Landmarker wrapper + stable pinch detection (metric thresholds with hysteresis). */
export class HandTracker {
  constructor() {
    this.landmarker = null; this.ready = false; this.error = null;
    this.fx = new OneEuro(1.6, 0.8, 1.0); this.fy = new OneEuro(1.6, 0.8, 1.0);
    this.fpx = new OneEuro(2.5, 1.0); this.fpy = new OneEuro(2.5, 1.0);
    this.present = false; this.pinching = false; this.cursor = { x: 0.5, y: 0.5 }; this.vx = 0;
    this.palm = { x: 0.5, y: 0.5 }; this.palmVideo = this.palm; this.palmSpeed = 0; this._lastPalmX = 0.5; this._lastPalmY = 0.5; this._palmSmoothSpeed = 0;
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
    const prevX = this.cursor.x, dt = Math.max(0.001, (now - this.lastSeen) / 1000);
    this.lastSeen = now; this.landmarks = lm;
    const t = lm[THUMB_TIP], i = lm[INDEX_TIP];
    const rx = this.fx.filter((t.x + i.x) / 2, now);
    const ry = this.fy.filter((t.y + i.y) / 2, now);
    this.rawVideoCursor = { x: rx, y: ry };
    this.cursor.x = CONFIG.hand.mirror ? 1 - rx : rx;
    this.cursor.y = ry;
    this.vx = (this.cursor.x - prevX) / dt;
    // Palm center: mean of wrist(0), index-MCP(5), middle-MCP(9), ring-MCP(13), pinky-MCP(17)
    const palmLMs = [0, 5, 9, 13, 17];
    const rawPalmX = palmLMs.reduce((s, k) => s + lm[k].x, 0) / 5;
    const rawPalmY = palmLMs.reduce((s, k) => s + lm[k].y, 0) / 5;
    // Palm stays in raw VIDEO coordinates (un-mirrored); Input/Stage.videoToStage() applies crop + optional mirror.
    this.palm.x = this.fpx.filter(rawPalmX, now);
    this.palm.y = this.fpy.filter(rawPalmY, now);
    const rawSpeed = Math.hypot(this.palm.x - this._lastPalmX, this.palm.y - this._lastPalmY) / dt;
    this._lastPalmX = this.palm.x; this._lastPalmY = this.palm.y;
    const tau = 0.12; const alpha = 1 - Math.exp(-dt / tau);
    this._palmSmoothSpeed += alpha * (rawSpeed - this._palmSmoothSpeed);
    this.palmSpeed = this._palmSmoothSpeed;
    const a = wl[THUMB_TIP], b = wl[INDEX_TIP];
    this.pinchMeters = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    if (this.pinchMeters < CONFIG.hand.grabMeters) { this.onCount++; this.offCount = 0; } else if (this.pinchMeters > CONFIG.hand.releaseMeters) { this.offCount++; this.onCount = 0; }
    if (!this.pinching && this.onCount >= 2) this.pinching = true;
    if (this.pinching && this.offCount >= 2) this.pinching = false;
  }

  /** Hold state through brief dropouts; release if the hand has been gone too long. */
  tick(now) { if (this.present && now - this.lastSeen > CONFIG.hand.lostGraceMs) this._lose(); }
  _lose() { this.present = false; this.pinching = false; this.landmarks = null; this.fx.reset(); this.fy.reset(); this.fpx.reset(); this.fpy.reset(); this.vx = 0; this.palmSpeed = 0; this._palmSmoothSpeed = 0; this.onCount = this.offCount = 0; }
}
