export const CONFIG = {
  markers: {
    dictionary: 'ARUCO_MIP_36h12',
    ids: { 11: 'polluted', 12: 'recovering', 13: 'clean' },
    detectWidth: 384,   // detection runs on a downscaled frame
    maxHamming: 1,
  },
  camera: { hfovDeg: 70, width: 1280, height: 720 },
  tracking: { switchFrames: 6, switchCooldownMs: 1500, lostAfterMs: 2000 },
  worlds: {
    polluted:   { label: 'Polluted world',   r0: 0.05, items: 12, seed: 11 },
    recovering: { label: 'Recovering world', r0: 0.5,  items: 7,  seed: 22 },
    clean:      { label: 'Clean world',      r0: 0.95, items: 4,  seed: 33 },
  },
  bins: [
    { kind: 'plastic', label: 'Plastic', color: 0xf2c230, x: -0.72 },
    { kind: 'paper',   label: 'Paper',   color: 0x3d7fd6, x: -0.28 },
    { kind: 'metal',   label: 'Metal',   color: 0x9aa7b3, x: 0.16 },
    { kind: 'organic', label: 'Organic', color: 0x4aa84f, x: 0.54 },
  ],
  hand: { grabMeters: 0.026, releaseMeters: 0.042, lostGraceMs: 300 },
  diorama: { size: 2.4, holdHeight: 0.34, viewElevationDeg: 36, binZ: -0.15 },
};
export const BIN_NAME = { plastic: 'yellow', paper: 'blue', metal: 'grey', organic: 'green' };
