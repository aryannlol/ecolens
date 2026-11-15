// QR modal & LAN-IP detection — extracted from main.js
let _hud;
const qrModal  = document.getElementById('qr-modal');
const qrImg    = document.getElementById('qr-img');
const qrLink   = document.getElementById('qr-link');
const qrIpInput = document.getElementById('qr-ip-input');

let detectedLanIp = (typeof __LAN_IP__ !== 'undefined' && __LAN_IP__) ? __LAN_IP__ : '';

async function resolveLanIp() {
  if (detectedLanIp) return detectedLanIp;
  try {
    const res = await fetch('/api/lan-ip');
    if (res.ok) { const data = await res.json(); if (data.ip) detectedLanIp = data.ip; }
  } catch {}
  return detectedLanIp;
}

function updateQrDisplay() {
  const current = new URL(window.location.href);
  const isLocal = ['localhost', '127.0.0.1'].includes(current.hostname);
  const inputIp = qrIpInput?.value.trim();
  const host = inputIp || ((isLocal && detectedLanIp) ? detectedLanIp : current.hostname);
  const port = current.port ? `:${current.port}` : '';
  const url = `${current.protocol}//${host}${port}/markers.html`;
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
  qrLink.href = url;
  qrLink.textContent = url;
}

export async function toggleQr(open) {
  const show = open ?? qrModal.hasAttribute('hidden');
  if (show) {
    await resolveLanIp();
    const current = new URL(window.location.href);
    const isLocal = ['localhost', '127.0.0.1'].includes(current.hostname);
    if (qrIpInput && !qrIpInput.value) qrIpInput.value = (isLocal && detectedLanIp) ? detectedLanIp : current.hostname;
    updateQrDisplay();
    qrModal.removeAttribute('hidden');
  } else {
    qrModal.setAttribute('hidden', '');
  }
}

export function initQr(hud) {
  _hud = hud;
  qrIpInput?.addEventListener('input', () => updateQrDisplay());
  document.getElementById('btn-qr')?.addEventListener('click', () => toggleQr(true));
  document.getElementById('btn-start-qr')?.addEventListener('click', () => toggleQr(true));
  document.getElementById('qr-close')?.addEventListener('click', () => toggleQr(false));
  qrModal?.addEventListener('click', (e) => { if (e.target === qrModal) toggleQr(false); });
  document.getElementById('btn-copy-link')?.addEventListener('click', () => {
    navigator.clipboard.writeText(qrLink.href).then(() => _hud.toast('Copied marker link to clipboard!', 'good'));
  });
}
