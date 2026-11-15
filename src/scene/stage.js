import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { CONFIG } from '../config.js';
import { updateStageGeom } from '../util/stageMap.js';

/** Renderer, camera, webcam background and image-based lighting. */
export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 80);
    this.fog = new THREE.FogExp2(0x8a7458, 0.01); this.scene.fog = this.fog;
    this.flash = 0; this.aspect = 16 / 9; this.videoTexture = null;
    this.targetPixelRatio = Math.min(devicePixelRatio || 1, 1.25);
    this.frameTimes = [];
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    new RGBELoader().load('/assets/env.hdr', (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      this.scene.environment = pm.fromEquirectangular(tex).texture;
      tex.dispose();
    }, undefined, () => {
      // RoomEnvironment fallback already active
    });
  }

  /** Match canvas to the video aspect, fit it to the window in cover mode, and render at up to 1.5x pixel density. */
  setSource(w, h) {
    this.videoWidth = w;
    this.videoHeight = h;
    this.aspect = w / h;
    const hf = (CONFIG.camera.hfovDeg * Math.PI) / 180;
    this.videoVFov = 2 * Math.atan(Math.tan(hf / 2) / this.aspect);
    this.resize();
  }

  resize() {
    const W = innerWidth, H = innerHeight;
    const stage = document.getElementById('stage');
    if (stage) {
      stage.style.width = W + 'px';
      stage.style.height = H + 'px';
      stage.style.left = '0px';
      stage.style.top = '0px';
      stage.style.transform = 'none';
    }

    const vw = this.videoWidth || 1280, vh = this.videoHeight || 720;
    const s = Math.max(W / vw, H / vh);
    const visW = W / s, visH = H / s;
    const cropX = (vw - visW) / 2, cropY = (vh - visH) / 2;
    this.crop = { s, visW, visH, cropX, cropY, vw, vh, W, H, mirrored: true };
    updateStageGeom(this.crop);

    // Keep AR locked: constant focal length in video pixels
    const videoVFov = this.videoVFov || (2 * Math.atan(Math.tan((CONFIG.camera.hfovDeg * Math.PI / 180) / 2) / (vw / vh)));
    const f_px = (vh / 2) / Math.tan(videoVFov / 2);
    this.camera.aspect = W / H;
    this.camera.fov = (2 * Math.atan((visH / 2) / f_px) * 180) / Math.PI;
    this.camera.updateProjectionMatrix();

    // Video background crop
    if (this.videoTexture) {
      this.videoTexture.repeat.set(visW / vw, visH / vh);
      this.videoTexture.offset.set((1 - this.videoTexture.repeat.x) / 2, (1 - this.videoTexture.repeat.y) / 2);
    }

    // Pixel ratio guard: max 2.1 million pixels
    let pr = this.targetPixelRatio || Math.min(devicePixelRatio || 1, 1.25);
    if (W * H * pr * pr > 2.1e6) {
      pr = Math.sqrt(2.1e6 / (W * H));
    }
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(W, H, false);

    this.canvas.style.width = W + 'px';
    this.canvas.style.height = H + 'px';

    const ov = document.getElementById('hand-overlay');
    if (ov) {
      ov.width = W; ov.height = H;
      ov.style.width = W + 'px'; ov.style.height = H + 'px';
    }

    if (this.onResize) this.onResize(W, H);
  }

  setVideo(video) {
    this.videoTexture = new THREE.VideoTexture(video); this.videoTexture.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.videoTexture; this.setSource(video.videoWidth, video.videoHeight);
  }
  setBackdrop() { // no-camera mode: a soft studio gradient
    const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#1d2a2b'); gr.addColorStop(1, '#0c1213'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; this.scene.background = t; this.setSource(1280, 720);
  }
  render(prof, dist, dt) {
    this.renderer.toneMappingExposure = prof.exposure * (1 + this.flash * 0.5);
    this.scene.environmentIntensity = prof.env;
    this.fog.color.copy(prof.fog); this.fog.density = prof.fogK / Math.max(dist, 1);
    if (dt) {
      this.frameTimes.push(dt * 1000);
      if (this.frameTimes.length >= 60) {
        const avg = this.frameTimes.reduce((a, b) => a + b, 0) / 60;
        if (avg > 24 && this.targetPixelRatio > 1.0) {
          this.targetPixelRatio = 1.0;
          this.renderer.setPixelRatio(1.0);
        }
        this.frameTimes.length = 0;
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
  notifyVideoFrame() {
    if (this.videoTexture) this.videoTexture.needsUpdate = true;
  }
}
