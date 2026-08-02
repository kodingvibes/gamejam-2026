// Beatmapper: autoria manual del schema maestro de sonido.
import * as audio from "./audio.js";
import * as S from "./schema.js";
import * as W from "./waveform.js";

const $ = (s) => document.querySelector(s);
const KEY = "beatmapper.v1";

const state = {
  track: { name: "", duration: 0, trim: { start: 0, end: 0 } },
  tempo: { bpm: 120, offset: 0, beatsPerBar: 4 },
  sections: [],
  tags: [
    { id: "obstacle", key: "1", color: "#ef4444" },
    { id: "fx", key: "2", color: "#06b6d4" },
    { id: "background", key: "3", color: "#8b5cf6" },
  ],
  events: [],
};

let peaks = null;                     // picos multiescala del buffer actual
let view = { t0: 0, pps: 100 };
let sel = new Set(), selSection = null, rect = null;
let taps = [], snapOn = false, division = 1;
let undoStack = [], redoStack = [], drag = null;

// ---------- undo ----------
const snap = () => JSON.stringify(state);
function push() {
  undoStack.push(snap());
  if (undoStack.length > 50) undoStack.shift();
  redoStack.length = 0;
}
function restore(s) {
  Object.assign(state, JSON.parse(s));
  sel.clear(); selSection = null;
  syncUI(); save();
}
function undo() { if (undoStack.length) { redoStack.push(snap()); restore(undoStack.pop()); } }
function redo() { if (redoStack.length) { undoStack.push(snap()); restore(redoStack.pop()); } }

// ---------- persistencia ----------
function save() { try { localStorage.setItem(KEY, JSON.stringify(S.build(state))); } catch {} }

function setState(doc) {
  Object.assign(state, S.parse(doc));
  sel.clear(); selSection = null;
  undoStack = []; redoStack = [];
  syncUI();
}

// ---------- audio ----------
async function loadFile(f) {
  const prev = state.track.name;
  const b = await audio.decode(await f.arrayBuffer());
  audio.setBuffer(b);
  peaks = audio.buildPeaks(b);
  $("#warn").textContent = prev && prev !== f.name ? `ojo: el proyecto era de "${prev}"` : "";
  state.track.name = f.name;
  state.track.duration = b.duration;
  if (!(state.track.trim.end > state.track.trim.start)) state.track.trim = { start: 0, end: b.duration };
  fitView();
  syncUI(); save();
  $("#ok").textContent = `${f.name}: ${b.duration.toFixed(2)}s @ ${b.sampleRate}Hz`;
  $("#latInfo").textContent = `salida ${(audio.latency() * 1000).toFixed(1)}ms`;
}

// posicion de cancion del evento que acabo de oir (compensa latencia de salida)
function stampNow() {
  const c = audio.getCtx();
  return audio.posAt(c.currentTime - audio.latency() - (+$("#lat").value || 0) / 1000);
}

// ---------- ediciones ----------
const nextId = (pfx, list) => {
  let i = 1;
  while (list.some((x) => x.id === pfx + i)) i++;
  return pfx + i;
};

function addMark(tagId, t) {
  if (!state.tags.some((x) => x.id === tagId)) return null;
  push();
  const e = { t: snapOn ? S.snapTime(t, state.tempo, division) : t, tag: tagId };
  state.events.push(e);
  save();
  return e;
}

// cierra las marcas seleccionadas en t: pasan de instante a rango (voz, riser, pad)
function setEnd(t) {
  if (!sel.size) return;
  push();
  for (const e of sel) {
    const d = (snapOn ? S.snapTime(t, state.tempo, division) : t) - e.t;
    if (d > 0) e.dur = d; else delete e.dur;
  }
  save(); syncUI();
}

function tapAt(t) {
  if (taps.length === 0) push();
  taps.push(t);
  const f = S.fitTaps(taps);
  if (f) { state.tempo.bpm = f.bpm; state.tempo.offset = f.offset; save(); }
  syncUI();
  return f;
}

function dropBoundary(t, label) {
  push();
  const cur = state.sections.find((s) => t > s.start && t < s.end);
  if (cur) {
    const end = cur.end;
    cur.end = t;
    state.sections.push({ id: nextId("s", state.sections), label, start: t, end });
  } else {
    const nx = state.sections.filter((s) => s.start > t).sort((a, b) => a.start - b.start)[0];
    const end = nx ? nx.start : Math.max(t + 1, state.track.duration);
    state.sections.push({ id: nextId("s", state.sections), label, start: t, end });
  }
  save(); syncUI();
}

function delSelection() {
  if (sel.size) {
    push();
    state.events = state.events.filter((e) => !sel.has(e));
    sel.clear();
  } else if (selSection) {
    push();
    state.sections = state.sections.filter((s) => s !== selSection);
    selSection = null;
  } else return;
  save(); syncUI();
}

// ---------- vista ----------
function fitView() {
  const W2 = $("#cv").clientWidth || 800;
  view = { t0: 0, pps: W2 / Math.max(1, state.track.duration) };
}
function zoom(f, anchorX) {
  const cv = $("#cv"), x = anchorX ?? cv.clientWidth / 2, t = W.x2t(x, view);
  view.pps = Math.max(1, Math.min(4000, view.pps * f));
  view.t0 = t - x / view.pps;
  clampView();
}
function clampView() {
  const d = Math.max(1, state.track.duration);
  view.t0 = Math.max(-0.5, Math.min(view.t0, d));
}

// ---------- UI ----------
function syncUI() {
  $("#bpm").value = state.tempo.bpm.toFixed(2);
  $("#offset").value = state.tempo.offset.toFixed(4);
  $("#bpb").value = state.tempo.beatsPerBar;
  $("#name").textContent = state.track.name || "sin audio";
  $("#trimTxt").textContent = `trim ${W.fmt(state.track.trim.start)} - ${W.fmt(state.track.trim.end)}`;
  $("#selInfo").textContent = `${sel.size} sel / ${state.events.length} marcas`;
  $("#secInfo").textContent = selSection ? `${selSection.label} (${selSection.id})` : `${state.sections.length} secciones`;
  $("#tapInfo").textContent = `${taps.length} taps`;
  $("#chkSnap").textContent = `snap: ${snapOn ? "on" : "off"}`;
  $("#chkSnap").classList.toggle("on", snapOn);
  renderTags();
}

function renderTags() {
  const box = $("#tags");
  box.innerHTML = "";
  state.tags.forEach((t, i) => {
    const d = document.createElement("div");
    d.className = "tag";
    d.innerHTML = `<input class="k" type="text" maxlength="1" value="${t.key}" />
      <input type="text" value="${t.id}" /><input type="color" value="${t.color}" /><button>x</button>`;
    const [k, id, c, del] = d.children;
    k.onchange = () => { push(); t.key = k.value; save(); };
    id.onchange = () => { push(); const old = t.id; t.id = id.value; state.events.forEach((e) => { if (e.tag === old) e.tag = t.id; }); save(); };
    c.onchange = () => { push(); t.color = c.value; save(); };
    del.onclick = () => { push(); state.tags.splice(i, 1); save(); syncUI(); };
    box.appendChild(d);
  });
}

// ---------- canvas ----------
const cv = $("#cv"), g = cv.getContext("2d");
function resize() {
  const r = cv.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  cv.width = r.width * dpr; cv.height = r.height * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
new ResizeObserver(resize).observe(cv);

function frame() {
  const p = audio.pos(), tr = state.track.trim;
  if ($("#chkLoop").checked && audio.isPlaying() && p >= tr.end && tr.end > tr.start) audio.play(tr.start);
  if (audio.isPlaying()) {   // autoscroll
    const x = W.t2x(p, view), w = cv.clientWidth;
    if (x < 0 || x > w * 0.85) view.t0 = p - (w * 0.3) / view.pps;
  }
  $("#time").textContent = W.fmt(p);
  W.draw(g, cv.clientWidth, cv.clientHeight, { view, state, peaks, pos: p, sel, selSection, rect });
  requestAnimationFrame(frame);
}

// ---------- raton ----------
const hitMark = (x) => state.events.find((e) => Math.abs(W.t2x(e.t, view) - x) < 5);

cv.addEventListener("mousedown", (ev) => {
  const r = cv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
  const t = W.x2t(x, view), H = cv.clientHeight;
  if (ev.button === 1) { drag = { k: "pan", x, t0: view.t0 }; return; }
  if (y < W.RULER + W.SECT && y >= W.RULER) {              // banda de secciones
    let edge = null;
    for (const s of state.sections) {
      if (Math.abs(W.t2x(s.start, view) - x) < 4) edge = { s, side: "start" };
      else if (Math.abs(W.t2x(s.end, view) - x) < 4) edge = { s, side: "end" };
    }
    if (edge) { push(); drag = { k: "sec-edge", ...edge }; return; }
    const inside = state.sections.find((s) => t >= s.start && t < s.end);
    if (inside) { selSection = inside; sel.clear(); $("#secLabel").value = inside.label; syncUI(); return; }
    drag = { k: "sec-new", t };
    return;
  }
  if (y >= W.waveBot(H)) {                                  // carril de marcas
    const m = hitMark(x);
    if (m) {
      if (ev.shiftKey) sel.has(m) ? sel.delete(m) : sel.add(m);
      else if (!sel.has(m)) { sel.clear(); sel.add(m); }
      push();
      drag = { k: "move", t, moved: false, orig: [...sel].map((e) => [e, e.t]) };
    } else {
      if (!ev.shiftKey) sel.clear();
      drag = { k: "rect", x0: x, keep: new Set(sel) };
      rect = { x0: x, x1: x };
    }
    syncUI();
    return;
  }
  const tr = state.track.trim;                              // asas de trim sobre la onda
  if (y >= W.waveTop()) {
    for (const side of ["start", "end"]) {
      if (Math.abs(W.t2x(tr[side], view) - x) < 5) { push(); drag = { k: "trim", side }; return; }
    }
  }
  drag = { k: "seek" };                                      // regla u onda
  audio.seek(t);
});

addEventListener("mousemove", (ev) => {
  if (!drag) return;
  const r = cv.getBoundingClientRect(), x = ev.clientX - r.left, t = W.x2t(x, view);
  if (drag.k === "seek") audio.seek(t);
  else if (drag.k === "pan") view.t0 = drag.t0 - (x - drag.x) / view.pps, clampView();
  else if (drag.k === "sec-edge") {
    const s = drag.s;
    if (drag.side === "start") s.start = Math.min(t, s.end - 0.05);
    else s.end = Math.max(t, s.start + 0.05);
  } else if (drag.k === "trim") {
    const tr = state.track.trim;
    if (drag.side === "start") tr.start = Math.max(0, Math.min(t, tr.end - 0.05));
    else tr.end = Math.min(state.track.duration, Math.max(t, tr.start + 0.05));
    syncUI();
  } else if (drag.k === "sec-new") drag.t1 = t;
  else if (drag.k === "move") {
    drag.moved = true;
    const d = t - drag.t;
    for (const [e, t0] of drag.orig) e.t = Math.max(0, t0 + d);
  } else if (drag.k === "rect") {
    rect = { x0: drag.x0, x1: x };
    sel = new Set(drag.keep);
    const a = Math.min(rect.x0, rect.x1), b = Math.max(rect.x0, rect.x1);
    for (const e of state.events) { const ex = W.t2x(e.t, view); if (ex >= a && ex <= b) sel.add(e); }
    syncUI();
  }
});

addEventListener("mouseup", () => {
  if (!drag) return;
  if (drag.k === "sec-new" && drag.t1 != null && Math.abs(drag.t1 - drag.t) > 0.05) {
    push();
    const [a, b] = [drag.t, drag.t1].sort((x, y) => x - y);
    state.sections.push({ id: nextId("s", state.sections), label: $("#secLabel").value || "seccion", start: a, end: b });
  }
  if (drag.k === "move" && !drag.moved) undoStack.pop();     // fue solo un click
  if (["sec-edge", "sec-new", "move", "trim"].includes(drag.k)) save();
  drag = null; rect = null; syncUI();
});

cv.addEventListener("wheel", (ev) => {
  ev.preventDefault();
  if (ev.shiftKey) { view.t0 += ev.deltaY / view.pps; clampView(); }
  else zoom(Math.exp(-ev.deltaY * 0.002), ev.clientX - cv.getBoundingClientRect().left);
}, { passive: false });

// ---------- teclado ----------
addEventListener("keydown", (ev) => {
  const tag = ev.target.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  const k = ev.key.toLowerCase();
  if (ev.ctrlKey || ev.metaKey) {
    if (k === "z") { ev.preventDefault(); ev.shiftKey ? redo() : undo(); }
    return;
  }
  if (k === " ") { ev.preventDefault(); audio.isPlaying() ? audio.pause() : audio.play(); }
  else if (k === "t") tapAt(stampNow());
  else if (k >= "1" && k <= "9") { const t = state.tags.find((x) => x.key === k); if (t) addMark(t.id, stampNow()); syncUI(); }
  else if (k === "s") dropBoundary(audio.pos(), $("#secLabel").value || "seccion");
  else if (k === "q") { snapOn = !snapOn; syncUI(); }
  else if (k === "e") { setEnd(audio.pos()); }
  else if (k === "i") { push(); state.track.trim.start = audio.pos(); save(); syncUI(); }
  else if (k === "o") { push(); state.track.trim.end = audio.pos(); save(); syncUI(); }
  else if (k === "delete" || k === "backspace") { ev.preventDefault(); delSelection(); }
  else if (k === "+" || k === "=") zoom(1.4);
  else if (k === "-") zoom(1 / 1.4);
  else if (k === "home") audio.seek(0);
});

// ---------- controles ----------
$("#file").onchange = (e) => e.target.files[0] && loadFile(e.target.files[0]);
$("#btnPlay").onclick = () => (audio.isPlaying() ? audio.pause() : audio.play());
$("#zoomIn").onclick = () => zoom(1.4);
$("#zoomOut").onclick = () => zoom(1 / 1.4);
$("#btnFit").onclick = fitView;
$("#btnTap").onclick = () => tapAt(stampNow());
$("#btnTapReset").onclick = () => { taps = []; syncUI(); };
$("#btnIn").onclick = () => { push(); state.track.trim.start = audio.pos(); save(); syncUI(); };
$("#btnOut").onclick = () => { push(); state.track.trim.end = audio.pos(); save(); syncUI(); };
$("#chkSnap").onclick = () => { snapOn = !snapOn; syncUI(); };
$("#div").onchange = (e) => (division = +e.target.value);
$("#btnQuant").onclick = () => {
  if (!sel.size) return;
  push();
  for (const e of sel) e.t = S.snapTime(e.t, state.tempo, division);
  save(); syncUI();
};
$("#secLabel").onchange = (e) => { if (selSection) { push(); selSection.label = e.target.value; save(); syncUI(); } };
$("#btnSecDel").onclick =() => { if (selSection) { push(); state.sections = state.sections.filter((s) => s !== selSection); selSection = null; save(); syncUI(); } };
$("#btnTagAdd").onclick = () => {
  push();
  state.tags.push({ id: nextId("tag", state.tags), key: String(state.tags.length + 1), color: "#eab308" });
  save(); syncUI();
};
$("#bpm").onchange = (e) => { push(); state.tempo.bpm = Math.max(1, +e.target.value); save(); syncUI(); };
$("#offset").onchange = (e) => { push(); state.tempo.offset = +e.target.value; save(); syncUI(); };
$("#bpb").onchange = (e) => { push(); state.tempo.beatsPerBar = Math.max(1, +e.target.value | 0); save(); syncUI(); };
for (const b of document.querySelectorAll("[data-bpm]"))
  b.onclick = () => { push(); state.tempo.bpm = Math.max(1, state.tempo.bpm + +b.dataset.bpm); save(); syncUI(); };
for (const b of document.querySelectorAll("[data-off]"))
  b.onclick = () => { push(); state.tempo.offset += +b.dataset.off / 1000; save(); syncUI(); };
for (const b of document.querySelectorAll("[data-sec]"))
  b.onclick = () => { $("#secLabel").value = b.dataset.sec; dropBoundary(audio.pos(), b.dataset.sec); };

$("#btnExport").onclick = () => {
  const doc = S.build(state);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }));
  a.download = (state.track.name || "song").replace(/\.[^.]+$/, "") + ".schema.json";
  a.click();
  URL.revokeObjectURL(a.href);
};
$("#btnImportBtn").onclick = () => $("#fileImport").click();
$("#fileImport").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    setState(JSON.parse(await f.text()));
    fitView(); save();
    $("#warn").textContent = peaks ? "" : `recarga el audio "${state.track.name}"`;
  } catch (err) { $("#warn").textContent = "json invalido: " + err.message; }
};
$("#btnClear").onclick = () => {
  localStorage.removeItem(KEY);
  push();
  state.sections = []; state.events = []; taps = [];
  state.tempo = { bpm: 120, offset: 0, beatsPerBar: 4 };
  sel.clear(); selSection = null;
  syncUI();
};

// drag & drop de audio (o de un json)
addEventListener("dragover", (e) => e.preventDefault());
addEventListener("drop", async (e) => {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (!f) return;
  if (f.name.endsWith(".json")) { try { setState(JSON.parse(await f.text())); fitView(); save(); } catch (err) { $("#warn").textContent = "json invalido: " + err.message; } }
  else loadFile(f);
});

// ---------- arranque ----------
resize();
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    setState(JSON.parse(raw));
    if (state.track.name) $("#warn").textContent = `proyecto restaurado: recarga "${state.track.name}"`;
  }
} catch {}
fitView();
syncUI();
requestAnimationFrame(frame);

// handle de debug/test
window.__bm = {
  state, audio, S, W,
  get peaks() { return peaks; },
  get view() { return view; },
  get sel() { return sel; },
  get taps() { return taps; },
  tapAt, addMark, dropBoundary, delSelection, undo, redo, syncUI, fitView, setState,
  doc: () => S.build(state),
  setSnap: (on, div) => { snapOn = on; if (div) division = div; $("#div").value = String(division); syncUI(); },
  resetTaps: () => { taps = []; syncUI(); },
  selectAll: () => { sel = new Set(state.events); syncUI(); },
};
