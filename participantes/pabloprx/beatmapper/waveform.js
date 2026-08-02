// Dibujo del timeline en canvas 2d: regla, secciones, onda, grilla, marcas, trim.
import { HEX } from "../theme.js";
import { beatDur, beatAt } from "./schema.js";
import { levelFor } from "./audio.js";

export const RULER = 24, SECT = 16, MARK = 20;   // alturas de las bandas
export const waveTop = () => RULER + SECT;
export const waveBot = (H) => H - MARK;

export const t2x = (t, v) => (t - v.t0) * v.pps;
export const x2t = (x, v) => v.t0 + x / v.pps;

const SECT_COLORS = [HEX.violet, HEX.cyan, HEX.orange, HEX.green, HEX.pink, HEX.yellow, HEX.accentSoft, HEX.lime];
export const sectColor = (i) => SECT_COLORS[i % SECT_COLORS.length];

export function fmt(t) {
  const s = Math.max(0, t), m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}.${String(Math.floor((s % 1) * 1000)).padStart(3, "0")}`;
}

const STEPS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120];

export function draw(g, W, H, s) {
  const { view: v, state: st, peaks, pos, sel, selSection, rect } = s;
  const wt = waveTop(), wb = waveBot(H), wh = wb - wt;
  g.fillStyle = HEX.bg; g.fillRect(0, 0, W, H);

  // --- onda ---
  if (peaks) {
    const spp = peaks.rate / v.pps;
    const li = levelFor(peaks, spp), bs = peaks.base * 2 ** li, arr = peaks.levels[li], nb = arr.length / 2;
    const mid = wt + wh / 2, amp = wh / 2 - 2;
    g.fillStyle = HEX.accent;
    for (let x = 0; x < W; x++) {
      let i0 = Math.floor((x2t(x, v) * peaks.rate) / bs);
      let i1 = Math.ceil((x2t(x + 1, v) * peaks.rate) / bs);
      if (i1 <= 0 || i0 >= nb) continue;
      i0 = Math.max(0, i0); i1 = Math.max(i0 + 1, Math.min(i1, nb));
      let mn = 0, mx = 0;
      for (let i = i0; i < i1; i++) { const a = arr[i * 2], b = arr[i * 2 + 1]; if (a < mn) mn = a; if (b > mx) mx = b; }
      g.fillRect(x, mid - mx * amp, 1, Math.max(1, (mx - mn) * amp));
    }
  }

  // --- fuera del trim, apagado ---
  const tr = st.track.trim;
  g.fillStyle = "rgba(11,13,23,0.72)";
  const tx0 = t2x(tr.start, v), tx1 = t2x(tr.end, v);
  if (tx0 > 0) g.fillRect(0, wt, tx0, wh);
  if (tx1 < W) g.fillRect(tx1, wt, W - tx1, wh);
  g.strokeStyle = HEX.green; g.lineWidth = 2;
  for (const x of [tx0, tx1]) if (x > -2 && x < W + 2) { g.beginPath(); g.moveTo(x, wt); g.lineTo(x, wb); g.stroke(); }
  g.lineWidth = 1;

  // --- grilla de beats/compases ---
  const bd = beatDur(st.tempo), bpb = st.tempo.beatsPerBar;
  const bpx = bd * v.pps;
  if (bpx > 2) {
    const b0 = Math.floor(beatAt(x2t(0, v), st.tempo)), b1 = Math.ceil(beatAt(x2t(W, v), st.tempo));
    for (let b = b0; b <= b1; b++) {
      const bar = ((b % bpb) + bpb) % bpb === 0;
      if (!bar && bpx < 6) continue;
      const x = Math.round(t2x(st.tempo.offset + b * bd, v)) + 0.5;
      g.strokeStyle = bar ? "rgba(226,232,240,0.45)" : "rgba(148,163,184,0.18)";
      g.beginPath(); g.moveTo(x, wt); g.lineTo(x, wb); g.stroke();
    }
  }

  // --- banda de secciones ---
  g.fillStyle = HEX.surface; g.fillRect(0, RULER, W, SECT);
  st.sections.forEach((sc, i) => {
    const x = t2x(sc.start, v), w = (sc.end - sc.start) * v.pps;
    if (x + w < 0 || x > W) return;
    g.fillStyle = sectColor(i); g.globalAlpha = sc === selSection ? 0.95 : 0.6;
    g.fillRect(x, RULER, w, SECT);
    g.globalAlpha = 1;
    g.fillStyle = HEX.bg; g.font = "10px ui-monospace, monospace";
    g.save(); g.beginPath(); g.rect(x + 2, RULER, Math.max(0, w - 4), SECT); g.clip();
    g.fillText(sc.label, x + 4, RULER + 11); g.restore();
    g.strokeStyle = HEX.bg; g.beginPath(); g.moveTo(x + .5, RULER); g.lineTo(x + .5, RULER + SECT); g.stroke();
  });

  // --- regla ---
  g.fillStyle = HEX.surfaceLight; g.fillRect(0, 0, W, RULER);
  g.strokeStyle = HEX.border; g.beginPath(); g.moveTo(0, RULER + .5); g.lineTo(W, RULER + .5); g.stroke();
  const step = STEPS.find((s2) => s2 * v.pps >= 70) || 120;
  g.font = "10px ui-monospace, monospace";
  for (let t = Math.ceil(v.t0 / step) * step; t2x(t, v) < W; t += step) {
    const x = Math.round(t2x(t, v)) + .5;
    g.strokeStyle = HEX.border; g.beginPath(); g.moveTo(x, 12); g.lineTo(x, RULER); g.stroke();
    g.fillStyle = HEX.textMuted; g.fillText(fmt(t), x + 3, 10);
  }
  if (bpx * bpb > 46) {   // etiquetas de compas
    const bar0 = Math.floor(beatAt(x2t(0, v), st.tempo) / bpb), bar1 = Math.ceil(beatAt(x2t(W, v), st.tempo) / bpb);
    g.fillStyle = HEX.accentSoft;
    for (let b = bar0; b <= bar1; b++) {
      const x = t2x(st.tempo.offset + b * bpb * bd, v);
      if (x > -20 && x < W) g.fillText(`c${b + 1}`, x + 3, RULER - 3);
    }
  }

  // --- marcas ---
  const col = Object.fromEntries(st.tags.map((t) => [t.id, t.color]));
  g.fillStyle = HEX.surface; g.fillRect(0, wb, W, MARK);
  for (const e of st.events) {
    const x = Math.round(t2x(e.t, v)) + .5;
    if (x < -6 || x > W + 6) continue;
    const c = col[e.tag] || HEX.text, on = sel.has(e);
    g.strokeStyle = c; g.globalAlpha = on ? 1 : 0.65; g.lineWidth = on ? 2 : 1;
    g.beginPath(); g.moveTo(x, wt); g.lineTo(x, wb + MARK); g.stroke();
    g.globalAlpha = 1; g.lineWidth = 1;
    g.fillStyle = c;
    if (e.dur > 0) {                      // marca con rango: barra hasta t+dur
      const w2 = Math.max(2, e.dur * v.pps);
      g.globalAlpha = 0.35; g.fillRect(x, wt, w2, wb - wt); g.globalAlpha = 1;
      g.fillRect(x, wb + 7, w2, 6);
    }
    g.fillRect(x - 3, wb + 4, 7, 12);
    if (on) { g.strokeStyle = HEX.text; g.strokeRect(x - 4.5, wb + 2.5, 10, 15); }
  }

  // --- seleccion por rectangulo ---
  if (rect) {
    g.fillStyle = "rgba(99,102,241,0.25)"; g.strokeStyle = HEX.accent;
    const x = Math.min(rect.x0, rect.x1), w = Math.abs(rect.x1 - rect.x0);
    g.fillRect(x, wb, w, MARK); g.strokeRect(x + .5, wb + .5, w, MARK - 1);
  }

  // --- playhead ---
  const px = Math.round(t2x(pos, v)) + .5;
  g.strokeStyle = HEX.pink; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(px, 0); g.lineTo(px, H); g.stroke();
  g.lineWidth = 1;
}
