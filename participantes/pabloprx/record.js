// Grabacion de gameplay (tecla Y): corres la cancion SIN obstaculos y lo que hiciste se
// convierte en el guion. Puro y testeable: el tiempo de cada accion es songT, nunca Date.now.
import { JUMP_V, GRAVITY, SLIDE_T, KINDS, PLAYER_D, hits, stepPlayer } from "./physics.js";
import { timeOfRow, rowAt, zOf } from "./music.js";

// Cuanto ANTES del impacto se hace cada accion. Ya no se usa para colocar nada (el guion
// sale del negativo, no de la accion), pero marca la ventana en la que un hueco es tuyo.
export const LEAD = { jump: JUMP_V / -GRAVITY, slide: SLIDE_T / 2, lane: JUMP_V / -GRAVITY };

// Reconstruye el estado del jugador frame a frame a partir de lo grabado.
// Mismas reglas que la escena: saltar solo desde el suelo, el carril cambia al instante.
// `gr` = signo de la gravedad: con -1 el mundo entero (jugador y cajas) se espeja en y=0,
// asi que la misma grabacion tiene que esquivar lo mismo. Es lo que prueba que una zona de
// gravedad invertida no invalida el guion.
export function replay(rec, end, dt = 1 / 240, gr = 1) {
  const acts = [...rec].sort((a, b) => a.t - b.t);
  let p = { y: 0, vy: 0, sliding: 0 }, lane = acts[0]?.lane ?? 1, i = 0;
  const path = [];
  for (let k = 0; k * dt <= end; k++) {
    while (i < acts.length && acts[i].t <= k * dt) {
      const a = acts[i++];
      if (a.a === "jump" && gr * p.y <= 0) { p.vy = gr * JUMP_V; p.sliding = 0; }
      if (a.a === "slide") { if (gr * p.y > 0) p.vy = -gr * JUMP_V; p.sliding = SLIDE_T; }
      lane = a.a === "lane" ? a.to : a.lane;
    }
    p = stepPlayer(p, dt, gr);
    path.push({ y: p.y, sliding: p.sliding, lane });
  }
  return path;
}

// True si esa corrida se comia ese obstaculo. Solo mira los frames en los que el
// obstaculo esta encima del jugador: el resto es tiempo perdido y aca se prueban miles.
function eats(path, c, speed, dt, gr = 1) {
  const half = (KINDS[c.kind].d + PLAYER_D) / 2 / speed + dt;
  const a = Math.max(0, Math.floor((c.t - half) / dt));
  const b = Math.min(path.length - 1, Math.ceil((c.t + half) / dt));
  for (let k = a; k <= b; k++) {
    if (path[k].lane !== c.lane) continue;
    if (hits(c.kind, zOf(c, k * dt, speed), path[k].y, path[k].sliding, gr)) return true;
  }
  return false;
}

// Replay de la grabacion contra una lista de obstaculos: devuelve los que te comerias.
// Los orbs no chocan, asi que no cuentan.
export function simulate(rec, cues, speed, dt = 1 / 240, gr = 1) {
  const list = cues.filter((c) => c.role !== "orb");
  const path = replay(rec, Math.max(0, ...list.map((c) => c.t)) + 1, dt, gr);
  return list.filter((c) => eats(path, c, speed, dt, gr)).map((c) => c.n);
}

// Lo grabado -> el NEGATIVO de la corrida: se rellena todo el hueco por el que NO pasaste.
// En cada fila y carril se prueba primero una caja entera; si tu vuelta se la comia, se
// prueba el hueco por el que pasaste (low si ibas por el aire, high si ibas agachado); y
// si tampoco entra es que ahi estabas vos parado, y ahi no va nada.
// Sale un tunel con la forma exacta de tu vuelta: denso, y jugable por construccion.
const ORDER = ["block", "low", "high"];

// Saltos encadenados: dos saltos tan seguidos que el segundo sale casi sin tocar el suelo.
// Medido sobre la grabacion del 30/07: el aire dura 0.4542s y el beat 0.4615s, o sea que
// saltar en el beat siguiente deja una ventana de 8ms. Ahi va un JUMP ORB (kind "orbj"):
// se agarra manteniendo ↑/W y te da el salto en el aire, como en geometry dash.
// El corte esta en 1.5 beats porque los huecos medidos se parten solos ahi:
// 0.546 y 0.633s de un lado, 0.882s y para arriba del otro.
export const CHAIN = 1.5;
export function chains(rec, g) {
  const j = rec.filter((a) => a.a === "jump").sort((a, b) => a.t - b.t);
  const out = [];
  for (let i = 1; i < j.length; i++) {
    if (j[i].t - j[i - 1].t > CHAIN * g.beat) continue;
    out.push({ row: rowAt(j[i].t, g), lane: j[i].lane, role: "orb", kind: "orbj" });
  }
  return out;
}

// `from` = primera fila que se DICTA. El replay sigue arrancando en 0 (hace falta el estado
// del jugador), pero no se emite ni una directiva antes de esa fila: asi lo que ya esta
// escrito a mano en el guion no se puede pisar por accidente, y lo exportado se PEGA al final.
// `n` = carriles del nivel (`lanes` en LEVELS). Default 3, que es lo que asumia antes.
export function toScript(rec, g, speed, len, dt = 1 / 240, from = 0, n = 3) {
  const path = replay(rec, len, dt);
  const orbs = chains(rec, g).filter((o) => o.row >= from);
  const out = [];
  let solid = 0;
  for (let row = Math.max(0, from, rowAt(0, g)); row <= rowAt(len, g); row++) {
    const t = timeOfRow(row, g);
    if (t < 0 || t > len) continue;
    for (let lane = 0; lane < n; lane++) {
      // donde va un orb no va obstaculo: la celda es tuya, es por donde pasaste saltando
      if (orbs.some((o) => o.row === row && o.lane === lane)) continue;
      const kind = ORDER.find((k) => !eats(path, { t, lane, kind: k }, speed, dt));
      if (kind) out.push({ row, lane, kind });
      if (kind === "block") solid++;
    }
  }
  return { script: [...out, ...orbs].sort((a, b) => a.row - b.row || a.lane - b.lane), solid, orbs: orbs.length, from, cells: (rowAt(len, g) + 1 - from) * n };
}

export const fmt = (script) =>
  script.map((d) => (d.role
    ? `      { row: ${d.row}, lane: ${d.lane}, role: "${d.role}", kind: "${d.kind}" },`
    : `      { row: ${d.row}, lane: ${d.lane}, kind: "${d.kind}" },`)).join("\n");
