// ─── Audio Manager (Web Audio API - Procedural) ─────────────────────────────

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private _muted = false;
  private _volume = 0.3;

  constructor() {
    // Audio context is created on first user interaction
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this._volume;
        this.masterGain.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Reverb impulse response (procedural — exponential decay noise).
  private buildReverb(tail: number, decay: number): ConvolverNode | null {
    const ctx = this.ensureContext();
    if (!ctx) return null;

    const length = Math.floor(ctx.sampleRate * tail);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let idx = 0; idx < length; idx++) {
        data[idx] = (Math.random() * 2 - 1) * Math.pow(1 - idx / length, decay);
      }
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;
    convolver.connect(this.masterGain!);
    return convolver;
  }

  private getReverb(): ConvolverNode | null {
    if (this.reverb) return this.reverb;
    this.reverb = this.buildReverb(2.2, 2.2);
    return this.reverb;
  }

  get muted(): boolean {
    return this._muted;
  }

  set muted(value: boolean) {
    this._muted = value;
    if (this.masterGain) {
      this.masterGain.gain.value = value ? 0 : this._volume;
    }
  }

  get volume(): number {
    return this._volume;
  }

  set volume(value: number) {
    this._volume = Math.max(0, Math.min(1, value));
    if (this.masterGain && !this._muted) {
      this.masterGain.gain.value = this._volume;
    }
  }

  playLaser(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Layer 1: main laser tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);

    // Layer 2: high-pitched ping
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2000, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
    gain2.gain.setValueAtTime(0.15, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc2.connect(gain2);
    gain2.connect(this.masterGain!);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 0.1);
  }

  playMissile(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  }

  playExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Small random variance keeps low tones but varies each blast (realism)
    const jitter = () => 0.85 + Math.random() * 0.3;

    // Layer 0: sub-bass boom (depth)
    const subDur = 0.7 + Math.random() * 0.3;
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(55 + Math.random() * 30, ctx.currentTime);
    sub.frequency.exponentialRampToValueAtTime(20 + Math.random() * 10, ctx.currentTime + subDur);
    subGain.gain.setValueAtTime(0.9, ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + subDur);
    sub.connect(subGain);
    subGain.connect(this.masterGain!);
    sub.start(ctx.currentTime);
    sub.stop(ctx.currentTime + subDur);

    // Layer 1: noise burst (low rumble, longer decay)
    const rumbleDur = 0.8 + Math.random() * 0.3;
    const bufferSize = ctx.sampleRate * rumbleDur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let idx = 0; idx < bufferSize; idx++) {
      data[idx] = (Math.random() * 2 - 1) * Math.pow(1 - idx / bufferSize, 1.5);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.9 * jitter(), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + rumbleDur);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200 + Math.random() * 1500, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(70 + Math.random() * 30, ctx.currentTime + rumbleDur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    // Reverb tail on the rumble
    const reverb = this.getReverb();
    if (reverb) filter.connect(reverb);
    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + rumbleDur);

    // Layer 2: impact thump
    const thumpDur = 0.25 + Math.random() * 0.15;
    const osc = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(85 + Math.random() * 40, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(28 + Math.random() * 8, ctx.currentTime + thumpDur);
    gain2.gain.setValueAtTime(0.8, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + thumpDur);
    osc.connect(gain2);
    gain2.connect(this.masterGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + thumpDur);

    // Layer 3: shrapnel (high noise)
    const shrapnelDur = 0.25 + Math.random() * 0.15;
    const bufferSize2 = ctx.sampleRate * shrapnelDur;
    const buffer2 = ctx.createBuffer(1, bufferSize2, ctx.sampleRate);
    const data2 = buffer2.getChannelData(0);
    for (let idx = 0; idx < bufferSize2; idx++) {
      data2[idx] = (Math.random() * 2 - 1) * Math.pow(1 - idx / bufferSize2, 3);
    }
    const noise2 = ctx.createBufferSource();
    noise2.buffer = buffer2;

    const gain3 = ctx.createGain();
    gain3.gain.setValueAtTime(0.4 + Math.random() * 0.25, ctx.currentTime);
    gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + shrapnelDur);

    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'highpass';
    filter2.frequency.setValueAtTime(1800 + Math.random() * 800, ctx.currentTime);

    noise2.connect(filter2);
    filter2.connect(gain3);
    gain3.connect(this.masterGain!);
    noise2.start(ctx.currentTime);
    noise2.stop(ctx.currentTime + shrapnelDur);
  }

  // Player death: longer, louder, much bigger reverb tail.
  playDeathExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Layer 0: slow, deep sub-bass boom
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(50, ctx.currentTime);
    sub.frequency.exponentialRampToValueAtTime(16, ctx.currentTime + 1.6);
    subGain.gain.setValueAtTime(1.0, ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.6);
    sub.connect(subGain);
    subGain.connect(this.masterGain!);
    sub.start(ctx.currentTime);
    sub.stop(ctx.currentTime + 1.6);

    // Layer 1: long noise rumble with big reverb
    const rumbleDur = 2.0;
    const bufferSize = ctx.sampleRate * rumbleDur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let idx = 0; idx < bufferSize; idx++) {
      data[idx] = (Math.random() * 2 - 1) * Math.pow(1 - idx / bufferSize, 1.2);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.0, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + rumbleDur);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + rumbleDur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    const reverb = this.buildReverb(4.0, 1.5);
    if (reverb) filter.connect(reverb);
    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + rumbleDur);

    // Layer 2: deep impact thump
    const osc = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(18, ctx.currentTime + 0.6);
    gain2.gain.setValueAtTime(0.9, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    osc.connect(gain2);
    gain2.connect(this.masterGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);

    // Layer 3: falling whoosh (drama)
    const whoosh = ctx.createOscillator();
    const whooshGain = ctx.createGain();
    whoosh.type = 'sawtooth';
    whoosh.frequency.setValueAtTime(600, ctx.currentTime);
    whoosh.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 1.2);
    whooshGain.gain.setValueAtTime(0.18, ctx.currentTime);
    whooshGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
    whoosh.connect(whooshGain);
    whooshGain.connect(this.masterGain!);
    whoosh.start(ctx.currentTime);
    whoosh.stop(ctx.currentTime + 1.2);
  }

  playEnemyLaser(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(700, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(1600, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.06);
    gain2.gain.setValueAtTime(0.25, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc2.connect(gain2);
    gain2.connect(this.masterGain!);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 0.08);
  }

  playSmallExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const bufferSize = ctx.sampleRate * 0.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let idx = 0; idx < bufferSize; idx++) {
      data[idx] = (Math.random() * 2 - 1) * Math.pow(1 - idx / bufferSize, 2);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + 0.2);
  }

  playHit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }

  playShieldHit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }

  playVictory(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    for (let idx = 0; idx < notes.length; idx++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[idx], ctx.currentTime + idx * 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime + idx * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.2 + 0.4);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(ctx.currentTime + idx * 0.2);
      osc.stop(ctx.currentTime + idx * 0.2 + 0.4);
    }
  }

  playGameOver(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [400, 350, 300, 200];
    for (let idx = 0; idx < notes.length; idx++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(notes[idx], ctx.currentTime + idx * 0.3);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.3 + 0.5);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(ctx.currentTime + idx * 0.3);
      osc.stop(ctx.currentTime + idx * 0.3 + 0.5);
    }
  }

  // ── Motion-design SFX (procedural) ───────────────────────────────────────

  private noiseBuffer: AudioBuffer | null = null;
  private getNoise(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
    return buf;
  }

  /** Filtered-noise sweep. `up` = rising (warp out), else falling (warp in). */
  private sweep(duration: number, from: number, to: number, gainPeak: number, q = 4): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(gainPeak, t + duration * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    const rev = this.getReverb();
    if (rev) gain.connect(rev);
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  playWarp(): void {
    this.sweep(1.6, 120, 4200, 0.9, 2.5);
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 1.5);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 1.7);
  }

  playWarpArrive(): void {
    this.sweep(1.1, 5000, 160, 0.7, 2);
  }

  playRoll(): void {
    this.sweep(0.45, 600, 2600, 0.35, 6);
  }

  playDeflect(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.exponentialRampToValueAtTime(3600, t + 0.06);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  playPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const notes = [880, 1175, 1568];
    notes.forEach((f, i) => {
      const t = ctx.currentTime + i * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.13);
    });
  }

  playBoost(): void {
    this.sweep(0.6, 300, 1800, 0.45, 3);
  }

  /** Two-tone klaxon for the boss warning. */
  playAlarm(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    for (let i = 0; i < 4; i++) {
      const t = ctx.currentTime + i * 0.55;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.setValueAtTime(440, t + 0.25);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.09, t + 0.03);
      gain.gain.setValueAtTime(0.09, t + 0.45);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.52);
    }
  }

  dispose(): void {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.reverb = null;
  }
}
