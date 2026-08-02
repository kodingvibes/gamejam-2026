// WebAudio: decode, transporte y picos multiescala. Sin dependencias.
let ctx = null, buf = null, node = null, startedAt = 0, offset = 0, playing = false;

export function getCtx() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export const latency = () => { const c = getCtx(); return c.outputLatency || c.baseLatency || 0; };

export const decode = (arrayBuffer) => getCtx().decodeAudioData(arrayBuffer);

export const buffer = () => buf;
export const duration = () => (buf ? buf.duration : 0);
export const isPlaying = () => playing;

export function setBuffer(b) { stop(); buf = b; offset = 0; }

export function play(from = offset) {
  if (!buf) return;
  stop();
  const c = getCtx();
  const n = c.createBufferSource();
  n.buffer = buf;
  n.connect(c.destination);
  offset = Math.max(0, Math.min(from, buf.duration));
  if (offset >= buf.duration - 0.001) offset = 0;   // reproducir de nuevo desde el inicio
  startedAt = c.currentTime;
  // comparar contra el nodo actual: el ended de un nodo viejo no debe parar al nuevo
  n.onended = () => { if (n === node) { playing = false; offset = buf.duration; node = null; } };
  node = n;
  n.start(0, offset);
  playing = true;
}

export function stop() {
  if (node) { const n = node; node = null; try { n.stop(); } catch {} n.disconnect(); }
  playing = false;
}

export function pause() { const p = pos(); stop(); offset = p; }
export function seek(t) { const was = playing; offset = Math.max(0, Math.min(t, duration())); if (was) play(offset); }

// posicion de cancion para un instante del reloj de audio
export const posAt = (ctxTime) => (playing ? Math.min(ctxTime - startedAt + offset, duration()) : offset);
export const pos = () => posAt(ctx ? ctx.currentTime : 0);

// --- picos: nivel 0 = BASE muestras por bucket, cada nivel duplica el bucket ---
const BASE = 256;

export function buildPeaks(b) {
  const ch = b.getChannelData(0);
  const n = Math.ceil(ch.length / BASE);
  const l0 = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const a = i * BASE, e = Math.min(a + BASE, ch.length);
    let mn = 0, mx = 0;
    for (let j = a; j < e; j++) { const v = ch[j]; if (v < mn) mn = v; else if (v > mx) mx = v; }
    l0[i * 2] = mn; l0[i * 2 + 1] = mx;
  }
  const levels = [l0];
  while (levels[levels.length - 1].length > 4) {
    const p = levels[levels.length - 1], m = Math.ceil(p.length / 4), q = new Float32Array(m * 2);
    for (let i = 0; i < m; i++) {
      const a = i * 4;
      q[i * 2] = Math.min(p[a], a + 2 < p.length ? p[a + 2] : p[a]);
      q[i * 2 + 1] = Math.max(p[a + 1], a + 3 < p.length ? p[a + 3] : p[a + 1]);
    }
    levels.push(q);
  }
  return { levels, base: BASE, rate: b.sampleRate, length: ch.length };
}

// nivel mas pequeno cuyo bucket cubre >= muestras por pixel
export function levelFor(peaks, samplesPerPx) {
  let i = 0;
  while (i + 1 < peaks.levels.length && peaks.base * 2 ** i < samplesPerPx) i++;
  return i;
}
