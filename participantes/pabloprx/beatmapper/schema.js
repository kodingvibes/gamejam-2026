// Schema maestro de sonido: lectura, escritura y validacion.
// El juego importa este modulo para consumir el JSON exportado por el beatmapper.
export const VERSION = 1;

const r = (x, d = 6) => Math.round(x * 10 ** d) / 10 ** d;

export const beatDur = (tempo) => 60 / tempo.bpm;
export const beatAt = (t, tempo) => (t - tempo.offset) / beatDur(tempo);
export const timeOfBeat = (b, tempo) => tempo.offset + b * beatDur(tempo);

// div en beats: 1, 0.5, 0.25, 0.125
export function snapTime(t, tempo, div) {
  const s = beatDur(tempo) * div;
  return tempo.offset + Math.round((t - tempo.offset) / s) * s;
}

export function sectionAt(t, sections) {
  const s = sections.find((x) => t >= x.start && t < x.end);
  return s ? s.id : null;
}

// state -> doc listo para exportar
export function build(state) {
  const { track, tempo, sections, tags, events } = state;
  const secs = sections.slice().sort((a, b) => a.start - b.start)
    .map((s) => ({ id: s.id, label: s.label, start: r(s.start), end: r(s.end) }));
  return {
    version: VERSION,
    track: {
      name: track.name,
      duration: r(track.duration),
      trim: { start: r(track.trim.start), end: r(track.trim.end) },
    },
    tempo: { bpm: r(tempo.bpm, 4), offset: r(tempo.offset), beatsPerBar: tempo.beatsPerBar },
    sections: secs,
    tags: tags.map((t) => ({ id: t.id, key: t.key, color: t.color })),
    events: events.slice().sort((a, b) => a.t - b.t).map((e) => ({
      t: r(e.t),
      tag: e.tag,
      ...(e.dur > 0 ? { dur: r(e.dur) } : {}),   // marca con duracion (voz, riser, pad)
      ...(e.v != null ? { v: r(e.v, 3) } : {}),  // intensidad 0-1, la pone el analizador
      beat: r(beatAt(e.t, tempo), 4),
      section: sectionAt(e.t, sections),
    })),
  };
}

export function validate(doc) {
  const err = [];
  const num = (v) => typeof v === "number" && isFinite(v);
  if (!doc || typeof doc !== "object") return ["no es un objeto"];
  if (doc.version !== VERSION) err.push(`version ${doc.version} != ${VERSION}`);
  if (!doc.track || !num(doc.track.duration)) err.push("track.duration invalido");
  else if (!doc.track.trim || !num(doc.track.trim.start) || !num(doc.track.trim.end)) err.push("track.trim invalido");
  if (!doc.tempo || !num(doc.tempo.bpm) || doc.tempo.bpm <= 0) err.push("tempo.bpm invalido");
  else if (!num(doc.tempo.offset)) err.push("tempo.offset invalido");
  for (const k of ["sections", "tags", "events"]) if (!Array.isArray(doc[k])) err.push(`${k} no es array`);
  if (err.length) return err;
  const ids = new Set(doc.tags.map((t) => t.id));
  doc.sections.forEach((s, i) => {
    if (!s.id || typeof s.label !== "string") err.push(`seccion ${i} sin id/label`);
    if (!num(s.start) || !num(s.end) || s.end <= s.start) err.push(`seccion ${i} con rango invalido`);
  });
  doc.events.forEach((e, i) => {
    if (!num(e.t)) err.push(`evento ${i} sin t`);
    if (e.dur != null && !(num(e.dur) && e.dur > 0)) err.push(`evento ${i} con dur invalido`);
    if (!ids.has(e.tag)) err.push(`evento ${i} usa tag desconocido "${e.tag}"`);
  });
  return err;
}

// doc -> state (lanza si el doc no valida)
export function parse(doc) {
  const err = validate(doc);
  if (err.length) throw new Error(err.join("; "));
  return {
    track: {
      name: doc.track.name || "",
      duration: doc.track.duration,
      trim: { start: doc.track.trim.start, end: doc.track.trim.end },
    },
    tempo: { bpm: doc.tempo.bpm, offset: doc.tempo.offset, beatsPerBar: doc.tempo.beatsPerBar || 4 },
    sections: doc.sections.map((s) => ({ id: s.id, label: s.label, start: s.start, end: s.end })),
    tags: doc.tags.map((t) => ({ id: t.id, key: t.key, color: t.color })),
    events: doc.events.map((e) => ({ t: e.t, tag: e.tag, ...(e.dur > 0 ? { dur: e.dur } : {}), ...(e.v != null ? { v: e.v } : {}) })),
  };
}

// Ajuste por minimos cuadrados de tiempos de tap -> bpm + offset.
// Descarta taps cuyo intervalo se desvia >25% de un multiplo del intervalo mediano.
export function fitTaps(taps) {
  if (taps.length < 3) return null;
  const ts = taps.slice().sort((a, b) => a - b);
  const d = [];
  for (let i = 1; i < ts.length; i++) d.push(ts[i] - ts[i - 1]);
  const sorted = d.slice().sort((a, b) => a - b);
  const med = sorted[sorted.length >> 1];
  if (!(med > 0)) return null;
  const idx = [0], keep = [ts[0]];
  let ref = ts[0], n = 0;
  for (let i = 1; i < ts.length; i++) {
    const k = Math.max(1, Math.round((ts[i] - ref) / med));
    if (Math.abs(ts[i] - ref - k * med) > 0.25 * med) continue; // outlier
    n += k; ref = ts[i];
    idx.push(n); keep.push(ts[i]);
  }
  if (keep.length < 3) return null;
  const m = keep.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < m; i++) { sx += idx[i]; sy += keep[i]; sxx += idx[i] ** 2; sxy += idx[i] * keep[i]; }
  const den = m * sxx - sx * sx;
  if (!den) return null;
  const slope = (m * sxy - sx * sy) / den;
  const inter = (sy - slope * sx) / m;
  if (!(slope > 0)) return null;
  const offset = inter - Math.floor(inter / slope) * slope; // normalizado a [0, beat)
  return { bpm: 60 / slope, offset, used: m, dropped: ts.length - m };
}
