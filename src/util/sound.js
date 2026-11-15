/** Zero-dependency procedural sound FX via Web Audio API. */
class SoundEngine {
  constructor() {
    this.ctx = null;
  }
  _init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }
  _tone(freq, type, duration, gain = 0.15, slideTo = null) {
    const ctx = this._init();
    if (!ctx) return;
    const osc = ctx.createOscillator(), g = ctx.createGain(), now = ctx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(10, slideTo), now + duration);
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }
  grab() { this._tone(240, 'sine', 0.08, 0.12, 480); }
  drop() { this._tone(320, 'sine', 0.07, 0.09, 180); }
  splash() {
    this._tone(280, 'sine', 0.12, 0.14, 140);
    setTimeout(() => this._tone(360, 'sine', 0.15, 0.12, 620), 40);
  }
  wind() {
    this._tone(160, 'sine', 0.45, 0.18, 90);
    setTimeout(() => this._tone(220, 'sine', 0.35, 0.12, 110), 60);
  }
  recycle() {
    this._tone(523.25, 'triangle', 0.18, 0.15); // C5
    setTimeout(() => this._tone(659.25, 'triangle', 0.25, 0.18), 70); // E5
  }
  wrong() {
    this._tone(160, 'sawtooth', 0.12, 0.09, 120);
    setTimeout(() => this._tone(130, 'sawtooth', 0.16, 0.08, 100), 80);
  }
  lock(on) { this._tone(on ? 680 : 420, 'sine', 0.06, 0.12, on ? 880 : 320); }
  complete() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      setTimeout(() => this._tone(f, 'sine', 0.55, 0.18), i * 110);
    });
    setTimeout(() => {
      this._tone(1046.5, 'triangle', 1.2, 0.15);
      this._tone(1318.5, 'sine', 1.2, 0.12);
      this._tone(1567.98, 'sine', 1.2, 0.1);
    }, notes.length * 110);
  }
}
export const sound = new SoundEngine();
