import * as THREE from 'three';
import gsap from 'gsap';
import { CONFIG, BIN_NAME } from '../config.js';
import { WorldState } from '../state/restoration.js';
import { createWaste, KIND_NOUN } from './waste.js';
import { heightAt } from '../scene/terrain.js';
import { sound } from '../util/sound.js';
import { spawnLayout } from './layout.js';

/** World progress, spawning, sorting rules and the recycling sequence. */
export class Game extends EventTarget {
  constructor({ world, restoration, bins, fx }) {
    super(); Object.assign(this, { world, restoration, bins, fx });
    this.states = {}; this.current = null; this.meshes = new Map();
  }
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  idle() { return [...this.meshes.values()].filter((m) => m.userData.state === 'idle'); }

  loadWorld(id, immediate = false) {
    if (this.current?.id === id) return;
    for (const m of this.meshes.values()) { m.userData.state = 'busy'; gsap.to(m.scale, { x: 0, y: 0, z: 0, duration: 0.35, ease: 'back.in(2)', onComplete: () => m.removeFromParent() }); }
    this.meshes.clear();
    const def = CONFIG.worlds[id];
    const st = (this.states[id] ||= new WorldState(id, def, spawnLayout(def)));
    this.current = st;
    st.remaining.forEach((rec, i) => this._spawn(rec, immediate ? 0.1 + i * 0.06 : 0.55 + i * 0.07));
    if (immediate) this.restoration.jump(st.r); else this.restoration.tweenTo(st.r, 2.4);
    this.emit('world', { id, label: def.label }); this.emit('progress', { sorted: st.sorted, total: st.total });
  }

  _spawn(rec, delay) {
    const m = createWaste(rec.kind, rec.variant, rec.id), y = heightAt(rec.x, rec.z);
    m.position.set(rec.x, y, rec.z); m.rotation.y = rec.rot; m.userData.home.copy(m.position); m.userData.state = 'busy';
    const s = m.scale.x; m.scale.setScalar(0.001);
    this.world.itemsGroup.add(m); this.meshes.set(rec.id, m);
    gsap.to(m.scale, { x: s, y: s, z: s, duration: 0.6, delay, ease: 'back.out(2.2)', onComplete: () => { m.userData.state = 'idle'; } });
  }

  reset() {
    const st = this.current; if (!st) return; const id = st.id;
    for (const m of this.meshes.values()) m.removeFromParent();
    this.meshes.clear(); delete this.states[id]; this.current = null; this.loadWorld(id);
  }

  attemptSort(item, bin) {
    const d = item.userData, st = this.current, rec = st.items.find((i) => i.id === d.id);
    if (!rec) return;
    d.state = 'busy'; d.halo.material.opacity = 0;
    if (bin.kind !== d.kind) return this._wrong(item, bin);
    rec.done = true; st.sorted++; this.meshes.delete(d.id);
    const mouth = bin.mouth(), home = d.home.clone(), id = st.id;
    this.emit('progress', { sorted: st.sorted, total: st.total });
    gsap.timeline()
      .to(item.position, { x: mouth.x, y: mouth.y + 0.2, z: mouth.z, duration: 0.28, ease: 'power2.out' })
      .to(item.position, { y: mouth.y - 0.12, duration: 0.2, ease: 'power2.in' })
      .to(item.scale, { x: 0.3, y: 0.3, z: 0.3, duration: 0.2 }, '<')
      .call(() => {
        item.removeFromParent(); bin.feedbackGood(); sound.recycle();
        this.emit('toast', { text: `Recycled ${KIND_NOUN[d.kind]}`, tone: 'good' });
        this.fx.burst(mouth, home, bin.def.color, 30, 0.25).then(() => {
          this.fx.ripple(home, 0xbaff9a, 1.0); this.fx.burst(home, home.clone().add(new THREE.Vector3(0, 0.35, 0)), 0xfff2a0, 14, 0, 0.3);
          if (this.current?.id === id) this.restoration.tweenTo(st.r, 1.8);
          if (st.sorted >= st.total) this._complete(st);
        });
      });
  }

  _wrong(item, bin) {
    const d = item.userData, home = d.home; bin.feedbackBad(); sound.wrong();
    this.emit('toast', { text: `That's ${KIND_NOUN[d.kind]}. It goes in the ${BIN_NAME[d.kind]} bin.`, tone: 'bad' });
    gsap.timeline().to(item.position, { y: item.position.y + 0.18, duration: 0.2, ease: 'power2.out' })
      .to(item.position, { x: home.x, y: home.y, z: home.z, duration: 0.55, ease: 'power2.inOut' }).call(() => { d.state = 'idle'; });
  }

  _complete(st) {
    sound.complete();
    this.emit('toast', { text: `${CONFIG.worlds[st.id].label} restored`, tone: 'good' });
    const c = new THREE.Vector3(0, 0.05, 0.3);
    [0, 0.35, 0.7].forEach((d) => this.fx.ripple(c, 0xfff0a0, 1.6, d));
    this.fx.burst(new THREE.Vector3(0, 0.1, 0.3), new THREE.Vector3(0, 1.0, 0), 0xfff0a0, 60, 0, 1.6);
    this.emit('complete', { id: st.id });
  }

  /** Scoop sludge/debris directly from the river into a held organic waste item. */
  scoopRiver(pt) {
    const id = `river-${Date.now()}`;
    const m = createWaste('organic', 1, id);
    m.position.copy(pt); m.userData.home.copy(pt); m.userData.state = 'idle';
    this.world.itemsGroup.add(m); this.meshes.set(id, m);
    if (this.current) {
      this.current.items.push({ id, kind: 'organic', variant: 1, x: pt.x, z: pt.z, rot: 0, done: false });
      this.current.total++;
      this.emit('progress', { sorted: this.current.sorted, total: this.current.total });
    }
    this.fx.ripple(pt, 0x6fe0cf, 0.7);
    this.emit('toast', { text: 'Scooped river sludge! Put it in the Organic bin.', tone: 'good' });
    return m;
  }

  /** Brief ring + glow whenever the marker selects a different world. */
  worldPulse() { this.fx.ripple(new THREE.Vector3(0, 0.03, 0), 0x7fd6a0, 0.8); }
}
