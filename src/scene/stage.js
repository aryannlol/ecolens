import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { CONFIG } from '../config.js';

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
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; // replaced by the HDRI if present
    fetch('/assets/env.hdr', { method: 'HEAD' }).then((r) => {
      if (!r.ok || !(r.headers.get('content-type') || '').match(/octet|hdr|image/)) return;
      new RGBELoader().load('/assets/env.hdr', (tex) => { tex.mapping = THREE.EquirectangularReflectionMapping; this.scene.environment = pm.fromEquirectangular(tex).texture; tex.dispose(); });
    }).catch(() => {});
  }

  /** Match canvas to the video aspect, fit it to the window, and render at up to 1.5x pixel density for crisp edges. */
  setSource(w, h) {
    this.aspect = w / h;
    const hf = (CONFIG.camera.hfovDeg * Math.PI) / 180;
    this.camera.fov = (2 * Math.atan(Math.tan(hf / 2) / this.aspect) * 180) / Math.PI;
    this.camera.aspect = this.aspect; this.camera.updateProjectionMatrix();
    this.resize();
  }
  resize() {
    const s = Math.min(innerWidth / this.aspect, innerHeight) ; const cssH = Math.floor(s), cssW = Math.floor(s * this.aspect);
    const stage = document.getElementById('stage');
    stage.style.width = cssW + 'px'; stage.style.height = cssH + 'px';
    this.renderer.setPixelRatio(this.targetPixelRatio);
    this.renderer.setSize(cssW, cssH, false);
    this.canvas.style.width = cssW + 'px'; this.canvas.style.height = cssH + 'px';
    const ov = document.getElementById('hand-overlay'); ov.width = cssW; ov.height = cssH; ov.style.width = cssW + 'px'; ov.style.height = cssH + 'px';
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
