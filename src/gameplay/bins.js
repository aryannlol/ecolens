import * as THREE from 'three';
import gsap from 'gsap';
import { CONFIG } from '../config.js';
import { heightAt } from '../scene/terrain.js';

function labelSprite(kind, text, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = 'rgba(10,20,16,0.84)'; g.beginPath(); g.roundRect(8, 16, 496, 128, 40); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 4; g.stroke();

  // Category badge circle
  g.fillStyle = '#' + new THREE.Color(color).getHexString(); g.beginPath(); g.arc(74, 80, 36, 0, 7); g.fill();

  // White icon paths
  g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff'; g.lineWidth = 3.5; g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'plastic') {
    // Bottle icon
    g.strokeRect(68, 54, 12, 8);
    g.beginPath();
    g.moveTo(69, 62); g.lineTo(62, 72); g.lineTo(62, 104);
    g.arcTo(62, 108, 66, 108, 4); g.lineTo(82, 108);
    g.arcTo(86, 108, 86, 104, 4); g.lineTo(86, 72); g.lineTo(79, 62);
    g.closePath(); g.stroke();
  } else if (kind === 'paper') {
    // Document icon with fold
    g.beginPath();
    g.moveTo(63, 56); g.lineTo(78, 56); g.lineTo(85, 63); g.lineTo(85, 104);
    g.lineTo(63, 104); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(78, 56); g.lineTo(78, 63); g.lineTo(85, 63); g.stroke();
    g.beginPath(); g.moveTo(68, 76); g.lineTo(80, 76); g.moveTo(68, 85); g.lineTo(80, 85); g.stroke();
  } else if (kind === 'metal') {
    // 3 stacked layers
    for (const dy of [63, 76, 89]) {
      g.beginPath();
      g.moveTo(74, dy - 7); g.lineTo(87, dy); g.lineTo(74, dy + 7); g.lineTo(61, dy); g.closePath();
      g.stroke();
    }
  } else if (kind === 'organic') {
    // Leaf icon
    g.beginPath();
    g.moveTo(74, 105); g.lineTo(74, 84);
    g.bezierCurveTo(61, 84, 59, 65, 74, 55);
    g.bezierCurveTo(89, 65, 87, 84, 74, 84);
    g.stroke();
  }

  g.fillStyle = '#ffffff'; g.font = '700 68px system-ui, -apple-system, Segoe UI, sans-serif'; g.textBaseline = 'middle';
  g.fillText(text, 126, 84);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(0.44, 0.138, 1); return s;
}

let sharedRecycleDecalTex = null;
function getRecycleDecalTexture() {
  if (sharedRecycleDecalTex) return sharedRecycleDecalTex;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const cx = 128, cy = 128, r = 68;
  for (let i = 0; i < 3; i++) {
    const a = i * (Math.PI * 2 / 3) - Math.PI / 2;
    g.save();
    g.translate(cx, cy);
    g.rotate(a);
    g.beginPath();
    g.arc(0, 0, r, -0.65, 0.55);
    g.lineWidth = 14;
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineCap = 'round';
    g.stroke();
    // Arrow head
    const ax = Math.cos(0.55) * r, ay = Math.sin(0.55) * r;
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath();
    g.moveTo(ax - 5, ay - 14);
    g.lineTo(ax + 16, ay + 6);
    g.lineTo(ax - 13, ay + 12);
    g.closePath();
    g.fill();
    g.restore();
  }
  sharedRecycleDecalTex = new THREE.CanvasTexture(c);
  sharedRecycleDecalTex.colorSpace = THREE.SRGBColorSpace;
  return sharedRecycleDecalTex;
}

export class Bin {
  constructor(def) {
    this.def = def; this.kind = def.kind;
    this.group = new THREE.Group(); this.group.position.set(def.x, 0.034, CONFIG.diorama.binZ);
    const col = new THREE.Color(def.color);
    const prof = [[0, 0], [0.13, 0], [0.175, 0.3], [0.165, 0.31], [0.158, 0.285], [0.118, 0.025], [0, 0.025]].map(([x, y]) => new THREE.Vector2(x, y));
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide });
    this.body = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), mat); this.body.castShadow = this.body.receiveShadow = true;
    const inner = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32).rotateX(-Math.PI / 2).translate(0, 0.02, 0), new THREE.MeshStandardMaterial({ color: 0x0a0d0c, roughness: 1 }));
    this.rimMat = new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(1.15), emissive: col, emissiveIntensity: 0.08, roughness: 0.3 });
    this.rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.011, 12, 48).rotateX(Math.PI / 2).translate(0, 0.31, 0), this.rimMat);
    this.glowMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.glow = new THREE.Mesh(new THREE.RingGeometry(0.19, 0.3, 48).rotateX(-Math.PI / 2).translate(0, 0.005, 0), this.glowMat);
    this.lidPivot = new THREE.Group(); this.lidPivot.position.set(0, 0.315, -0.17);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.178, 0.178, 0.014, 40).translate(0, 0, 0.17), mat); lid.castShadow = true; this.lidPivot.add(lid); this.lidPivot.rotation.x = -1.9; this.lidPivot.visible = false;
    this.label = labelSprite(def.kind, def.label, def.color); this.label.position.y = 0.52;

    // Front recycling symbol decal
    const decalMat = new THREE.MeshBasicMaterial({
      map: getRecycleDecalTexture(),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    this.decal = new THREE.Mesh(new THREE.PlaneGeometry(0.125, 0.125), decalMat);
    this.decal.position.set(0, 0.155, 0.165);
    this.decal.rotation.x = -0.15;

    this.group.add(this.body, inner, this.rim, this.glow, this.lidPivot, this.label, this.decal);
    this.group.position.y = 0.034; this.hover = 0;
  }
  get position() { return this.group.position; }
  setHover(on) { gsap.to(this, { hover: on ? 1 : 0, duration: 0.18, overwrite: true, onUpdate: () => { this.glowMat.opacity = this.hover * 0.75; this.rimMat.emissiveIntensity = 0.08 + this.hover * 0.9; } }); }
  /** Lid swings shut and re-opens; the bin gives a little squash. */
  feedbackGood() {
    this.lidPivot.visible = true; this.lidPivot.rotation.x = -1.9;
    gsap.timeline({ onComplete: () => { this.lidPivot.visible = false; } }).to(this.lidPivot.rotation, { x: -0.02, duration: 0.2, ease: 'power2.in' }).to(this.group.scale, { y: 0.9, x: 1.05, z: 1.05, duration: 0.09 }, '<0.1')
      .to(this.group.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'elastic.out(1,0.4)' }).to(this.lidPivot.rotation, { x: -1.9, duration: 0.45, ease: 'back.out(1.6)' }, '-=0.35');
    this.flash(0x7dffa0);
  }
  feedbackBad() {
    const x0 = this.def.x; this.flash(0xff5a4d);
    gsap.timeline().to(this.group.position, { x: x0 + 0.025, duration: 0.05 }).to(this.group.position, { x: x0 - 0.025, duration: 0.07 }).to(this.group.position, { x: x0 + 0.015, duration: 0.06 }).to(this.group.position, { x: x0, duration: 0.06 });
  }
  flash(color) {
    const orig = this.glowMat.color.clone(); this.glowMat.color.set(color); this.glowMat.opacity = 0.9;
    gsap.to(this.glowMat, { opacity: 0, duration: 0.7, onComplete: () => this.glowMat.color.copy(orig) });
  }
  /** Top-centre of the opening in diorama space. */
  mouth(out = new THREE.Vector3()) { return out.set(this.group.position.x, this.group.position.y + 0.3, this.group.position.z); }
}

export function createBins(parent) {
  const bins = CONFIG.bins.map((d) => new Bin(d)); bins.forEach((b) => parent.add(b.group)); return bins;
}
