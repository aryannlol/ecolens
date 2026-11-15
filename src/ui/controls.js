import * as THREE from 'three';

// Keyboard shortcuts + inspect-mode orbit — extracted from main.js
export function initControls({ manager, input, haze, world, game, hud, stage, toggleQr, hideEndgame, resetGame, startDemo }) {
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (e.key === 'Escape') { toggleQr(false); hideEndgame(); return; }
    if (k === 'm') { toggleQr(); return; }
    if (['1', '2', '3'].includes(k)) { if (manager.mode === 'idle') startDemo(); hideEndgame(); manager.selectManual(['polluted', 'recovering', 'clean'][+k - 1]); }
    if (k === 'l') { if (!manager.hasPose && !manager.locked) { hud.toast('Show a marker first to lock it', 'bad'); return; } const v = manager.toggleLock(); hud.setLocked(v); if (manager.activeWorld) hud.setTracking(v ? `${manager.activeWorld} (locked)` : `${manager.activeWorld} marker`); hud.toast(v ? 'Marker locked in place' : 'Marker tracking resumed', 'good'); }
    if (k === 'w') haze.triggerWKey(performance.now());
    if (k === 'f') { const v = !manager.frozen; manager.setFrozen(v); input.inspect = v; hud.hint(v ? 'Inspect: drag to rotate, scroll to zoom, F to return' : 'Tracking resumed'); if (!v) { world.inspect.yaw = world.inspect.pitch = 0; world.inspect.zoom = 1; } }
    if (k === 'r') { hideEndgame(); resetGame(); }
    if (k === 'h') hud.showSkeleton = !hud.showSkeleton;
  });

  // inspect-mode orbit
  let drag = null;
  stage.canvas.addEventListener('pointerdown', (e) => { if (manager.frozen) drag = { x: e.clientX, y: e.clientY }; });
  addEventListener('pointerup', () => (drag = null));
  addEventListener('pointermove', (e) => { if (!drag) return; world.inspect.yaw -= (e.clientX - drag.x) * 0.008; world.inspect.pitch = THREE.MathUtils.clamp(world.inspect.pitch - (e.clientY - drag.y) * 0.006, -0.6, 0.9); drag = { x: e.clientX, y: e.clientY }; });
  stage.canvas.addEventListener('wheel', (e) => { if (manager.frozen) world.inspect.zoom = THREE.MathUtils.clamp(world.inspect.zoom * (e.deltaY > 0 ? 0.93 : 1.07), 0.5, 2.5); }, { passive: true });
}
