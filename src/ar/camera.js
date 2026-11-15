import { CONFIG } from '../config.js';
export async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API unavailable (use localhost or https).');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { width: { ideal: CONFIG.camera.width }, height: { ideal: CONFIG.camera.height }, frameRate: { ideal: 30 }, facingMode: 'user' },
  });
  const video = document.createElement('video');
  video.srcObject = stream; video.muted = true; video.playsInline = true;
  await video.play();
  await new Promise((r) => (video.videoWidth ? r() : (video.onloadedmetadata = r)));
  return video;
}
