// node test-music.js -> falla si el schema o el mapeo de nivel se rompen
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { validate, beatAt } from "./beatmapper/schema.js";
import {
  LEVELS, cues, zOf, leadOf, spawnAt, bgAt, layerAt, fxAt, flipAt, mix,
  grid, rowAt, timeOfRow, tileOf, rowOfTile, laneOfTile,  sectionAt, enterOf, enterDz,
  chaseAt, CHASE, markWin, flashIdx, GHOST_ROW, gridAt, hatAt, hypeAt, gateAt, HAT_K,
  hueAt, rotHue,
} from "./music.js";
import {
  KINDS, PLAYER_Z, PLAYER_D, PLAYER_H, SPAWN_Z, JUMP_V, hits, stepPlayer, SPEED_MULS,
  lanesX, LANE_X,
} from "./physics.js";
import { LEAD, CHAIN, chains, toScript, simulate, fmt } from "./record.js";
import { toSVG, parts, wave, drawReactor, radioMax, BOX, WAVE_N } from "./reactor.js";
import { bolt, forks, pyras, pyraFaces, arcDir, ARC_TILT, outrun } from "./fx.js";

// la grabacion de verdad con la que se genero el nivel (tecla Y, 30/07)
const rec0 = JSON.parse(readFileSync("./tools/rec-insomnia-drop.json", "utf8")).rec;

const doc = JSON.parse(readFileSync("./assets/insomnia.schema.json", "utf8"));
assert.deepEqual(validate(doc), [], "el schema no valida");

// la grilla tiene que caer sobre los eventos: beat declarado == beat calculado
for (const e of doc.events) {
  assert(Math.abs(beatAt(e.t, doc.tempo) - e.beat) < 1e-3, `beat mal en t=${e.t}`);
}

// el kick del drop es a negras: 4 por compas, sin huecos
const drop = doc.sections.find((s) => s.label === "drop");
const kicks = doc.events.filter((e) => e.tag === "kick" && e.t >= drop.start && e.t < drop.end);
const bar = (60 / doc.tempo.bpm) * doc.tempo.beatsPerBar;
assert.equal(kicks.length, Math.round((drop.end - drop.start) / bar) * 4, "faltan kicks en el drop");
for (let i = 1; i < kicks.length; i++) {
  assert(Math.abs(kicks[i].t - kicks[i - 1].t - 60 / doc.tempo.bpm) < 1e-3, `kick descuadrado en ${kicks[i].t}`);
}

// la voz "this is acid" es un rango, no un instante, y tiene que durar lo que dura
const voice = doc.events.filter((e) => e.tag === "voice");
assert.equal(voice.length, 1);
assert(Math.abs(voice[0].dur - 0.896) < 1e-3, `dur de la voz: ${voice[0].dur}`);

// el mapeo de nivel: sin obstaculos en el break, y todo dentro del corte
const c = cues(doc, LEVELS["insomnia-drop"]);
const len = doc.track.trim.end - doc.track.trim.start;
for (const x of c) assert(x.t >= -1e-6 && x.t <= len, `cue fuera del corte: ${x.t}`);
assert.equal(c.filter((x) => x.section === "break" && x.role === "obstacle").length, 0, "el break no lleva obstaculos");

const byRole = {};
for (const x of c) byRole[x.role] = (byRole[x.role] || 0) + 1;
const obst = c.filter((x) => x.role === "obstacle");
// dos obstaculos a la vez en carriles distintos son legales: el hueco se mide entre TIEMPOS
const ts = [...new Set(obst.map((x) => x.t))].sort((a, b) => a - b);
const gaps = ts.slice(1).map((x, i) => x - ts[i]);
console.log("cues por rol:", byRole);
console.log(`obstaculos: ${obst.length} en ${len.toFixed(1)}s = ${(obst.length / len).toFixed(2)}/s, hueco min ${Math.min(...gaps).toFixed(3)}s`);
assert(Math.min(...gaps) > 0.35, "obstaculos demasiado juntos para reaccionar");

// --- trayectoria: la caja tiene que APARECER ANTES para LLEGAR en el beat ---
const speed = LEVELS["insomnia-drop"].speed;
const lead = leadOf(speed);
for (const o of obst) {
  const d = KINDS[o.kind].d;
  // sale del spawn justo `lead` segundos antes
  assert(Math.abs(zOf(o, spawnAt(o, speed), speed) - (SPAWN_Z - d / 2)) < 1e-6, `spawn mal en #${o.n}`);
  // y pisa al jugador exactamente en su tiempo, no antes ni despues
  assert(hits(o.kind, zOf(o, o.t, speed), 0, 0), `#${o.n} no impacta en su beat`);
  const m = ((d + PLAYER_D) / 2 / speed) * 1.25;
  assert(!hits(o.kind, zOf(o, o.t - m, speed), 0, 0), `#${o.n} impacta antes de tiempo`);
  assert(!hits(o.kind, zOf(o, o.t + m, speed), 0, 0), `#${o.n} impacta despues de tiempo`);
}
console.log(`lead: ${lead.toFixed(3)}s = ${(lead / (60 / doc.tempo.bpm)).toFixed(2)} beats de viaje a v=${speed}`);

// --- el nivel se puede terminar ---
// No basta con "nunca los 3 carriles tapados": hay que poder ENCADENAR las salidas.
// BFS sobre los carriles vivos: solo `block` obliga a moverse (low se salta, high se
// pasa agachado), y se puede cambiar un carril por cada hueco de tiempo de reaccion.
const react = 60 / doc.tempo.bpm;   // una fila = un beat = lo minimo para reaccionar
let alive = new Set([0, 1, 2]);
for (let i = 0; i < ts.length; i++) {
  const here = obst.filter((o) => Math.abs(o.t - ts[i]) < 1e-4);
  const blocked = new Set(here.filter((o) => o.kind === "block").map((o) => o.lane));
  alive = new Set([...alive].filter((l) => !blocked.has(l)));
  assert(alive.size, `sin salida en t=${ts[i].toFixed(3)} (#${here[0].n})`);
  const moves = Math.floor((ts[i + 1] - ts[i]) / react + 1e-6) || 0;
  const next = new Set();
  for (const l of alive) for (let d = -moves; d <= moves; d++) if (l + d >= 0 && l + d < 3) next.add(l + d);
  alive = next;
}
console.log(`nivel resoluble: ${ts.length} tiempos con obstaculo, carriles vivos al final ${[...alive]}`);

// y el aire tiene que alcanzar para dos saltos seguidos en el mismo carril
const byLane = [0, 1, 2].map((l) => obst.filter((o) => o.lane === l).sort((a, b) => a.t - b.t));
for (const ln of byLane) for (let i = 1; i < ln.length; i++) {
  if (ln[i].kind !== "low" || ln[i - 1].kind !== "low") continue;
  assert(ln[i].t - ln[i - 1].t > 0.4542, `dos saltos pegados en el carril ${ln[i].lane}: #${ln[i].n}`);
}

// --- guion: se referencia por #n, y el #n no se mueve aunque borres cues ---
const lv = { ...LEVELS["insomnia-drop"], zones: [], script: [
  { at: 5, bg: "#ef4444", over: 2 },
  { from: 10, to: 20, role: "obstacle", kind: "block" },
  { at: 12, off: true },
] };
const c2 = cues(doc, lv);
assert.equal(c2.find((x) => x.n === 12), undefined, "la cue apagada sigue ahi");
assert.equal(c2.find((x) => x.n === 13).n, 13, "borrar una cue renumero las demas");
for (const x of c2) if (x.n >= 10 && x.n <= 20 && x.role === "obstacle") assert.equal(x.kind, "block");

// --- filas y tiles: numerar la pista para dictar donde no hay senal ---
const g = grid(doc);
assert(Math.abs(g.beat - 60 / doc.tempo.bpm) < 1e-9);
for (const n of [0, 1, 7, 78, 127]) {
  assert.equal(rowAt(timeOfRow(n, g), g), n, `fila ${n} no vuelve de su tiempo`);
  assert.equal(rowAt(timeOfRow(n, g) + g.beat * 0.99, g), n, `la fila ${n} no cubre su beat entero`);
  assert.equal(rowAt(timeOfRow(n, g) + g.beat, g), n + 1, `la fila ${n} se pasa al siguiente beat`);
}
assert.equal(tileOf(107, 2), 323);
assert.equal(rowOfTile(323), 107);
assert.equal(laneOfTile(323), 2);
const rows = Math.floor((len - g.off) / g.beat);
console.log(`filas: ${rows} (1 por beat de ${g.beat.toFixed(4)}s) = ${rows * 3} tiles en ${len.toFixed(1)}s`);
assert(g.beat > 0.35, "la fila es mas corta que la ventana de reaccion");

// un obstaculo dictado por tile pisa al jugador EXACTAMENTE en el tiempo de su fila
const lvT = { ...LEVELS["insomnia-drop"], zones: [], script: [
  { tile: [323, 324], kind: "low" },
  { row: 70, lane: 0, kind: "block" },   // fuera de la zona f78-f83, que es de un carril
  { from: 1, to: 999, role: "obstacle", kind: "high" },   // no debe tocar los tiles
] };
const cT = cues(doc, lvT);
const t323 = cT.find((x) => x.n === "t323");
assert.equal(t323.kind, "low", "la regla por #n piso un obstaculo de tile");
assert.equal(t323.lane, 2);
assert(Math.abs(t323.t - timeOfRow(107, g)) < 1e-9, "el tile no cae en el tiempo de su fila");
assert.equal(cT.find((x) => x.n === "t324").row, 108, "324 es la fila siguiente");
assert.equal(cT.find((x) => x.n === "t210").lane, 0, "{row:70, lane:0} tiene que ser el tile 210");
for (const o of cT.filter((x) => typeof x.n === "string")) {
  assert(hits(o.kind, zOf(o, o.t, speed), 0, 0), `${o.n} no impacta en el tiempo de su fila`);
  const m = ((KINDS[o.kind].d + PLAYER_D) / 2 / speed) * 1.25;
  assert(!hits(o.kind, zOf(o, o.t - m, speed), 0, 0), `${o.n} impacta antes`);
  assert(!hits(o.kind, zOf(o, o.t + m, speed), 0, 0), `${o.n} impacta despues`);
}
assert(cT.every((x, i, a) => !i || a[i - 1].t <= x.t), "la lista quedo desordenada por t");
assert.equal(cT.filter((x) => x.n === 5).length, 1, "los tiles renumeraron las cues");
// y al reves: dictar por fila/tile NO puede tocar las cues numeradas (no lleva at/from/to)
const cSolo = cues(doc, { ...LEVELS["insomnia-drop"], zones: [], script: [{ row: 70, lane: 0, kind: "block" }] });
const key = (l) => l.filter((x) => typeof x.n === "number" && x.role === "obstacle")
  .map((x) => `${x.n}${x.kind}${x.lane}`);
assert.deepEqual(
  key(cSolo), key(c),
  "la directiva por fila piso kind/lane de las cues"
);

// el fondo interpola: a mitad de los 2s va por la mitad del camino
const five = c2.find((x) => x.n === 5);
const base = 0x0b0d17;
assert.equal(bgAt(five.t - 0.01, c2, base), base, "el fondo cambio antes de la cue");
assert.equal(bgAt(five.t + 2, c2, base), 0xef4444, "el fondo no llego al color");
assert.equal(bgAt(five.t + 1, c2, base), mix(base, 0xef4444, 0.5), "la transicion no es lineal");
// --- el fx de la voz: encendido EXACTAMENTE en [t, t+dur), apagado fuera ---
const acid = c.find((x) => x.fx === "acid");
assert(acid && acid.dur, "no hay cue de fx acid");
assert.equal(fxAt(acid.t - 1e-6, c, "acid"), null, "el fx arranca antes de la voz");
assert.equal(fxAt(acid.t, c, "acid"), 0, "el fx no arranca en el borde de entrada");
assert(Math.abs(fxAt(acid.t + acid.dur / 2, c, "acid") - 0.5) < 1e-9, "el progreso no es lineal");
assert.equal(fxAt(acid.t + acid.dur, c, "acid"), null, "el fx sigue vivo en el borde de salida");
assert.equal(fxAt(acid.t + 5, c, "acid"), null, "el fx sigue vivo despues");
assert.equal(fxAt(acid.t, c, "otro"), null, "responde a un fx que no existe");
console.log(`fx acid: [${acid.t.toFixed(4)}, ${(acid.t + acid.dur).toFixed(4)}) = ${acid.dur.toFixed(3)}s en el ${acid.section}`);

// --- capas de fondo: el guion las apaga y las tinta como al bg ---
const lvL = { ...LEVELS["insomnia-drop"], zones: [], script: [
  { at: 5, layer: "eq", tint: "#ec4899", over: 2 },
  { at: 7, layer: "far", vis: false },   // una cue toca UNA capa: la segunda pisaria a la primera
] };
const cL = cues(doc, lvL);
const eq = LEVELS["insomnia-drop"].layers.map((l) => ({ ...l, color: parseInt(l.color.slice(1), 16) }));
const [stars, far, , bars] = eq;
const t5 = cL.find((x) => x.n === 5).t;
assert.equal(layerAt(t5 - 0.01, cL, bars).color, bars.color, "la capa se tinto antes de la cue");
assert.equal(layerAt(t5 + 1, cL, bars).color, mix(bars.color, 0xec4899, 0.5), "la capa no interpola");
assert.equal(layerAt(t5 + 2, cL, bars).color, 0xec4899, "la capa no llega al color");
const t7 = cL.find((x) => x.n === 7).t;
assert.equal(layerAt(t7 - 0.01, cL, far).vis, true, "la capa se apago antes de la cue");
assert.equal(layerAt(t7, cL, far).vis, false, "la capa no se apago");
assert.equal(layerAt(t5 + 9, cL, stars).color, stars.color, "una capa sin regla cambio sola");

// --- orbs y gravedad: roles nuevos, mapeables desde el nivel ---
const lvO = { ...LEVELS["insomnia-drop"], zones: [], script: [
  { row: 70, lane: 1, role: "orb" },     // orb en el tiempo de la fila 70
  { at: 9, role2: "orb" },               // y una senal reciclada como orb
  { row: 88, role: "flip" },
  { row: 104, role: "flip" },
] };
const cO = cues(doc, lvO);
const orb = cO.find((x) => x.n === "t211");
assert(orb, "el orb por fila no aparecio (fila 70 carril 1 = tile 211)");
assert.equal(orb.role, "orb");
assert.equal(orb.kind, "orb", "el orb tiene que traer su propio kind");
assert(Math.abs(orb.t - timeOfRow(70, g)) < 1e-9, "el orb no cae en el tiempo de su fila");
assert(hits("orb", zOf(orb, orb.t, speed), 0, 0), "el orb no llega al jugador en su beat");
assert(!hits("orb", zOf(orb, orb.t - 0.25, speed), 0, 0), "el orb se agarra antes de tiempo");
assert.equal(cO.find((x) => x.n === 9).kind, "orb", "role2: la cue reciclada no quedo orb");

// la gravedad es la paridad de las cues de flip <= t: funcion pura, rebobinar la deshace
const [f1, f2] = cO.filter((x) => x.role === "flip");
assert(f1 && f2, "faltan las cues de flip");
assert.equal(flipAt(0, cO).g, 1, "arranca de cabeza");
assert.equal(flipAt(f1.t - 1e-9, cO).g, 1, "se dio vuelta antes de la cue");
assert.equal(flipAt(f1.t, cO).g, -1, "no se dio vuelta en la cue");
assert.equal(flipAt(f1.t, cO).at, f1.t, "no marca cuando fue el flip (la camara no sabe girar)");
assert.equal(flipAt(f2.t - 1e-9, cO).g, -1, "volvio al piso solo");
assert.equal(flipAt(f2.t, cO).g, 1, "el segundo flip no vuelve al piso");
assert.equal(flipAt(len, cO).n, 2);
assert.equal(flipAt(0, c).g, 1);   // sin cues de flip, siempre al piso
console.log(`flip: ${f1.t.toFixed(3)}s -> techo, ${f2.t.toFixed(3)}s -> piso (${(f2.t - f1.t).toFixed(3)}s de cabeza)`);

// --- grabar gameplay (Y) y volcarlo como guion (U) ---
// El guion es el NEGATIVO de la corrida: se rellena todo menos el hueco por el que
// pasaste. Lo que importa: la misma grabacion lo esquiva entero, y no queda aire de
// sobra al lado tuyo.
{
  const seq = ["jump", "slide", "lane", "jump", "slide", "lane", "jump", "slide"];
  const rec = [];
  let lane = 1;
  seq.forEach((a, i) => {
    // 60ms tarde a proposito: un humano nunca cae en la fila exacta
    const to = a === "lane" ? (lane + 1) % 3 : lane;
    rec.push({ a, t: timeOfRow(20 + i * 4, g) - LEAD[a] + 0.06, lane, to });
    lane = to;
  });
  const gen = toScript(rec, g, speed, len);

  // GRABAR DESDE EL MEDIO no puede tocar lo de antes: `from` es la fila desde la que se
  // dicta, o sea desde donde apretaste Y. Lo anterior sigue en el replay (hace falta el
  // estado del jugador) pero no sale ni una directiva, asi que el volcado se PEGA al final
  // del guion en vez de reemplazarlo, y lo editado a mano no se puede perder por accidente.
  const desde = toScript(rec, g, speed, len, 1 / 240, 64);
  assert.equal(desde.from, 64);
  assert.equal(Math.min(...desde.script.map((d) => d.row)), 64, "dicto filas anteriores a `from`");
  assert.deepEqual(desde.script, gen.script.filter((d) => d.row >= 64),
    "dictar desde el medio cambio lo que dicta de ahi en adelante");
  console.log(`grabar desde el medio: f64 -> ${desde.script.length} directivas `
    + `(${gen.script.length} desde la f0), las anteriores intactas`);

  // el guion de verdad: pasa por LEVELS.script -> cues() y se replaya contra eso
  const cR = cues(doc, { ...LEVELS["insomnia-drop"], zones: [], script: gen.script })
    .filter((x) => typeof x.n === "string");
  assert.equal(cR.length, gen.script.length, "las directivas no dieron los obstaculos que decian");
  assert.deepEqual(simulate(rec, cR, speed), [], "la grabacion no esquiva su propio guion");

  // denso: en una corrida que se pasa casi todo el rato quieta en un carril, los otros
  // dos tienen que estar tapados. Si esto baja, el nivel volvio a quedar abierto.
  const at = (row, lane) => cR.find((x) => x.row === row && x.lane === lane);
  assert(gen.script.length / gen.cells > 0.6, `solo se relleno el ${(100 * gen.script.length / gen.cells).toFixed(0)}% de la pista`);
  assert.equal(at(22, 0).kind, "block", "el carril de al lado quedo abierto sin que pasaras por el");
  assert.equal(at(22, 2).kind, "block", "el carril de al lado quedo abierto sin que pasaras por el");
  assert.equal(at(22, 1), undefined, "pusieron un obstaculo justo donde estabas parado");

  // y en tu propio carril, solo el hueco por el que pasaste
  assert.equal(at(20, 1).kind, "low", "donde saltaste no quedo nada que saltar");
  assert.equal(at(24, 1).kind, "high", "donde te deslizaste no quedo nada que agachar");
  assert(fmt(gen.script).includes(`{ row: 20, lane: 1, kind: "low" },`), "el volcado no es pegable");

  // el negativo se aguanta la latencia sola: no hay que cuantizar la pulsacion, si el
  // salto no llega a pasar por encima del hueco simplemente no se pone hueco.
  const tarde = toScript(rec.map((a) => ({ ...a, t: a.t + 0.15 })), g, speed, len);
  assert.deepEqual(simulate(rec.map((a) => ({ ...a, t: a.t + 0.15 })),
    cues(doc, { ...LEVELS["insomnia-drop"], zones: [], script: tarde.script }).filter((x) => typeof x.n === "string"),
    speed), [], "150ms tarde y el guion ya no es esquivable por quien lo grabo");

  console.log(`grabacion: ${seq.length} acciones -> ${gen.script.length}/${gen.cells} celdas `
    + `(${(100 * gen.script.length / gen.cells).toFixed(0)}%), ${gen.solid} cajas enteras`);
}

// --- saltos encadenados -> jump orb ---
// Dos saltos con menos de CHAIN beats de hueco: el segundo sale casi sin tocar el suelo
// (el aire dura 0.4542s y el beat 0.4615s). Ahi va un orb de salto y NO va obstaculo.
{
  const t0 = timeOfRow(30, g);
  const rec = [
    { a: "jump", t: t0, lane: 1 },
    { a: "jump", t: t0 + g.beat, lane: 1 },            // encadenado: 1 beat
    { a: "jump", t: t0 + g.beat * 6, lane: 1 },        // suelto: 6 beats
  ];
  const orbs = chains(rec, g);
  assert.equal(orbs.length, 1, "no detecto el salto encadenado (o se comio el suelto)");
  assert.deepEqual(orbs[0], { row: 31, lane: 1, role: "orb", kind: "orbj" });
  const gen = toScript(rec, g, speed, len);
  assert(!gen.script.some((d) => d.row === 31 && d.lane === 1 && d.kind !== "orbj"),
    "el orb quedo tapado por un obstaculo en la misma celda");
  const cO2 = cues(doc, { ...LEVELS["insomnia-drop"], zones: [], script: gen.script });
  const orb = cO2.find((x) => x.n === "t94");
  assert.equal(orb.role, "orb", "la directiva del orb no llego como orb");
  assert.equal(orb.kind, "orbj", "el orb de salto llego como orb de dash");
  assert(KINDS.orbj.y0 < PLAYER_H && KINDS.orbj.y1 > 111.6,
    "el orb de salto no engancha ni de pie ni en el apice del salto");
  assert(fmt(gen.script).includes(`role: "orb", kind: "orbj"`), "el volcado del orb no es pegable");
  console.log(`jump orb: corte en ${CHAIN} beats (${(CHAIN * g.beat * 1000).toFixed(0)}ms), aire 454ms`);
}

// --- el nivel de verdad: se puede pasar, al piso y de cabeza ---
{
  const lv = LEVELS["insomnia-drop"];
  const all = cues(doc, lv);
  const obst = all.filter((c) => c.role === "obstacle");
  // El tramo 2D se saco del nivel. Si vuelve una zona, tiene que ser de UN carril (de perfil
  // la x del mundo no proyecta: dos carriles se dibujan uno encima del otro) y el solver de
  // abajo tiene que volver a pinear el carril dentro de ella.
  assert.deepEqual(lv.zones ?? [], [], "volvio una zona: revisa que sea de un carril y pinea el solver");
  // La grabacion arranco siendo el negativo exacto del nivel, o sea que lo esquivaba por
  // construccion. Ya no: el nivel se edita a mano fila por fila, y la gracia de esas ediciones
  // es justamente **sacar carriles libres para forzar la accion**. Asi que lo que se prueba no
  // es que la grabacion pase, es que el nivel SE PUEDA PASAR (`resolver`, abajo); de la
  // grabacion solo se reporta cuanto se despego, para saber cuanto se redisenio.
  const sobra = simulate(rec0, obst, speed);

  // --- el nivel entero se puede pasar ---
  // Busqueda en anchura por filas con la fisica de verdad. En cada fila se prueba cada carril
  // (el cambio es instantaneo: se choca por indice) y cada accion en una grilla de tiempos, se
  // simula el beat a 240Hz y se tira lo que choca. Los estados se deduplican por (carril, y,
  // vy, deslizando) redondeados, que es lo que hace que 127 filas no exploten.
  // Esto reemplaza al "la grabacion esquiva su propio nivel": ese asumia que el nivel era el
  // negativo de la corrida, y ya no lo es.
  const OFF = [0, 1, 2, 3, 4].map((i) => (i / 5 - 0.35) * g.beat);   // cuando se pulsa dentro del beat
  const clave = (s) => `${s.lane},${Math.round(s.y / 8)},${Math.round(s.vy / 80)},${s.sliding > 0 ? 1 : 0}`;
  const resolver = (gr) => {
    const paso2 = 1 / 240;
    let vivos = [{ lane: 1, y: 0, vy: 0, sliding: 0, dash: 0 }];
    for (let r = 0; r <= 127 && vivos.length; r++) {
      const ini = timeOfRow(r, g), fin = ini + g.beat;
      const cerca = obst.filter((c) => Math.abs(c.t - ini) < 2 * g.beat);
      const nuevos = new Map();
      for (const s of vivos) {
        for (const lane of [0, 1, 2]) {
          for (const acc of [null, ...OFF.flatMap((d) => [["jump", d], ["slide", d]])]) {
            let p = { ...s, lane }, muerto = false, hecho = !acc;
            for (let t = ini; t < fin; t += paso2) {
              if (!hecho && t >= ini + acc[1] + g.beat / 2) {
                hecho = true;
                if (acc[0] === "jump") { if (gr * p.y <= 0) { p.vy = gr * JUMP_V; p.sliding = 0; } }
                else p.sliding = 0.5;
              }
              p = stepPlayer(p, paso2, gr);
              for (const c of cerca) {
                if (c.lane !== p.lane) continue;
                if (hits(c.kind, zOf(c, t, speed), p.y, p.sliding, gr)) { muerto = true; break; }
              }
              if (muerto) break;
            }
            if (!muerto) nuevos.set(clave(p), p);
          }
        }
      }
      vivos = [...nuevos.values()];
      if (!vivos.length) return r;   // la fila donde se muere
    }
    return null;
  };
  for (const gr of [1, -1]) {
    const muere = resolver(gr);
    assert.equal(muere, null, `el nivel no se puede pasar${gr < 0 ? " de cabeza" : ""}: `
      + `en la f${muere} no queda ningun estado vivo (ningun carril + accion la esquiva)`);
  }
  console.log(`nivel pasable al piso y de cabeza (solver por filas) | la grabacion original ya `
    + `no lo esquiva: se come ${sobra.length} (${sobra.join(", ") || "-"}), o sea lo redisenado a mano`);
}

// --- los huecos no abren ninguna pared ---
// Un `gap` sale de vaciar el INTERIOR de una pared de 5+ cajas seguidas: deja de tapar la
// vista pero no se cruza, porque desde 3 huecos seguidos no hay salto que alcance (test.js).
// Si una zanja quedara de 1 o 2 filas, esa pared se volvio pasable y el nivel se ablando.
{
  const lv = LEVELS["insomnia-drop"];
  const at = new Map(lv.script.filter((d) => d.row != null && d.kind)
    .map((d) => [`${d.row},${d.lane}`, d.kind]));
  const runs = [];
  for (const lane of [0, 1, 2]) {
    let n = 0;
    for (let r = 0; r <= 128; r++) {
      if (at.get(`${r},${lane}`) === "gap") { n++; continue; }
      if (n) runs.push([lane, r - n, n]);
      n = 0;
    }
  }
  const cortas = runs.filter(([, , n]) => n < 3);
  assert.deepEqual(cortas, [], `zanjas de menos de 3 filas (esas paredes se pueden saltar): `
    + `${cortas.map(([l, r, n]) => `carril ${l} f${r} x${n}`).join(", ")}`);
  console.log(`huecos: ${runs.reduce((a, [, , n]) => a + n, 0)} en ${runs.length} zanjas de `
    + `${Math.min(...runs.map((x) => x[2]))}-${Math.max(...runs.map((x) => x[2]))} filas`);

  // El chase de los huecos: en cualquier instante hay UNO encendido cada 4 filas, y el
  // encendido se corre UNA fila cada medio beat. Si no se corriera de a una, la zanja
  // parpadearia en bloque en vez de leerse como una luz que corre.
  const beat = 60 / 130;
  for (const t of [0, 3.7, 41.2]) {
    const on = [0, 1, 2, 3].filter((r) => chaseAt(r, t, beat) === 1);
    assert.equal(on.length, 1, `en t=${t} hay ${on.length} huecos encendidos de cada 4`);
    const on2 = [0, 1, 2, 3].filter((r) => chaseAt(r, t + beat / 2, beat) === 1);
    assert.equal(on2[0], (on[0] + 3) % 4, `medio beat despues el encendido no se corrio una fila`);
    assert.equal(chaseAt(on[0], t + beat * 2, beat), 1, `el chase no vuelve al principio cada 4`);
  }
  console.log(`chase de huecos: 1 de cada ${CHASE.length}, se corre 1 fila cada `
    + `${(beat / 2 * 1000).toFixed(0)}ms, vuelve cada ${(beat * 2 * 1000).toFixed(0)}ms`);
}

// --- ventana de las formas: se prenden en una marca y se apagan en la siguiente ---
{
  const beat = g.beat;
  const marcas = c.filter((x) => x.role === "mark").map((x) => x.t);
  // en el drop las marcas vienen de a pares (una por compas + su respuesta un beat despues):
  // la ventana tiene que abrir DENTRO del par y estar cerrada entre par y par.
  const drop = marcas.filter((t) => t > 31 && t < 40);
  assert.ok(drop.length >= 6, `pocas marcas en el drop (${drop.length})`);
  for (let i = 0; i + 1 < drop.length; i++) {
    const medio = (drop[i] + drop[i + 1]) / 2, hueco = drop[i + 1] - drop[i];
    const abierto = markWin(medio, c, beat) > 0.9;
    assert.equal(abierto, hueco <= beat * 1.5,
      `en t=${medio.toFixed(2)} (hueco de ${(hueco / beat).toFixed(1)} beats) la ventana esta `
      + `${abierto ? "abierta" : "cerrada"}`);
  }
  assert.equal(markWin(drop[0] - 0.001, c, beat), 0, "la ventana no arranca en la marca");
  // cuanto tiempo del drop tienen formas: si fuera casi todo, no seria un destello
  const dt = 1 / 120, d0 = 29.6, d1 = 59;
  let on = 0, n = 0;
  for (let t = d0; t < d1; t += dt, n++) if (markWin(t, c, beat) > 0.5) on++;
  const pct = on / n;
  assert.ok(pct > 0.1 && pct < 0.45, `las formas estan encendidas el ${(pct * 100).toFixed(0)}% del drop`);
  console.log(`formas: ventana de marca a marca (<=1.5 beats), encendidas el `
    + `${(pct * 100).toFixed(0)}% del drop`);
}

// --- secciones: es lo que decide cuanta luz hay (rig, pin spots, color del suelo) ---
{
  const t0 = doc.track.trim.start;
  const secs = doc.sections.map((s) => ({ label: s.label, start: s.start - t0, end: s.end - t0 }));
  const largo = doc.track.trim.end - t0;
  assert.equal(secs[0].start, 0, "la primera seccion no arranca en 0");
  assert.ok(Math.abs(secs.at(-1).end - largo) < 0.01, "las secciones no llegan al final del corte");
  for (let i = 1; i < secs.length; i++) {
    assert.equal(secs[i].start, secs[i - 1].end, `hueco entre ${secs[i - 1].label} y ${secs[i].label}`);
  }
  // el rig se apaga en el break y se clava en el drop: si no hay drop, no hay show
  assert.ok(secs.some((s) => s.label.startsWith("drop")), "el nivel no tiene drop");
  // y el corte tiene que caer DENTRO de la ultima seccion, no despues: si sobra cancion sin
  // seccion, ese tramo se queda sin rave, sin glow y sin enter y se ve como un bug
  assert.equal(sectionAt(largo - 0.1, secs), secs.at(-1).label, "el corte se pasa de la ultima seccion");
  assert.equal(sectionAt(-1, secs), null, "sectionAt tiene que dar null fuera de la cancion");
  // `glow` dice con que late lo que se JUEGA (cajas, suelo, portones, formas) en cada
  // seccion: "bg" = el kick, "mark" = accent/voice. Si una seccion no esta, o apunta a un rol
  // sin cues ahi, ese tramo se queda sin latido y no se nota hasta jugarlo.
  const glow = LEVELS["insomnia-drop"].glow;
  const todas = cues(doc, LEVELS["insomnia-drop"]);
  for (const s of secs) {
    const role = glow[s.label];
    assert(role, `la seccion ${s.label} no tiene glow`);
    const n = todas.filter((c) => c.role === role && c.t >= s.start && c.t < s.end).length;
    assert(n > 0, `${s.label} late con "${role}" pero no hay ni una cue de ese rol en el tramo`);
  }
  // `enter` dice COMO entra el obstaculo en cada seccion. Es solo dibujo, pero tiene que
  // terminar lejos: si la animacion siguiera cerca del jugador, estaria deformando justo lo
  // que hay que leer. Se mide en unidades de pista, con la entrada durando un beat.
  const enter = LEVELS["insomnia-drop"].enter;
  const KINDS_IN = ["fade", "grow", "slam", "wide", "roll", "side"];
  for (const s of secs) {
    assert(enter[s.label], `la seccion ${s.label} no tiene enter`);
    assert(KINDS_IN.includes(enter[s.label]), `enter "${enter[s.label]}" no existe en drawBox`);
  }
  // SECTORES del suelo: son solo color, pero si dejan un agujero el piso vuelve al color de
  // la seccion en medio de la pista y se lee como un bug. Tienen que ser contiguos, arrancar
  // en la fila 0 y llegar hasta la ultima.
  const sect = LEVELS["insomnia-drop"].sectors;
  assert(sect.length > 0, "el nivel no tiene sectores de suelo");
  assert.equal(sect[0].from, 0, "los sectores no arrancan en la fila 0");
  for (let i = 1; i < sect.length; i++) {
    assert.equal(sect[i].from, sect[i - 1].to + 1,
      `hueco/solape entre sectores en la fila ${sect[i].from}`);
  }
  assert(sect[sect.length - 1].to >= rows, "los sectores no llegan a la ultima fila");
  for (const s of sect) assert(/^#[0-9a-f]{6}$/i.test(s.color), `color de sector invalido: ${s.color}`);

  // Las variantes del eq van por sector: si faltan nombres, los ultimos sectores caen al
  // modes[0] sin decir nada y el tramo se ve igual que el primero.
  const MODES = ["analyzer", "sweep", "center", "spectro", "color", "constelacion"];
  const eq = LEVELS["insomnia-drop"].layers.find((l) => l.kind === "bars");
  assert.equal(eq.modes.length, sect.length,
    `${eq.modes.length} variantes de eq para ${sect.length} sectores`);
  for (const m of eq.modes) assert(MODES.includes(m), `variante de eq "${m}" no existe en drawBars`);

  // EL BEAT DEL FANTASMA. Tres cosas tienen que caer juntas o el efecto no se ve:
  // la fila `GHOST_ROW` arranca cuando se levanta el apagon, termina cuando entra el drop, y
  // es la unica fila del nivel cuyo sector dibuja la `constelacion`.
  {
    const br = secs.find((s) => s.label === "break"), dr = secs.find((s) => s.label === "drop");
    const t0 = timeOfRow(GHOST_ROW, g), t1 = timeOfRow(GHOST_ROW + 1, g);
    assert(Math.abs(t0 - (br.end - g.beat)) < 1e-6, "el fantasma no arranca donde se levanta el apagon");
    assert(Math.abs(t1 - dr.start) < 1e-6, "el fantasma no termina donde arranca el drop");
    const conste = eq.modes.map((m, i) => (m === "constelacion" ? sect[i] : null)).filter(Boolean);
    assert.equal(conste.length, 1, "la constelacion tiene que ir en UN solo sector");
    assert(GHOST_ROW >= conste[0].from && GHOST_ROW <= conste[0].to,
      `la constelacion va en f${conste[0].from}-${conste[0].to} y el fantasma en la f${GHOST_ROW}`);
    console.log(`fantasma: f${GHOST_ROW} = ${t0.toFixed(3)}-${t1.toFixed(3)}s `
      + `(${(g.beat * 1000).toFixed(0)}ms entre apagon y drop), constelacion en el sector `
      + `f${conste[0].from}-${conste[0].to}`);

    // Y DESPUES, con las marcas: la misma ventana que las formas de los costados. Tiene que
    // arrancar en la primera marca del drop (#46, f67) y no encenderse ni una vez en el
    // buildup, donde las marcas van filtradas y estan lejos: ahi un blanco y negro por compas
    // seria un parpadeo permanente y no un golpe.
    const dt = 1 / 120;
    const on = (t) => markWin(t, c, g.beat) > 0.02;   // el mismo corte que `draw()`
    let vent = [], prev = false;
    for (let t = dr.start; t < largo; t += dt) { const v = on(t); if (v && !prev) vent.push(t); prev = v; }
    let bu = 0, nbu = 0;
    for (let t = 0; t < br.start; t += dt, nbu++) if (on(t)) bu++;
    assert.equal(bu, 0, `el fantasma se enciende ${(100 * bu / nbu).toFixed(1)}% del buildup`);
    const m46 = c.find((x) => x.n === 46);
    assert(m46 && Math.abs(vent[0] - m46.t) < 0.1, `el primer destello no cae en la #46 (${m46?.t})`);
    assert(vent.length >= 10, `solo ${vent.length} destellos en el drop`);
    let onD = 0, nD = 0;
    for (let t = dr.start; t < largo; t += dt, nD++) if (on(t)) onD++;
    console.log(`fantasma con marcas: ${vent.length} destellos, el 1o en la #46 (f${m46.row}), `
      + `${(100 * onD / nD).toFixed(0)}% del drop, 0% del buildup`);

    // La FIGURA de la constelacion cambia con cada destello. Dos cosas: la f63 tiene que dar
    // 0 (el rombo de siempre, que es lo que se aprobo) y la figura no puede cambiar A MITAD
    // de un destello, o la constelacion se transformaria en pantalla en vez de aparecer ya
    // siendo otra cosa. NFIGS es el largo de `FIGS` en AIRunnerGame.js.
    const NFIGS = 5;
    assert.equal(flashIdx(t0 + g.beat / 2, c, g.beat), 0, "la f63 no dibuja el rombo");
    const figs = vent.map((v) => flashIdx(v + 0.01, c, g.beat));
    for (let i = 0; i < vent.length; i++) {
      const fin = vent[i] + g.beat - 0.01;
      assert.equal(flashIdx(fin, c, g.beat), figs[i], `la figura cambia dentro del destello ${i}`);
    }
    assert.deepEqual(figs, figs.map((_, i) => i + 1), "los destellos no van en orden");
    console.log(`figuras: f63 rombo, y ${vent.length} destellos que ciclan `
      + `${figs.slice(0, 6).map((f) => f % NFIGS).join(" ")}... sobre ${NFIGS} figuras`);
  }
  console.log(`eq: ${new Set(eq.modes).size}/${MODES.length} variantes en ${sect.length} sectores `
    + `(${eq.modes.join(" ")})`);
  console.log(`sectores de suelo: ${sect.length} tramos de ${sect[0].to - sect[0].from + 1}-`
    + `${Math.max(...sect.map((x) => x.to - x.from + 1))} filas, cubren 0-${sect[sect.length - 1].to}`);

  // La entrada tiene que cerrar a TODAS las velocidades de `V` (feel), no solo a la del
  // nivel: a x2 el viaje entero dura 5.08 beats, o sea menos que los 7 de la entrada, y sin
  // topar la caja llegaba encima tuyo a medio caer (medido: e=0.73, flotando 185 sobre el
  // piso). `enterDz` es el tope.
  const beatDur = bar / doc.tempo.beatsPerBar;
  const dz = enterDz(beatDur, speed);
  const zFin = SPAWN_Z - dz;
  for (const mul of SPEED_MULS) {
    const v = speed * mul, d = enterDz(beatDur, v), fin = SPAWN_Z - d;
    assert.equal(enterOf(SPAWN_Z, d), 0, `a x${mul} la entrada no arranca en 0 en el spawn`);
    assert(1 - enterOf(fin, d) < 1e-9, `a x${mul} la entrada no termina en su propia distancia`);
    assert.equal(enterOf(PLAYER_Z, d), 1, `a x${mul} la entrada no esta hecha encima del jugador`);
    // Tiene que TERMINAR lo bastante lejos para no deformar la caja que estas leyendo:
    // >= 2 beats de viaje, el doble de la ventana de reaccion.
    const s = (fin - PLAYER_Z) / v;
    assert(s > 2 * beatDur, `a x${mul} la entrada termina a ${s.toFixed(2)}s del impacto: `
      + `deforma la caja que hay que leer`);
  }
  // Y a la velocidad del nivel, ademas, lo bastante cerca para que se VEA: la niebla hunde
  // todo lo que pasa de 1600. (A x0.5 y x0.25 no se cumple: ahi la entrada es proporcional a
  // la velocidad y termina lejos. Se ve poco, pero no rompe nada, ver NOTAS.)
  assert(zFin - PLAYER_Z < 1600, "la entrada termina hundida en la niebla: no se ve (era el reporte)");
  console.log("secciones: " + secs.map((s) => `${s.label} ${s.start.toFixed(1)}-${s.end.toFixed(1)}s`
    + ` late con ${glow[s.label]}, entra ${enter[s.label]}`).join(" | "));
  console.log(`entrada: termina en z=${zFin.toFixed(0)}, a ${(zFin - PLAYER_Z).toFixed(0)} del jugador`
    + ` (niebla f=${(((zFin - PLAYER_Z) / 1600) ** 2).toFixed(2)}, `
    + `${((zFin - PLAYER_Z) / speed / beatDur).toFixed(2)} beats antes del impacto), y con V: `
    + SPEED_MULS.map((m) => `x${m} a ${(SPAWN_Z - enterDz(beatDur, speed * m) - PLAYER_Z).toFixed(0)}`
      + ` (${((SPAWN_Z - enterDz(beatDur, speed * m) - PLAYER_Z) / (speed * m) / beatDur).toFixed(1)}b)`).join(" "));
}

// --- CARRILES: el paso de 170 es lo que ata los dos niveles ------------------------------
// `lanesX(3)` TIENE que dar el [-170, 0, 170] de siempre: el nivel 1 sale de ahi desde que
// existe `lanesX`, asi que si alguien toca el paso para que entren 4 carriles en el ancho
// viejo, el nivel 1 se mueve y se entera el test, no el ojo.
{
  assert.deepEqual(lanesX(3), LANE_X, "lanesX(3) ya no da los carriles de siempre");
  assert.deepEqual(lanesX(3), [-170, 0, 170], "el paso de carril dejo de ser 170");
  assert.deepEqual(lanesX(4), [-255, -85, 85, 255], "lanesX(4) no ensancha la pista");
  // un `high` mide w=70, o sea 140 de ancho: el paso no puede bajar de ahi o dos carriles
  // vecinos se solapan y el de al lado deja de ser una salida.
  const paso = lanesX(4)[1] - lanesX(4)[0];
  assert(paso >= KINDS.high.w * 2, `paso ${paso} menor que el ancho de un high (${KINDS.high.w * 2})`);
  console.log(`carriles: paso ${paso}, 3 -> [${lanesX(3)}] (pista ${lanesX(3).at(-1) * 2 + 170}), `
    + `4 -> [${lanesX(4)}] (pista ${lanesX(4).at(-1) * 2 + 170})`);
}

// --- nivel 2: orbit-motion ---------------------------------------------------------------
// Arranca MINIMO (4 carriles, fondo vacio, sin un obstaculo). Lo unico que se afirma es que
// la grilla, las secciones, los sectores y el decor cierran. El dia que tenga guion, aca
// abajo va el mismo solver por filas que el nivel 1.
{
  const doc2 = JSON.parse(readFileSync("./assets/orbit.schema.json", "utf8"));
  assert.deepEqual(validate(doc2), [], "el schema de orbit-motion no valida");
  const lv2 = LEVELS["orbit-motion"];
  const g2 = grid(doc2);
  // `hypeAt`/`gateAt` piden la grilla + el nivel (o sea lo que devuelve `loadLevel`), no el
  // objeto crudo de `LEVELS`: leen la fila con `rowAt`, y eso necesita `off` y `beat`.
  const L2 = { ...g2, ...lv2 }, L1 = { ...g, ...LEVELS["insomnia-drop"] };
  const t0 = doc2.track.trim.start, len2 = doc2.track.trim.end - t0;

  // La f165 arrancaria JUSTO en el corte (el resto contra la ultima fila entera es 0), o sea
  // que la ultima jugable es la 164. Por eso no vale el `Math.floor((len - off) / beat)` del
  // nivel 1, que aca da 165: se mide con `rowAt`, que es lo que usa el juego.
  const ultima = rowAt(len2 - 1e-9, g2);
  assert.equal(ultima, 164, `el corte da ${ultima + 1} filas, no 165`);
  assert(Math.abs(g2.beat - 60 / 137) < 1e-9, "la grilla no es de 137bpm");
  assert(Math.abs(g2.off + 165 * g2.beat - len2) < 1e-6, "el corte no cae en una fila entera");

  assert.equal(lv2.lanes, 4, "orbit-motion es de 4 carriles");
  assert.deepEqual(lanesX(lv2.lanes).length, 4, "laneX no trae 4 posiciones");

  // secciones: contiguas, de 0 al final del corte (mismo criterio que el nivel 1)
  const secs2 = doc2.sections.map((s) => ({ label: s.label, start: s.start - t0, end: s.end - t0 }));
  assert.equal(secs2[0].start, 0, "la primera seccion no arranca en 0");
  assert(Math.abs(secs2.at(-1).end - len2) < 0.01, "las secciones no llegan al final del corte");
  for (let i = 1; i < secs2.length; i++) {
    assert.equal(secs2[i].start, secs2[i - 1].end,
      `hueco entre ${secs2[i - 1].label} y ${secs2[i].label}`);
  }
  // y ninguna anidada dentro de otra: el schema crudo traia una "intro" de 72.7ms metida
  // dentro del buildup, y `sectionAt` devuelve la PRIMERA que matchea, o sea que 72ms del
  // buildup se leian como una seccion que no existe en `glow` ni en `enter`.
  for (const s of secs2) assert(s.end - s.start > g2.beat, `${s.label} dura menos de un beat`);
  for (const s of secs2) assert(lv2.glow[s.label] && lv2.enter[s.label],
    `la seccion ${s.label} no tiene glow/enter`);

  // sectores del suelo: contiguos, de la f0 a la ultima. Un agujero devuelve el suelo al
  // color de la seccion en medio de la pista y se lee como un bug.
  assert.equal(lv2.sectors[0].from, 0, "los sectores no arrancan en la fila 0");
  for (let i = 1; i < lv2.sectors.length; i++) {
    assert.equal(lv2.sectors[i].from, lv2.sectors[i - 1].to + 1,
      `hueco/solape entre sectores en la fila ${lv2.sectors[i].from}`);
  }
  assert.equal(lv2.sectors.at(-1).to, ultima, "los sectores no llegan justo a la ultima fila");

  // DECOR: la lista blanca no se escribe a mano, se saca del renderer (`this.dec("...")` en
  // `draw()`), asi que un nivel no puede pedir una capa que nadie dibuja ni aunque se agregue
  // una capa nueva y se olvide actualizar el test.
  const src = readFileSync("./AIRunnerGame.js", "utf8");
  const DECOR = [...new Set([...src.matchAll(/\bdec\("([a-z]+)"\)/g)].map((m) => m[1]))];
  assert(DECOR.length >= 8, `el renderer solo declara ${DECOR.length} capas de decorado`);
  for (const d of lv2.decor) assert(DECOR.includes(d), `decor "${d}" no existe en el renderer`);
  for (const d of LEVELS["insomnia-drop"].decor) {
    assert(DECOR.includes(d), `el nivel 1 pide un decor "${d}" que el renderer no dibuja`);
  }
  assert.deepEqual(lv2.layers ?? [], [], "orbit-motion no lleva capas de `layers`");
  assert.deepEqual(lv2.zones ?? [], [], "orbit-motion no tiene zonas");
  // el nivel 1 NO puede heredar ninguna de las capas nuevas: cada una es del 2 y varias de
  // ellas (el gate, el blanco del contratiempo) taparian pantalla entera si se colaran.
  for (const d of ["rings", "hat", "gate", "arcs", "burst", "lights"]) {
    assert(!LEVELS["insomnia-drop"].decor.includes(d), `el nivel 1 heredo la capa nueva "${d}"`);
  }
  // EL RIG CRUZANDO EL MUNDO ENTERO (`rigOver`) es un dial del nivel 2 y su respaldo es FALSE,
  // que es el orden de dibujo de siempre: el rig antes del suelo, o sea encerrado en el cielo.
  // Si el nivel 1 lo declarara, sus vigas pasarian por encima de la pista y del muneco.
  assert(!LEVELS["insomnia-drop"].rigOver, "el nivel 1 declara `rigOver`");
  assert.equal(!!L2.rigOver, true, "el nivel 2 perdio `rigOver`");
  assert.equal(!!L1.rigOver, false, "el nivel 1 gano `rigOver`");

  // LA CRECIENTE (`hype` -> `hypeAt`). Los tramos van por FILA y tienen que ser contiguos en
  // el sentido de que no se pisen y vayan en orden: si no, el `for` de `hypeAt` (que se queda
  // con el ultimo tramo cuyo `from` ya paso) leeria uno que no es.
  {
    let prev = -1;
    for (const hh of lv2.hype) {
      assert(hh.from > prev, `hype: el tramo f${hh.from} pisa al anterior`);
      assert(hh.to >= hh.from, `hype: tramo f${hh.from} vacio`);
      prev = hh.to;
    }
    const H = (row) => hypeAt(timeOfRow(row, g2) + g2.beat / 2, L2);
    assert.equal(H(0).toFixed(2), "0.00", "la creciente no arranca en 0");
    assert(H(30) > 0.4 && H(30) < 0.6, `a media creciente da ${H(30)}`);
    assert(H(61) > 0.98, `el buildup no llega arriba: ${H(61)}`);
    // el break CAE (ahi habla el cantante y vuelan las letras) y el drop2 vuelve de golpe
    assert(H(67) < 0.2, `el break no se cae: ${H(67)}`);
    assert(H(68) > 0.98, `el drop2 no entra arriba: ${H(68)}`);
    // y los tramos van pegados a las SECCIONES medidas, no a filas a ojo: un tramo corrido una
    // fila deja la creciente al 0 en el primer beat del drop, que es el que mas se mira.
    for (const hh of lv2.hype) {
      const sr = (r) => sectionAt(timeOfRow(r, g2) + g2.beat / 2, secs2);
      assert.equal(sr(hh.from), sr(hh.to), `el tramo de hype f${hh.from}-f${hh.to} cruza secciones`);
    }
    assert(H(164) < 0.3, `el outro no se apaga: ${H(164)}`);
    // el nivel 1 no la declara: vale 0 en todo el nivel, o sea que no puede mover un pixel
    for (let r = 0; r < 128; r += 8) assert.equal(hypeAt(timeOfRow(r, g), L1), 0);
  }

  // EL GATE (`fx` -> `gateAt`). Fuera de sus tramos tiene que devolver 1 EXACTO: cualquier
  // otra cosa es un velo negro permanente sobre el nivel entero.
  {
    for (const f of lv2.fx) {
      assert(["gate", "dark", "reactor", "beam", "ghost", "snap", "spin", "jolt", "neg", "grid"]
        .includes(f.kind), `tramo fx de tipo desconocido: ${f.kind}`);
      assert(f.to >= f.from, `tramo fx f${f.from} vacio`);
    }
    // LA PANTALLA POR CUATRO (`grid`). Dos cosas, y las dos son la afirmacion de una regla: el
    // NIVEL 1 no la puede declarar (es lo que hace que ahi `setGrid` salga por la primera linea y
    // no se cree ni una camara, o sea el 0 px), y el tramo no puede caer dentro del apagon ni
    // cruzar de seccion: cuatro cuadrantes en negro no son cuatro cuadrantes, y una grilla que
    // arranca en un lado de la cancion y termina en otro no es un efecto, es un tramo mal puesto.
    assert.equal((L1.fx ?? []).filter((f) => f.kind === "grid").length, 0,
      "el nivel 1 declara la grilla 2x2: ahi no se puede crear ni una camara de mas");
    for (const f of lv2.fx.filter((x) => x.kind === "grid")) {
      assert(!lv2.fx.some((d) => d.kind === "dark" && d.from <= f.to && d.to >= f.from),
        `la grilla f${f.from}-f${f.to} cae dentro del apagon`);
      const s0 = sectionAt(timeOfRow(f.from, g2) + g2.beat / 2, secs2);
      const s1 = sectionAt(timeOfRow(f.to, g2) + g2.beat / 2, secs2);
      assert.equal(s0, s1, `la grilla f${f.from}-f${f.to} cruza de ${s0} a ${s1}`);
    }
    // EL TIRON DE LAS HELICES (`spin`): son DOS y tienen que durar LO MISMO y girar para
    // lados CONTRARIOS. Lo pidio asi ("to one side... and onto the other it must be the
    // contrary side, the same span of time"), o sea que es la afirmacion del pedido y no una
    // opinion: si un dia se mueve una de las dos filas, el test lo dice.
    {
      const sp = lv2.fx.filter((x) => x.kind === "spin");
      assert.equal(sp.length, 2, `tramos de spin: ${sp.length}`);
      assert.equal(sp[0].to - sp[0].from, sp[1].to - sp[1].from,
        `los dos spin no duran lo mismo: ${sp.map((x) => x.to - x.from)}`);
      assert.equal(Math.sign(sp[0].dir ?? 1) * Math.sign(sp[1].dir ?? 1), -1,
        "los dos spin giran para el mismo lado");
    }
    // EL FOGONAZO DEL SNARE (`snap`): una FILA sola y DENTRO del apagon. Es el unico sitio del
    // nivel donde se ve el reactor antes del drop, y se ve porque se dibuja SOBRE el negro: si
    // el tramo se saliera del `dark` el fogonazo caeria sobre el nivel encendido y no seria un
    // fogonazo, seria un reactor de mas. Y si durara mas de una fila dejaria de ser un flash.
    for (const f of lv2.fx.filter((x) => x.kind === "snap")) {
      assert.equal(f.from, f.to, `el fogonazo f${f.from}-f${f.to} dura mas de una fila`);
      const d = lv2.fx.find((x) => x.kind === "dark" && x.from <= f.from && x.to >= f.to);
      assert(d, `el fogonazo de la f${f.from} cae fuera del apagon`);
      // y el apagon tiene que seguir DESPUES del fogonazo: si el fogonazo fuera la ultima fila
      // del apagon, se veria el reactor y al beat siguiente ya estaria el drop, o sea sin
      // el negro en medio que es lo que hace que se lea como "flashea y sigue".
      assert(d.to > f.to, `el fogonazo de la f${f.from} es la ultima fila del apagon`);
    }
    // EL NEGATIVO (`neg`). Es el MISMO motor que el gate (`gateAt` con otro `kind`), asi que lo
    // unico propio que hay que afirmar es donde puede vivir y a que ritmo pega:
    //  - NO puede pisar un `gate`, un `dark` ni un `ghost`. Los tres son negro o blanco a pantalla
    //    completa dibujados por la MISMA puerta del Graphics, o sea que el negativo les daria
    //    vuelta el color: el apagon del break saldria BLANCO entero.
    //  - y no puede pasar de 3 destellos por segundo, que es el umbral de WCAG 2.3.1.
    // Lo declaran LOS DOS niveles, asi que el bloque va parametrizado: un assert que solo mira
    // el nivel 2 deja al 1 sin red justo donde el efecto es nuevo.
    const NEG = [["insomnia-drop", L1, g, L1.fx ?? []], ["orbit-motion", L2, g2, lv2.fx]];
    let negN = 0;
    for (const [nom, LV, gg, fxs] of NEG) for (const f of fxs.filter((x) => x.kind === "neg")) {
      negN++;
      for (const o of fxs) {
        if (!["gate", "dark", "ghost"].includes(o.kind)) continue;
        assert(f.to < o.from || f.from > o.to,
          `${nom}: el negativo f${f.from}-f${f.to} pisa un ${o.kind} (f${o.from}-f${o.to})`);
      }
      const hz = (f.div ?? 4) / gg.beat;
      assert(hz <= 3, `${nom}: el negativo destella a ${hz.toFixed(2)}Hz (el limite son 3/s)`);
      // tiene que dar vuelta la imagen y devolverla dentro de su propio tramo
      for (const r of [f.from, f.to]) {
        const t0 = timeOfRow(r, gg);
        const v = Array.from({ length: 40 }, (_, i) => gateAt(t0 + (i / 40) * gg.beat, LV, "neg"));
        assert(v.some((x) => x === 1), `${nom}: el negativo de la f${r} no vuelve`);
        assert(v.some((x) => x < 1), `${nom}: el negativo de la f${r} no invierte`);
      }
    }
    // y FUERA de sus tramos devuelve 1 EXACTO en los dos niveles: cualquier otra cosa es la
    // pantalla invertida a destiempo. Se barre fila por fila y beat entero, no de a saltos.
    for (const [nom, LV, gg, fxs] of NEG) {
      const filas = nom === "orbit-motion" ? 165 : 220;
      for (let r = 0; r < filas; r++) {
        if (fxs.some((f) => f.kind === "neg" && r >= f.from && r <= f.to)) continue;
        const t0 = timeOfRow(r, gg);
        for (let i = 0; i < 8; i++) {
          assert.equal(gateAt(t0 + (i / 8) * gg.beat, LV, "neg"), 1,
            `${nom}: la f${r} esta fuera de todo tramo de negativo y la imagen sale invertida`);
        }
      }
    }
    // EL NEGATIVO DEL NIVEL 1. Tres cosas propias suyas, y las tres son por donde se colaria:
    //  - lo unico que declara en `fx` es el negativo: cualquier otro tramo (un `dark`, un
    //    `grid`, un `reactor`) le cambiaria el nivel entero, que esta medido a 0 px.
    //  - no puede tocar la f56-f63: ahi ya estan los blinders (f56-f59), el apagon (f60-f62) y
    //    el beat del fantasma (f63 = GHOST_ROW), o sea tres efectos a pantalla completa.
    //  - y no puede caer donde el fantasma se enciende con las MARCAS (`markWin`, el mismo
    //    corte de 0.02 que usa `draw()`): el negativo se aplica ULTIMO y envuelve al fantasma,
    //    o sea que serian dos filtros encima. Medido: 0.0% de los dos tramos.
    {
      const negs = (L1.fx ?? []).filter((f) => f.kind === "neg");
      assert.equal(negs.length, (L1.fx ?? []).length,
        "el nivel 1 declara un tramo de `fx` que no es el negativo");
      assert(negs.length > 0, "el nivel 1 se quedo sin negativo");
      for (const f of negs) {
        assert(f.to < 56 || f.from > 63,
          `el negativo f${f.from}-f${f.to} pisa los blinders / el apagon / la f63`);
        let mx = 0;
        for (let t = timeOfRow(f.from, g); t < timeOfRow(f.to + 1, g); t += 0.01) {
          mx = Math.max(mx, markWin(t, c, g.beat));
        }
        assert(mx <= 0.02, `el negativo f${f.from}-f${f.to} cae sobre el fantasma (markWin ${mx})`);
      }
      console.log(`negativo: ${negN} tramos (nivel 1 `
        + `${negs.map((f) => `f${f.from}-f${f.to} a ${((f.div ?? 4) / g.beat).toFixed(2)}Hz`).join(", ")}`
        + `; el limite de la WCAG son 3/s)`);
    }
    for (const r of [0, 9, 20, 31, 100, 164]) {
      assert.equal(gateAt(timeOfRow(r, g2) + g2.beat / 2, L2), 1,
        `la f${r} esta fuera de todo tramo de gate y el gate no esta abierto`);
    }
    // y DENTRO tiene que cerrar de verdad: se barre el beat entero y se mira que pase por los
    // dos estados. Un gate que no cierra no es un gate, es codigo muerto.
    const gates = lv2.fx.filter((f) => f.kind === "gate");
    for (const r of gates.flatMap((f) => [f.from, f.to])) {
      const t0 = timeOfRow(r, g2);
      const v = Array.from({ length: 40 }, (_, i) => gateAt(t0 + (i / 40) * g2.beat, L2));
      assert(v.some((x) => x === 1), `el gate de la f${r} nunca abre`);
      assert(v.some((x) => x < 1), `el gate de la f${r} nunca cierra`);
    }
    // EL CRESCENDO DEL TAJO (`ramp`): el ultimo tramo se come cada vez mas de cada
    // semicorchea, o sea que el gate MISMO es la rampa. Se mide la fraccion cerrada barriendo
    // el beat, y tiene que CRECER fila a fila. Sin esto un `ramp` mal puesto pasa desapercibido.
    const cerrado = (r) => {
      const t0 = timeOfRow(r, g2), N = 400;
      let n = 0;
      for (let i = 0; i < N; i++) if (gateAt(t0 + (i / N) * g2.beat, L2) < 1) n++;
      return n / N;
    };
    const cre = gates.at(-1);
    const c0 = cerrado(cre.from), c1 = cerrado(cre.to);
    assert(c1 > c0 * 3, `el gate en creciente no crece (f${cre.from} ${c0} -> f${cre.to} ${c1})`);
    assert(Math.abs(c0 - (cre.cut ?? 0.18)) < 0.02, `arranca en ${c0} y no en su \`cut\` ${cre.cut}`);
    assert(Math.abs(c1 - cre.ramp) < 0.02, `termina en ${c1} y no en su \`ramp\` ${cre.ramp}`);

    // LOS TRAMOS QUE NO SON GATE. Cada uno tiene que caer donde dice el diseno, porque el
    // renderer no mira secciones sino estas filas: el apagon dentro del break (es donde habla
    // el cantante), el reactor arrancando EN el drop (aparece con el, que es lo que lo hace un
    // jefe) y el haz cubriendo el reactor entero sin dejar un hueco.
    const uno = (k) => lv2.fx.filter((f) => f.kind === k);
    const secRow = (r) => sectionAt(timeOfRow(r, g2) + g2.beat / 2, secs2);
    const [dark] = uno("dark"), [reac] = uno("reactor"), [gh] = uno("ghost");
    assert.equal(secRow(dark.from), "break", "el apagon no arranca en el break");
    assert.equal(secRow(dark.to), "break", "el apagon se pasa del break");
    assert.equal(secRow(reac.from), lv2.dropSec, "el reactor no aparece con el drop");
    assert.equal(secRow(reac.from - 1), "break", "el reactor ya estaba antes del drop");
    assert.equal(reac.to, ultima, "el reactor no llega al final del nivel");
    const beams = uno("beam").sort((a, b) => a.from - b.from);
    assert.equal(beams[0].from, reac.from, "el haz no arranca con el reactor");
    assert.equal(beams.at(-1).to, reac.to, "el haz no llega hasta el final del reactor");
    for (let i = 1; i < beams.length; i++) {
      assert.equal(beams[i].from, beams[i - 1].to + 1, "los tramos de haz dejan un hueco");
      assert.notEqual(beams[i].mode, beams[i - 1].mode, "dos tramos de haz seguidos con el mismo modo");
    }
    // EL HAZ DISPARA Y NO ESTA PUESTO. La envolvente dura `BEAM_T` SEGUNDOS, o sea que el duty
    // deja de ser el 82.7% de cualquier division: se lee del renderer para que subir `BEAM_T` o
    // acortar el periodo lo diga aca y no una captura. Medido hoy: 16.5% y 33.0%.
    {
      const rsrc = readFileSync("./AIRunnerGame.js", "utf8");
      const bt = Number(rsrc.match(/BEAM_T = ([\d.]+)/)[1]);
      const vis = 1 - Math.sqrt(0.03);            // el corte de alpha de `drawBeam`
      for (const b of beams) {
        const duty = (vis * bt) / (g2.beat * (b.mode ? 2 : 4));
        assert(duty < 0.4, `el haz esta puesto el ${(duty * 100).toFixed(0)}% del tramo mode=${b.mode}`);
      }
      // y el barrido NUNCA sale y llega al mismo carril: si `b === a` el haz se queda quieto y
      // vuelve a ser lo que se reporto (un objetivo fijo).
      const hs = (x) => { const s = Math.sin(x * 127.1) * 43758.5453; return s - Math.floor(s); };
      for (let i = 0; i < 500; i++) {
        const a = Math.floor(hs(i * 1.9 + 7) * lv2.lanes);
        const b = (a + 1 + Math.floor(hs(i * 5.3) * (lv2.lanes - 1))) % lv2.lanes;
        assert.notEqual(b, a, `el disparo ${i} barre al mismo carril`);
      }
    }
    assert(gh.from > reac.from && gh.to === reac.to, "el fantasma no cae dentro del reactor");
    // el nivel 1 no declara `fx`: abierto siempre
    for (let r = 0; r < 128; r += 8) assert.equal(gateAt(timeOfRow(r, g), L1), 1);
  }

  // EL CONTRATIEMPO (`hatAt`): pica en la mitad del beat y vale ~0 en el beat. Es medio beat
  // corrido de `gridAt`, o sea que si algun dia se toca `gridAt` esto lo dice.
  {
    const t0 = timeOfRow(40, g2);
    // los dos son la misma sierra medio beat corrida: `gridAt` pica EN el beat y `hatAt` en
    // la mitad. Barriendo el beat entero, el maximo de cada uno tiene que caer en su mitad.
    const N = 200, ph = (f) => {
      let bi = 0;
      for (let i = 1; i < N; i++) if (f(t0 + (i / N) * g2.beat) > f(t0 + (bi / N) * g2.beat)) bi = i;
      return bi / N;
    };
    assert(ph((x) => gridAt(x, g2)) < 0.02, "el kick no pica en el 1 del beat");
    const p = ph((x) => hatAt(x, g2, HAT_K));
    assert(Math.abs(p - 0.5) < 0.02, `el hat pica en la fase ${p}, no en el contratiempo`);
    // y el exponente tiene que dejarlo por DEBAJO del corte de alpha en el resto del beat:
    // con k=2 el piso es 0.25 y el blanco quedaria puesto como un velo permanente.
    assert(hatAt(t0, g2, HAT_K) * 0.14 < 0.01,
      `el hat no baja del corte de alpha entre golpe y golpe (k=${HAT_K})`);
  }

  // LAS LETRAS DEL BREAK: sin `dur` `fxAt` no devuelve progreso y se quedan quietas. El
  // schema de este nivel no trae ni una, o sea que la pone el rol (`dur` en `map`).
  {
    const letras = cues(doc2, lv2).filter((x) => x.fx === "acid");
    // UNA SOLA (`every: 2` en el `map`): el canal trae dos eventos a 3.72 beats uno de otro y
    // el segundo arrancaba a 308ms del drop, o sea que la frase VOLVIA a salir sobre los
    // primeros beats del drop2. Eso es el "la letra se repite en el drop" que se reporto.
    assert.equal(letras.length, 1, `el nivel 2 tiene ${letras.length} cues de letras, no 1`);
    for (const x of letras) assert(x.dur > 0, "la cue de letras no trae `dur`");
    // cae en el break (donde habla el cantante) y TERMINA antes del drop
    const drop0 = secs2.find((sc) => sc.label === lv2.dropSec).start;
    for (const x of letras) {
      assert.equal(sectionAt(x.t, secs2), "break", `la cue de letras cae en ${sectionAt(x.t, secs2)}`);
      assert(x.t + x.dur <= drop0,
        `la frase se mete ${(x.t + x.dur - drop0).toFixed(3)}s dentro del drop`);
    }
    assert(lv2.acid.length <= 24, `la frase del nivel 2 no entra en el pool (${lv2.acid.length})`);
    // LA FRASE SALE DEL CANAL, no de escribirla a mano: el tag del schema es lo que canta, y
    // por escribirla a mano se habia colado "LET THE BASS DOWN" sin el QUICK (reportado).
    {
      const canal = Object.entries(LEVELS["orbit-motion"].map).find(([, v]) => v.fx === "acid")[0];
      assert.equal(lv2.acid, canal.toUpperCase(),
        `la frase no es la del canal: "${lv2.acid}" vs "${canal.toUpperCase()}"`);
    }
  }

  // LA OLA POR SECCION (`wave`). Cada seccion del nivel tiene que declarar la suya o la malla
  // vuelve al factor 1 en medio de la cancion, que es justo lo que se venia a arreglar. Y el
  // drop tiene que ir MAS opaco que el final del buildup y con OTRA forma, que es lo que se
  // pidio: si alguien iguala los dos numeros, el efecto desaparece sin que falle nada mas.
  {
    for (const sc of secs2) assert(lv2.wave[sc.label], `la seccion ${sc.label} no declara \`wave\``);
    const fin = (l) => lv2.wave[l].to ?? lv2.wave[l].a;
    assert.equal(lv2.wave[lv2.dropSec].a, Math.max(...secs2.map((sc) => lv2.wave[sc.label].a)),
      "el drop no es la seccion mas opaca");
    assert(fin("buildup") < lv2.wave.buildup.a * 0.3,
      `el buildup no se apaga hacia el apagon (${lv2.wave.buildup.a} -> ${fin("buildup")})`);
    // el break la borra, pero ya no de una: los efectos del buildup tienen que llegar al #78
    // (f63, la primera "let the bass"), que cae DENTRO del break, asi que la ola se apaga
    // rampa abajo y para cuando entra el apagon (f64) ya no queda nada que tapar.
    assert.equal(fin("break"), 0, "el break no deja la ola en 0");
    assert.notEqual(lv2.wave[lv2.dropSec].mode ?? 0, lv2.wave.buildup.mode ?? 0,
      "el drop usa la misma ola que el buildup");
    // EL SUELO OUTRUN DEL NIVEL 1 (`wave.mode` = 2 + `mesh`). Lo mismo para el otro nivel: la
    // seccion que no declara `wave` cae en el respaldo `{ a: 1, mode: 0 }`, y ese respaldo es el
    // AGUA del nivel 2, o sea que a la cordillera le faltaria una seccion y ahi saldrian olas.
    const L1W = LEVELS["insomnia-drop"].wave;
    assert(L1W, "el nivel 1 se quedo sin `wave`: la malla vuelve al agua del nivel 2");
    for (const l of doc.sections.map((s) => s.label)) {
      assert(L1W[l], `el nivel 1 no declara \`wave\` para la seccion ${l}`);
      assert.equal(L1W[l].mode, 2, `la seccion ${l} del nivel 1 no va con el outrun (mode 2)`);
    }
    assert(LEVELS["insomnia-drop"].decor.includes("mesh"), "el nivel 1 no enciende la malla");
    // y el nivel 2 NO puede llegar al modo 2: su ola esta medida y el outrun es otra forma
    for (const sc of secs2) {
      assert((lv2.wave[sc.label].mode ?? 0) < 2, `el nivel 2 pide el outrun en ${sc.label}`);
    }
    // el alpha de la malla es `(0.15 + 0.30*lat) * a`: por encima de 1.5 el factor la pone a la
    // par de las bandas del suelo (0.28 + 0.4) y la malla dejaria de ser fondo.
    for (const [nom, W] of [["insomnia-drop", L1W], ["orbit-motion", lv2.wave]]) {
      for (const [l, w] of Object.entries(W)) {
        for (const v of [w.a, w.to ?? w.a]) {
          assert(v <= 1.5, `${nom}: la ola de ${l} llega a ${v}, o sea por encima de la pista`);
        }
      }
    }
    // LAS CRESTAS FACETADAS (`shape`) van SOLO en el drop: se pidio que el buildup se quede
    // como esta. Un `shape` en el buildup seria justo lo contrario de lo que se pidio.
    assert.equal(lv2.wave[lv2.dropSec].shape, "pyra", "el drop no facetea la ola");
    for (const sc of secs2) {
      if (sc.label === lv2.dropSec) continue;
      assert(!lv2.wave[sc.label].shape, `la seccion ${sc.label} facetea la ola y no es el drop`);
    }
    // LA PALETA DE LA MALLA (`mesh` en LEVELS) contra `KILL`. La malla es fondo y `KILL` es lo
    // unico que mata: si el dorado se acercara al rosa, el fondo se pareceria a lo que mata, que
    // es la regla que ya vale para el `NEON`. Se mide el valle, la cresta y el MEDIO (que es el
    // color que mas superficie tiene, ver la gamma de `tono`), en RGB y en tono.
    const KILL = parseInt(src.match(/const KILL = 0x([0-9a-f]{6})/)[1], 16);
    const rgb = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const tono = ([r, gr, b]) => {
      const mx = Math.max(r, gr, b), d = mx - Math.min(r, gr, b);
      if (!d) return 0;
      const h = mx === r ? (gr - b) / d : mx === gr ? 2 + (b - r) / d : 4 + (r - gr) / d;
      return ((h * 60) % 360 + 360) % 360;
    };
    // el MEDIO no es la mitad de los dos hexs: `tono` mezcla con gamma 0.55, o sea que la altura
    // 0 de la ola (la mas comun) cae en 0.5^0.55 = 0.683 hacia la cresta. Esa es la mezcla que
    // se ve en pantalla, y por eso es la que se compara contra `KILL`.
    const mezcla = (a, b) => rgb(a).map((x, i) => Math.round(x + (rgb(b)[i] - x) * 0.5 ** 0.55));
    {
      const m = LEVELS["insomnia-drop"].mesh;
      assert(m, "el nivel 1 se quedo sin paleta de malla: volveria al cyan del nivel 2");
      const lo = rgb(parseInt(m.lo.slice(1), 16)), hi = rgb(parseInt(m.hi.slice(1), 16));
      const med = mezcla(parseInt(m.lo.slice(1), 16), parseInt(m.hi.slice(1), 16));
      for (const [nom, col] of [["valle", lo], ["cresta", hi], ["medio", med]]) {
        const d = Math.hypot(...col.map((x, i) => x - rgb(KILL)[i]));
        assert(d >= 100, `el ${nom} de la malla esta a ${d.toFixed(0)} de KILL en RGB`);
        const dh = Math.abs(((tono(col) - tono(rgb(KILL))) % 360 + 540) % 360 - 180);
        assert(dh >= 45, `el ${nom} de la malla esta a ${dh.toFixed(0)} grados de KILL`);
      }
      console.log(`suelo outrun: nivel 1 con mesh ${m.lo} -> ${m.hi} (medio `
        + `#${med.map((x) => x.toString(16).padStart(2, "0")).join("")}), mode 2 en las `
        + `${Object.keys(L1W).length} secciones, a de `
        + `${Object.values(L1W).map((w) => w.a).join("/")}`);
    }
  }

  // LA DERIVA DE TONO (`hue` -> `hueAt` + `rotHue`). Dos cosas y las dos son medibles:
  // que el nivel 1 no se entere (no declara `hue`, o sea 0 grados en todo el nivel: si girara
  // uno solo, el diff de pixeles del nivel 1 dejaria de dar 0), y que girar el tono NO cambie
  // la luminosidad, que es de lo que cuelgan todas las mediciones de contraste del proyecto.
  {
    for (let r = 0; r < 128; r += 8) assert.equal(hueAt(timeOfRow(r, g), L1), 0);
    assert.equal(rotHue(0x00d8ff, 0), 0x00d8ff, "girar 0 grados cambia el color");
    const lum = (c) => 0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255);
    for (const c of [0x00d8ff, 0x5fe8ff, 0x3ef2b5, 0xed4679]) {
      for (const d of [30, 70, 150, -70]) {
        const v = rotHue(c, d);
        assert(Math.abs(lum(v) - lum(c)) <= 1,
          `girar ${d} grados mueve la luma de ${c.toString(16)}: ${lum(c).toFixed(1)} -> ${lum(v).toFixed(1)}`);
      }
    }
    // el gris no tiene tono que girar: si lo tuviera, el metal del reactor y el contorno negro
    // del muneco se pintarian de color en cada deriva.
    for (const c of [0x000000, 0x808080, 0xffffff]) assert.equal(rotHue(c, 90), c);
    // y la deriva del nivel 2 vuelve a 0 UNA vez por ciclo y no se queda girada: `hueAt` es un
    // seno sobre la parte que no es `hold`, o sea que el arranque de cada ciclo esta en casa.
    const hu = LEVELS["orbit-motion"].hue;
    assert.equal(hueAt((L2.off ?? 0), L2), 0, "la deriva no arranca en 0");
    assert(hueAt((L2.off ?? 0) + hu.hold * L2.beat * 0.5, L2) === 0,
      "la deriva ya se movio dentro del `hold`");
    const pico = hueAt((L2.off ?? 0) + (hu.hold + (hu.beats - hu.hold) / 2) * L2.beat, L2);
    assert(Math.abs(pico - hu.deg) < 1e-6, `el pico de la deriva es ${pico} y no ${hu.deg}`);
  }

  // EL GUION: mismo solver por filas que el nivel 1, con SUS carriles y SU velocidad.
  const c2 = cues(doc2, lv2);
  const ob2 = c2.filter((x) => x.role === "obstacle");
  assert(ob2.length > 0, "orbit-motion se quedo sin guion");
  {
    // el APAGON no puede pedir accion: el `dark` es negro entero (mismo criterio que el break
    // del nivel 1, donde esta medido que no hay ni un obstaculo).
    for (const f of lv2.fx.filter((x) => x.kind === "dark")) {
      const dentro = ob2.filter((c) => c.row >= f.from && c.row <= f.to);
      assert.equal(dentro.length, 0, `hay ${dentro.length} obstaculos dentro del apagon f${f.from}-f${f.to}`);
    }
    // ninguna cue puede caer fuera de la grilla: la ultima fila del nivel es la `ultima`
    for (const c of ob2) assert(c.row <= ultima, `obstaculo en la f${c.row}, pasada la f${ultima}`);
    // una zanja de menos de 3 huecos se cruza de un salto y abre la pared que vino a vaciar
    const at2 = new Map(lv2.script.filter((d) => d.row != null && d.kind).map((d) => [`${d.row},${d.lane}`, d.kind]));
    for (let lane = 0; lane < lv2.lanes; lane++) {
      let len = 0;
      for (let r = 0; r <= ultima + 1; r++) {
        if (at2.get(`${r},${lane}`) === "gap") len++;
        else { assert(len === 0 || len >= 3, `zanja de ${len} en el carril ${lane} antes de la f${r}`); len = 0; }
      }
    }
    // y el nivel se puede pasar, al piso y de cabeza
    const clave2 = (s) => `${s.lane},${Math.round(s.y / 8)},${Math.round(s.vy / 80)},${s.sliding > 0 ? 1 : 0}`;
    const OFF2 = [0, 1, 2, 3, 4].map((i) => (i / 5 - 0.35) * g2.beat);
    const lanes2 = [...Array(lv2.lanes).keys()];
    const resolver2 = (gr) => {
      const paso2 = 1 / 240;
      let vivos = [{ lane: (lv2.lanes - 1) >> 1, y: 0, vy: 0, sliding: 0, dash: 0 }];
      let flaco = 1e9;
      for (let r = 0; r <= ultima && vivos.length; r++) {
        const ini = timeOfRow(r, g2), fin = ini + g2.beat;
        const cerca = ob2.filter((c) => Math.abs(c.t - ini) < 2 * g2.beat);
        const nuevos = new Map();
        for (const s of vivos) for (const lane of lanes2)
          for (const acc of [null, ...OFF2.flatMap((d) => [["jump", d], ["slide", d]])]) {
            let p = { ...s, lane }, muerto = false, hecho = !acc;
            for (let t = ini; t < fin; t += paso2) {
              if (!hecho && t >= ini + acc[1] + g2.beat / 2) {
                hecho = true;
                if (acc[0] === "jump") { if (gr * p.y <= 0) { p.vy = gr * JUMP_V; p.sliding = 0; } }
                else p.sliding = 0.5;
              }
              p = stepPlayer(p, paso2, gr);
              for (const c of cerca) {
                if (c.lane !== p.lane) continue;
                if (hits(c.kind, zOf(c, t, lv2.speed), p.y, p.sliding, gr)) { muerto = true; break; }
              }
              if (muerto) break;
            }
            if (!muerto) nuevos.set(clave2(p), p);
          }
        vivos = [...nuevos.values()];
        flaco = Math.min(flaco, vivos.length);
        if (!vivos.length) return { muere: r };
      }
      return { muere: null, flaco };
    };
    const r1 = resolver2(1), r2 = resolver2(-1);
    assert.equal(r1.muere, null, `el nivel 2 no se puede pasar: en la f${r1.muere} no queda estado vivo`);
    assert.equal(r2.muere, null, `el nivel 2 no se puede pasar de cabeza: en la f${r2.muere} no queda estado vivo`);
    const k2 = {};
    for (const c of ob2) k2[c.kind] = (k2[c.kind] ?? 0) + 1;
    console.log(`orbit-motion guion: ${ob2.length} obstaculos (`
      + Object.entries(k2).map(([k, n]) => `${n} ${k}`).join(", ")
      + `) pasable al piso y de cabeza (solver por filas a v=${lv2.speed}, ${lv2.lanes} carriles), `
      + `fila mas flaca ${Math.min(r1.flaco, r2.flaco)} estados, apagon f63-f67 vacio`);
  }
  for (const x of c2) assert(x.t >= -1e-6 && x.t <= len2, `cue fuera del corte: ${x.t}`);

  const porRol = {};
  for (const x of c2) porRol[x.role] = (porRol[x.role] ?? 0) + 1;
  console.log(`orbit-motion: ${ultima + 1} filas de ${g2.beat.toFixed(4)}s (${len2.toFixed(2)}s), `
    + `${lv2.lanes} carriles en [${lanesX(lv2.lanes)}], v=${lv2.speed}, `
    + `${secs2.length} secciones (${secs2.map((s) => s.label).join("/")}), `
    + `${lv2.sectors.length} sectores f0-f${lv2.sectors.at(-1).to}, decor ${lv2.decor.join("+")}`);
  console.log(`orbit-motion cues: ${c2.length} (`
    + Object.entries(porRol).map(([r, n]) => `${n} ${r}`).join(", ") + ")");
}

// --- nivel 3: breathe ---------------------------------------------------------------------
// Arranca MINIMO (4 carriles, fondo declarado, SIN guion). Lo que se afirma es que la grilla,
// las secciones, los sectores, los modos del eq, el decor, la ola, el glow/enter y la velocidad
// cierran. El guion se dicta bailando despues (`Y`/`U`), igual que los otros dos: con `script:
// []` no hay obstaculos y el solver por filas no corre (solo corre si hay obstaculos).
{
  const doc3 = JSON.parse(readFileSync("./assets/breathe.schema.json", "utf8"));
  assert.deepEqual(validate(doc3), [], "el schema de breathe no valida");
  const lv3 = LEVELS["breathe"];
  const g3 = grid(doc3);
  const L3 = { ...g3, ...lv3 };
  const t0 = doc3.track.trim.start, len3 = doc3.track.trim.end - t0;

  // la grilla es de 155bpm y el corte cae en una fila entera: la ultima jugable es la 286
  const ultima3 = rowAt(len3 - 1e-9, g3);
  assert.equal(ultima3, 286, `el corte da ${ultima3 + 1} filas, no 287`);
  assert(Math.abs(g3.beat - 60 / 155) < 1e-9, "la grilla no es de 155bpm");
  // el corte cae DENTRO de la ultima fila (286): la f287 arranca 1.46ms despues del corte, o
  // sea que la ultima jugable es la 286 (mismo criterio que el nivel 2, que se mide con `rowAt`).
  assert(len3 >= g3.off + 286 * g3.beat && len3 < g3.off + 287 * g3.beat,
    "el corte no cae dentro de la ultima fila");

  assert.equal(lv3.lanes, 4, "breathe es de 4 carriles");
  assert.deepEqual(lanesX(lv3.lanes).length, 4, "laneX no trae 4 posiciones");

  // secciones: contiguas, de 0 al final del corte (mismo criterio que los otros dos). El
  // schema trae el outro MAS ALLA del corte (hasta la fila 394), o sea que la ultima seccion
  // se recorta a la fila 286: `sectionAt` usa los tiempos del schema, asi que el recorte se
  // hace en el test comparando contra `len3`, no contra el `end` crudo del schema.
  const secs3 = doc3.sections.map((s) => ({ label: s.label, start: s.start - t0, end: s.end - t0 }));
  // la intro arranca 0.15ms ANTES del corte (el schema la abre un pelo antes del trim): se
  // acepta ese epsilon, o sea que la primera seccion cubre el arranque del corte.
  assert(Math.abs(secs3[0].start) < 0.001, "la primera seccion no arranca en 0");
  for (let i = 1; i < secs3.length; i++) {
    assert.equal(secs3[i].start, secs3[i - 1].end,
      `hueco entre ${secs3[i - 1].label} y ${secs3[i].label}`);
  }
  for (const s of secs3) assert(s.end - s.start > g3.beat, `${s.label} dura menos de un beat`);
  for (const s of secs3) assert(lv3.glow[s.label] && lv3.enter[s.label],
    `la seccion ${s.label} no tiene glow/enter`);

  // sectores del suelo: contiguos, de la f0 a la ultima (286). Un agujero devuelve el suelo al
  // color de la seccion en medio de la pista y se lee como un bug.
  assert.equal(lv3.sectors[0].from, 0, "los sectores no arrancan en la fila 0");
  for (let i = 1; i < lv3.sectors.length; i++) {
    assert.equal(lv3.sectors[i].from, lv3.sectors[i - 1].to + 1,
      `hueco/solape entre sectores en la fila ${lv3.sectors[i].from}`);
  }
  assert.equal(lv3.sectors.at(-1).to, ultima3, "los sectores no llegan justo a la ultima fila");

  // DECOR: la lista blanca se saca del renderer (`this.dec("...")`), igual que los otros dos.
  {
    const src3 = readFileSync("./AIRunnerGame.js", "utf8");
    const DECOR3 = [...new Set([...src3.matchAll(/\bdec\("([a-z]+)"\)/g)].map((m) => m[1]))];
    for (const d of lv3.decor) assert(DECOR3.includes(d), `decor "${d}" no existe en el renderer`);
  }

  // MODOS DEL EQ: uno por sector, y todos tienen que existir en `drawBars`. El eq es la capa
  // `bars` de `layers`; `drawBars` lee `L.modes[si]` con `si` = indice del sector.
  {
    const eq = lv3.layers.find((l) => l.kind === "bars");
    assert(eq, "breathe no declara el eq en `layers`");
    assert.equal(eq.modes.length, lv3.sectors.length,
      `el eq tiene ${eq.modes.length} modos para ${lv3.sectors.length} sectores`);
    const VALID = ["analyzer", "sweep", "center", "spectro", "color", "constelacion"];
    for (const m of eq.modes) assert(VALID.includes(m), `modo de eq desconocido: "${m}"`);
  }

  // WAVE: las seis secciones declaradas (si falta una, la malla vuelve al agua del nivel 2).
  for (const sc of secs3) assert(lv3.wave[sc.label], `la seccion ${sc.label} no declara \`wave\``);
  // el drop es la seccion mas opaca y va con la OTRA ola y faceteada
  assert.equal(lv3.wave.drop.a, Math.max(...secs3.map((sc) => lv3.wave[sc.label].a)),
    "el drop no es la seccion mas opaca");
  assert.notEqual(lv3.wave.drop.mode ?? 0, lv3.wave.buildup.mode ?? 0,
    "el drop usa la misma ola que el buildup");
  assert.equal(lv3.wave.drop.shape, "pyra", "el drop no facetea la ola");
  for (const sc of secs3) {
    if (sc.label === "drop") continue;
    assert(!lv3.wave[sc.label].shape, `la seccion ${sc.label} facetea la ola y no es el drop`);
  }
  // el break deja la ola en 0 (ahi la pantalla es negra por el `dark`)
  assert.equal(lv3.wave.break.to, 0, "el break no deja la ola en 0");
  // y el alpha de la malla no puede pasar de 1.5 (por encima de la pista)
  for (const [l, w] of Object.entries(lv3.wave)) {
    for (const v of [w.a, w.to ?? w.a]) assert(v <= 1.5, `la ola de ${l} llega a ${v}`);
  }

  // GLOW: cada seccion con un rol que tenga >=1 cue en ese tramo. La voz (mark) suena en las
  // seis, o sea que todo late con la voz.
  {
    const c3 = cues(doc3, lv3);
    for (const sc of secs3) {
      const rol = lv3.glow[sc.label];
      const n = c3.filter((x) => x.role === rol && x.t >= sc.start && x.t < sc.end).length;
      assert(n >= 1, `la seccion ${sc.label} late con "${rol}" pero no tiene ni una cue ahi`);
    }
  }

  // ENTER: cada seccion con un valor valido (los que dibuja `drawBox`).
  {
    const VALID = ["fade", "grow", "side", "wide", "slam", "roll"];
    for (const sc of secs3) {
      assert(VALID.includes(lv3.enter[sc.label]),
        `la seccion ${sc.label} tiene un enter invalido: "${lv3.enter[sc.label]}"`);
    }
  }

  // VELOCIDAD: la ventana de carril tiene que ser >= 300ms. A 155bpm la cuenta de la GUIA da
  // v=4532 (absurda), o sea que se acepta una ventana mas corta que la del nivel 1: a v=1400
  // la ventana es beat - 103/v = 0.387097 - 0.073571 = **313ms**.
  {
    const ventana = g3.beat - (KINDS.block.d + PLAYER_D) / lv3.speed;
    assert(ventana >= 0.3, `la ventana de carril es ${(ventana * 1000).toFixed(0)}ms, < 300ms`);
    console.log(`breathe velocidad: ventana de carril ${(ventana * 1000).toFixed(0)}ms a v=${lv3.speed}`);
  }

  // FX: el apagon (dark f56-f63) y el negativo (neg f240-f255). El negativo no puede pisar el
  // dark ni ningun otro tramo a pantalla completa.
  {
    for (const f of lv3.fx) {
      assert(["dark", "neg"].includes(f.kind), `tramo fx de tipo desconocido: ${f.kind}`);
      assert(f.to >= f.from, `tramo fx f${f.from} vacio`);
    }
    const [dark3] = lv3.fx.filter((f) => f.kind === "dark");
    assert(dark3, "breathe no declara el apagon");
    assert.equal(dark3.from, 56, "el apagon no arranca en la f56");
    assert.equal(dark3.to, 63, "el apagon no termina en la f63");
    for (const f of lv3.fx.filter((x) => x.kind === "neg")) {
      for (const o of lv3.fx) {
        if (!["dark", "ghost", "gate"].includes(o.kind)) continue;
        assert(f.to < o.from || f.from > o.to,
          `el negativo f${f.from}-f${f.to} pisa un ${o.kind} (f${o.from}-f${o.to})`);
      }
      const hz = (f.div ?? 4) / g3.beat;
      assert(hz <= 3, `el negativo destella a ${hz.toFixed(2)}Hz (el limite son 3/s)`);
    }
  }

  // EL GUION: mismo solver por filas que los otros dos niveles, con SUS carriles y SU
  // velocidad. El apagon (f56-f63) va vacio y el nivel se puede pasar al piso y de cabeza.
  const c3 = cues(doc3, lv3);
  const ob3 = c3.filter((x) => x.role === "obstacle");
  assert(ob3.length > 0, "breathe se quedo sin guion");
  for (const x of c3) assert(x.t >= -1e-6 && x.t <= len3, `cue fuera del corte: ${x.t}`);
  {
    // el APAGON no puede pedir accion: el `dark` es negro entero (mismo criterio que los
    // otros dos niveles).
    for (const f of lv3.fx.filter((x) => x.kind === "dark")) {
      const dentro = ob3.filter((c) => c.row >= f.from && c.row <= f.to);
      assert.equal(dentro.length, 0, `hay ${dentro.length} obstaculos dentro del apagon f${f.from}-f${f.to}`);
    }
    // ninguna cue puede caer fuera de la grilla: la ultima fila del nivel es la `ultima3`
    for (const c of ob3) assert(c.row <= ultima3, `obstaculo en la f${c.row}, pasada la f${ultima3}`);
    // una zanja de menos de 3 huecos se cruza de un salto y abre la pared que vino a vaciar
    const at3 = new Map(lv3.script.filter((d) => d.row != null && d.kind).map((d) => [`${d.row},${d.lane}`, d.kind]));
    for (let lane = 0; lane < lv3.lanes; lane++) {
      let len = 0;
      for (let r = 0; r <= ultima3 + 1; r++) {
        if (at3.get(`${r},${lane}`) === "gap") len++;
        else { assert(len === 0 || len >= 3, `zanja de ${len} en el carril ${lane} antes de la f${r}`); len = 0; }
      }
    }
    // y el nivel se puede pasar, al piso y de cabeza
    const clave3 = (s) => `${s.lane},${Math.round(s.y / 8)},${Math.round(s.vy / 80)},${s.sliding > 0 ? 1 : 0}`;
    const OFF3 = [0, 1, 2, 3, 4].map((i) => (i / 5 - 0.35) * g3.beat);
    const lanes3 = [...Array(lv3.lanes).keys()];
    const resolver3 = (gr) => {
      const paso2 = 1 / 240;
      let vivos = [{ lane: (lv3.lanes - 1) >> 1, y: 0, vy: 0, sliding: 0, dash: 0 }];
      let flaco = 1e9;
      for (let r = 0; r <= ultima3 && vivos.length; r++) {
        const ini = timeOfRow(r, g3), fin = ini + g3.beat;
        const cerca = ob3.filter((c) => Math.abs(c.t - ini) < 2 * g3.beat);
        const nuevos = new Map();
        for (const s of vivos) for (const lane of lanes3)
          for (const acc of [null, ...OFF3.flatMap((d) => [["jump", d], ["slide", d]])]) {
            let p = { ...s, lane }, muerto = false, hecho = !acc;
            for (let t = ini; t < fin; t += paso2) {
              if (!hecho && t >= ini + acc[1] + g3.beat / 2) {
                hecho = true;
                if (acc[0] === "jump") { if (gr * p.y <= 0) { p.vy = gr * JUMP_V; p.sliding = 0; } }
                else p.sliding = 0.5;
              }
              p = stepPlayer(p, paso2, gr);
              for (const c of cerca) {
                if (c.lane !== p.lane) continue;
                if (hits(c.kind, zOf(c, t, lv3.speed), p.y, p.sliding, gr)) { muerto = true; break; }
              }
              if (muerto) break;
            }
            if (!muerto) nuevos.set(clave3(p), p);
          }
        vivos = [...nuevos.values()];
        flaco = Math.min(flaco, vivos.length);
        if (!vivos.length) return { muere: r };
      }
      return { muere: null, flaco };
    };
    const r1 = resolver3(1), r2 = resolver3(-1);
    assert.equal(r1.muere, null, `breathe no se puede pasar: en la f${r1.muere} no queda estado vivo`);
    assert.equal(r2.muere, null, `breathe no se puede pasar de cabeza: en la f${r2.muere} no queda estado vivo`);
    const k3 = {};
    for (const c of ob3) k3[c.kind] = (k3[c.kind] ?? 0) + 1;
    console.log(`breathe guion: ${ob3.length} obstaculos (`
      + Object.entries(k3).map(([k, n]) => `${n} ${k}`).join(", ")
      + `) pasable al piso y de cabeza (solver por filas a v=${lv3.speed}, ${lv3.lanes} carriles), `
      + `fila mas flaca ${Math.min(r1.flaco, r2.flaco)} estados, apagon f56-f63 vacio`);
  }

  // EL NIVEL 1 Y EL 2 NO SE MUEVEN: no heredan nada del nivel 3. El nivel 1 YA tiene su propio
  // eq con modos (14 sectores, 14 modos) y el nivel 2 no declara `layers`. Lo que hay que
  // afirmar es que el eq del nivel 3 no se cuela en el 1 (sus 14 modos siguen siendo los suyos)
  // y que el 2 sigue sin capas.
  assert.deepEqual(LEVELS["orbit-motion"].layers ?? [], [], "el nivel 2 heredo capas del nivel 3");
  {
    const eq1 = (LEVELS["insomnia-drop"].layers ?? []).find((l) => l.kind === "bars");
    assert(eq1 && eq1.modes, "el nivel 1 perdio su eq con modos");
    assert.equal(eq1.modes.length, 14, "el nivel 1 cambio el numero de modos de su eq");
    // y ninguno de los modos del nivel 3 es el del nivel 1 (los dos eq son distintos)
    const eq3 = lv3.layers.find((l) => l.kind === "bars");
    assert.notDeepEqual(eq3.modes, eq1.modes, "el eq del nivel 3 es identico al del nivel 1");
  }
  // y el nivel 3 no declara `rigOver` (el rig queda en el cielo, como el nivel 1)
  assert.equal(!!L3.rigOver, false, "breathe declara `rigOver`");

  const porRol3 = {};
  for (const x of c3) porRol3[x.role] = (porRol3[x.role] ?? 0) + 1;
  console.log(`breathe: ${ultima3 + 1} filas de ${g3.beat.toFixed(4)}s (${len3.toFixed(2)}s), `
    + `${lv3.lanes} carriles en [${lanesX(lv3.lanes)}], v=${lv3.speed}, `
    + `${secs3.length} secciones (${secs3.map((s) => s.label).join("/")}), `
    + `${lv3.sectors.length} sectores f0-f${lv3.sectors.at(-1).to}, decor ${lv3.decor.join("+")}`);
  console.log(`breathe cues: ${c3.length} (`
    + Object.entries(porRol3).map(([r, n]) => `${n} ${r}`).join(", ") + ")");
}

// --- el reactor: misma geometria, dos backends -------------------------------------------
// `reactor.js` no importa Phaser, o sea que su backend de dibujo corre desde node con un
// doble. Aca va lo minimo (los ids que se animan, que no explota y que sale simetrico); el
// chequeo largo -alas identicas salvo rotacion, encuadre- vive en `tools/reactor-svg.js`,
// que es lo que ademas escribe `assets/reactor.svg`.
{
  const svg = toSVG();
  for (const id of ["reactor", "core", "wing-1", "wing-2", "wing-3", "wave-1", "wave-2", "wave-3"]) {
    assert.ok(svg.includes(`id="${id}"`), `falta id="${id}" en el svg del reactor`);
  }
  const ondas = [1, 2, 3].map((i) => svg.match(new RegExp(`id="wave-${i}" d="([^"]*)"`))[1]);
  assert.equal(new Set(ondas).size, 3, "las tres pantallas muestran la misma onda");

  // simetria respecto del eje vertical: con el ala 1 apuntando arriba, espejar en x=BOX/2
  // devuelve el mismo multiconjunto (el ala 1 cae sobre si misma y las otras dos se
  // intercambian). Los puntos van ordenados: espejar un poligono le invierte el sentido.
  // Las ondas quedan fuera (llevan `id`): son una traza, no geometria mecanica.
  const clave = (p, esp) => {
    const r = (v) => Math.round(v * 100) / 100, x = (v) => (esp ? BOX - v : v);
    const pts = p.k === "poly" ? p.pts.map(([a, b]) => `${r(x(a))},${r(b)}`).sort()
      : [`${r(x(p.x))},${r(p.y)}`];
    return [p.k, p.c, r(p.a), r(p.r ?? 0), p.fill ? 1 : 0, pts.join(";")].join("|");
  };
  const geo = parts().filter((p) => !p.id);
  assert.deepEqual(geo.map((p) => clave(p, true)).sort(), geo.map((p) => clave(p, false)).sort(),
    "el reactor no es simetrico respecto del eje vertical");
  assert.ok(radioMax() < BOX / 2, `el reactor se sale del cuadro: r=${radioMax().toFixed(1)}`);

  // el otro backend: un doble del Graphics de Phaser que apunta todo lo que le piden.
  const ll = [];
  const doble = new Proxy({}, { get: (_, m) => (...a) => ll.push([m, ...a]) });
  const P = (x, y) => ({ x: 100 + x * 0.5, y: 200 + x * 0 + y * 0.5 });   // semejanza, escala 0.5
  drawReactor(doble, P, { t: 1.3, beat: 0.7, pulse: 0.4, spin: 0.9 });
  assert.ok(ll.length > parts().length, "drawReactor no dibujo todas las primitivas");
  for (const [m, ...a] of ll) {
    assert.ok(a.every((v) => typeof v !== "number" || Number.isFinite(v)), `${m} con NaN`);
  }
  // con el FFT en cero (el juego en pausa) la traza no puede volverse una raya ni un NaN
  const plana = wave(0, { fft: new Uint8Array(128), beat: 1 });
  assert.equal(plana.length, WAVE_N);
  assert.ok(plana.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), "la onda dio NaN");
  // LA TRAZA VA CLAVADA AL BEAT (`bt` = beats transcurridos): un ciclo exacto por beat. Se
  // reporto que las ondas de las pantallas no van en sincro, y es que la portadora corria a
  // `t * 5.5` rad/s, o sea 0.383 ciclos por beat, un numero que no sale del tempo. Con `bt`,
  // dos beats enteros de distancia tienen que dar la MISMA onda; medio beat, otra.
  {
    const o = (bt) => ({ t: 0, beat: 0, fft: null, bt });
    const key = (p) => p.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join(" ");
    assert.equal(key(wave(1, o(3))), key(wave(1, o(5))), "la traza no repite cada beat");
    assert.notEqual(key(wave(1, o(3))), key(wave(1, o(3.5))), "la traza no se mueve dentro del beat");
    // y sin `bt` (el SVG estatico) cae en la cuenta vieja, o sea que no se entera del dial
    assert.equal(key(wave(1, { t: 1, beat: 0, fft: null })),
      key(wave(1, { t: 1, beat: 0, fft: null })), "la onda del SVG dejo de ser determinista");
  }
  console.log(`reactor: ${parts().length} primitivas (${geo.length} mecanicas + 3 ondas), `
    + `radio ${radioMax().toFixed(1)} de ${BOX / 2}, ${ll.length} llamadas al Graphics, simetrico`);
}

console.log("ok");

// CUAL SECCION ES EL DROP LO DICE EL NIVEL. El nivel 1 tiene un `drop` Y un `drop2`, asi que
// mirar el prefijo del nombre le encendia al `drop2` el rave clavado y el temblor (medido:
// 169813 px distintos a t=65 contra `git archive HEAD`). El respaldo tiene que ser "drop", que
// es lo que el renderer hacia antes de existir el dial.
{
  // `loadLevel` usa fetch, o sea que desde node se leen los LEVELS crudos + el respaldo, que
  // se saca del propio `music.js` (mismo idiom que la lista blanca de `decor`, que sale del
  // renderer): asi no se puede cambiar el respaldo y dejar el test verde.
  const src = readFileSync(new URL("./music.js", import.meta.url), "utf8");
  const def = src.match(/dropSec:\s*level\.dropSec\s*\?\?\s*"([a-z0-9]+)"/i)?.[1];
  assert.equal(def, "drop", "el respaldo de dropSec dejo de ser 'drop'");
  assert.equal(LEVELS["insomnia-drop"].dropSec, undefined,
    "el nivel 1 no tiene que declarar dropSec: su drop es el respaldo");
  assert.equal(LEVELS["orbit-motion"].dropSec, "drop2", "el nivel 2 no declara cual es su drop");

  // y por que no alcanza con mirar el prefijo del nombre: el nivel 1 tiene DOS secciones que
  // empiezan con "drop" y solo la primera es su drop.
  const l1 = doc.sections.map((x) => x.label);
  const l2 = JSON.parse(readFileSync("./assets/orbit.schema.json", "utf8")).sections.map((x) => x.label);
  assert(l1.filter((x) => x.startsWith("drop")).length === 2, `nivel 1: ${l1}`);
  assert(l1.includes(def), `el drop del nivel 1 (${def}) no es una seccion suya`);
  assert(l2.includes(LEVELS["orbit-motion"].dropSec), `el drop del nivel 2 no es una seccion`);
  assert(!l2.includes("drop"), "el nivel 2 tiene una seccion 'drop' y su dropSec es otra");
  console.log(`drop: nivel 1 -> "${def}" (respaldo) de [${l1}], nivel 2 -> "drop2" de [${l2}]`);
}

// --- los efectos nuevos: geometria pura, o sea que se comprueba desde node --------------
// `fx.js` no importa Phaser (mismo idiom que `reactor.js`), asi que lo unico que hace falta
// es llamarlo y medir los puntos. Lo que se mide es lo que romperia el efecto en pantalla:
// que sea DETERMINISTICO (si no, rebobinar da otro rayo y el mundo deja de ser funcion de
// songT) y que no se salga de su caja (un rayo que se va a 10 pantallas de distancia no se ve
// y cuesta lo mismo).
{
  // 1. DETERMINISMO. Dos llamadas con la misma semilla dan exactamente lo mismo, y semillas
  //    distintas dan cosas distintas: `hash` y no `Math.random()`.
  assert.deepEqual(bolt(7), bolt(7), "el rayo no es deterministico");
  assert.notDeepEqual(bolt(7), bolt(8), "dos rayos distintos salen iguales");
  assert.deepEqual(pyras(3, 12, 0.4), pyras(3, 12, 0.4), "las piramides no son deterministicas");
  assert.deepEqual(forks(5), forks(5), "las ramas no son deterministicas");

  // 2. EL RAYO. `lv` niveles de partir el segmento son 2^lv + 1 puntos, y va de punta a
  //    punta: los extremos son los que pone el que dibuja y no se pueden mover.
  for (const lv of [1, 3, 5]) {
    const b = bolt(11, lv);
    assert.equal(b.length, 2 ** lv + 1, `bolt(lv=${lv}) da ${b.length} puntos`);
    assert.deepEqual(b[0], { x: 0, y: 0 }, "el rayo no arranca en su origen");
    assert.deepEqual(b.at(-1), { x: 1, y: 0 }, "el rayo no llega a su destino");
  }
  const b5 = bolt(11, 5);
  // la x tiene que ir SIEMPRE hacia adelante: si retrocediera el rayo se dobla sobre si mismo
  for (let i = 1; i < b5.length; i++) assert(b5[i].x > b5[i - 1].x, "el rayo retrocede");
  // y el desvio lateral tiene que quedarse dentro de lo que suma la serie de amplitudes
  // (jag/1 + jag/2 + ... + jag/lv), o sea 0.13 * 2.283 = 0.297 con los valores por defecto
  const tope = 0.13 * [1, 2, 3, 4, 5].reduce((a, l) => a + 1 / l, 0);
  const desv = Math.max(...b5.map((p) => Math.abs(p.y)));
  assert(desv <= tope + 1e-9, `el rayo se desvia ${desv}, por encima del tope ${tope}`);
  assert(desv > 0.05, `el rayo sale casi recto (${desv}): no se leeria como descarga`);

  // 3. LAS PIRAMIDES (antes esquirlas planas). Salen del centro y FRENAN: el recorrido es
  //    1-(1-p)^2, o sea que la mitad del camino esta hecha en p=0.29. Lineal se leerian como
  //    que flotan.
  const r0 = pyras(1, 16, 0), r5 = pyras(1, 16, 0.5), r9 = pyras(1, 16, 0.95);
  // el recorrido se mide SIN la caida (`-0.18 p^2`) y sin el aplastado (0.62): con la caida
  // puesta, una pieza que sube acerca su y a 0 y su distancia al centro BAJA, o sea que
  // hypot(x,y) no mide lo que avanzo sino donde quedo.
  const rad = (l, p) => l.map((s) => Math.hypot(s.x, (s.y + 0.18 * p * p) / 0.62));
  assert(Math.max(...rad(r0, 0)) < 1e-9, "las piramides no salen del centro");
  const [d5, d9] = [rad(r5, 0.5), rad(r9, 0.95)];
  for (let i = 0; i < 16; i++) assert(d9[i] > d5[i], "una piramide vuelve para atras");
  // el frenazo: a mitad de tiempo ya hizo mas de la mitad del camino
  const avance = d5.reduce((a, x, i) => a + x / d9[i], 0) / 16;
  assert(avance > 0.6, `las piramides no frenan (a p=0.5 llevan el ${(avance * 100).toFixed(0)}%)`);
  // y se apagan: al final el alpha esta en 0
  assert(pyras(1, 8, 1)[0].a <= 0, "la piramide no se apaga al terminar");

  // 4. LAS DOS CARAS. Lo que la hace leer como VOLUMEN y no como triangulo plano son tres
  //    cosas y las tres se comprueban: que sean dos caras de 3 puntos, que compartan la arista
  //    (apice, esquina de adelante) y que vayan con DISTINTO gris. Y que la esquina de adelante
  //    este FUERA de la linea de la base: con `tilt` = 0 la base queda de canto y las dos caras
  //    colapsan en una, que es exactamente el dibujo viejo.
  const [ca, cb] = pyraFaces(r5[0]);
  assert.equal(ca.pts.length, 3, "la cara no es un triangulo");
  assert.equal(cb.pts.length, 3, "la cara no es un triangulo");
  assert(ca.shade > cb.shade * 2, `las dos caras van casi del mismo gris (${ca.shade}/${cb.shade})`);
  assert.deepEqual([ca.pts[0], ca.pts[2]], [cb.pts[0], cb.pts[1]], "las caras no comparten arista");
  const [ap, L, F] = ca.pts, Rt = cb.pts[2];
  const fuera = Math.abs((Rt.x - L.x) * (F.y - L.y) - (Rt.y - L.y) * (F.x - L.x))
    / Math.hypot(Rt.x - L.x, Rt.y - L.y);
  assert(fuera > r5[0].r * 0.3, `la base esta de canto (${fuera.toFixed(4)}): es un triangulo plano`);
  // y la pieza entera cabe en su radio: el apice esta a `r` del centro
  assert(Math.abs(Math.hypot(ap.x - r5[0].x, ap.y - r5[0].y) - r5[0].r) < 1e-9,
    "el apice no esta a `r` del centro");

  // 5. EL RAYO NUNCA ES HORIZONTAL (`arcDir`). Se pidio que las descargas vayan siempre en
  //    diagonal o de arriba abajo, nunca cruzando la pantalla, asi que se sortean 20000 semillas
  //    y se mide el angulo contra la HORIZONTAL. El peor caso teorico es 90 - TILT - JIT = 50
  //    grados; el assert corta en 45, que es el limite de "esto ya se lee como horizontal".
  //    Se mide con el aplastado del origen del reactor puesto (0.7 en y, ver `drawArcs`): sin
  //    eso el numero no seria el de la pantalla. Y se comprueba que salgan las TRES familias.
  const fam = new Set();
  let peor = 90;
  for (let s = 0; s < 20000; s++) for (const dn of [-1, 1]) {
    const an = arcDir(s * 0.7 + 1, dn);
    // desvio con SIGNO desde la vertical, o sea la inclinacion del rayo. El aplastado del
    // origen del reactor (0.7) no toca la direccion a proposito: si la tocara, tumbaria el rayo.
    const dev = Math.atan2(Math.cos(an), Math.abs(Math.sin(an))) * 180 / Math.PI;
    peor = Math.min(peor, 90 - Math.abs(dev));
    fam.add(Math.round(dev / (ARC_TILT * 180 / Math.PI)));
  }
  assert(peor >= 45, `un rayo sale a ${peor.toFixed(1)} grados de la horizontal`);
  assert.deepEqual([...fam].sort(), [-1, 0, 1], `el rayo no tiene las 3 familias: ${[...fam]}`);

  //    Y con `all` son SEIS: las mismas tres espejadas hacia abajo, o sea que el reactor irradia
  //    en redondo. El assert es el MISMO limite: espejar no puede acercar ningun rayo a la
  //    horizontal, y las dos puntas (arriba y abajo) tienen que aparecer.
  const fam6 = new Set();
  let peor6 = 90;
  for (let s = 0; s < 20000; s++) for (const dn of [-1, 1]) {
    const an = arcDir(s * 0.7 + 1, dn, 1);
    const dev = Math.atan2(Math.cos(an), Math.abs(Math.sin(an))) * 180 / Math.PI;
    peor6 = Math.min(peor6, 90 - Math.abs(dev));
    fam6.add(`${Math.sign(Math.sin(an)) < 0 ? "^" : "v"}${Math.round(dev / (ARC_TILT * 180 / Math.PI))}`);
  }
  assert(peor6 >= 45, `un rayo de \`all\` sale a ${peor6.toFixed(1)} grados de la horizontal`);
  assert.equal(fam6.size, 6, `\`all\` no da las 6 familias: ${[...fam6]}`);

  // 6. EL SUELO OUTRUN (`outrun`, `meshWave` con `mode` 2). Es la ola del nivel 1 y lo unico que
  //    hay que afirmar es lo que la hace outrun y no agua:
  //    - PLANA al lado de la pista: `edge` son 255 y la cordillera arranca en 700, o sea 445 del
  //      mundo de desierto liso. Si esto se rompe, la montana le crece pegada al carril de
  //      afuera y se lee como una pared.
  //    - dentro de -1..1: `drawMesh` multiplica por la amplitud medida y la del nivel 2 sale
  //      normalizada por la suma de pesos. Una ola de 1.4 haria montanas un 40% mas altas que
  //      todo lo que se midio.
  //    - SIMETRICA en x: es la misma cordillera de los dos lados de la pista.
  //    - y RESUELTA por las columnas de la malla: `drawMesh` reparte columnas cada `MESH_PX` de
  //      PANTALLA, o sea ~90 del mundo en la fila mas lejana. Se cuentan las crestas con paso 1
  //      y con paso 90 y tienen que dar lo mismo: si no dieran, la cordillera aliasaria.
  {
    assert.equal(outrun.length, 2, "`outrun` dejo de ser funcion de (x, z): una montana no ondula");
    assert.equal(outrun(900, 1200), outrun(900, 1200), "`outrun` no es deterministica");
    // sin los comentarios: ahi las dos cosas estan NOMBRADAS, que es justo lo que se explica
    const fxsrc = readFileSync("./fx.js", "utf8").replace(/\/\/.*$/gm, "");
    assert(!/Math\.random|Date\.now/.test(fxsrc), "`fx.js` dejo de ser funcion pura del tiempo");
    let plano = 0, mn = 1, mx = -1, sim = 0;
    for (let x = -2000; x <= 2000; x += 3) for (let z = 0; z <= 4000; z += 13) {
      const v = outrun(x, z);
      mn = Math.min(mn, v); mx = Math.max(mx, v);
      sim = Math.max(sim, Math.abs(v - outrun(-x, z)));
      if (Math.abs(x) <= 700) plano = Math.max(plano, Math.abs(v));
    }
    assert.equal(plano, 0, `la cordillera no deja plano el borde de la pista (${plano})`);
    // ...y lo mismo con el borde que le pasa `drawMesh` (`xi`, el de adentro de la FILA, que es
    // de PANTALLA): la rampa tiene que nacer AHI y no en el respaldo del mundo, o si no el campo
    // cercano se queda sin cordillera (medido: 0.0px de relieve a z=700 con el 700 fijo).
    for (const x0 of [345, 520, 700]) {
      let pl = 0, hay = 0;
      for (let x = -2000; x <= 2000; x += 3) {
        const v = outrun(x, 900, x0);
        if (Math.abs(x) <= x0) pl = Math.max(pl, Math.abs(v)); else hay = Math.max(hay, Math.abs(v));
      }
      assert.equal(pl, 0, `con x0=${x0} la cordillera se mete dentro del borde de la fila (${pl})`);
      assert(hay > 0.5, `con x0=${x0} no hay cordillera fuera del borde (${hay})`);
    }
    assert(mn >= -1 && mx <= 1, `la cordillera se sale de -1..1 (${mn} .. ${mx})`);
    assert(mx > 0.8, `la cordillera no llega a la cresta (${mx}): no se veria`);
    assert.equal(sim, 0, "la cordillera no es simetrica: seria otra montana de cada lado");
    const crestas = (paso, z) => {
      let n = 0;
      for (let x = 260 + paso; x <= 1400 - paso; x += paso) {
        if (outrun(x, z) > outrun(x - paso, z) && outrun(x, z) >= outrun(x + paso, z)) n++;
      }
      return n;
    };
    for (const z of [300, 1500]) {
      const fina = crestas(1, z);
      assert(fina >= 1 && fina <= 3, `${fina} crestas por lado a z=${z}: es un peine, no una sierra`);
      assert.equal(crestas(90, z), fina, `la cordillera aliasa a z=${z} con las columnas de la malla`);
    }
    console.log(`outrun: ${crestas(1, 300)} crestas por lado, plano hasta 700 del mundo `
      + `(borde de pista en 255), rango ${mn.toFixed(2)}..${mx.toFixed(2)}`);
  }

  console.log(`fx: rayo de ${b5.length} puntos con ${forks(11).length} ramas `
    + `(desvio max ${desv.toFixed(3)} de ${tope.toFixed(3)}, `
    + `min ${peor.toFixed(1)} grados sobre la horizontal en 3 familias, `
    + `${peor6.toFixed(1)} en las ${fam6.size} de \`all\`), `
    + `${pyras(1, 14, 0.5).length} piramides de 2 caras (${ca.shade}/${cb.shade} de gris, `
    + `base ${(fuera / r5[0].r).toFixed(2)}r fuera de canto) y a p=0.5 llevan el `
    + `${(avance * 100).toFixed(0)}% del camino`);
}
