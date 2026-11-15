// Planar marker pose from 4 corners via homography decomposition.
// Marker model: unit square, centred, x right, y down, corners TL,TR,BR,BL.
// Camera: OpenCV convention (x right, y down, z forward). Units = marker side.
const MODEL = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];

function solve8(A, b) {
  const n = 8;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    if (Math.abs(A[p][i]) < 1e-12) return null;
    [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
    for (let r = i + 1; r < n; r++) {
      const f = A[r][i] / A[i][i];
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
    x[i] = s / A[i][i];
  }
  return x;
}

const norm = (v) => Math.hypot(v[0], v[1], v[2]);
const scale = (v, s) => [v[0] * s, v[1] * s, v[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** corners: [{x,y}] x4 in pixels of a w*h image; f = focal length in pixels. */
export function solvePlanarPose(corners, w, h, f) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [X, Y] = MODEL[i];
    const u = (corners[i].x - w / 2) / f, v = (corners[i].y - h / 2) / f;
    A.push([X, Y, 1, 0, 0, 0, -u * X, -u * Y]); b.push(u);
    A.push([0, 0, 0, X, Y, 1, -v * X, -v * Y]); b.push(v);
  }
  const s = solve8(A, b);
  if (!s) return null;
  const h1 = [s[0], s[3], s[6]], h2 = [s[1], s[4], s[7]], h3 = [s[2], s[5], 1];
  const lambda = 2 / (norm(h1) + norm(h2));
  let r1 = scale(h1, lambda), r2 = scale(h2, lambda), t = scale(h3, lambda);
  if (t[2] < 0) { r1 = scale(r1, -1); r2 = scale(r2, -1); t = scale(t, -1); }
  r1 = scale(r1, 1 / norm(r1));
  const d = dot(r1, r2);
  r2 = [r2[0] - d * r1[0], r2[1] - d * r1[1], r2[2] - d * r1[2]];
  r2 = scale(r2, 1 / norm(r2));
  const r3 = cross(r1, r2);
  // R columns = r1, r2, r3 (marker axes in camera frame)
  return { R: [[r1[0], r2[0], r3[0]], [r1[1], r2[1], r3[1]], [r1[2], r2[2], r3[2]]], t };
}

/** OpenCV camera frame -> three.js frame (flip y and z). Row-major 4x4 for Matrix4.set(). */
export function toThreeRows({ R, t }) {
  const c = [1, -1, -1];
  const r = (i, j) => c[i] * c[j] * R[i][j];
  return [
    r(0, 0), r(0, 1), r(0, 2), t[0],
    r(1, 0), r(1, 1), r(1, 2), -t[1],
    r(2, 0), r(2, 1), r(2, 2), -t[2],
    0, 0, 0, 1,
  ];
}
