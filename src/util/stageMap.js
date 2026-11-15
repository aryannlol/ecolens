// src/util/stageMap.js
// Single source of truth for video-to-stage and stage-to-NDC coordinate mapping.

export const STAGE_GEOM = {
  W: typeof window !== 'undefined' ? window.innerWidth : 1280,
  H: typeof window !== 'undefined' ? window.innerHeight : 720,
  vw: 1280,
  vh: 720,
  s: 1,
  visW: 1280,
  visH: 720,
  cropX: 0,
  cropY: 0,
  mirrored: true,
};

export function updateStageGeom(geom) {
  Object.assign(STAGE_GEOM, geom);
}

/**
 * Maps raw video-normalized coordinates (0..1, MediaPipe) to stage-normalized (0..1, top-left, y-down).
 * Accounts for cover-mode cropping and webcam background mirroring.
 */
export function videoToStage(nx, ny) {
  const { vw, vh, visW, visH, cropX, cropY, mirrored } = STAGE_GEOM;
  const rawX = (nx * vw - cropX) / (visW || 1);
  const x = mirrored ? (1 - rawX) : rawX;
  const y = (ny * vh - cropY) / (visH || 1);
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
  };
}

/**
 * Converts stage-normalized coordinates (0..1, y-down) to Three.js NDC (-1..1, y-up).
 */
export function stageToNdc(x, y) {
  return {
    x: x * 2 - 1,
    y: -(y * 2 - 1),
  };
}
