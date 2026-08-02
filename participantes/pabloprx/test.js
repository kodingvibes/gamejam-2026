// node test.js  -> falla si un obstaculo deja de ser esquivable
import assert from "node:assert";
import {
  KINDS, PLAYER_Z, LANE_X, PLAYER_H, SLIDE_H, JUMP_V, SLIDE_T, DASH_T, DASH_Y, DASH_VY,
  hits, stepPlayer, ride,
} from "./physics.js";
import { CAMS } from "./cams.js";
import { pose } from "./avatar.js";

// simula un obstaculo acercandose a velocidad v; reacciona cuando faltan `trig` segundos
function dodge(kind, v, trig, g = 1) {
  const k = KINDS[kind];
  let z = 3000, p = { y: 0, vy: 0, sliding: 0 }, acted = false;
  for (let i = 0; i < 2000 && z > -200; i++) {
    const dt = 1 / 60;
    if (!acted && (z + k.d / 2 - PLAYER_Z) / v <= trig) {
      acted = true;
      if (kind === "low" || kind === "gap") p.vy = g * JUMP_V; else p.sliding = SLIDE_T;
    }
    p = stepPlayer(p, dt, g);
    z -= v * dt;
    if (hits(kind, z, p.y, p.sliding, g)) return false;
  }
  return true;
}

// tiempo de aire de un salto: de despegar a volver a la superficie
function airTime(g = 1, dt = 1 / 240) {
  let p = { y: 0, vy: g * JUMP_V, sliding: 0 }, t = 0, peak = 0;
  do { p = stepPlayer(p, dt, g); t += dt; peak = Math.max(peak, g * p.y); } while (g * p.y > 0);
  return { t, peak };
}

// ventana de reaccion (en segundos) para cada obstaculo/velocidad
function window_(kind, v, g = 1) {
  let n = 0;
  for (let t = 0.02; t <= 0.6; t += 0.02) if (dodge(kind, v, t, g)) n++;
  return +(n * 0.02).toFixed(2);
}

for (const v of [325, 650, 1300, 1900, 3250]) {          // x0.5 .. x5 del rango de juego
  for (const kind of ["low", "high"]) {
    const w = window_(kind, v);
    console.log(`v=${v} ${kind}: ventana ${w}s`);
    assert(w >= 0.1, `${kind} a v=${v} es casi imposible de esquivar (${w}s)`);
  }
  assert(!dodge("block", v, 0.2), `block no deberia poder saltarse a v=${v}`);
}

// --- gap: hueco en el suelo. Se salta (no se desliza), y una zanja de 3 filas seguidas
// no se cruza: por eso cambiar una pared de cajas por una zanja no baja la dificultad,
// solo deja de tapar la vista.
for (const v of [650, 1300, 1900]) {
  const w = window_("gap", v);
  assert(w >= 0.1, `gap a v=${v} es casi imposible de saltar (${w}s)`);
  for (const g of [1, -1]) assert(hits("gap", PLAYER_Z - KINDS.gap.d / 2, 0, SLIDE_T, g),
    `deslizarse sobre un gap deberia matar (g=${g})`);
}
// abajo de esta velocidad el hueco es mas largo que el salto y no hay forma de pasarlo.
// El nivel corre a 700; `V` (feel) hacia abajo ya rompia el nivel antes de esto.
const vMin = [...Array(60).keys()].map((i) => 300 + i * 10).find((v) => window_("gap", v) >= 0.1);
console.log(`gap: ventana ${window_("gap", 650)}s a v=650, mata de pie y agachado, `
  + `imposible por debajo de v=${vMin}`);
// medido: 460. La v del nivel es 700 y `V` la baja hasta 350, donde el nivel ya estaba
// roto igual (61 golpes con la grabacion, ver NOTAS). Si esto sube, el hueco es muy profundo.
assert(vMin <= 500, `el gap necesita v>=${vMin}: demasiado para el rango de juego`);
// zanja: N huecos seguidos, uno por beat. Se prueba saltando en el mejor momento posible.
function trench(n, v, beat = 0.4615) {
  const step = beat * v;
  for (let trig = 0.02; trig <= 0.6; trig += 0.01) {
    let z = 3000, p = { y: 0, vy: 0, sliding: 0 }, next = 0, dead = false;
    for (let i = 0; i < 4000 && z > -n * step - 400; i++) {
      const dt = 1 / 240;
      // salta en cuanto puede: si esta en el suelo y el proximo hueco esta a `trig`
      if (p.y === 0 && next < n && (z - next * step + KINDS.gap.d / 2 - PLAYER_Z) / v <= trig) {
        p.vy = JUMP_V; next++;
      }
      p = stepPlayer(p, dt);
      z -= v * dt;
      for (let j = 0; j < n; j++) if (hits("gap", z - j * step, p.y, p.sliding)) { dead = true; break; }
      if (dead) break;
    }
    if (!dead) return true;
  }
  return false;
}
assert(trench(1, 700), "un hueco suelto tiene que poder saltarse");
assert(!trench(3, 700), "una zanja de 3 huecos no deberia cruzarse (seria mas facil que la pared)");
// por eso `music.js` solo convierte el INTERIOR de paredes de 5+ filas: la zanja mas corta
// que genera es de 3, y desde 3 no se cruza. Si esto cambia, la pared se vuelve pasable.
console.log(`zanja: se cruza hasta ${[1, 2, 3, 4, 5].filter((n) => trench(n, 700)).length} huecos seguidos`);

// --- gravedad invertida: mismo juego, del otro lado del piso ---
const up = airTime(1), down = airTime(-1);
console.log(`aire: g=1 ${up.t.toFixed(4)}s pico ${up.peak.toFixed(1)} | g=-1 ${down.t.toFixed(4)}s pico ${down.peak.toFixed(1)}`);
assert(Math.abs(up.t - down.t) < 1e-9, "el tiempo de aire cambia con la gravedad");
assert(Math.abs(up.peak - down.peak) < 1e-9, "el salto no llega igual de lejos hacia el techo");
// y hacia el techo la y es NEGATIVA: no es el mismo salto disfrazado
{
  const p = stepPlayer({ y: 0, vy: -JUMP_V, sliding: 0 }, 1 / 60, -1);
  assert(p.y < 0, `con g=-1 el salto tiene que ir a y<0, dio ${p.y}`);
  assert.equal(stepPlayer({ y: -1, vy: -10, sliding: 0 }, 1, -1).y, 0, "no frena en el techo");
}
// esquivar tiene que dar exactamente lo mismo de cabeza
for (const v of [325, 1300, 3250]) {
  for (const kind of ["low", "high"]) {
    assert.equal(window_(kind, v), window_(kind, v, -1), `la ventana de ${kind} cambia con la gravedad a v=${v}`);
  }
}

// --- orb + dash sostenido ---
// mantener: sube a DASH_Y y se queda ahi hasta que se agota el dash
{
  const dt = 1 / 240;
  let p = { y: 0, vy: 0, sliding: 0, dash: DASH_T }, t = 0, top = 0;
  while (p.dash > 0) { p = stepPlayer(p, dt, 1, true); t += dt; top = Math.max(top, p.y); }
  assert(Math.abs(t - DASH_T) < dt * 2, `el dash duro ${t.toFixed(3)}s, no ${DASH_T}s`);
  assert.equal(top, DASH_Y, `el dash no se queda en DASH_Y (${top})`);
  assert.equal(p.y, DASH_Y, "el dash pierde altura sin motivo");
  const rise = DASH_Y / DASH_VY;
  assert(Math.abs(stepPlayer({ y: 0, vy: 0, sliding: 0, dash: DASH_T }, rise, 1, true).y - DASH_Y) < 1e-9,
    "tarda otra cosa en subir a la altura de crucero");
  // soltar lo corta: cae y toca el piso
  let q = stepPlayer(p, dt, 1, false);
  assert.equal(q.dash, 0, "soltar no corta el dash");
  let fall = 0;
  while (q.y > 0) { q = stepPlayer(q, dt, 1, false); fall += dt; }
  assert(fall < 0.3, `tarda ${fall.toFixed(3)}s en caer desde el dash`);
  // de cabeza el dash va al otro lado, misma altura
  let r = { y: 0, vy: 0, sliding: 0, dash: DASH_T };
  for (let i = 0; i < 200; i++) r = stepPlayer(r, dt, -1, true);
  assert.equal(r.y, -DASH_Y, `el dash invertido quedo en ${r.y}`);
  console.log(`dash: ${DASH_T}s a y=${DASH_Y} (sube en ${rise.toFixed(3)}s, cae en ${fall.toFixed(3)}s)`);
}
// el orb no es un obstaculo: se toca corriendo, en el piso y en el aire
{
  const zc = PLAYER_Z - KINDS.orb.d / 2;   // centrado en el jugador
  assert(hits("orb", zc, 0, 0), "el orb no se puede tocar corriendo");
  assert(hits("orb", zc, 0, 0, -1), "el orb no se puede tocar de cabeza");
  assert(!hits("orb", zc + 400, 0, 0), "el orb engancha de lejos");
}
// --- las tres camaras: el mundo es el mismo, cambia de donde se mira ---
{
  const [back, side, fp] = CAMS;
  const W = 900, H = 640;
  // escena de mentira: proj/frame solo leen estos campos. songT/dash entran porque la 1a
  // persona tiene cadencia de zancada (bobY/bobX salen del tiempo de la cancion).
  const scn = (o = {}) => ({ scale: { width: W }, roll: 0, grav: 1, x: 0, y: 0, songT: 0, dash: 0, ...o });
  const at = (c, S, x, y, z) => { c.frame.call(S, W, H); return c.proj.call(S, x, y, z); };

  assert.equal(CAMS.length, 3);
  for (const c of CAMS) {   // arriba es arriba y la escala es positiva en las tres
    const S = scn(), lo = at(c, S, 0, 0, 1500), hi = at(c, S, 0, 200, 1500);
    assert(hi.y < lo.y, `en "${c.id}" el eje y no apunta arriba`);
    assert(lo.s > 0 && isFinite(lo.x) && isFinite(lo.y), `en "${c.id}" proj da basura`);
  }

  const B = scn();
  assert.equal(at(back, B, 0, 0, 720).x, W / 2, "atras: el centro de la pista se movio");
  assert(at(back, B, 0, 0, 4000).y < at(back, B, 0, 0, 800).y, "atras: lo lejano no sube al horizonte");

  const S = scn();
  const s0 = at(side, S, 0, 0, PLAYER_Z), s1 = at(side, S, 0, 0, PLAYER_Z + 700);
  const s2 = at(side, S, 0, 0, PLAYER_Z + 1400);
  assert(s0.x < s1.x && s1.x < s2.x, "de lado los obstaculos no entran por la derecha");
  assert(Math.abs((s1.x - s0.x) - (s2.x - s1.x)) < 1e-9, "de lado no es ortografica");
  assert(s0.x < W * 0.3, "de lado el jugador no esta a la izquierda");
  // de lado es 2D plano: los tres carriles COLAPSAN en la misma linea a proposito
  // (geometry dash). Por eso los tramos con `cam: "lado"` son zonas de un solo carril:
  // si no, dos cajas de carriles distintos se dibujarian una encima de la otra.
  const l0 = at(side, S, LANE_X[0], 0, PLAYER_Z), l2 = at(side, S, LANE_X[2], 0, PLAYER_Z);
  assert(l0.x === l2.x && l0.y === l2.y, "de lado los carriles no colapsan: no es 2D");
  assert(side.flat, "de lado falta flat: el renderer dibujaria carriles que no existen");

  const P = scn({ x: LANE_X[2], y: 40 });
  fp.frame.call(P, W, H);
  const eye = fp.proj.call(P, P.x, P.camY, 3000);
  assert(Math.abs(eye.x - W / 2) < 1e-9 && Math.abs(eye.y - P.horizon) < 1e-9,
    "1a persona: los ojos no miran al centro del horizonte");
  assert(fp.zn > PLAYER_Z, "1a persona: se dibujaria lo que ya quedo detras");
  assert(!fp.body, "1a persona: se dibuja el muneco encima de la camara");
  const F = scn({ grav: -1 });
  assert(at(fp, F, 0, 0, 1500).y < F.horizon, "1a persona: de cabeza la pista no queda arriba");
  // CADENCIA: en el suelo la camara se mueve con songT (es lo que hace que se note que
  // corres); en el aire no hay pisadas, asi que el balanceo se apaga. Sin esto la vista es
  // una foto y el eje no lo detecta ningun otro assert.
  {
    const suelo = [0, 0.12, 0.23].map((t) => at(fp, scn({ songT: t }), 0, 0, PLAYER_Z + 400));
    const dx = Math.max(...suelo.map((p) => p.x)) - Math.min(...suelo.map((p) => p.x));
    const dy = Math.max(...suelo.map((p) => p.y)) - Math.min(...suelo.map((p) => p.y));
    assert(dx > 4 && dy > 4, `1a persona: la camara no tiene cadencia (dx=${dx.toFixed(1)} dy=${dy.toFixed(1)})`);
    const aire = [0, 0.12, 0.23].map((t) => at(fp, scn({ songT: t, y: 80 }), 0, 0, PLAYER_Z + 400));
    assert(aire.every((p) => p.x === aire[0].x && p.y === aire[0].y),
      "1a persona: en el aire sigue habiendo pisadas");
    console.log(`1a persona: cadencia ${dx.toFixed(0)}px en x y ${dy.toFixed(0)}px en y a 400 de los ojos`);
  }
  console.log(`camaras: ${CAMS.map((c) => c.id).join(" / ")} (lado: ${(s1.x - s0.x).toFixed(0)}px por 700z)`);
}

// --- el flote: chico y funcion de la cancion (no hay paso que sincronizar) ---
{
  const beat = 0.4615, bar = beat * 4;
  for (const t2 of [0, 1.3, 7.9, 40.2]) {
    const r = ride(t2, beat);
    assert(Math.abs(r.hover) <= 1 && Math.abs(r.arm) <= 1, "el flote se fue de rango");
    assert(Math.abs(r.hover - ride(t2 + bar, beat).hover) < 1e-9,
      "el flote no cierra en el compas");
  }
  // brazos y flote NO pueden ir a la misma frecuencia: si laten igual parece juguete a cuerda
  assert(Math.abs(ride(bar / 2, beat).arm - ride(bar / 2, beat).hover) > 0.3,
    "brazos y flote van iguales");
  console.log(`tabla: flote de 1 ciclo por compas (${bar.toFixed(2)}s), brazos a 2/3 de eso`);
}

// --- el muneco tiene que caber en SU hitbox: lo que se dibuja es lo que se choca
{
  const ext = (st, soloCuerpo = false) => {
    let lo = 9, hi = -9;
    for (const z of pose(st)) {
      if (soloCuerpo && z.poly) continue;   // la tabla es suelo: su cola cae por debajo de los pies
      const [a, b] = z.disc ? [z.disc[1] - z.disc[2], z.disc[1] + z.disc[2]]
        : z.seg ? [Math.min(z.seg[1], z.seg[3]) - z.w, Math.max(z.seg[1], z.seg[3]) + z.w]
        : z.poly ? [Math.min(...z.poly.map((q) => q[1])), Math.max(...z.poly.map((q) => q[1]))]
        : [z.rect[1], z.rect[1] + z.rect[3]];
      lo = Math.min(lo, a); hi = Math.max(hi, b);
    }
    return { lo, hi };
  };
  for (let i = 0; i < 12; i++) {
    const { lo, hi } = ext({ arm: i / 6 - 1 }, true);
    assert(hi > 0.94 && hi < 1.04, `en la tabla el muneco mide ${hi.toFixed(3)} y no 1`);
    assert(lo > -0.05, `el cuerpo se hunde ${lo.toFixed(3)} en la tabla`);
  }
  // La tabla APUNTA hacia adelante: derecho se ve casi de canto y al cruzar de carril ensena
  // la panza. Si el ancho no crece con el giro es que se dibuja plana, sin perspectiva, y
  // vuelve a ser una tabla de planchar cruzada.
  const deck = (yaw) => {
    const q = pose({ yaw }).filter((z) => z.poly)[2].poly;
    return { w: Math.max(...q.map((a) => a[0])) - Math.min(...q.map((a) => a[0])),
      h: Math.max(...q.map((a) => a[1])) - Math.min(...q.map((a) => a[1])) };
  };
  const d0 = deck(0), d6 = deck(0.6);
  assert(d6.w > d0.w * 1.8, `girando la tabla no se abre (${d0.w.toFixed(2)} -> ${d6.w.toFixed(2)})`);
  assert(d0.h > 0.15, "derecha la tabla se dibuja plana: no hay perspectiva");
  const ag = ext({ sliding: true }).hi, caja = SLIDE_H / PLAYER_H;
  assert(ag < caja * 1.08, `agachado mide ${ag.toFixed(3)} y su hitbox ${caja}: sobresale`);
  // en el aire la tabla va PEGADA a los pies: si se queda en el suelo se lee como que la
  // perdiste, y ese fue el primer intento
  assert(ext({ air: true, rising: true }).lo > -0.02, "subiendo la tabla se queda en el suelo");
  console.log(`muneco: 1.00 en la tabla, ${ag.toFixed(2)} agachado (hitbox ${caja}), `
    + `tabla ${d0.w.toFixed(2)} de ancho derecho y ${d6.w.toFixed(2)} girando, `
    + `${pose({}).length} piezas x 3 pasadas`);
}

console.log("ok");
