import { AR } from './aruco.js';
import { CONFIG } from '../config.js';
import { solvePlanarPose } from './pose.js';

/** Detects ArUco markers on a downscaled frame and returns marker-space poses. */
export class MarkerTracker {
  constructor(video) {
    this.video = video;
    const w = CONFIG.markers.detectWidth;
    this.w = w; this.h = Math.round((w * video.videoHeight) / video.videoWidth);
    this.canvas = document.createElement('canvas'); this.canvas.width = this.w; this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.detector = new AR.Detector({ dictionaryName: CONFIG.markers.dictionary });
    const hf = (CONFIG.camera.hfovDeg * Math.PI) / 180;
    this.f = this.w / 2 / Math.tan(hf / 2);
    this.lastCorners = [];
  }
  /** @returns [{id, world, pose:{R,t}, corners}] only for the configured world markers */
  detect() {
    this.ctx.drawImage(this.video, 0, 0, this.w, this.h);
    const img = this.ctx.getImageData(0, 0, this.w, this.h);
    const out = [];
    for (const m of this.detector.detect(img)) {
      const world = CONFIG.markers.ids[m.id];
      if (!world || m.hammingDistance > CONFIG.markers.maxHamming) continue;
      const pose = solvePlanarPose(m.corners, this.w, this.h, this.f);
      if (!pose || pose.t[2] < 0.5) continue;
      out.push({ id: m.id, world, pose, corners: m.corners });
    }
    this.lastCorners = out.map((m) => m.corners);
    return out;
  }
}
