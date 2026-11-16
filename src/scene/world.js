import * as THREE from 'three';
import { Terrain, heightAt, HALF, STATION } from './terrain.js';
import { River } from './water.js';
import { Grass, Forest } from './vegetation.js';
import { Town } from './buildings.js';
import { Sky, FarGround } from './sky.js';
import { Atmosphere } from './atmosphere.js';
import { Wildlife } from './wildlife.js';
import { profileAt } from '../state/worldProfiles.js';
import { CONFIG } from '../config.js';

/**
 * The single diorama. Three worlds are three recovery states of this one scene, so no asset is ever loaded twice.
 * anchor (marker pose) -> content (tilted to the viewer, y-up) -> terrain, water, plants, town, sky, bins, waste, fx.
 */
export class World {
  constructor() {
    this.anchor = new THREE.Group(); this.anchor.matrixAutoUpdate = false; this.anchor.visible = false;
    this.content = new THREE.Group(); this.anchor.add(this.content);
    this.tilt = 0; this.inspect = { yaw: 0, pitch: 0, zoom: 1 };
    this.profile = profileAt(0.05);

    this.terrain = new Terrain(); this.river = new River(); this.grass = new Grass(); this.forest = new Forest();
    this.town = new Town(); this.sky = new Sky(); this.far = new FarGround(); this.atmo = new Atmosphere(this.town.stacks); this.wildlife = new Wildlife();

    // plinth and bin slab
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 0.08, 0.3, HALF * 2 + 0.08), new THREE.MeshStandardMaterial({ color: 0x1b2225, roughness: 0.35, metalness: 0.3 }));
    plinth.position.y = -0.1 - 0.15 - 0.004; plinth.receiveShadow = true;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.04, STATION.z1 - STATION.z0), new THREE.MeshStandardMaterial({ color: 0xa6a7a2, roughness: 0.8 }));
    slab.position.set(0, 0.012, (STATION.z0 + STATION.z1) / 2); slab.receiveShadow = true; slab.castShadow = true;

    this.sun = new THREE.DirectionalLight(0xffffff, 2); this.sun.position.set(1.5, 2.6, 1.7); this.sun.castShadow = true;
    const sc = this.sun.shadow.camera; const ext = HALF * 1.6; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 0.5; sc.far = 7;
    this.sun.shadow.mapSize.set(1024, 1024); this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.02; this.sun.shadow.radius = 3;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.rim = new THREE.DirectionalLight(0xbfd8ff, 0.6); this.rim.position.set(-1.6, 1.2, -2);

    this.binsGroup = new THREE.Group(); this.itemsGroup = new THREE.Group(); this.fxGroup = new THREE.Group();
    this.content.add(this.sky.mesh, this.far.mesh, plinth, this.terrain.mesh, slab, this.river.group, this.grass.mesh, this.forest.group, this.town.group,
      this.atmo.group, this.wildlife.group, this.sun, this.sun.target, this.hemi, this.rim, this.binsGroup, this.itemsGroup, this.fxGroup);
    this.center = new THREE.Vector3(0, 0.1, 0);
  }

  /** Marker pose in, auto-levelled so the viewer always sees the ground receding to a horizon with sky above. */
  setPose(matrix, smoothTilt = true, dt = 0.016) {
    this.anchor.matrix.copy(matrix); this.anchor.matrixWorldNeedsUpdate = true; this.anchor.visible = true;
    const inv = new THREE.Matrix4().copy(matrix).invert();
    const v = new THREE.Vector3(0, 0, 0).applyMatrix4(inv).normalize();       // camera direction in marker space
    const alpha = Math.atan2(v.z, -v.y);                                       // elevation of the viewer above the marker plane
    const E = (CONFIG.diorama.viewElevationDeg * Math.PI) / 180;
    const target = THREE.MathUtils.clamp(E - alpha, -0.9, 1.0);
    const k = 1 - Math.exp(-dt * 6);
    this.tilt = smoothTilt ? this.tilt + (target - this.tilt) * k : target;
  }
  distance() { return Math.max(1, new THREE.Vector3().setFromMatrixPosition(this.anchor.matrix).length()); }

  update(t, dt, rd, air = 1, riverMurk = 0) {
    const p = profileAt(rd, this.profile);
    this.content.rotation.set(Math.PI / 2 + this.tilt + this.inspect.pitch, this.inspect.yaw, 0, 'XYZ');
    { const k = (1.25 / HALF) * this.inspect.zoom; this.content.scale.set(CONFIG.hand.mirror ? -k : k, k, k); } // -x: cancels the CSS mirror
    this.terrain.update(rd); this.river.update(t, dt, rd, p, riverMurk); this.grass.update(t, rd); this.forest.update(t, rd);
    this.town.update(rd); this.sky.update(t, p, rd); this.far.update(rd, p); this.atmo.update(t, dt, rd, p, air); this.wildlife.update(t, rd);
    if (this.atmo.wind > 0) p.fogK *= Math.max(0.15, 1 - this.atmo.wind * 0.75);
    this.sun.color.copy(p.sun); this.sun.intensity = p.sunI; this.hemi.color.copy(p.hemiSky); this.hemi.groundColor.copy(p.hemiGround); this.hemi.intensity = p.hemiI;
    this.rim.intensity = 0.25 + 0.5 * rd;
    return p;
  }
  groundY(x, z) { return heightAt(x, z); }
}
