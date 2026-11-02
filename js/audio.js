// js/audio.js — Tactile Web Audio Synthesizer Engine

const AudioEngine = {
  ctx: null,
  enabled: true,

  // Initialize Web Audio Context lazily on first user interaction
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  // Soft tactile tap feedback sound
  playClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(720, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(280, this.ctx.currentTime + 0.065);

      gain.gain.setValueAtTime(0.14, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.065);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.065);
    } catch (e) {
      console.warn('Audio click synth suppressed:', e);
    }
  },

  // Uplifting triad chime for slot booking, rewards & success
  playSuccess() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);         // C5
      osc.frequency.setValueAtTime(659.25, now + 0.07);    // E5
      osc.frequency.setValueAtTime(1046.50, now + 0.15);  // C6

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(now + 0.32);
    } catch (e) {
      console.warn('Audio success synth suppressed:', e);
    }
  },

  // Toggle audio on/off
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
};