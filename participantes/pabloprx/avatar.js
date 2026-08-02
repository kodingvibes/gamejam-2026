// El muneco, aparte del juego: aca no hay escena, ni camara, ni `songT`. Entra un estado y
// salen piezas en unidades de SU ALTO (1 = la cabeza, 0 = los pies), y el que dibuja pone la
// perspectiva. Por eso el mismo codigo sirve en las tres camaras y en `tools/avatar.html`,
// que es el banco donde se toca la pose sin el nivel encima.
//
// Vectores y no un sprite recortado: los 4 dibujos de carrera del sheet se diferencian 8-12%
// de silueta (medido sobre las mascaras alfa), o sea que no son un ciclo. Aca la pose es
// CONTINUA: no hay frame rate, hay funcion.

// Colores. El casco es cromado (tres grises + brillo), lo demas sale del sheet de diseno
// (`assets/player/sheet-v1.png`): capucha teal, mochila oscura con el eq verde, zapatillas.
export const PJ_COL = {
  hood: 0x16b8a8, hoodDark: 0x0f8f84, dark: 0x1e1b3a, pack: 0x141329, packLit: 0x262450,
  pant: 0x232244, violet: 0x8a4dff, cyan: 0x22d3ee, shoe: 0xe6e6ee, eq: 0x34d399,
  line: 0x090814,
  crom: 0x9aa3b8, cromLit: 0xdfe5f0, cromTop: 0xffffff, cromDark: 0x5b6377,
};

const lerp = (a, b, t) => a + (b - a) * t;

// Pseudo-3D DENTRO del muneco. `d` es profundidad: >0 se aleja de la camara. Lo lejano se
// dibuja mas chico y mas ARRIBA, que es exactamente lo que hace la pista, asi que la tabla
// se lee apuntando hacia adelante ("|") y no cruzada ("----"). Sin esto un snowboard visto
// de atras parece una tabla de planchar.
// RISE es la ALTURA DE LA CAMARA: cuanto sube en pantalla lo que se aleja. Con 0.115 la
// tabla apuntando hacia adelante se veia de canto y desaparecia; con 0.22 se le ve la panza,
// que es como se ve desde CAM_Y en el juego.
const DEEP = 0.5, RISE = 0.22;
const f3 = (d) => 1 / (1 + d * DEEP);
const p3 = (x, y, d) => { const f = f3(d); return [x * f, y * f + d * RISE]; };

// La tabla, en el plano del suelo y APUNTANDO HACIA ADELANTE. `yaw` la gira: 0 = derecho
// (de atras se ve casi de canto, corta y angosta) y hasta ~0.6 rad cuando cruzas de carril,
// que es cuando ensena la panza. El resplandor de abajo es lo que la hace flotar: sin el es
// una tabla apoyada.
// 0.40 y no 0.52: una tabla de verdad mide casi lo que el que la lleva, pero cruzada llena
// media pantalla y en el heli se comia al muneco.
const BOARD_L = 0.40, BOARD_W = 0.115;
function tablaPts(y, yaw, k = 1, kw = null, dOff = 0, flip = 1) {
  const sn = Math.sin(yaw), cs = Math.cos(yaw);
  const L = BOARD_L * k, W = BOARD_W * (kw ?? k) * flip;
  return [[L, 0], [L * 0.72, W], [-L * 0.72, W], [-L, 0], [-L * 0.72, -W], [L * 0.72, -W]]
    .map(([a, b]) => p3(a * sn + b * cs, y, a * cs - b * sn + dOff));
}
// `dOff` la manda hacia adelante (derrapando) y `flip` le aplasta el ancho: es el truco de
// girarla sobre su eje largo, y cuando pasa por 0 se ve de canto, que ES el flip.
function tabla(p, y, yaw, dOff = 0, flip = 1) {
  const F = Math.abs(flip) < 0.07 ? Math.sign(flip || 1) * 0.07 : flip;
  const A = [y - 0.015, y + 0.005, y + 0.035, y + 0.052];
  p.push({ poly: tablaPts(A[0], yaw, 1.18, null, dOff, F), c: PJ_COL.cyan, a: 0.20, noShade: true });
  p.push({ poly: tablaPts(A[1], yaw, 1.06, null, dOff, F), c: PJ_COL.cyan, a: 0.40,
    noShade: true, neon: 1 });
  p.push({ poly: tablaPts(A[2], yaw, 1.06, null, dOff, F), c: PJ_COL.pack });
  // la raya es una FRANJA por el medio, no la tabla entera pintada: el deck es oscuro y lo
  // que se ve de color es el filo
  p.push({ poly: tablaPts(A[3], yaw, 0.9, 0.2, dOff, F), c: PJ_COL.violet, a: 0.75,
    noShade: true, neon: 1 });
}

// El pie sobre la tabla: apunta hacia donde apunta la tabla y se achica con la distancia.
function pie2(p, pie, yaw, s) {
  const l = 0.10 * pie.z, sn = Math.sin(yaw), cs = Math.cos(yaw);
  const ax = pie.x, ay = pie.y;
  // apuntando hacia adelante el pie se escorza, pero no a cero: por debajo de la mitad se
  // lee como un punto y no como una zapatilla. Lo que se pierde de largo se va a `dy`.
  const dx = l * (0.5 * sn + 0.55 * Math.sign(sn || 1) * 0), dy = l * cs * 0.42;
  const ex = dx + sn * l * 0.6;
  p.push({ seg: [ax - ex * 0.5, ay - dy * 0.5, ax + ex * 0.5, ay + dy * 0.5],
    w: 0.042 * pie.z, c: PJ_COL.shoe });
  p.push({ seg: [ax - ex * 0.5, ay - dy * 0.5 + 0.03 * pie.z,
    ax + ex * 0.5, ay + dy * 0.5 + 0.03 * pie.z], w: 0.014 * pie.z, c: PJ_COL.violet });
}

// El pie: capsula del talon a la punta, con la banda violeta encima. Va aparte porque gira,
// y una zapatilla que no gira es un ladrillo pegado a la pierna.
function pie(p, x, y, s, ang, z = 1) {
  const l = 0.075 * z, c = Math.cos(ang), sn = Math.sin(ang);
  const x0 = x - s * l * 0.35 * c, y0 = y + 0.03 * z + s * l * 0.35 * sn * s;
  const x1 = x + s * l * 0.65 * c, y1 = y + 0.03 * z - l * 0.65 * sn;
  p.push({ seg: [x0, y0, x1, y1], w: 0.032 * z, c: PJ_COL.shoe });
  p.push({ seg: [x0, y0 + 0.028 * z, x1, y1 + 0.028 * z], w: 0.012 * z, c: PJ_COL.violet });
}

// --- la pose. Todo en unidades del alto del muneco, x=0 en el eje del cuerpo.
// De espaldas, lo que se lee de una carrera NO es el balanceo adelante-atras (eso es
// profundidad, no se ve): es que un pie SE LEVANTA y la rodilla se dobla mientras el otro
// pisa. Por eso el ciclo mueve alto, separacion y flexion, nunca angulo de cadera.
export function pose(st) {
  const { arm = 0, air = false, rising = false, sliding = false, land = 0 } = st;
  const p = [];
  const cap = (x0, y0, x1, y1, w, c) => p.push({ seg: [x0, y0, x1, y1], w, c });
  const rect = (x, y, w, h, c, r = 0.02) => p.push({ rect: [x, y, w, h], r, c });
  const disc = (x, y, r, c) => p.push({ disc: [x, y, r], c });

  if (sliding) {
    // Deslizar es un DERRAPE: la tabla se cruza y sale hacia adelante, el cuerpo se tira
    // atras y abajo y las piernas se estiran hacia ella. Cruzada es la unica forma de que se
    // vea (de frente y lejos se escondia detras del cuerpo), y ademas es lo que hace uno de
    // verdad para frenar. Agachandose sin mas parecia que te sentabas.
    const cruz = 1.15 * (st.yaw >= 0 ? 1 : -1);   // hacia el lado al que ibas
    const ade = 0.16, hip = 0.115;
    const pieDe2 = (a) => {
      const x = a * Math.sin(cruz), d = a * Math.cos(cruz) + ade;
      const [px, py] = p3(x, 0.075, d);
      return { x: px, y: py, z: f3(d) };
    };
    const pies = [pieDe2(0.2), pieDe2(-0.2)];
    for (const pi of pies) {   // muslos
      cap(Math.sign(pi.x || 1) * 0.05, hip, lerp(Math.sign(pi.x || 1) * 0.05, pi.x, 0.55),
        lerp(hip, pi.y, 0.5) + 0.015, 0.052 * lerp(1, pi.z, 0.5), PJ_COL.pant);
    }
    tabla(p, 0, cruz, ade);
    for (const pi of pies) {   // pantorrillas y pies, encima de la tabla
      cap(lerp(Math.sign(pi.x || 1) * 0.05, pi.x, 0.55), lerp(hip, pi.y, 0.5) + 0.015,
        pi.x, pi.y + 0.02 * pi.z, 0.045 * pi.z, PJ_COL.pant);
      pie2(p, pi, cruz, 1);
    }
    // la mano de adentro va al piso (es lo que hace uno derrapando) y la otra se abre
    for (const i of [0, 1]) {
      const s2 = i ? 1 : -1;
      const bajo = s2 * Math.sign(cruz) < 0;
      cap(s2 * 0.15, 0.25, s2 * 0.27, bajo ? 0.13 : 0.21, 0.042, PJ_COL.hoodDark);
      cap(s2 * 0.27, bajo ? 0.13 : 0.21, s2 * (bajo ? 0.34 : 0.36), bajo ? 0.02 : 0.17,
        0.038, PJ_COL.hoodDark);
      disc(s2 * (bajo ? 0.34 : 0.36), bajo ? 0.01 : 0.16, 0.045, PJ_COL.dark);
    }
    torso(p, { y0: 0.04, y1: 0.29, ancho: 0.35, lean: 0 });
    cabeza(p, 0.275, 0);
    return p;
  }

  // --- LA TABLA. Aca no hay ciclo de piernas a proposito: es lo que hace Subway Surfers
  // con el hoverboard y Jetpack Joyride con la mochila. De espaldas una caminata son dos
  // palos que suben y bajan, y a 100px de alto nadie lee una rodilla. Parado sobre algo, el
  // movimiento lo hacen la tabla girando, la estela y el bote, que si se leen.
  //
  // Los pies van UNO DELANTE DEL OTRO sobre la tabla (que apunta hacia adelante), no al lado:
  // por eso del pie de adelante se ve poco, y esta mas arriba y mas chico. Eso es el escorzo,
  // y es lo que hace que se lea como snowboard y no como equilibrista.
  const flex = 0.5 + 0.5 * arm;   // respira, no camina
  const yaw = st.yaw ?? 0;
  // TRUCOS. Solo en el aire y solo dibujo: la hitbox no se entera. `tp` es el avance del
  // salto (0 despegue, 1 aterrizaje) y sale de `vy`, o sea que no hace falta guardar nada.
  //   heli  = la tabla gira una vuelta entera bajo los pies (shuvit)
  //   flip  = gira sobre su eje largo: al pasar por el canto desaparece, y eso es el flip
  //   grab  = no gira, la agarras con una mano
  const tp = air ? (st.tp ?? 0) : 0;
  const truco = air ? st.trick : null;
  const yawT = truco === "heli" ? yaw + Math.PI * 2 * tp : yaw;
  const flip = truco === "flip" ? Math.cos(Math.PI * 2 * tp) : 1;
  const grab = truco === "grab" ? Math.sin(Math.PI * tp) : 0;
  const sn = Math.sin(yaw), cs = Math.cos(yaw);
  const yTabla = air ? (rising ? 0.16 : 0.10) - 0.005 : 0;
  const flexA = air ? 1 : 0;
  const pieDe = (a, b) => {   // posicion de un pie: `a` a lo largo de la tabla, `b` a lo ancho
    const x = a * sn + b * cs, d = a * cs - b * sn;
    const [px, py] = p3(x, yTabla + 0.075, d);
    return { x: px, y: py, z: f3(d), d };
  };
  const atras = pieDe(-0.21, -0.035), adelante = pieDe(0.21, 0.035);
  const hipY = 0.42 - flex * 0.012 - land * 0.05 - (air ? 0.02 : 0);

  // la pierna de ADELANTE (la lejana) va primero: la tabla y la otra pierna la tapan
  const pierna = (pie, s) => {
    const hipX = s * 0.05;
    const rodX = lerp(hipX, pie.x, 0.5) + s * 0.075;
    const rodY = lerp(hipY, pie.y, 0.55) + 0.02;
    cap(hipX, hipY, rodX, rodY, 0.055 * lerp(1, pie.z, 0.5), PJ_COL.pant);
    cap(rodX, rodY, pie.x, pie.y + 0.03 * pie.z, 0.048 * pie.z, PJ_COL.pant);
    pie2(p, pie, yaw, s);
  };
  pierna(adelante, 1);
  tabla(p, yTabla, yawT, 0, flip);
  pierna(atras, -1);

  // Los brazos son lo UNICO que se mueve solo, asi que se mueven de verdad: hacen
  // equilibrio (uno adelantado, el otro atras) y **contrapesan el giro**: al cruzar de
  // carril el de afuera sube y el de adentro baja, que es lo que hace cualquiera que se
  // inclina. Antes esto era medio pixel y el que se movia era el muneco entero.
  for (const i of [0, 1]) {
    const s = i ? 1 : -1;
    const contra = -s * yaw * 1.1;   // el de afuera de la curva sube
    const sw = (i ? 1 : -0.5) + (air ? 1.2 : 0) + arm * (i ? 0.55 : -0.4) + contra;
    const homX = s * 0.155, homY = 0.70;
    let manX = s * (0.30 + sw * 0.025) + sn * 0.06, manY = 0.50 + sw * 0.075;
    if (grab && i === 0) {   // la mano de abajo va a buscar el canto de la tabla
      manX = lerp(manX, -0.16, grab); manY = lerp(manY, yTabla + 0.14, grab);
    }
    const codX = lerp(homX, manX, 0.5) + s * 0.03, codY = lerp(homY, manY, 0.6);
    cap(homX, homY, codX, codY, 0.048, PJ_COL.hoodDark);
    cap(codX, codY, manX, manY, 0.042, PJ_COL.hoodDark);
    p.push({ rect: [lerp(homX, codX, 0.35), lerp(homY, codY, 0.35), 0.09, 0.026], r: 0.02,
      c: PJ_COL.violet, neon: 1 });
    disc(manX, manY, 0.045, PJ_COL.dark);
  }

  torso(p, { y0: 0.40, y1: 0.76, ancho: 0.33, lean: 0 });
  cabeza(p, 0.76 - land * 0.02, 0);
  return p;
}

// tronco: cadera + capucha + mochila. `lean` corre la parte de arriba (de espaldas la
// inclinacion hacia adelante no rota: se lee como que los hombros se van y el cuello se
// esconde, y eso es un desplazamiento chico, no un giro).
function torso(p, { y0, y1, ancho, lean }) {
  const h = y1 - y0;
  p.push({ rect: [0, y0 - 0.02, ancho * 0.9, h * 0.3], r: 0.03, c: PJ_COL.pant });
  p.push({ rect: [lean, y0 + h * 0.14, ancho, h * 0.86], r: 0.06, c: PJ_COL.hood });
  p.push({ rect: [lean, y0 + h * 0.16, ancho * 1.01, 0.028], r: 0, c: PJ_COL.violet, neon: 1 });
  p.push({ rect: [lean, y0 + h * 0.32, ancho * 0.79, h * 0.62], r: 0.05, c: PJ_COL.pack });
  p.push({ rect: [lean, y0 + h * 0.4, ancho * 0.64, h * 0.48], r: 0.035, c: PJ_COL.packLit,
    eq: true });
  p.push({ rect: [lean, y1 - 0.01, ancho * 0.9, 0.045], r: 0.02, c: PJ_COL.hood });
}

// El casco: cromado, liso, de una pieza (daft punk). Lo que lo hace metal en Graphics, que
// no tiene degradados, es el ESCALONADO: tres grises de mas oscuro abajo a mas claro arriba,
// mas un brillo blanco chico y descentrado. La visera se ve de espaldas porque da la vuelta:
// es la banda oscura con el filo cyan cruzando la nuca.
function cabeza(p, y, lean) {
  const w = 0.265;
  const R = (dy, dw, dh, c, rr, noShade) =>
    p.push({ rect: [lean, y + dy, dw, dh], r: rr, c, noShade });
  R(0.0, 0.19, 0.05, PJ_COL.dark, 0.02);                     // cuello
  R(0.02, w * 0.74, 0.085, PJ_COL.cromDark, 0.04);            // la mandibula, mas angosta
  R(0.06, w, 0.185, PJ_COL.crom, 0.115);                     // el casco
  R(0.115, w * 0.72, 0.115, PJ_COL.cromLit, 0.075);          // la luz de arriba
  // el brillo va DESCENTRADO: centrado se lee como plastico, corrido se lee como metal
  p.push({ rect: [lean - w * 0.19, y + 0.205, w * 0.24, 0.03], r: 0.014,
    c: PJ_COL.cromTop, noShade: true });
  R(0.108, w * 1.01, 0.026, PJ_COL.dark, 0.012);             // la visera da la vuelta
  p.push({ rect: [lean, y + 0.112, w * 0.95, 0.012], r: 0.006, c: PJ_COL.cyan,
    noShade: true, neon: 1 });   // el filo encendido
  for (const i of [0, 1]) {   // rejilla lateral, hundida en el casco (no un plato pegado)
    const s = i ? 1 : -1;
    p.push({ disc: [lean + s * w * 0.43, y + 0.155, 0.034], c: PJ_COL.cromDark });
    p.push({ disc: [lean + s * w * 0.43, y + 0.155, 0.023], c: PJ_COL.violet });
    p.push({ disc: [lean + s * w * 0.43, y + 0.155, 0.010], c: PJ_COL.cyan, noShade: true });
  }
}

// --- el dibujo. Dos pasadas: primero todas las piezas en negro engordadas y despues en
// color. El contorno es lo que despega al muneco del rave; pieza por pieza no sirve, el
// contorno de una taparia a la de al lado.
// `P(x, y)` mapea unidades de cuerpo a pantalla y `u` es cuantos pixeles mide el alto.
export function drawAvatar(g, piezas, P, u, kx = 1, eq = null) {
  const OUT = 0.016;
  // tres pasadas: contorno negro engordado, color, y la SOMBRA (la misma forma metida hacia
  // abajo y hacia adentro, en negro al 22%). Sin degradados eso es lo unico que da volumen,
  // y va en una pasada aparte para que la sombra de una pieza no manche a la de al lado.
  for (const paso of [OUT, 0, -1]) {
    if (paso === OUT) g.fillStyle(PJ_COL.line, 1);
    if (paso === -1) g.fillStyle(PJ_COL.line, 0.22);
    for (const z of piezas) {
      if (paso === 0) g.fillStyle(z.c, z.a ?? 1);
      if (paso === -1 && (z.noShade || z.poly)) continue;
      const e = paso === -1 ? 0 : paso;
      if (z.poly) {
        // el contorno de un poligono es el mismo poligono escalado desde su centro
        const k2 = paso === OUT ? 1.05 : 1;
        const cx = z.poly.reduce((t, q) => t + q[0], 0) / z.poly.length;
        const cy = z.poly.reduce((t, q) => t + q[1], 0) / z.poly.length;
        g.fillPoints(z.poly.map(([qx, qy]) => {
          const q = P(cx + (qx - cx) * k2, cy + (qy - cy) * k2);
          return { x: q.x, y: q.y };
        }), true);
      } else if (z.disc) {
        const rr = z.disc[2];
        const c = P(z.disc[0], z.disc[1] - (paso === -1 ? rr * 0.22 : 0));
        g.fillCircle(c.x, c.y, (rr + e) * u * kx * (paso === -1 ? 0.78 : 1));
      } else if (z.seg) {
        const [x0, y0, x1, y1] = z.seg;
        const w = (z.w + e) * kx * (paso === -1 ? 0.5 : 1);
        const d0 = paso === -1 ? z.w * 0.5 : 0;
        const a = P(x0, y0 - d0), b = P(x1, y1 - d0);
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const nx = (-dy / d) * w * u, ny = (dx / d) * w * u;
        g.fillPoints([{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny },
          { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny }], true);
        g.fillCircle(a.x, a.y, w * u); g.fillCircle(b.x, b.y, w * u);
      } else {
        const [x, y, w, h] = z.rect;
        // la sombra del rectangulo es su tercio de abajo, con el mismo redondeo
        const hh = paso === -1 ? h * 0.34 : h;
        const a = P(x - w / 2 - e, y + hh + e), b = P(x + w / 2 + e, y - e);
        g.fillRoundedRect(a.x, a.y, b.x - a.x, b.y - a.y, (z.r + e) * u * kx);
      }
      // la pantalla de la mochila lleva el eq encima, en la pasada de color
      if (paso === 0 && z.eq && eq) {
        const [x, y, w, h] = z.rect;
        for (let i = 0; i < 5; i++) {
          const bx = x - w * 0.32 + i * w * 0.16, v = eq(i);
          const a = P(bx - w * 0.055, y + h * 0.13 + h * 0.74 * (0.18 + 0.82 * v)),
            b = P(bx + w * 0.055, y + h * 0.13);
          g.fillStyle(PJ_COL.eq, 0.5 + 0.5 * v);
          g.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
        }
      }
    }
  }
}
