import * as THREE from 'three';
import gsap from 'gsap';
import { CONFIG } from './config.js';
import { Stage } from './scene/stage.js';
import { World } from './scene/world.js';
import { startCamera } from './ar/camera.js';
import { MarkerTracker } from './ar/markerTracker.js';
import { MarkerManager, demoMatrix } from './ar/markerManager.js';
import { HandTracker } from './hands/handTracker.js';
import { Input } from './hands/input.js';
import { Restoration } from './state/restoration.js';
import { createBins } from './gameplay/bins.js';
import { FX } from './gameplay/recycling.js';
import { Game } from './gameplay/game.js';
import { GrabController } from './gameplay/grabController.js';
import { HUD } from './ui/hud.js';
import { sound } from './util/sound.js';
import { show as showEndgame, hide as hideEndgame } from './ui/endgame.js';
import { Haze } from './ui/haze.js';
import { initQr, toggleQr } from './ui/qr.js';
import { initControls } from './ui/controls.js';

gsap.ticker.lagSmoothing(0); // keep animations on real time even if the frame rate dips
const hud = new HUD();
const stage = new Stage(document.getElementById('gl'));
const world = new World(); stage.scene.add(world.anchor);
const restoration = new Restoration();
const bins = createBins(world.binsGroup);
const fx = new FX(world.fxGroup);
const game = new Game({ world, restoration, bins, fx });
const manager = new MarkerManager();
const hand = new HandTracker();
const input = new Input(hand, stage.canvas, stage);
const haze = new Haze(document.getElementById('stage'));
stage.onResize = (w, h) => haze.resize(w, h);
const grab = new GrabController({ stage, world, game, bins, haze });
const demo = demoMatrix();
let video = null, tracker = null, mode = 'idle', lastVT = -1, frame = 0, firstWorld = true;
stage.setBackdrop();

// ---- events -------------------------------------------------------------------------------------
manager.addEventListener('world', (e) => {
  const { world: id, source } = e.detail;
  grab.cancel(); game.loadWorld(id, firstWorld);
  if (firstWorld) { world.inspect.zoom = 0.001; gsap.to(world.inspect, { zoom: 1, duration: 1.1, ease: 'back.out(1.5)' }); } else game.worldPulse();
  gsap.fromTo(stage, { flash: 0 }, { flash: 1, duration: 0.25, yoyo: true, repeat: 1 });
  firstWorld = false; hud.setWorld(id, CONFIG.worlds[id].label);
  hud.setTracking(source === 'marker' ? `${CONFIG.worlds[id].label} marker` : 'Manual selection');
});
game.addEventListener('world', (e) => {
  const { id, haze: stHaze } = e.detail;
  haze.setDensityArray(stHaze, id);
  restoration.air = haze.air;
  hud.setAir(restoration.air);
});
manager.addEventListener('status', (e) => {
  if (manager.locked) return;
  if (mode === 'camera') hud.setTracking(e.detail === 'tracking' ? `${CONFIG.worlds[manager.activeWorld].label} marker` : e.detail === 'lost' ? 'Marker lost, holding last position' : 'Looking for a marker');
});
game.addEventListener('toast', (e) => hud.toast(e.detail.text, e.detail.tone));
game.addEventListener('progress', (e) => hud.setProgress(e.detail.sorted, e.detail.total));

// ---- start --------------------------------------------------------------------------------------
async function startWithCamera() {
  hud.startNote('Starting camera…');
  try {
    video = await startCamera(); stage.setVideo(video); tracker = new MarkerTracker(video); mode = 'camera';
    hud.setTracking('Looking for a marker'); hud.hideStart();
    hud.hint('Show marker 11, 12 or 13 · 1 / 2 / 3 pick world · L lock · pinch litter/river · F inspect');
    hud.setHand('Hand: loading', false);
    hand.init().then((ok) => hud.setHand(ok ? 'Hand: ready' : 'Hand: model missing (mouse works)', ok));
  } catch (e) { hud.startNote(`Camera unavailable: ${e.message || e}. You can still try the demo.`); }
}
function startDemo() {
  mode = 'demo'; stage.setBackdrop(); hud.hideStart(); manager.selectManual('polluted'); hud.setHand('Mouse: drag to grab', false);
  hud.hint('Demo mode · 1 / 2 / 3 pick a world · drag litter into a bin · F inspect · R reset'); hud.setTracking('No camera');
}
function toggleLock() {
  if (!manager.hasPose && !manager.locked) { hud.toast('Show a marker first to lock it', 'bad'); return; }
  const v = manager.toggleLock();
  sound.lock(v);
  hud.setLocked(v);
  if (manager.activeWorld) hud.setTracking(v ? `${CONFIG.worlds[manager.activeWorld].label} (locked)` : `${CONFIG.worlds[manager.activeWorld].label} marker`);
  hud.toast(v ? 'Marker locked in place' : 'Marker tracking resumed', 'good');
  hud.hint(v ? 'Marker locked: position fixed · L to unlock' : 'Tracking resumed');
}
document.getElementById('btn-cam').onclick = startWithCamera;
document.getElementById('btn-demo').onclick = startDemo;
document.getElementById('btn-lock').onclick = toggleLock;
document.getElementById('st-hand')?.addEventListener('click', () => { hud.showSkeleton = !hud.showSkeleton; });

// Settings popover (TASK B)
const btnSettings = document.getElementById('btn-settings');
const popover = document.getElementById('settings-popover');
btnSettings?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (popover) {
    if (popover.hasAttribute('hidden')) popover.removeAttribute('hidden');
    else popover.setAttribute('hidden', '');
  }
});
document.addEventListener('click', (e) => {
  if (popover && !popover.contains(e.target) && e.target !== btnSettings) {
    popover.setAttribute('hidden', '');
  }
});

// Fullscreen toggle (JOB 1)
document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});

// Sound toggle
let soundOn = true;
const btnSound = document.getElementById('set-sound');
btnSound?.addEventListener('click', () => {
  soundOn = !soundOn;
  sound.enabled = soundOn;
  btnSound.textContent = soundOn ? 'On' : 'Off';
  btnSound.classList.toggle('active', soundOn);
});

// Quality setting (Low/Med/High: pixel ratio 1.0/1.25/1.5, shadows on/off for Low)
document.querySelectorAll('.q-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.q-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const q = btn.dataset.q;
    const pr = q === 'low' ? 1.0 : q === 'med' ? 1.25 : 1.5;
    stage.renderer.setPixelRatio(pr);
    const shadows = q !== 'low';
    stage.renderer.shadowMap.enabled = shadows;
    stage.scene.traverse((obj) => {
      if (obj.material) obj.material.needsUpdate = true;
    });
  });
});

// Reset game button in settings
document.getElementById('set-reset')?.addEventListener('click', () => {
  popover?.setAttribute('hidden', '');
  resetGame();
  hud.toast('Game reset', 'good');
});

// Show Results button (TASK D)
document.getElementById('btn-show-results')?.addEventListener('click', () => {
  const worldId = manager.activeWorld || 'polluted';
  const nextId = NEXT_WORLD[worldId] || 'polluted';
  showEndgame({
    to: ENDGAME_MAP[worldId] || 'recovering',
    onNext: () => { if (mode === 'idle') startDemo(); manager.selectManual(nextId); },
    onReplay: () => resetGame(),
    onInspect: () => { manager.setFrozen(true); input.inspect = true; hud.hint('Inspect: drag to rotate, scroll to zoom, F to return'); },
    onClose: () => {},
  });
});

initQr(hud);

function resetGame() {
  game.reset();
}

// Cinematic Endgame — uses the full-screen EcoEndgame overlay
const ENDGAME_MAP = { polluted: 'recovering', recovering: 'clean', clean: 'final' };
const NEXT_WORLD = { polluted: 'recovering', recovering: 'clean', clean: 'polluted' };

game.addEventListener('complete', ({ detail }) => {
  const worldId = detail.id;
  const nextId = NEXT_WORLD[worldId] || 'polluted';

  // Purify air fully
  restoration.air = 1.0;
  hud.setAir(1.0);

  showEndgame({
    to: ENDGAME_MAP[worldId] || 'recovering',
    onNext: () => { if (mode === 'idle') startDemo(); manager.selectManual(nextId); },
    onReplay: () => resetGame(),
    onInspect: () => { manager.setFrozen(true); input.inspect = true; hud.hint('Inspect: drag to rotate, scroll to zoom, F to return'); },
    onClose: () => {},
  });
});

manager.addEventListener('world', () => hideEndgame());

initControls({ manager, input, haze, world, game, hud, stage, toggleQr, hideEndgame, resetGame, startDemo });
addEventListener('resize', () => stage.resize());

// perf readout (?perf)
const showPerf = new URLSearchParams(location.search).has('perf');
let perfEl = null, perfFrames = 0, perfTimeAcc = 0;
if (showPerf) {
  perfEl = document.createElement('div');
  perfEl.id = 'perf-readout';
  perfEl.style.cssText = 'position:fixed;top:6px;right:6px;background:rgba(0,0,0,0.8);color:#5dff6a;font:11px monospace;padding:4px 8px;border-radius:4px;z-index:9999;pointer-events:none;';
  document.body.appendChild(perfEl);
}

// displayMatrix smoothing
const displayMatrix = new THREE.Matrix4();
const currPos = new THREE.Vector3(), targetPos = new THREE.Vector3();
const currQuat = new THREE.Quaternion(), targetQuat = new THREE.Quaternion();
const currScale = new THREE.Vector3(1, 1, 1), targetScale = new THREE.Vector3(1, 1, 1);
let poseInit = false;

// ---- frame loop ---------------------------------------------------------------------------------
let prev = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - prev) / 1000, 0.05); prev = now; const t = now / 1000;
  perfFrames++; perfTimeAcc += dt;
  if (perfEl && perfFrames >= 10) {
    const ms = (perfTimeAcc / perfFrames * 1000).toFixed(1);
    const info = stage.renderer.info.render;
    perfEl.textContent = `${ms} ms | ${info.calls} calls | ${info.triangles} tris`;
    perfFrames = 0; perfTimeAcc = 0;
  }

  if (mode === 'camera' && video.currentTime !== lastVT) {
    lastVT = video.currentTime; frame++;
    stage.notifyVideoFrame();
    if (frame % 2 === 0) hand.detect(video, now);
    else if (frame % 4 === 1 && !grab.held) manager.update(tracker.detect(), now);
  }
  hand.tick(now); input.update();

  const airVal = haze.update(now, dt, input, grab, restoration.rd, sound, world.atmo);
  restoration.air = airVal;
  hud.setAir(airVal);
  if (airVal < 0.4 && now - haze.lastWipeTime > 4000) {
    hud.hint('Wave your open hand across the haze');
  } else if (now - haze.lastWipeTime <= 500 && document.getElementById('hint')?.textContent === 'Wave your open hand across the haze') {
    hud.hint('Sort waste into the right bins to restore the world.');
  }

  if (mode === 'camera') {
    if (hand.ready) hud.setHand(hand.present ? (hand.pinching ? 'Hand: pinching' : 'Hand: tracking') : 'Hand: show your hand', hand.present);
    else if (hand.error) hud.setHand('Hand model missing, mouse works', false);
  }

  if (manager.activeWorld) {
    const targetM = manager.hasPose ? manager.matrix : demo;
    targetM.decompose(targetPos, targetQuat, targetScale);
    if (!poseInit) {
      currPos.copy(targetPos); currQuat.copy(targetQuat); currScale.copy(targetScale);
      displayMatrix.copy(targetM); poseInit = true;
    } else {
      const f = 1 - Math.exp(-dt * 18);
      currPos.lerp(targetPos, f);
      currQuat.slerp(targetQuat, f);
      currScale.lerp(targetScale, f);
      displayMatrix.compose(currPos, currQuat, currScale);
    }
    world.setPose(displayMatrix, true, dt);
    game.update(t, dt);
    const riverMurk = game.riverMurk();
    const prof = world.update(t, dt, restoration.rd, restoration.air, riverMurk);
    world.anchor.updateMatrixWorld(true);
    grab.update(input, dt, now);
    fx.update(dt);
    hud.setCursor(input, grab.state === 'holding' ? 'grab' : grab.state === 'hover' ? 'hover' : 'idle');
    hud.drawHand(hand.landmarks, input);
    hud.setMeter(restoration.rd);
    stage.render(prof, world.distance(), dt);
  } else {
    stage.render({ exposure: 1, env: 1, fog: new THREE.Color(0x222222), fogK: 0 }, 5, dt);
  }
}
requestAnimationFrame(loop);

// Handy for debugging in the console: __ecolens.game, .world, .restoration ...
window.__ecolens = { game, world, restoration, stage, grab, manager, hand, input, bins };
