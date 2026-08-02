// GEOMETRIA PURA DE LOS EFECTOS. No importa Phaser y no sabe que hay una escena: entra
// estado, salen PUNTOS en un espacio 0..1, y el que dibuja pone la transformada. Mismo idiom
// que `reactor.js`, un escalon mas abajo: aca no hay backend SVG, o sea que no hacen falta
// primitivas (`disc`/`ring`/`poly`) y alcanza con los puntos. Por eso se comprueba desde node
// (`test-music.js`): determinismo, cantidad y que no se salga de su caja.
//
// Todo sale de `hash(i)`, nunca de `Math.random()`: el mundo es funcion de `songT` y
// rebobinar tiene que traer el MISMO rayo y las MISMAS esquirlas.
const hash = (i) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };

// EL SUELO OUTRUN (`meshWave` con `mode` 2). Es la MISMA malla del nivel 2 con otra ola: no hay
// capa nueva, el nivel 1 enciende `mesh` en su `decor` y declara `wave.mode` = 2. Entra `(x, z)`
// del mundo y sale un escalar -1..1, sin Phaser y sin escena, o sea que se comprueba desde node
// igual que `bolt` y `pyras`.
//
// La diferencia con el agua del nivel 2 son dos cosas, y las dos son la referencia retro:
//  - **al lado de la pista es PLANO**. La ola del nivel 2 ondula desde el borde mismo, y eso es
//    justo lo que hace que un outrun no se lea como outrun: ahi lo que hay pegado a la ruta es
//    desierto liso y las montanas estan lejos. `x0` es donde arranca a levantarse y `MTN_W` =
//    900 es cuanto tarda en levantar del todo. La rampa va **al cuadrado**: lineal deja una
//    cuna visible en el arranque, y al cuadrado la montana sale del piso sin junta.
//    **`x0` LO PONE EL QUE DIBUJA, y es el borde de ADENTRO de la propia fila** (`xi` en
//    `drawMesh`), no un numero del mundo. Con `MTN_X0` = 700 fijo la cordillera no existia en el
//    campo cercano y eso esta medido: el hueco contra la pista es constante en PANTALLA (`xi =
//    edge + 90/s(z)`), o sea que en el mundo se abre con la distancia y solo llega a 700 en
//    z=4000 (xi = 688); para toda fila mas cercana la franja dibujada caia ENTERA dentro de la
//    zona plana. Relieve pico a valle en pixeles, antes -> ahora: z=400 0.0 -> 0.0, z=700 0.0 ->
//    4.0, z=1100 3.4 -> 21.2, z=1500 13.2 -> 33.4, y de z=2600 para atras identico (29.0 / 23.5
//    / 18.4), o sea que devuelve el campo cercano sin tocar lo que ya estaba medido. Y no acerca
//    la malla a la pista: `v` vale exactamente 0 en `xi`, o sea que el relieve NACE en el borde
//    de la capa (holgura medida contra la pista: 88px, plana con la profundidad).
//    `MTN_X0` = 700 queda de respaldo para el que no pasa borde: la camara de perfil
//    (`drawMeshFlat`), donde las franjas son cortes a x FIJA del mundo y ahi ese numero es el
//    borde de verdad.
//  - **crestas en PICO y no en seno**: `1 - 2|sin|` es una onda triangular, o sea faldas rectas
//    y cumbre en punta, que es como se dibujaban esas montanas. Un seno da lomas.
//
// El termino de z pesa 0.30 contra 0.70 el de x: la cordillera es de x (se ve de frente) y lo
// de z es solo que no salgan todas las cumbres a la misma altura fila tras fila.
// **No lleva `t`**: una montana no ondula. Lo que se mueve es la pista, y las filas de la malla
// ya se desplazan solas con `songT`.
// LOS DOS PERIODOS, medidos contra las columnas que la malla DIBUJA y no elegidos: `MTN_KX` =
// pi/620 son 1240 del mundo entre cumbres (2 crestas por lado, contadas con paso 1 y con el paso
// de las columnas) y `MTN_KZ` = 2pi/1400 son 1400 en z con filas cada 70. Lo que hay que medir
// de un periodo es que la reticula lo RESUELVA: muestras por periodo en x (nx real por fila,
// medido en vivo) z=400 411 / z=700 63.8 / z=1100 30.0 / z=1500 21.8 / z=2000 16.2 / z=2600 12.3
// / z=3300 9.7 / z=4000 8.0, y en z 20 fijas. El peor caso (8.0) esta muy por encima de las 3
// muestras de Nyquist con las que se midio la malla del nivel 2, o sea que no aliasa.
const MTN_X0 = 700, MTN_W = 900, MTN_KX = Math.PI / 620, MTN_KZ = (2 * Math.PI) / 1400;
export const outrun = (x, z, x0 = MTN_X0) => {
  const m = Math.min(1, Math.max(0, (Math.abs(x) - x0) / MTN_W)) ** 2;
  if (!m) return 0;
  return m * (0.70 * (1 - 2 * Math.abs(Math.sin(x * MTN_KX))) + 0.30 * Math.sin(z * MTN_KZ));
};

// RAYO ELECTRICO (referencia 3, ELECTRIC ARCS). Desplazamiento del punto medio: se parte el
// segmento en dos y se corre el medio, `lv` veces. Con lv=5 son 33 puntos, que es lo que hace
// falta para que se lea como descarga y no como zigzag.
//
// El desplazamiento se DIVIDE por el nivel (`jag / (l + 1)`) y no se mantiene: con amplitud
// constante en todos los niveles el ultimo pasa a mandar y el rayo sale peludo, o sea ruido
// alrededor de una recta. Dividiendo, el nivel 0 pone la forma (una sola curva grande) y los
// de abajo el detalle, que es un rayo.
//
// Va en su propio espacio: x de 0 a 1 a lo largo del rayo, y = lo que se sale de la recta.
// El que dibuja pone los dos extremos, o sea que el mismo rayo sirve cruzando la pantalla,
// saliendo del reactor o pegado al suelo.
export function bolt(seed, lv = 5, jag = 0.13) {
  let pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
  for (let l = 0; l < lv; l++) {
    const out = [pts[0]], d = jag / (l + 1);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      out.push({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2 + (hash(seed * 31 + l * 7.7 + i * 13.3) - 0.5) * 2 * d,
      }, b);
    }
    pts = out;
  }
  return pts;
}

// EL RAYO NUNCA ES HORIZONTAL (`arcDir`). Se reporto que un relampago cruzando de lado a lado
// "rompe" la imagen, y es cierto: la pista es una fuga vertical, o sea que lo unico horizontal
// de la pantalla es el horizonte, y una descarga paralela a el se lee como una grieta en el
// render. El angulo se mide desde la VERTICAL y solo hay TRES familias (`k` = -1 / 0 / +1):
// arriba-izquierda, arriba y arriba-derecha, que son exactamente las tres direcciones pedidas
// ("top-left to bottom-right", "top-right to bottom-left" y "top to bottom").
//
// `ARC_TILT` = 30 grados desde la vertical, o sea 60 desde la horizontal, y `ARC_JIT` = 10 de
// sorteo. El sorteo no es cosmetico: con las tres familias secas los 8 rayos del fogonazo caian
// encimados en tres rectas. El peor caso es 30+10 = 40 desde la vertical, o sea **50 grados
// desde la horizontal**, y `test-music.js` falla si algun sorteo baja de 45.
//
// `dn` es hacia donde va: -1 sale hacia arriba (desde el reactor) y +1 baja (desde el canto de
// arriba). Es la MISMA recta en los dos casos, lo unico que cambia es de que punta se dibuja.
//
// `all` = las SEIS familias, o sea las tres de arriba MAS las tres espejadas hacia abajo. Se
// reporto que los rayos del reactor "solo van hacia arriba" y que tienen que salir "desde todos
// los ejes desde el centro": un nucleo de plasma irradia en redondo, no en abanico. Espejar no
// rompe la regla de arriba, la CONSERVA: el peor caso sigue siendo 30+10 = 40 grados desde la
// vertical, o sea 50 desde la horizontal, con el rayo yendo para abajo en vez de para arriba.
// Seis y no un angulo libre porque un sorteo continuo pasa por el horizontal y ese es el que se
// lee como una grieta en el render.
export const ARC_TILT = Math.PI / 6, ARC_JIT = Math.PI / 18;
export function arcDir(seed, dn = 1, all = 0) {
  const j = Math.floor(hash(seed) * (all ? 6 : 3));
  const k = (j % 3) - 1;
  const d = all && j >= 3 ? -dn : dn;
  return d * (Math.PI / 2) + k * ARC_TILT + (hash(seed + 0.37) - 0.5) * 2 * ARC_JIT;
}

// Las RAMAS son lo que separa una descarga de un cable doblado: salen de un punto del rayo
// principal, van mas cortas y se apagan antes. Cada una es un `bolt` con su semilla, o sea
// que tambien es deterministica.
// Devuelve `{ at, pts, len }`: `at` = fraccion del rayo principal donde nace (para que el que
// dibuja sepa de que punto sale) y `len` = cuanto mide comparada con el.
export function forks(seed, n = 3) {
  return Array.from({ length: n }, (_, i) => {
    const r = hash(seed * 17 + i * 3.3);
    return {
      at: 0.18 + 0.6 * r,
      len: 0.18 + 0.3 * hash(seed * 17 + i * 3.3 + 0.5),
      dir: (hash(seed * 17 + i * 3.3 + 0.25) - 0.5) * 1.6,   // radianes contra el rayo padre
      pts: bolt(seed * 5 + i + 1, 3, 0.2),
    };
  });
}

// PIRAMIDES DE METAL (reemplazan a las esquirlas de la referencia 7). `p` = progreso 0..1
// del estallido.
//
// El recorrido es `1 - (1 - p)^2` y no `p`: sale de golpe y FRENA, que es lo que hace un
// trozo de metal contra el aire. Lineal se lee como que las particulas flotan hacia afuera.
// La `y` va aplastada (0.62) y con una caida (`-0.18 p^2`): el estallido es en el plano de la
// pantalla pero pesa, y un circulo perfecto se lee como un icono de explosion.
//
// Devuelve el CENTRO de cada pieza, su giro y su medio alto, todo en unidades del radio del
// estallido: el que dibuja las convierte en las CARAS de una piramide (`pyraFaces`).
// Son 14 y no 22: una piramide con dos caras ocupa mas que un rombo plano, y con 22 el
// estallido se leia como confeti.
export function pyras(seed, n = 14, p = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = hash(seed * 7 + i) * Math.PI * 2;
    const d = (0.35 + 0.65 * hash(seed * 7 + i + 0.5)) * (1 - (1 - p) ** 2);
    out.push({
      x: Math.cos(a) * d,
      y: Math.sin(a) * d * 0.62 - 0.18 * p * p,
      rot: a + p * (hash(seed * 7 + i + 0.25) - 0.5) * 5,
      r: (0.07 + 0.11 * hash(seed * 7 + i + 0.75)) * (1 - 0.45 * p),
      a: Math.min(1, 2.5 * (1 - p)),
    });
  }
  return out;
}

// LAS DOS CARAS VISIBLES de una piramide de base triangular. No es un poligono plano: son dos
// triangulos que comparten la arista `apice - esquina de adelante`, y lo que los hace leer como
// un volumen es que van con DISTINTO gris (`shade`), no el contorno. Sin la esquina de adelante
// (o sea con la base de canto) esto es un triangulo plano, que es justo lo que se venia a
// cambiar.
export function pyraFaces(s, tilt = 0.7) {
  const c = Math.cos(s.rot), sn = Math.sin(s.rot);
  const R = (x, y) => ({ x: s.x + x * c - y * sn, y: s.y + x * sn + y * c });
  const w = s.r * 0.78;
  const ap = R(0, -s.r), L = R(-w, s.r), F = R(0, s.r + tilt * w), Rt = R(w, s.r);
  // la cara iluminada primero y la de sombra despues: el que dibuja las pinta en ese orden
  return [{ pts: [ap, L, F], shade: 1 }, { pts: [ap, F, Rt], shade: 0.42 }];
}
