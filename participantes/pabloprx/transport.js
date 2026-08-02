// Reloj de la cancion. Todo el mundo del juego es funcion de pos(), asi que
// pausa, camara lenta y rebobinado salen gratis: solo cambian el reloj.
export async function loadAudio(url) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const buf = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
  return new Transport(ctx, buf);
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Transport {
  constructor(ctx, buf) {
    this.ctx = ctx;
    this.buf = buf;
    this.gain = ctx.createGain();
    this.gain.connect(ctx.destination);
    this.t = 0;          // posicion cuando esta parado
    this.rate = 1;
    this.playing = false;
    this.node = null;
    this.loop = null;    // [a, b] en segundos
    this.adj = 0;        // ajuste fino de sync a ojo (s): outputLatency no siempre acierta
    // Analizador REAL, para el fondo `spectro`. Cuelga de la FUENTE y no de `gain`, o sea
    // que mutear (X) no apaga el espectro; y no va a destination, o sea que no suena dos
    // veces. Es lo unico del render que NO es funcion de songT: en pausa da todo ceros.
    this.an = ctx.createAnalyser();
    this.an.fftSize = 256;                  // 128 bins, mas de los que caben en barras
    this.an.smoothingTimeConstant = 0.72;   // sin esto el espectro tiembla y no se lee
    this.fft = new Uint8Array(this.an.frequencyBinCount);
  }

  spectrum() { this.an.getByteFrequencyData(this.fft); return this.fft; }

  get duration() { return this.buf.duration; }
  // lo que suena ahora salio del buffer hace `latency`: el video va con el audio, no con el reloj
  get lat() { return (this.ctx.outputLatency || this.ctx.baseLatency || 0) + this.adj; }

  pos() {
    if (!this.playing) return this.t;
    return clamp(this.t0 + (this.ctx.currentTime - this.anchor - this.lat) * this.rate, 0, this.duration);
  }

  // una vez por frame: cierra el loop y corta al final. Separado de pos() para no recursionar.
  tick() {
    if (!this.playing) return this.t;
    const t = this.pos();
    if (this.loop && t >= this.loop[1]) { this.seek(this.loop[0]); return this.loop[0]; }
    if (t >= this.duration - 1e-3) { this.pause(); return this.t; }
    return t;
  }

  play() {
    if (this.playing) return;
    this.ctx.resume();
    if (this.t >= this.duration - 1e-3) this.t = 0;
    const n = this.ctx.createBufferSource();
    n.buffer = this.buf;
    n.playbackRate.value = this.rate;
    n.connect(this.gain);
    n.connect(this.an);
    this.t0 = this.t;
    this.anchor = this.ctx.currentTime;
    n.start(0, this.t);
    this.node = n;
    this.playing = true;
  }

  pause() {
    if (!this.playing) return;
    const t = this.pos();
    this.kill();
    this.t = t;
  }

  kill() {
    if (this.node) {
      const n = this.node;
      this.node = null;
      try { n.stop(); } catch { /* ya parado */ }
      n.disconnect();
    }
    this.playing = false;
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  seek(t) {
    const p = this.playing;
    this.pause();
    this.t = clamp(t, 0, this.duration);
    if (p) this.play();
  }

  setRate(r) {
    const p = this.playing;
    this.pause();
    this.rate = r;
    if (p) this.play();
  }

  setMute(on) { this.gain.gain.value = on ? 0 : 1; }
}
