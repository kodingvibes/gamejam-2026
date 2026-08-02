// Genera un guion de obstaculos REALISTA y PASABLE para el nivel 3 (breathe) SIN jugar.
//
// Construye el guion a mano siguiendo el patron de los niveles 1 y 2:
//   - un CAMINO (carril libre de cajas) que se mueve de a un carril por fila, siguiendo la
//     estructura musical -> pasable por construccion (el solver de test-music.js lo verifica).
//   - los otros carriles se llenan de PAREDES de cajas de longitud controlada; las de 5+
//     se AHUECAN por dentro a `gap` (patron B + huecos + B, zanja minima de 3).
//   - en el camino se ponen `low`/`high` (saltos y slides) espaciados para que el aire
//     alcance, y `orbj` en los saltos encadenados.
//   - el break (f56-f63, el apagon `dark`) va VACIO.
//
// Uso: node gen-breathe-script.js
import { readFileSync, writeFileSync } from "node:fs";
import { grid, rowAt, timeOfRow, LEVELS } from "./music.js";

const doc = JSON.parse(readFileSync("./assets/breathe.schema.json", "utf8"));
const lv = LEVELS["breathe"];
const g = grid(doc);
const len = doc.track.trim.end - doc.track.trim.start;
const lanes = lv.lanes;
const ultima = rowAt(len - 1e-9, g);
const beat = g.beat;

function secOf(row) {
  if (row < 32) return "intro";
  if (row < 56) return "buildup";
  if (row < 64) return "break";
  if (row < 160) return "drop";
  if (row < 192) return "break2";
  return "outro";
}

// --- camino: carril libre de cajas por fila ---------------------------------
const path = [];
let lane = 1;
const TARGET = [1, 2, 0, 3];
for (let row = 0; row <= ultima; row++) {
  if (secOf(row) !== "break" && row % 4 === 0) {
    const t = TARGET[Math.floor(row / 16) % 4];
    if (lane < t) lane++;
    else if (lane > t) lane--;
  }
  path[row] = lane;
}

// --- densidad por seccion (cajas por fila) -----------------------------------
// Cuantas cajas (block) se ponen por fila en los carriles que no son el camino.
const DENSITY = { intro: 1.4, buildup: 2.0, break: 0, drop: 2.6, break2: 1.8, outro: 1.2 };

// --- construir la grilla: paredes de cajas -----------------------------------
// Por cada fila se bloquean `nBlock` carriles (los que no son el camino). Para que las
// paredes no sean todas largas (y no se ahuequen todas), se alterna: en la mitad de las
// filas se bloquean carriles "sueltos" y en la otra mitad se deja crecer la pared.
const gridMap = new Map();
for (let row = 0; row <= ultima; row++) {
  const sec = secOf(row);
  if (sec === "break") continue;
  const free = path[row];
  const nBlock = Math.min(3, Math.round(DENSITY[sec]));
  const others = [0, 1, 2, 3].filter((l) => l !== free);
  // determinista: rotar que carriles tapar, y dejar un hueco cada 4 filas para que las
  // paredes no sean continuas de punta a punta
  const skip = row % 4 === 3;
  const blocked = skip ? others.slice(0, Math.max(0, nBlock - 1)) : others.slice(0, nBlock);
  for (const l of blocked) gridMap.set(`${row},${l}`, { row, lane: l, kind: "block" });
}

// --- ahuecar las paredes de 5+ cajas seguidas --------------------------------
for (let lane = 0; lane < lanes; lane++) {
  let run = [];
  const flush = () => {
    if (run.length >= 5) {
      for (let i = 1; i < run.length - 1; i++) {
        gridMap.set(`${run[i]},${lane}`, { row: run[i], lane, kind: "gap" });
      }
    }
    run = [];
  };
  for (let r = 0; r <= ultima + 1; r++) {
    const d = gridMap.get(`${r},${lane}`);
    if (d && d.kind === "block") run.push(r);
    else flush();
  }
  flush();
}

// --- low/high en el camino (saltos y slides) ---------------------------------
const LOW_HIGH_EVERY = { intro: 8, buildup: 6, drop: 4, break2: 6, outro: 8 };
for (let row = 0; row <= ultima; row++) {
  const sec = secOf(row);
  if (sec === "break") continue;
  const every = LOW_HIGH_EVERY[sec];
  if (row % every !== 0) continue;
  const free = path[row];
  const key = `${row},${free}`;
  if (gridMap.has(key)) continue;
  const kind = Math.floor(row / every) % 2 === 0 ? "low" : "high";
  gridMap.set(key, { row, lane: free, kind });
}

// --- jump orbs en los saltos encadenados -------------------------------------
// En el drop, donde el camino salta seguido, se ponen JUMP ORBS (kind "orbj") para
// encadenar los saltos, como en los niveles 1 y 2. Los orbs no chocan (el solver los
// excluye), asi que no afectan la pasabilidad: son el "mantene ↑ para saltar en el aire".
const lows = [...gridMap.values()].filter((d) => d.kind === "low").sort((a, b) => a.row - b.row);
for (let i = 1; i < lows.length; i++) {
  const a = lows[i - 1], b = lows[i];
  if (a.lane !== b.lane) continue;
  if (b.row - a.row > 1) continue;
  gridMap.set(`${b.row},${b.lane}`, { row: b.row, lane: b.lane, role: "orb", kind: "orbj" });
}
// ademas, en el drop, un par de orbs sueltos en el camino donde hay un low: el jugador
// salta y puede agarrar el orb para encadenar. Se ponen en filas con low del camino.
let orbs = 0;
for (let row = 0; row <= ultima && orbs < 3; row++) {
  if (secOf(row) !== "drop") continue;
  const free = path[row];
  const key = `${row},${free}`;
  const cur = gridMap.get(key);
  if (cur && cur.kind === "low" && row + 1 <= ultima) {
    const nk = `${row + 1},${free}`;
    if (!gridMap.has(nk)) {
      gridMap.set(nk, { row: row + 1, lane: free, role: "orb", kind: "orbj" });
      orbs++;
    }
  }
}

// --- ensamblar y ordenar -----------------------------------------------------
const final = [...gridMap.values()].sort((a, b) => a.row - b.row || a.lane - b.lane);
const byKind = {};
for (const d of final) byKind[d.kind] = (byKind[d.kind] ?? 0) + 1;

const fmt = (script) =>
  script.map((d) => (d.role
    ? `      { row: ${d.row}, lane: ${d.lane}, role: "${d.role}", kind: "${d.kind}" },`
    : `      { row: ${d.row}, lane: ${d.lane}, kind: "${d.kind}" },`)).join("\n");

const out = `// Guion del nivel 3 (breathe), generado procedimentalmente (no dictado bailando).
// Sigue la estructura musical: ${final.length} directivas
// (${byKind.block ?? 0} block, ${byKind.gap ?? 0} gap, ${byKind.low ?? 0} low,
// ${byKind.high ?? 0} high, ${byKind.orbj ?? 0} orb). Pasable por construccion (camino de
// un carril que se mueve de a uno + paredes ahuecadas + low/high espaciados); el solver de
// test-music.js lo verifica.
script: [
${fmt(final)}
],
`;

writeFileSync("./breathe-script.txt", out);
console.log(`directivas: ${final.length} (${byKind.block ?? 0} block, ${byKind.gap ?? 0} gap, ${byKind.low ?? 0} low, ${byKind.high ?? 0} high, ${byKind.orbj ?? 0} orb)`);
console.log("escrito en ./breathe-script.txt");
