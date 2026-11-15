import * as THREE from 'three';
import { HALF } from './terrain.js';

/** Curved sky backdrop behind the diorama so the oblique view shows ground, horizon and sky. */
export class Sky {
  constructor() {
    this.uniforms = { uTime: { value: 0 }, uTop: { value: new THREE.Color(0x6e6252) }, uHorizon: { value: new THREE.Color(0x8a7458) }, uRec: { value: 0 }, uSun: { value: new THREE.Color(0xfff0d2) } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `
        uniform float uTime; uniform float uRec; uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSun; varying vec2 vUv; varying vec3 vP;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }
        void main(){
          float h = vUv.y;
          vec3 col = mix(uHorizon, uTop, pow(smoothstep(0.0, 0.85, h), 0.8));
          vec2 cp = vec2(vUv.x * 5.0 + uTime * 0.012, h * 2.6);
          float c = smoothstep(0.48, 0.78, fbm(cp));
          vec3 cloudCol = mix(vec3(0.33,0.29,0.25), vec3(1.0), uRec);
          col = mix(col, cloudCol, c * (0.25 + 0.55 * smoothstep(0.1, 0.5, h)));
          float sun = smoothstep(0.35, 0.0, distance(vUv, vec2(0.7, 0.42)));
          col += uSun * sun * sun * (0.15 + 0.55 * uRec);
          // distant hills silhouette
          float hills = 0.07 + 0.05 * sin(vUv.x * 18.0) + 0.03 * sin(vUv.x * 41.0 + 1.3);
          vec3 hillCol = mix(uHorizon * 0.55, vec3(0.2, 0.35, 0.28), uRec);
          col = mix(col, hillCol, smoothstep(hills + 0.01, hills - 0.01, h));
          float fade = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x);
          gl_FragColor = vec4(col, fade);
          #include <colorspace_fragment>
        }`,
      transparent: true,
    });
    const arc = Math.PI * 1.0;
    const skyR = (3.4 * HALF) / 1.2;
    // cylinder whose open side faces +z (toward the viewer); we only draw the far half
    const geo = new THREE.CylinderGeometry(skyR, skyR, 3.2, 64, 1, true, Math.PI - arc / 2, arc);
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.position.y = 1.6 - 0.125; this.mesh.renderOrder = -1;
  }
  update(t, prof, rd) {
    this.uniforms.uTime.value = t; this.uniforms.uRec.value = rd;
    this.uniforms.uTop.value.copy(prof.sky).multiplyScalar(0.8); this.uniforms.uHorizon.value.copy(prof.fog); this.uniforms.uSun.value.copy(prof.sun);
  }
}

/** Distant landscape ring around the diorama: terrain colours near the tile fading into horizon haze, so the sky meets land. */
export class FarGround {
  constructor() {
    const innerR = HALF + 0.04, outerR = (3.4 * HALF) / 1.2;
    const geo = new THREE.RingGeometry(innerR, outerR, 96, 8).rotateX(-Math.PI / 2);
    const count = geo.attributes.position.count;
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })); this.mesh.position.y = -0.125; this.mesh.renderOrder = -2;
    this.factors = new Float32Array(count);
    const p = geo.attributes.position;
    for (let i = 0; i < count; i++) {
      const r = Math.hypot(p.getX(i), p.getZ(i));
      const k = Math.min(1, Math.max(0, (r - innerR) / (outerR - innerR)));
      this.factors[i] = Math.pow(k, 0.7);
    }
    this.last = -1;
  }
  update(rd, prof) {
    if (Math.abs(rd - this.last) < 0.004) return; this.last = rd;
    const deadR = 0.40, deadG = 0.32, deadB = 0.19;
    const liveR = 0.20, liveG = 0.41, liveB = 0.10;
    const t = Math.min(1, rd * 1.2);
    const nearR = deadR + (liveR - deadR) * t;
    const nearG = deadG + (liveG - deadG) * t;
    const nearB = deadB + (liveB - deadB) * t;
    const farR = prof.fog.r, farG = prof.fog.g, farB = prof.fog.b;

    const colArr = this.mesh.geometry.attributes.color.array;
    for (let i = 0; i < this.factors.length; i++) {
      const e = this.factors[i];
      const idx = i * 3;
      colArr[idx] = nearR + (farR - nearR) * e;
      colArr[idx + 1] = nearG + (farG - nearG) * e;
      colArr[idx + 2] = nearB + (farB - nearB) * e;
    }
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }
}
