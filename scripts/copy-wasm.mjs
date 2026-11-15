// Copies the MediaPipe wasm runtime out of node_modules so the app never hits a CDN.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
const src = 'node_modules/@mediapipe/tasks-vision/wasm';
const dst = 'public/mediapipe/wasm';
if (existsSync(src)) { mkdirSync(dst, { recursive: true }); cpSync(src, dst, { recursive: true }); console.log('[setup] MediaPipe wasm copied'); }
else console.warn('[setup] run `npm install` first (tasks-vision not found)');
