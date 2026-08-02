// El reactor: una helice de tres palas vista de frente, donde cada pala es una PANTALLA DE
// OSCILOSCOPIO y el centro es la fuente de energia. Vive al fondo de la pista (el punto de
// fuga) del nivel `orbit-motion`.
//
// Aca no hay escena, ni Phaser, ni `songT`: entra un estado y salen PRIMITIVAS en un espacio
// propio (viewBox 0..1024, centro en 512,512). El que dibuja pone la transformada. Por eso el
// mismo dato sirve para el juego (`drawReactor`, Phaser Graphics) y para el SVG estatico
// (`toSVG`, que usa `tools/reactor-svg.js`): una sola verdad, dos backends.
//
// Nada de Math.random ni Date.now: el ruido sale de `hash(i)` (la misma formula que el
// renderer), asi que rebobinar la cancion devuelve el mismo reactor.

// --- espacio y medidas ------------------------------------------------------------------
// viewBox 0..1024 con el nucleo en (512,512). Radio nominal = 512 (el borde del cuadro).
export const BOX = 1024;
export const CX = 512, CY = 512;

// Medido sobre la geometria (ver `radioMax()` y el chequeo de `tools/reactor-svg.js`): el
// punto mas lejano del centro cae a 486.0, o sea 26px de margen contra el borde del cuadro.
// Ese margen es lo que deja respirar al glow, que en SVG desborda la forma.

const TAU = Math.PI * 2;
const hash = (i) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };

// --- colores ----------------------------------------------------------------------------
// Pocos y a proposito: tres emisivos, dos metales, un acento. `screen` y `line` no son
// colores nuevos, son el negro del fondo de la pantalla y el del vacio.
export const RX = {
  neon: 0x00d8ff,      // #00D8FF
  neonLit: 0x5fe8ff,   // #5FE8FF
  neonPale: 0xa8ffff,  // #A8FFFF
  // EL METAL NO ES GRIS NEUTRO, Y ESO ES LO QUE HACIA QUE LA PIEZA NO SE LEYERA. Se reporto
  // dos veces que "el color del reactor sigue sin verse", y medido aislando la capa (mismo
  // frame del drop2 con y sin `reactor` en `decor`, restando los dos PNG) la queja era exacta:
  // sobre sus 13759 pixeles la **saturacion media era 0.149**, o sea que la pieza es gris con
  // tres manchitas de cyan. La luma no era el problema (86.8 de media, p95 199): el problema
  // es que el chasis es lo mas GRANDE del dibujo y no tenia color.
  // Con el gris llevado al cyan del nivel (hue 193, la familia de `neon`) el chasis deja de
  // competir en gris y pasa a ser la sombra de lo que emite, que es lo que hace la referencia.
  // Oscuros a proposito y no mas claros: en la referencia el cuerpo es casi negro y lo unico
  // que brilla son las trazas. Sube la saturacion sin subir el area encendida.
  metal: 0x1e4a57,     // #1E4A57
  metalDark: 0x102a33, // #102A33
  red: 0xff4040,       // #FF4040
  screen: 0x061014,    // el fondo del CRT: casi negro con un pelo de cyan
  black: 0x05070a,
  white: 0xffffff,
};

// --- cuanto se apaga cada pieza (`DIM`) ---------------------------------------------------
// La escena manda el reactor al fondo con `o.alpha` (0.5 en el juego). Bajarlo PLANO apagaba
// por igual el chasis -que tiene que estar oscuro, es metal- y las pantallas y el nucleo, que
// son la razon de ser de la pieza: medido a alpha 0.5 sobre sus propios pixeles al tamano que
// tiene en el nivel, luma media 61.1 y solo el **8.1%** de los pixeles pasaba de 100.
//
// Asi que `alpha` deja de multiplicar y pasa a ser una CURVA POR PIEZA:
//
//     alpha efectivo = a * alpha ^ d
//
// `d` es el exponente de esta tabla. d=1 es el multiplicador plano de antes, d>1 se apaga mas
// y d<1 menos. **En alpha=1 la curva es la identidad para cualquier d** (`1^d = 1`), o sea que
// el SVG estatico y el dibujo de referencia no se enteran; lo afirma llamada por llamada el
// chequeo de `tools/reactor-svg.js`.
//
// A alpha=0.5 la tabla da: chasis 0.190 / fondo 0.288 / rejilla 0.379 / luz 0.707 /
// traza 0.841 / nucleo 0.901, contra el 0.5 parejo de antes.
export const DIM = {
  chasis: 2.4,   // metal: marco, junta, aletas, tornillos, bisel, anillo mecanico del nucleo
  fondo: 1.8,    // lo que es AGUJERO y no luz: el negro del CRT, la ventilacion, los cables
  rejilla: 1.4,  // la rejilla del osciloscopio: tiene que verse que hay rejilla, no leerse
  luz: 0.5,      // el filo encendido de la pantalla, los LEDs y los avisos
  traza: 0.25,   // la onda: es lo que dice que el monitor esta VIVO
  nucleo: 0.15,  // el jefe casi no se apaga. No es 0 para que un fundido de verdad se lo lleve
};

// --- el latido: `pulse` no alcanza --------------------------------------------------------
// Medido en el juego sobre 1200 frames del drop2 de `orbit-motion` (t=36..60.3s, 20ms):
// **`pulse` vale 0 el 100% del tramo** (ese drop no tiene NI UN evento de bass, lo dice
// `music.js`) y `beat` pasa de 0.02 solo el **31.7%**, con mediana 0. O sea que colgado de
// `pulse` -que es lo unico que movia el nucleo- el jefe esta CONGELADO justo donde mas se lo
// mira, y en el outro (28.6s con un solo evento) tambien.
//
// Lo que si esta vivo siempre que suene algo es el FFT, que el reactor ya recibe para la
// traza. `bass()` es la energia de los 12 primeros bins (0-2067Hz a 44.1kHz con fftSize 256).
// Medido en ese mismo tramo: min 0.724, p10 0.789, mediana 0.854, p90 0.899, max 0.950, y
// PLEGADO por fase de beat da 0.877 / 0.862 / 0.808 / 0.817 / 0.838 / 0.867 / 0.862 / 0.863,
// o sea que el pico cae en el 1 del beat: es un latido, no ruido. De ahi salen el piso (0.72)
// y el recorrido (0.23). Los 3 bins de mas abajo solos no sirven: saturan (mediana 1.000).
//
// Sin fft (el SVG estatico) o en silencio da 0, o sea que `kick` cae en `pulse` y el dibujo de
// referencia sigue siendo el de siempre.
const BASS_N = 12, BASS_0 = 0.72, BASS_D = 0.23;
export function bass(fft) {
  if (!fft) return 0;
  const n = Math.min(fft.length, BASS_N);
  let s = 0;
  for (let k = 0; k < n; k++) s += fft[k];
  return Math.max(0, Math.min(1, (s / (n * 255) - BASS_0) / BASS_D));
}
// el golpe: lo que este vivo. Vale 0 en el SVG y en pausa.
export const kick = (o = {}) => Math.max(o.pulse ?? 0, bass(o.fft ?? null));

// --- primitivas -------------------------------------------------------------------------
// Tres formas y nada mas. Un rect chaflanado, una linea, una rejilla y la onda son todos
// `poly`: asi los dos backends tienen tres casos y no doce.
//
//   { k: "disc", x, y, r, c, a, glow? }              circulo relleno
//   { k: "ring", x, y, r, w, c, a, glow? }           circulo trazado
//   { k: "poly", pts, c, a, fill, w, close, glow?, id? }
//
// `glow` es el radio del halo en unidades del viewBox (0 = sin halo). `id` solo lo llevan
// las tres ondas, que son lo unico que se anima desde fuera. `d` (el exponente de `DIM`) se
// lo pone `mete()`: es de la PUESTA, no de la forma, y no sale en el SVG.
const disc = (x, y, r, c, a = 1, glow = 0) => ({ k: "disc", x, y, r, c, a, glow });
const ring = (x, y, r, w, c, a = 1, glow = 0) => ({ k: "ring", x, y, r, w, c, a, glow });
const fill = (pts, c, a = 1, glow = 0) => ({ k: "poly", pts, c, a, fill: true, close: true, glow });
const line = (pts, c, w, a = 1, glow = 0, close = false, id = null) =>
  ({ k: "poly", pts, c, a, fill: false, w, close, glow, id });

// Rect chaflanado: las cuatro esquinas cortadas a 45 grados. Ocho puntos y ninguna curva, o
// sea que se lee igual a 64px que a 1024 y sale identico en SVG y en Phaser.
function cham(cx, cy, w, h, c) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  return [[x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c],
    [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c]];
}
const seg = (x0, y0, x1, y1) => [[x0, y0], [x1, y1]];

// Empuja primitivas a `arr` marcandolas con su exponente de `DIM`. Se usa como
// `const chasis = mete(p, DIM.chasis)` y despues `chasis(fill(...), line(...))`: la tabla
// queda en un solo sitio y cada pieza dice a que familia pertenece en el mismo renglon en el
// que se dibuja, sin un parametro mas en cada constructor.
const mete = (arr, d) => (...ps) => { for (const q of ps) { q.d = d; arr.push(q); } };

// --- rotacion ---------------------------------------------------------------------------
// Las tres alas son la MISMA geometria rotada 0 / 120 / 240 alrededor del nucleo. En SVG eso
// es un `transform="rotate(...)"` en el grupo, o sea que los tres `<g>` traen hijos identicos;
// en Phaser hay que rotar los puntos, que es lo que hace `rotPrim`.
export const WING_ROT = [0, 120, 240];

// El casco gira al REVES que las alas y mas lento: dos cosas girando igual se leen como una
// sola pieza, y era justo la queja (el reactor se leia como un logo, no como una maquina).
export const SHELL_SPIN = 0.55;

function rotPt([x, y], a) {
  const c = Math.cos(a), s = Math.sin(a), dx = x - CX, dy = y - CY;
  return [CX + dx * c - dy * s, CY + dx * s + dy * c];
}
function rotPrim(p, a) {
  if (!a) return p;
  if (p.k === "poly") return { ...p, pts: p.pts.map((q) => rotPt(q, a)) };
  const [x, y] = rotPt([p.x, p.y], a);
  return { ...p, x, y };
}

// --- la pantalla del ala ----------------------------------------------------------------
// Todo el ala se construye APUNTANDO ARRIBA (-y), que es el ala 1. Que apunte arriba no es
// capricho: asi el dibujo entero es simetrico respecto del eje vertical (el ala 1 se espeja
// sobre si misma y las otras dos se intercambian), y eso es un assert y no una opinion.
//
// Reparto radial, del nucleo al borde:
//   r 110..126  anillo mecanico del nucleo
//   r 118..181  cuello: cables, junta y aletas de refrigeracion
//   r 181..471  monitor (marco metalico, bisel, pantalla)
export const SCR = { x0: 424, x1: 600, cy: 180, amp: 55 };  // la traza, dentro de la pantalla

// La onda es FUNCION PURA. Con `fft` (el Uint8Array del AnalyserNode) sale del espectro real
// del audio que esta sonando; sin el (el SVG estatico, o el juego en pausa, donde el FFT da
// todo ceros) sale de una suma de tres senos. Cada ala lleva su fase y su frecuencia, sacadas
// de `hash(i)`, o sea que las tres pantallas muestran cosas distintas y siempre las mismas.
//
// LA PORTADORA VA EN BEATS, NO EN SEGUNDOS (`bt`). Se reporto que "las lineas de onda de los
// espectrogramas no se mueven en sincro": la portadora corria a `t * 5.5` rad/s, o sea
// 0.875 ciclos por segundo, que contra un beat de 0.43796s son **0.383 ciclos por beat**. En
// numero: la traza vuelve a su fase cada 2.61 beats, o sea que se cruza con el beat una vez
// cada 13 (el minimo comun multiplo de 2.61 y 1 en beats enteros) y el resto del tiempo va
// deslizando. Con `bt` (beats transcurridos) la portadora avanza **1 ciclo exacto por beat**:
// la onda esta en la misma fase en cada golpe.
// El respaldo es `t * 5.5 / TAU` beats, o sea EXACTAMENTE lo de antes: el SVG estatico
// (`tools/reactor-svg.js`), que no pasa `bt`, no cambia un punto.
export const WAVE_N = 65;
export function wave(i, o = {}) {
  const { t = 0, beat = 1, fft = null, bt = (t * 5.5) / TAU } = o;
  const ph = hash(i + 1) * TAU, fq = 1 + hash(i + 7) * 1.6;
  // Tener `fft` no es tener SENAL: en pausa, muteado el transporte o en modo diseno el
  // AnalyserNode devuelve el array entero en cero y la traza salia una RAYA RECTA, o sea tres
  // monitores apagados justo cuando se esta mirando el nivel. Se mira una vez si hay energia
  // (una pasada, corta en el primer bin distinto de cero) y si no la hay se cae al sintetico,
  // que es el mismo que usa el SVG estatico. Asi el reactor nunca esta muerto.
  let vivo = false;
  if (fft) for (let k = 0; k < fft.length; k++) if (fft[k]) { vivo = true; break; }
  const pts = [];
  for (let k = 0; k < WAVE_N; k++) {
    const u = k / (WAVE_N - 1);
    let v;
    if (vivo) {
      // el bin sale de u^1.7 y no lineal, por lo mismo que el `eq` del fondo: lineal apila
      // todo el grave en el borde izquierdo. La banda da MAGNITUD (0..255), asi que se la
      // multiplica por una portadora para que la traza sea BIPOLAR, como un osciloscopio.
      const b = Math.min(fft.length - 1, Math.floor(u ** 1.7 * fft.length));
      v = (fft[b] / 255) * Math.cos(u * 21 + ph + bt * TAU);
    } else {
      // el sintetico va CLAVADO AL BEAT igual que la portadora, y por eso los tres terminos
      // avanzan un numero ENTERO de ciclos por beat (1, 2 y 1): con velocidades en rad/s
      // (3.1 / 4.7 / 2.3, o sea 0.216 / 0.328 / 0.160 ciclos por beat a 137bpm) la traza de
      // pausa/mute iba por su cuenta, que es justo lo que se reporto de las pantallas.
      // Sin `bt` (el SVG estatico, que ademas va en t=0) `bt` cae en `t*5.5/TAU` y esto sigue
      // siendo una funcion determinista de `t`: el SVG no se entera.
      const tb = bt * TAU;
      v = 0.55 * Math.sin(u * TAU * (2 + fq) + ph + tb)
        + 0.30 * Math.sin(u * TAU * (5 + 2 * fq) - ph - tb * 2)
        + 0.15 * Math.sin(u * TAU * 11 + tb);
    }
    // ventana: la traza se muere en los dos bordes de la pantalla. Cortada de golpe se lee
    // como que se sale del marco.
    const w = Math.sin(Math.PI * u) ** 0.5;
    pts.push([SCR.x0 + u * (SCR.x1 - SCR.x0),
      SCR.cy - v * w * SCR.amp * (0.55 + 0.45 * beat)]);
  }
  return pts;
}

// --- el ala -----------------------------------------------------------------------------
// Devuelve las primitivas del ala `i` SIN ROTAR (apuntando arriba). El SVG las emite tal cual
// y les pone la rotacion en el grupo; `parts()` las rota para Phaser.
export function wingParts(i, o = {}) {
  const { beat = 1, t = 0, fft = null, bt } = o;
  const gl = 0.55 + 0.45 * beat;   // lo emisivo late; el metal no
  const kk = kick(o);              // el golpe: engorda los halos, nunca los apaga
  const p = [];
  const chasis = mete(p, DIM.chasis), fondo = mete(p, DIM.fondo);
  const rejilla = mete(p, DIM.rejilla), luz = mete(p, DIM.luz), traza = mete(p, DIM.traza);

  // cables al nucleo: dos por lado, con el nucleo cyan por dentro. Nacen debajo del anillo
  // mecanico (y=398 es r=114, o sea tapados por el anillo) y mueren bajo la junta.
  for (const s of [-1, 1]) for (const dx of [30, 58]) {
    chasis(line(seg(CX + s * dx, 398, CX + s * (dx + 6), 368), RX.metal, 12));
    fondo(line(seg(CX + s * dx, 398, CX + s * (dx + 6), 368), RX.neon, 4, 0.75 * gl, 5 + 5 * kk));
  }
  // junta de panel: el bloque que une el cuello con el monitor
  chasis(fill(cham(CX, 348, 152, 44, 10), RX.metalDark));
  chasis(line(cham(CX, 348, 152, 44, 10), RX.metal, 4, 1, 0, true));
  // aletas de refrigeracion, tres por lado
  for (const s of [-1, 1]) for (const y of [336, 350, 364]) {
    chasis(fill(cham(CX + s * 99, y, 34, 10, 3), RX.metal));
  }

  // monitor: marco metalico, bisel oscuro, pantalla
  chasis(fill(cham(CX, 186, 296, 290, 28), RX.metal));
  chasis(line(cham(CX, 186, 296, 290, 28), RX.metalDark, 5, 1, 0, true));
  // juntas de panel: un filo claro arriba y uno oscuro abajo, dentro del borde del marco.
  // Es lo unico que le da volumen al metal: sin degradados, un rect de un solo gris es una
  // loza. Van horizontales, o sea que no rompen la simetria.
  chasis(line(seg(CX - 118, 55, CX + 118, 55), RX.neonPale, 3, 0.12));
  chasis(line(seg(CX - 118, 317, CX + 118, 317), RX.black, 3, 0.35));
  chasis(fill(cham(CX, 186, 236, 230, 20), RX.metalDark));
  fondo(fill(cham(CX, 180, 196, 166, 13), RX.screen));
  luz(line(cham(CX, 180, 196, 166, 13), RX.neon, 3, 0.55 * gl, 6 + 8 * kk, true));

  // rejilla del osciloscopio: 5 verticales y 5 horizontales dentro de la pantalla, con los
  // dos EJES CENTRALES mas fuertes. Sin los ejes la rejilla se lee como una tela metalica.
  for (let k = -2; k <= 2; k++) {
    const eje = k === 0;
    rejilla(line(seg(CX + k * 38, 100, CX + k * 38, 260), RX.neon, eje ? 2 : 1.2,
      (eje ? 0.5 : 0.18) * gl));
    rejilla(line(seg(417, 180 + k * 36, 607, 180 + k * 36), RX.neon, eje ? 2 : 1.2,
      (eje ? 0.5 : 0.18) * gl));
  }
  // la traza. Es lo unico con `id`: se anima desde fuera (fase, amplitud, frecuencia).
  traza(line(wave(i, { t, beat, fft, ...(bt != null ? { bt } : {}) }), RX.neonPale, 5, 0.95, 9 + 10 * kk, false, `wave-${i + 1}`));

  // rejilla de ventilacion, arriba del bisel
  for (let k = -2; k <= 2; k++) fondo(fill(cham(CX + k * 26, 84, 10, 18, 3), RX.black, 0.75));

  // franja de control, abajo del bisel: dos avisos rojos y tres LEDs. Los de los costados van
  // del mismo color a la fuerza: el dibujo es simetrico y un LED suelto lo rompe.
  for (const s of [-1, 1]) luz(fill(cham(CX + s * 84, 282, 30, 14, 4), RX.red, 0.85, 4 + 5 * kk));
  for (const s of [-1, 1]) luz(disc(CX + s * 48, 282, 8, RX.neon, 0.9 * gl, 6 + 8 * kk));
  luz(disc(CX, 282, 8, RX.red, 0.9 * gl, 6 + 8 * kk));

  // tornillos en las cuatro esquinas del marco: casquillo oscuro, cabeza metalica y ranura
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const x = CX + sx * 133, y = 186 + sy * 130;
    chasis(disc(x, y, 11, RX.metalDark));
    chasis(disc(x, y, 6.5, RX.metal));
    chasis(line(seg(x - 5, y, x + 5, y), RX.metalDark, 2.5));
  }
  return p;
}

// --- el casco -----------------------------------------------------------------------------
// Las tres alas dejan tres huecos de 84.8 grados entre ellas, o sea que el dibujo tapaba el
// 44.7% de su propio disco y el pixel mas bajo oscilaba entre 354 y 488 a lo largo de una
// vuelta: la pieza se despegaba del final de la pista la mayor parte del tiempo. El casco es
// lo que cierra esos huecos: anillo dentado por fuera y tres tirantes que lo atan al nucleo
// justo por los huecos (90 / 210 / 330), que son los mismos angulos de los LEDs, o sea que la
// simetria respecto de x=CX se mantiene y el chequeo la sigue afirmando.
const SHELL = { r: 430, w: 44, n: 12, tw: 90, t0: 452, t1: 484, halo: 478 };
export function shellParts(o = {}) {
  const kk = kick(o);
  const p = [];
  const chasis = mete(p, DIM.chasis), luz = mete(p, DIM.luz);
  chasis(ring(CX, CY, SHELL.r, SHELL.w, RX.metalDark));
  chasis(ring(CX, CY, SHELL.r + SHELL.w / 2, 4, RX.metal));
  for (let k = 0; k < SHELL.n; k++) {
    const a = -Math.PI / 2 + (k * TAU) / SHELL.n;
    const c = Math.cos(a), s = Math.sin(a);
    const q = (r, u) => [CX + c * r - s * u, CY + s * r + c * u];
    const pts = [q(SHELL.t0, -SHELL.tw / 2), q(SHELL.t1, -SHELL.tw * 0.32),
      q(SHELL.t1, SHELL.tw * 0.32), q(SHELL.t0, SHELL.tw / 2)];
    chasis(fill(pts, RX.metalDark), line(pts, RX.metal, 3, 0.8, 0, true));
  }
  luz(ring(CX, CY, SHELL.halo, 3, RX.neon, 0.16 + 0.16 * kk, 12 + 26 * kk));
  for (const dg of [90, 210, 330]) {
    const a = (dg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const hw = (r) => 34 + (20 - 34) * ((r - 168) / 240);
    const q = (r, u) => [CX + c * r - s * u, CY + s * r + c * u];
    const tir = [q(168, -hw(168)), q(408, -hw(408)), q(408, hw(408)), q(168, hw(168))];
    chasis(fill(tir, RX.metalDark), line(tir, RX.metal, 4, 1, 0, true));
  }
  return p;
}

// --- el nucleo --------------------------------------------------------------------------
// Circular y concentrico: anillo mecanico con tornillos, anillo iluminado, el pozo de energia
// ESCALONADO y el punto blanco del centro, que es el foco visual.
//
// El pozo: cuatro discos OPACOS de radio decreciente, cada uno con un filo negro encima que
// marca donde termina. Antes eran discos semitransparentes (alpha 0.16 / 0.30 / 0.50) con
// glow de 10 y 14 encima, o sea que se fundian entre si y con el fondo: la unica mancha
// borrosa de una pieza que por lo demas es toda chaflan y arista. Es el mismo problema que
// resuelve el casco cromado del jugador (`avatar.js`) de la misma manera: sin degradados en
// Graphics, el metal (y aca la luz) se hace ESCALONANDO, no difuminando.
//
// Los pasos van 78 -> 62 -> 46 -> 30 (16 de ancho cada corona, medido: la mas angosta sigue
// siendo 5 veces el filo de 3, o sea que a 64px de reactor entero cada paso todavia es un
// pixel y pico y no se colapsan en uno). Solo el punto del centro conserva glow: es el foco,
// y con un unico emisor el ojo tiene donde caer.
//
// Medido sobre el SVG rasterizado a 1024, perfil radial de luminancia promediado en 6 radios:
// saltos de mas de 25/255 en UN pixel de radio, antes **2** y ahora **12**, con el salto mas
// grande subiendo de 43 a 68 y la pendiente media de 4.1 a 9.3. O sea que el degradado no se
// hizo mas contrastado: se convirtio en escalones.
const NUCLEO = [[78, RX.screen], [62, RX.neon], [46, RX.neonLit], [30, RX.neonPale]];

export function coreParts(o = {}) {
  const { beat = 1 } = o;
  const gl = 0.55 + 0.45 * beat;
  const kk = kick(o);
  const p = [];
  const chasis = mete(p, DIM.chasis), nucleo = mete(p, DIM.nucleo), luz = mete(p, DIM.luz);

  chasis(ring(CX, CY, 118, 16, RX.metal));
  chasis(ring(CX, CY, 104, 8, RX.metalDark));
  // 12 tornillos. Arrancan en -90 (o sea bajo el ala 1) y van cada 30 grados: asi el circulo
  // de tornillos es simetrico respecto del eje vertical, como todo lo demas.
  for (let k = 0; k < 12; k++) {
    const a = -Math.PI / 2 + (k * TAU) / 12;
    chasis(disc(CX + Math.cos(a) * 118, CY + Math.sin(a) * 118, 6.5, RX.metalDark));
  }
  nucleo(ring(CX, CY, 90, 8, RX.neon, 0.9 * gl, 8 + 16 * kk));
  for (const [r, c] of NUCLEO) {
    nucleo(disc(CX, CY, r, c));                        // el paso, macizo
    nucleo(ring(CX, CY, r, 3, RX.black, 0.6));         // su filo: donde termina se VE
  }
  // El brillo va ARRIBA y no en el centro, igual que el del casco cromado: un reflejo
  // centrado se lee como plastico. Es un ARCO y no un disco (un disco suelto arriba se lee
  // como un LED mas, de los que ya hay tres) de 110 grados sobre la corona del `neonLit`
  // (r=38, o sea la mitad de la corona 30..46), y va MUESTREADO simetrico respecto de la
  // vertical (-90 +- k*13.75) porque el reactor entero tiene que espejar sobre si mismo.
  const brillo = [];
  for (let k = -4; k <= 4; k++) {
    const a = -Math.PI / 2 + k * ((13.75 * Math.PI) / 180);
    brillo.push([CX + Math.cos(a) * 38, CY + Math.sin(a) * 38]);
  }
  nucleo(line(brillo, RX.white, 5, 0.5));
  // el punto central: lo unico del nucleo que respira, y lo hace con el RADIO del halo (antes
  // era el alpha de cuatro discos a la vez, o sea que latia la nebulosa entera). El halo va de
  // 8 a 34 y no a 18: es el pico de la pantalla y tiene que ABRIRSE con el golpe.
  nucleo(disc(CX, CY, 13, RX.white, 1, 8 + 26 * kk));

  // los tres LEDs rojos van en los HUECOS entre alas (90 / 210 / 330 grados), o sea a 60 de
  // cada ala: ese conjunto tambien es simetrico respecto de la vertical.
  for (const dg of [90, 210, 330]) {
    const a = (dg * Math.PI) / 180, x = CX + Math.cos(a) * 140, y = CY + Math.sin(a) * 140;
    chasis(ring(x, y, 15, 3, RX.metal));
    luz(disc(x, y, 9, RX.red, 0.85 * gl, 7 + 9 * kk));
  }
  return p;
}

// Todas las primitivas ya rotadas y con su grupo, en orden de dibujo (el nucleo va ultimo:
// es el foco y tiene que quedar encima de los cables). `spin` va en RADIANES y mueve solo
// las alas: el nucleo es la fuente y se queda quieto.
export function parts(o = {}) {
  const { spin = 0 } = o;
  const out = [];
  // El casco va PRIMERO: es lo de mas atras, asi no repinta ninguna pantalla.
  for (const p of shellParts(o)) out.push({ ...rotPrim(p, -spin * SHELL_SPIN), g: "shell" });
  for (let i = 0; i < 3; i++) {
    const a = (WING_ROT[i] * Math.PI) / 180 + spin;
    for (const p of wingParts(i, o)) out.push({ ...rotPrim(p, a), g: `wing-${i + 1}` });
  }
  for (const p of coreParts(o)) out.push({ ...p, g: "core" });
  return out;
}

// Lo mas lejos del centro que llega el dibujo. Es el numero que dice si el reactor entra en
// el cuadro; lo mide el chequeo, no se estima.
export function radioMax(o = {}) {
  let m = 0;
  for (const p of parts(o)) {
    if (p.k === "poly") for (const [x, y] of p.pts) m = Math.max(m, Math.hypot(x - CX, y - CY));
    else m = Math.max(m, Math.hypot(p.x - CX, p.y - CY) + p.r + (p.w ?? 0) / 2);
  }
  return m;
}

// --- backend 1: Phaser Graphics ---------------------------------------------------------
// `g` es un Phaser.GameObjects.Graphics y `P(x, y) -> {x, y}` es la transformada a pantalla
// que pone la escena. No se importa Phaser: solo se llaman `fillStyle`, `lineStyle`,
// `fillPoints`, `strokePoints`, `fillCircle` y `strokeCircle`, o sea que esto se puede
// testear desde node con un doble.
//
// La escala de radios y grosores se mide UNA VEZ sobre la propia `P` (dos puntos a 1 de
// distancia): se asume que `P` es una semejanza (escala + traslacion + giro), que es lo que
// hace falta para colgar el reactor del punto de fuga. Con perspectiva de verdad habria que
// medirla por primitiva.
//
// `o.alpha` (1 por defecto) es el dial con el que la escena lo manda al fondo: el reactor vive
// en el punto de fuga, o sea en lo mas lejos que hay, y entero era lo mas contrastado de la
// pantalla. Va aca y no en las primitivas porque es de la PUESTA y no del dibujo: el SVG
// estatico sale siempre entero.
// **No es un multiplicador, es una curva por pieza**: cada primitiva trae su exponente `d`
// (ver `DIM`) y el alpha efectivo es `a * alpha^d`. En alpha=1 es la identidad para toda la
// tabla, o sea que el dibujo de referencia no cambia.
export function drawReactor(g, P, o = {}) {
  const { alpha = 1 } = o;
  const a0 = P(CX, CY), a1 = P(CX + 1, CY);
  const s = Math.hypot(a1.x - a0.x, a1.y - a0.y) || 1;
  const pts = (arr) => arr.map(([x, y]) => P(x, y));

  for (const p0 of parts(o)) {
    const p = alpha === 1 ? p0 : { ...p0, a: p0.a * alpha ** (p0.d ?? 1) };
    const q = p.k === "poly" ? null : P(p.x, p.y);
    // el halo va en dos pasadas por debajo de la forma: ancha y tenue, y otra a la mitad de
    // ancho y mas fuerte. Con una sola pasada gruesa se lee como mancha y no como algo que
    // emite: es el mismo truco que los pins y las formas del nivel 1.
    if (p.glow > 0) {
      // ...y el halo va MAS ANCHO y mas fuerte que las dos pasadas de siempre (1/0.16 y
      // 0.5/0.26). Es la otra mitad de la queja de visibilidad: con el chasis ya en el cyan del
      // nivel lo que falta es que lo que EMITE derrame, que es lo que hace la referencia. Sigue
      // en DOS pasadas y no tres: el numero de llamadas al Graphics es el mismo (526 por frame),
      // lo unico que cambia son el ancho y el alpha, o sea que no cuesta nada medible.
      for (const [k, av] of [[1.7, 0.20], [0.7, 0.30]]) {
        const gw = p.glow * k * s;
        if (p.k === "disc") { g.fillStyle(p.c, p.a * av); g.fillCircle(q.x, q.y, p.r * s + gw); }
        else if (p.k === "ring") { g.lineStyle(p.w * s + gw * 2, p.c, p.a * av); g.strokeCircle(q.x, q.y, p.r * s); }
        else if (!p.fill) { g.lineStyle(p.w * s + gw * 2, p.c, p.a * av); g.strokePoints(pts(p.pts), p.close); }
      }
    }
    if (p.k === "disc") { g.fillStyle(p.c, p.a); g.fillCircle(q.x, q.y, p.r * s); }
    else if (p.k === "ring") { g.lineStyle(p.w * s, p.c, p.a); g.strokeCircle(q.x, q.y, p.r * s); }
    else if (p.fill) { g.fillStyle(p.c, p.a); g.fillPoints(pts(p.pts), true); }
    else { g.lineStyle(p.w * s, p.c, p.a); g.strokePoints(pts(p.pts), p.close); }
  }
}

// --- backend 2: SVG ---------------------------------------------------------------------
const hex = (c) => `#${c.toString(16).padStart(6, "0")}`;
const num = (v) => (Math.round(v * 100) / 100).toString();
const path = (ps, close) =>
  `M ${ps.map(([x, y]) => `${num(x)} ${num(y)}`).join(" L ")}${close ? " Z" : ""}`;

function svgPrim(p, ind) {
  const f = p.glow > 0 ? ` filter="url(#rx-glow)"` : "";
  const id = p.id ? ` id="${p.id}"` : "";
  if (p.k === "disc") {
    return `${ind}<circle cx="${num(p.x)}" cy="${num(p.y)}" r="${num(p.r)}" fill="${hex(p.c)}"`
      + ` fill-opacity="${num(p.a)}"${f}/>`;
  }
  if (p.k === "ring") {
    return `${ind}<circle cx="${num(p.x)}" cy="${num(p.y)}" r="${num(p.r)}" fill="none"`
      + ` stroke="${hex(p.c)}" stroke-width="${num(p.w)}" stroke-opacity="${num(p.a)}"${f}/>`;
  }
  if (p.fill) {
    return `${ind}<polygon points="${p.pts.map(([x, y]) => `${num(x)},${num(y)}`).join(" ")}"`
      + ` fill="${hex(p.c)}" fill-opacity="${num(p.a)}"${f}/>`;
  }
  // los trazos van todos como <path>, no como <polyline>: la onda tiene que ser un path de
  // verdad (se le reescribe la `d` desde JS) y no vale la pena tener dos serializadores.
  return `${ind}<path${id} d="${path(p.pts, p.close)}" fill="none" stroke="${hex(p.c)}"`
    + ` stroke-width="${num(p.w)}" stroke-opacity="${num(p.a)}"`
    + ` stroke-linecap="round" stroke-linejoin="round"${f}/>`;
}

// El mismo dato, serializado. Las tres alas salen con los MISMOS hijos y solo cambia el
// `transform` del grupo, o sea que editar una es editar las tres.
export function toSVG(opts = {}) {
  const { size = BOX, bg = true, o = {} } = opts;
  const L = [];
  L.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOX} ${BOX}"`
    + ` width="${size}" height="${size}">`);
  L.push(`  <defs>`);
  L.push(`    <filter id="rx-glow" x="-60%" y="-60%" width="220%" height="220%">`);
  L.push(`      <feGaussianBlur stdDeviation="7" result="b"/>`);
  L.push(`      <feMerge><feMergeNode in="b"/><feMergeNode in="b"/>`
    + `<feMergeNode in="SourceGraphic"/></feMerge>`);
  L.push(`    </filter>`);
  L.push(`  </defs>`);
  if (bg) L.push(`  <rect width="${BOX}" height="${BOX}" fill="${hex(RX.black)}"/>`);
  L.push(`  <g id="reactor">`);
  L.push(`    <g id="shell">`);
  for (const p of shellParts(o)) L.push(svgPrim(p, "      "));
  L.push(`    </g>`);
  L.push(`    <g id="core">`);
  for (const p of coreParts(o)) L.push(svgPrim(p, "      "));
  L.push(`    </g>`);
  for (let i = 0; i < 3; i++) {
    L.push(`    <g id="wing-${i + 1}" transform="rotate(${WING_ROT[i]} ${CX} ${CY})">`);
    for (const p of wingParts(i, o)) L.push(svgPrim(p, "      "));
    L.push(`    </g>`);
  }
  L.push(`  </g>`);
  L.push(`</svg>`);
  return L.join("\n") + "\n";
}
