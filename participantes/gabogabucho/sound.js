class LastreSound {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = LastreSound.readStoredMute();
  }

  static readStoredMute() {
    try {
      return window.localStorage.getItem('lastre:mute') === '1';
    } catch (error) {
      return false;
    }
  }

  storeMute() {
    try {
      window.localStorage.setItem('lastre:mute', this.muted ? '1' : '0');
    } catch (error) {
      return;
    }
  }

  ensure() {
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return null;
      this.context = new Context();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }

  toggleMute() {
    this.muted = !this.muted;
    this.storeMute();
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.context.currentTime, 0.02);
    }
    return this.muted;
  }

  tone({ from, to = from, duration = 0.12, type = 'sine', volume = 0.2, delay = 0 }) {
    const context = this.ensure();
    if (!context || this.muted) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  noise({ duration = 0.2, volume = 0.25, cutoff = 1800, sweepTo = 400, delay = 0 }) {
    const context = this.ensure();
    if (!context || this.muted) return;
    const start = context.currentTime + delay;
    const frames = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) channel[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(cutoff, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), start + duration);
    filter.Q.value = 1.2;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  pickup(pieces) {
    const step = Math.min(14, Math.max(0, pieces));
    const base = 440 * Math.pow(2, step / 14);
    this.tone({ from: base, to: base * 1.5, duration: 0.09, type: 'triangle', volume: 0.16 });
    this.tone({ from: base * 2, duration: 0.06, type: 'sine', volume: 0.07, delay: 0.03 });
  }

  scrape() {
    this.noise({ duration: 0.28, volume: 0.22, cutoff: 2600, sweepTo: 300 });
    this.tone({ from: 180, to: 90, duration: 0.2, type: 'sawtooth', volume: 0.1 });
  }

  stone() {
    this.noise({ duration: 0.16, volume: 0.18, cutoff: 1200, sweepTo: 220 });
    this.tone({ from: 130, to: 70, duration: 0.14, type: 'square', volume: 0.09 });
  }

  hop() {
    this.tone({ from: 320, to: 640, duration: 0.13, type: 'sine', volume: 0.13 });
  }

  impact() {
    this.tone({ from: 96, to: 48, duration: 0.24, type: 'square', volume: 0.14 });
    this.noise({ duration: 0.18, volume: 0.14, cutoff: 700, sweepTo: 140 });
  }

  boost() {
    [523, 659, 784, 1047].forEach((frequency, index) => {
      this.tone({ from: frequency, duration: 0.16, type: 'triangle', volume: 0.14, delay: index * 0.06 });
    });
  }

  finish() {
    [392, 523, 659, 784, 1047].forEach((frequency, index) => {
      this.tone({ from: frequency, duration: 0.3, type: 'triangle', volume: 0.16, delay: index * 0.12 });
    });
  }

  lose() {
    [330, 262, 196, 131].forEach((frequency, index) => {
      this.tone({ from: frequency, duration: 0.34, type: 'sawtooth', volume: 0.12, delay: index * 0.13 });
    });
  }

  menu() {
    this.tone({ from: 520, to: 780, duration: 0.12, type: 'square', volume: 0.1 });
  }
}
