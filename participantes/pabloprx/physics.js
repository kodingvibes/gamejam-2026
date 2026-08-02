// Fisica pura del runner: sin Phaser, para poder testearla con node.
export const PLAYER_H = 110;
export const SLIDE_H = 55;
// Profundidad del jugador = SU hitbox (el ancho no existe: se choca por indice de carril).
// Bajo de 40 a 28 porque rozabas cosas que ya habias esquivado. Medido a v=700: la ventana
// del salto pasa de 220 a 240ms, la del slide de 380 a 400ms y el hueco entre dos cajas del
// mismo carril de 297 a 314ms. No abre ninguna pared: `test.js` sigue midiendo que una zanja
// de 3 huecos no se cruza y que la caja no se salta.
export const PLAYER_D = 28;
export const PLAYER_Z = 720;    // z del jugador respecto de la camara
export const GRAVITY = -4400;   // ~0.45s de aire, pico ~113
export const JUMP_V = 1000;
export const SLIDE_T = 0.5;
export const SPAWN_Z = 4000;    // z donde aparece: de aca al jugador es el "viaje"
// `V` (feel): multiplicadores de la velocidad del nivel. Vive aca y no en el renderer porque
// la entrada del obstaculo tiene que cerrar a TODOS (ver `enterDz` en music.js) y eso se mide
// desde node.
export const SPEED_MULS = [1, 1.5, 0.75, 0.5, 2];
// CARRILES: cuantos los dice el NIVEL (`lanes` en LEVELS), el PASO no. Siempre 170, y con
// N carriles la pista se ENSANCHA en vez de apretarse. No es estetica: el `high` mide w=70,
// o sea 140 de ancho, asi que repartir 4 carriles en el ancho viejo (paso 113) los solaparia
// en pantalla y no se sabria a cual pertenece cada caja. Medido: paso 170 -> el borde de una
// caja de 140 queda a 15 del borde de la de al lado.
//   lanesX(3) = [-170, 0, 170]   (el de siempre: el nivel 1 no se mueve ni un pixel)
//   lanesX(4) = [-255, -85, 85, 255]   (pista de 680 en vez de 510)
export const lanesX = (n) => Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * 170);
// Default de 3 carriles: es lo que asumen `test.js`, `record.js` y todo lo que no recibe nivel.
export const LANE_X = lanesX(3);
export const DASH_T = 1.2;      // tope del dash: sostenido, no vuelo libre (~2.6 beats a 130bpm)
export const DASH_Y = 150;      // altura de crucero del dash
export const DASH_VY = 1400;    // lo que tarda en subir/bajar a esa altura

// d = profundidad: cuanto mas corta, mas margen tiene el salto/slide para pasar.
// La caja entera se midio contra el cambio de carril: con las cajas a una por beat
// (0.4615s a 130bpm) el hueco libre de un carril es `beat - (d + PLAYER_D)/v`. Con d=130
// eso daba 217ms a v=700, por debajo del tiempo de reaccion, o sea que cambiar de carril
// rapido era imposible. Con d=75 son 297ms. El alto bajo de 200 a 150 para poder ver la
// pista por encima de la pared: el salto llega a y=111.6, asi que sigue sin poder saltarse
// (lo comprueba test.js a las cinco velocidades).
export const KINDS = {
  block: { y0: 0, y1: 150, w: 45, d: 75 },
  low: { y0: 0, y1: 50, w: 70, d: 40 },
  high: { y0: 95, y1: 220, w: 70, d: 40 },
  // hueco en el suelo de UN carril: es una caja DEBAJO del piso, o sea que `hits` la
  // resuelve sola. De pie (y=0) la tocas, agachado tambien, en el aire no. Con la gravedad
  // invertida se espeja como todo lo demas.
  gap: { y0: -400, y1: 1, w: 70, d: 130 },
  orb: { y0: 55, y1: 175, w: 40, d: 70 },    // dash orb: no choca, se agarra (role "orb")
  orbj: { y0: 30, y1: 200, w: 40, d: 70 },   // jump orb: mas alto, engancha de pie y en el aire
};

// g = signo de gravedad: -1 corre por el techo. El mundo entero se espeja en y=0,
// asi que el alto del jugador y las cajas van con signo y nada mas cambia.
export function playerBox(y, sliding, g = 1) {
  const h = (sliding > 0 && y === 0 ? SLIDE_H : PLAYER_H) * g;
  return { bottom: Math.min(y, y + h), top: Math.max(y, y + h) };
}

// z = cara frontal del obstaculo
export function hits(kind, z, y, sliding, g = 1) {
  const k = KINDS[kind];
  if (Math.abs(z + k.d / 2 - PLAYER_Z) > (k.d + PLAYER_D) / 2) return false;
  const p = playerBox(y, sliding, g);
  return p.bottom < Math.max(k.y0 * g, k.y1 * g) && p.top > Math.min(k.y0 * g, k.y1 * g);
}

// avanza salto/slide/dash un frame; devuelve el nuevo estado.
// hold = mantener UP/W: el dash del orb dura mientras lo mantengas (y hasta DASH_T).
export function stepPlayer({ y, vy, sliding, dash = 0 }, dt, g = 1, hold = false) {
  if (dash > 0 && hold) {   // en dash no hay gravedad: te sostiene a media altura
    const d = g * DASH_Y - y;
    return {
      y: y + Math.sign(d) * Math.min(DASH_VY * dt, Math.abs(d)),
      vy: 0, sliding: 0, dash: Math.max(0, dash - dt),
    };
  }
  vy += g * GRAVITY * dt;
  y += vy * dt;
  if (g * y < 0 || (y === 0 && g * vy < 0)) { y = 0; vy = 0; }   // suelo (o techo, si g = -1)
  return { y, vy, sliding: Math.max(0, sliding - dt), dash: 0 };
}

// EL MUNECO NO CAMINA: va en tabla, y la pista es plana. O sea que no hay pisadas, y sin
// pisadas no hay bote: el sube y baja de una carrera sobre una superficie lisa es
// exactamente lo que se ve mal. Lo unico que se mueve solo es un flote lento y los brazos,
// y los dos van con la cancion (como todo lo demas del mundo) para que respire con la
// musica sin marcar un paso que no existe.
//
// Aca vivia `runAnim` (ciclo de carrera clavado al beat) y `stepsFor` (cadencia por
// velocidad). Se fueron con las piernas: no hay paso que sincronizar.
export function ride(t, beat) {
  const bar = beat * 4;
  return {
    // el flote: un ciclo por compas, y CHICO. Es para que no parezca una estatua, no para
    // que rebote.
    hover: Math.sin((t / bar) * Math.PI * 2),
    // los brazos van a otra frecuencia (2 ciclos cada 3 compases) para que no se lea
    // mecanico: si los dos laten igual parece un juguete a cuerda
    arm: Math.sin((t / (bar * 1.5)) * Math.PI * 2),
    phase: ((t / bar) % 1 + 1) % 1,
  };
}
