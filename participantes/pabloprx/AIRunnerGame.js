// CDN build exports names only (no default). En el repo base cambiar a: import Phaser from "phaser";
import * as Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.esm.js";
import { PALETTE, HEX, FONTS } from "./theme.js";
import {
  KINDS, LANE_X, lanesX, PLAYER_H, PLAYER_Z, SPAWN_Z, JUMP_V, SLIDE_T, DASH_T, hits,
  stepPlayer, ride, SPEED_MULS,
} from "./physics.js";
import { pose, drawAvatar } from "./avatar.js";
import {
  LEVELS,
  loadLevel, zOf, leadOf, enterOf, enterDz, bgAt, pulseAt, layerAt, fxAt, flipAt, mix, rowAt, timeOfRow,
  tileOf, zoneAt, zoneOfRow, sectionAt, sectorOfRow, chaseAt, CHASE, markWin, flashIdx, markN, GHOST_ROW, gridAt,
  hatAt, hypeAt, gateAt, fxOfRow, hueAt, rotHue,
} from "./music.js";
// geometria de los efectos nuevos, aparte y sin Phaser (mismo idiom que `reactor.js`):
// rayos electricos (ref 3) y esquirlas metalicas (ref 7 + 2). Aca solo se decide donde van.
import { bolt, forks, pyras, pyraFaces, arcDir, outrun } from "./fx.js";
import { loadAudio } from "./transport.js";
import { CAMS } from "./cams.js";
// la geometria del reactor vive aparte y es la MISMA que genera `assets/reactor.svg`
// (`tools/reactor-svg.js`): una sola verdad, dos backends. Aca solo se decide donde va.
import { drawReactor as paintReactor, CX as RCX, CY as RCY } from "./reactor.js";
import { toScript, fmt } from "./record.js";

// Pseudo-3D endless runner. Camera at origin looking down +z, ground at y=0.
// El mundo entero es funcion del tiempo de la cancion: por eso se puede rebobinar.
// Que nivel se carga sale de la URL (`?level=orbit-motion`); sin parametro, el de siempre.
// `?level=` vacio o con un nombre que no existe caia en `LEVELS[undefined]` y reventaba en
// `loadLevel` (leer `.schema` de undefined). El respaldo es el nivel de siempre.
const LEVEL_Q = new URLSearchParams(location.search).get("level");
const LEVEL = LEVELS[LEVEL_Q] ? LEVEL_Q : "insomnia-drop";
// MODO JUEGO (`?play=1`, o sea entrando por el menu de `index.html`): sin marcas, sin numeros de fila, sin
// HUD, sin teclas de diseno y CHOCAR CUENTA. Su ausencia es el modo diseno de siempre, que es
// donde estan medidos todos los diffs de 0 pixeles del proyecto: sin el flag no cambia un byte.
const PLAY = new URLSearchParams(location.search).has("play");
// una vida: muerto se congela el mundo en el sitio y se espera medio segundo de reloj REAL
// antes de volver a empezar. La espera sigue sin poderse saltar (es lo que evita machacar el
// reintento), pero a 3s cortaba el ritmo: el nivel entero va a 130-137bpm y 3s son 7 compases
// mirando una pantalla quieta. A 0.5 se lee el % y ya estas corriendo otra vez.
const DEAD_T = 0.5;
const RATES = [1, 0.5, 0.25, 0.1, 0.05];
const RATE_KEYS = ["ONE", "TWO", "THREE", "FOUR", "FIVE"];
// El nivel es violeta: TODO el decorado (pins, portones, formas, bandas del suelo) vive en
// esa familia. Los obstaculos se salen de ella a proposito, que es lo unico que hay que leer:
//  - lo que MATA (`block`, `gap`) es rojo y nada mas es rojo.
//  - lo que se PASA con una tecla (`low` saltar / `high` deslizar) es el ACCENT, los dos
//    igual: cual de las dos teclas lo dice el simbolo de la cara (GLYPH_UV), no el color.
// Los orbs NO se chocan, se agarran: amarillo el de dash, rosa el de salto.
// el rojo puro se salia del nivel: KILL es un magenta-rojo (60% hacia el rosa), o sea que
// sigue siendo el unico color caliente pero vive en la misma gama que el resto.
const KILL = 0xed4679;
const COLORS = {
  block: KILL, low: PALETTE.accentSoft, high: PALETTE.accentSoft,
  gap: KILL, orb: PALETTE.yellow, orbj: PALETTE.pink,
};
// LA FAMILIA ES DEL NIVEL, no del renderer: sale de `neon.fam` en LEVELS (ver `get neon`).
// Esto es solo el respaldo de los frames en los que todavia no cargo ninguno, y es la familia
// violeta del nivel 1, que la declara identica para que no se mueva un pixel.
// Sin rosa: el rosa quedo a un paso del KILL y el decorado no puede parecerse a lo que mata.
const NEON = [PALETTE.violet, PALETTE.accentSoft, PALETTE.accent, 0x7c3aed];
// que pide cada celda, al lado del numero de fila (tecla T): se lee de un vistazo
const GLYPH = { block: "#", low: "^", high: "v", gap: "_", orb: "o", orbj: "O" };
// el mismo simbolo, pero DIBUJADO en la cara del obstaculo: el color no dice que tecla es.
// Trazos en el espacio uv de la cara (u = ancho, v = 0 en el lado y1 de la caja), asi que
// con la gravedad invertida la cara se da vuelta sola y el chevron sigue apuntando al mismo
// lado del MUNDO: `low` se salta (apunta lejos del piso), `high` se desliza (apunta al piso).
// Son DOBLES (dos chevrones, no uno) y van de u=0.28 a u=0.72: un solo chevron chico se
// perdia contra el halo de la caja. La X del `block` vive en la mitad de abajo (v 0.52-0.95)
// porque ahi la cara es un TRIANGULO y arriba no hay ancho donde dibujarla.
const GLYPH_UV = {
  low: [[[0.3, 0.6], [0.5, 0.2], [0.7, 0.6]], [[0.3, 0.95], [0.5, 0.55], [0.7, 0.95]]],
  high: [[[0.3, 0.05], [0.5, 0.45], [0.7, 0.05]], [[0.3, 0.4], [0.5, 0.8], [0.7, 0.4]]],
  block: [[[0.32, 0.55], [0.68, 0.94]], [[0.68, 0.55], [0.32, 0.94]]],
};
// A donde apuntan los pin spots (`drawPins`), en el plano (x, y) del MUNDO y para el tubo de
// la derecha; el de la izquierda va espejado. -x es hacia la pista.
const PIN_DIRS = [
  [0, -1],    // v: al piso
  [-1, 0],    // <-: cruzan la pista de lado a lado
  [1, 0],     // ->: hacia afuera
  [-1, 1],    // <- + arriba
  [1, 1],     // arriba + ->
  [-1, -1],   // <- + al piso
];
// LAS FIGURAS DE LA CONSTELACION. Una por destello de fantasma, en orden: el primero (la f63)
// es el rombo de siempre y de ahi en mas van cambiando. `n` = lados, `rot` = angulo de arranque,
// `spin` = vueltas por compas (el signo es el sentido), `sway` = vaiven horizontal en pasos.
// El indice sale de las marcas que quedaron atras, o sea que rebobinar trae la misma figura.
const FIGS = [
  { n: 4, rot: 0, spin: 0, sway: 0 },                 // rombo, quieto (el de siempre)
  { n: 6, rot: 0, spin: 0.25, sway: 0 },              // hexagono girando
  { n: 3, rot: 0, spin: 0, sway: 0.5 },               // triangulo con vaiven
  { n: 4, rot: Math.PI / 4, spin: -0.5, sway: 0 },    // cuadrado plano, girando al reves
  { n: 5, rot: 0, spin: 0.15, sway: 0.35 },           // pentagono
];
const FLIP_T = 0.35;   // lo que tarda la camara en dar la vuelta (la gravedad cambia en la cue)
// Cuanto FLOTA el muneco, en unidades de mundo (PLAYER_H = 110). 1.2 = 1.8px en pantalla a
// v=700, o sea que se nota que no es una estatua y nada mas. Aca habia un bote de 5 (7.4px)
// y un vaiven de 1.4: los dos eran del muneco que corria, y sobre una pista PLANA y flotando
// no hay pisada que los justifique. Es lo que se veia como que se bamboleaba.
const HOVER = 1.2;
// los trucos del salto: uno por salto, elegido con hash(cuando saltaste)
const TRICKS = ["heli", "grab", "flip", "heli", "grab"];
// colchon para cobrar un orb que pasaste sin mantener. 150ms cubre el retraso humano que se
// midio en la grabacion (los saltos caian entre -109 y +119ms de la fila).
const ORB_GRACE = 0.15;
const TAG_COLORS = {
  kick: PALETTE.red, accent: PALETTE.yellow, voice: PALETTE.green,
  kicks: PALETTE.red, response: PALETTE.yellow, acidbass: PALETTE.green, snare: PALETTE.cyan,
};
const MAX_LABELS = 26;
// Etiquetas de tile visibles a la vez. Sobra: los numeros se cortan en z=2600, o sea
// (2600-PLAYER_Z)/(beat*speed) filas. Medido: 3.84 filas x 3 carriles = 12 en el nivel 1
// (v=1060) y 3.07 x 4 = 13 en el nivel 2 (v=1400). El 48 es de cuando la pista iba a 700.
const MAX_TILES = 48;
// La frase que vuela en el break la declara el NIVEL (`acid` en LEVELS); esto es el respaldo,
// o sea lo que decia el renderer antes de existir el dial. El pool de textos se dimensiona al
// mas largo que pueda pedir cualquier nivel, no a este: crear objetos de texto en `draw()`
// seria una fuga por frame.
const ACID = "THIS IS ACID";
const MAX_ACID = 24;
// LA MALLA DE ONDAS (`drawMesh`), la capa nueva del nivel 2. Cyan-verde sobre negro: `LO` es
// el valle y `HI` la cresta, o sea que la altura tambien se lee por color y no solo por forma.
// Ninguno de los dos es del `NEON` del nivel 1 a proposito: son fondos de niveles distintos.
// `LO` bien apagado (medido en pantalla: con 0x0a6f8c el valle todavia se leia como linea
// encendida y la ola salia plana; el contraste es lo que da la profundidad).
// Son el RESPALDO, no la unica paleta: el nivel puede declarar `mesh: { lo, hi }` (ver `LEVELS`
// y `loadLevel`). Sin declararlo salen estos dos, o sea lo que el renderer hacia antes del dial.
const MESH_LO = 0x063a4a, MESH_HI = 0x5fffd0;
// LAS FRECUENCIAS DE LA OLA. periodo = 2*PI/k, y lo que hay que meter dentro es el ancho
// VISIBLE de un lado y la mitad cercana en z. El ancho ya no es fijo (`xi` y `xo` salen de la
// fila, ver `MESH_GAP` y `drawMesh`), asi que las cuentas de abajo van con el de la fila del
// medio, que era el ancho unico de antes: 1400 - (edge+200) = **860**, y en z de `zn` a la
// mitad de `MESH_FAR` = 1070.
// Antes: kx=0.0042 (periodo 1496) y kz=0.0031 (periodo 2027), o sea **0.58 crestas en el
// ancho y 0.53 en la mitad cercana**: menos de una onda entera en cuadro. Eso no ondula,
// BASCULA, y se lee como el suelo wireframe de los 80 con una cuadricula encima.
//   kx = 0.016  -> periodo 392.7 -> 860 / 392.7 = **2.19 crestas por lado**
//   kz = 0.0125 -> periodo 502.7 -> 1070 / 502.7 = **2.13 crestas en la mitad cercana**
//                                  (2140 / 502.7 = 4.26 en toda la profundidad dibujada)
// 0.016 seguia siendo poco: 2.19 crestas por lado se leen como dos lomas, no como agua. Se
// probaron 0.020 (periodo 314, 2.74 crestas) y **0.024** (periodo 261.8, 3.28) mirando la
// captura contra las fotos de referencia y gano 0.024: con 0.020 el campo cercano todavia son
// dos lomas largas. Nyquist se mide con el paso PEOR, que es el de las filas de mas lejos:
// 31 de paso contra 261.8 de periodo son 8.4 muestras (ver `xo` en `drawMesh`), o sea que
// `MESH_NX` se queda en 18.
// El tercero sigue siendo de periodo LARGO (2*PI/0.0017 = 3696, o sea 4 veces el ancho) y va
// en x+z: es lo que rompe la regularidad de los otros dos, que solos dan un damero.
const MESH_KX = 0.024, MESH_KZ = 0.0125, MESH_KD = 0.0017;
// EL RIZO, el cuarto termino, y es del CAMPO CERCANO. Medido contando maximos locales de la
// ola sobre el ancho REALMENTE dibujado (que no es fijo: `xo` lo corta el borde de pantalla),
// con solo los tres senos de arriba: z=700 -> **1.08 crestas**, z=1500 -> 3.25, z=2500 -> 2.79,
// z=4000 -> 2.00. O sea que la fila mas cercana, que es la que mide 234px de cresta a valle en
// pantalla, era UN LOMO: se lee como que el terreno bascula, no como que ondula.
// No se arregla subiendo `MESH_KX`: el ancho de la fila cercana en el MUNDO es 289 (a z=1500
// son 863), asi que para meterle 3 crestas hace falta un periodo de ~96, y con el mismo peso
// la ola quedaria de 51px de alto por 48 de ancho, o sea picos y no olas.
// Se agrega una octava: periodo 83.8 (`MESH_KR`) con **0.4 de peso** contra 1 + 0.70 + 0.45 del
// resto, o sea +-19 del mundo = 37px en pantalla a z=700 sobre los 234 del oleaje. Medido con
// el rizo: z=700 pasa a **3.38 crestas** y las otras tres z no se mueven (3.25 / 2.75 / 2.00).
// Y se APAGA con la distancia (`MESH_RIP_Z` = 1000: entero en el jugador, cero en z=1720), que
// es lo que lo hace gratis en Nyquist: donde el paso entre columnas ya no lo resuelve (3.2
// muestras por periodo a z=1500) el termino vale 0.09 y su alias mide **4px** en pantalla.
// Va contra el tiempo (`-t*1.9`) y no a favor: el rizo corre hacia la camara y el oleaje se
// aleja, y ese cruce es lo que lo separa del fondo en vez de arrastrarlo.
const MESH_KR = 0.075, MESH_RIP = 0.4, MESH_RIP_Z = 1000;
// DENSIDAD, y sale de Nyquist, no del gusto: el paso entre muestras tiene que estar bastante
// por debajo de MEDIO periodo o la ola se aliasa y vuelve a verse como una reja.
//  - columnas: 18 sobre 860 de ancho = **50.6 de paso**, o sea **7.8 muestras por periodo** en
//    x (el minimo de Nyquist es 2). Repartidas LINEALES y no con `u^1.7`: `proj` es lineal en
//    x (`x * fov/z`), asi que parejas en el mundo son parejas en PANTALLA. Medido a z=1500 y
//    h=651: **23.1px entre columnas, todas iguales**; con `u^1.7` iban de 17px entre las dos
//    internas a 107px entre las dos externas.
//  - filas: una cada 120 = **4.2 muestras por periodo** en z (eran 260, que con el periodo
//    nuevo darian 1.9, o sea por DEBAJO de Nyquist).
// Lo que paga las columnas es que las lineas de CRUCE van una de cada `MESH_CROSS`: la
// referencia son crestas largas, no una cuadricula.
// DENSIDAD MEDIDA CONTRA LA REFERENCIA, segunda vuelta. Con 18 columnas y una fila cada 120 la
// malla llenaba el **16.9% de la banda en la que tiene permiso de existir** y cualquier columna
// vertical de pantalla la cruzaban **9-12 polilineas**; en la referencia son decenas. Lo que
// manda ahi es `MESH_DZ`, no `MESH_NX`: las polilineas de una fila corren de lado a lado (son
// LAS CRESTAS, lo que la referencia tiene largo y seguido) y las de cruce solo las cosen.
//   dz 120 -> 70: de 33 a **57 filas**, o sea 1.7 veces mas crestas cruzando la pantalla.
//   nx  18 -> 28: paso de 17.0 a 10.7 del mundo en la fila cercana (16.6 -> 10.4px en pantalla)
//                 y de 50.7 a 32.0 a z=1500, que es lo que resuelve el rizo de arriba.
//   cross 4 -> 3: la cuadricula sigue siendo mas suelta que las crestas (una de cada tres).
// Lo paga el presupuesto: ver el coste medido en `drawMesh`.
// `MESH_NX` es el MINIMO de columnas por fila; el numero de verdad sale de `MESH_PX`, que es
// el paso en PANTALLA (16px). Ver `xo` en `drawMesh`: desde que el borde de afuera es el de la
// pantalla y no 1400 del mundo, las filas de lejos cruzan mucho mas ancho y con 28 columnas
// fijas el paso se les iba a 2.2 muestras por periodo. Con 16px de paso van de 28 (fila
// cercana) a 35 (las de lejos) y ninguna baja de 3 muestras por periodo.
const MESH_NX = 28, MESH_PX = 16, MESH_DZ = 70, MESH_CROSS = 3;
// ALTO de la ola, en unidades de mundo y antes de multiplicar por el beat (0.45 + 0.55*beat).
// Era 78 y en pantalla la ola se leia como una arruga: medido a z=1500 y h=651, cresta a
// valle son 2*amp*fov/z px, o sea **71px con el kick arriba y 32 entre golpes**. Con 120 son
// **109px y 49**, que es cuando aparecen los valles oscuros de la referencia.
const MESH_AMP = 120;
// SEPARACION DE LA PISTA, **en PIXELES de pantalla** y no en unidades de mundo. Era 45 de
// mundo (20.5px a z=1500, medido a h=651 con fov = h*1.05 = 683.6): la malla se pegaba a los
// divisores y se leia como que CRUZA la pista. Se subio a 200 de mundo, y eso arreglo el
// fondo pero rompio el campo CERCANO: 200 de mundo son 200*s px, o sea que a z=300 la malla
// arrancaba tan afuera que el **0%** caia dentro del canvas (12% a z=700, 54% a z=1100), y lo
// que se perdia eran justo las filas de pixeles mas grandes.
// En PANTALLA el hueco es casi el mismo a cualquier z: `xi = edge + 90/s(z)`, o sea que el
// borde interno se corre 197 del mundo a z=1500, 329 a z=2500 y solo 92 a z=700, que es lo que
// mete la fila cercana en cuadro. Medido, hueco en PIXELES entre el borde de la pista
// (`edge + 35`) y la primera columna de la malla:
//    z:            700    1500    2500    4000
//    antes (200):  161px   75px    45px    28px
//    ahora  (90):   56px   74px    80px    84px
// Antes iba de 161 a 28, o sea que la malla estaba lejisimos en el campo cercano y encima de la
// pista en el fondo. Lo que queda de variacion (56 -> 84) es la pista, que se angosta con la
// distancia (los 35 de la banda son mundo): el hueco propio de la malla es plano.
const MESH_GAP = 90;
// NIEBLA PROPIA. Antes 1500, que con `a = (0.16 + 0.34*pulse) * (1 - f)` dejaba la malla por
// debajo de alpha 0.05 en z=1870: la malla moria en el aire, **36px mas abajo que el fondo de
// la pista** (medido: pixel mas alto y=322 contra 286), o sea un foso negro a los dos lados.
// Tiene que llegar tan lejos como la pista. `MESH_FAR` pasa a ser `SPAWN_Z`, que es hasta
// donde se dibuja el suelo, y la niebla se estira a 3400 para que la fila de SPAWN_Z todavia
// tenga alpha: con 2600 (lo primero que se probo) el alpha se anulaba en z=3320, o sea 304 en
// pantalla, y seguia sin llegar. Medido con 3400: la ultima fila viva cae en z~3890 y el pixel
// mas alto de la malla pasa de **y=322 a y=289**, o sea de 88 a 55 por debajo del horizonte.
// Los 55 que quedan no son un foso: ahi ya no hay pista contra la que compararse (la pista
// converge al punto de fuga y la malla va 90px por fuera), y el resplandor de `drawSky` es lo
// que ocupa esa banda. Cubre el **5.53%** del canvas contra el 2.31% de antes.
// El alpha ademas va por DEBAJO del de las bandas del suelo (0.28 + 0.4*beat): la malla es
// fondo y la pista es lo que se juega.
const MESH_FOG = 3400, MESH_FAR = SPAWN_Z;
// DE PERFIL (ver `drawMeshFlat`) el campo son `MESH_FLAT_N` franjas repartidas entre estas dos
// alturas de MUNDO. `MESH_FLAT_Y` = la mas cercana (la de abajo): 380 del mundo proyecta en
// **y=221** y con la ola entera en el valle baja a **y=277**, o sea 94px por encima de los
// y=371 donde empieza lo que se juega (el techo de un `block`). Cruza el reactor (y 181..354),
// y eso es a proposito: ahi lo TAPA el (ver `tapa` en `drawMeshFlat`), que es lo que le da
// profundidad. Con 460 (lo primero que se probo) el campo quedaba entero por encima de el,
// apretado en 170px de cielo, y se leia como una cenefa.
// `MESH_FLAT_TOP` = la mas lejana: 670 del mundo proyecta en y=32 de 651, o sea que la ultima
// franja roza el borde de arriba del cuadro y el campo llena el cielo entero de esa camara.
// `MESH_FLAT_SKEW`: cuanto se corre la x del MUNDO por cada z. Sin esto (skew 0) cada franja
// es un corte a x FIJA, o sea que el unico termino que varia a lo largo de la pantalla es el
// de z (periodo 502 del mundo = 327px) y las 10 franjas salen con la MISMA forma, solo
// desplazadas: se leen como rayas paralelas y no como agua. Con 1.3 el termino rapido de x
// (periodo 261.8) entra tambien en el barrido y cae en **131px de periodo en pantalla**, o sea
// que bate contra el de z y la cresta deja de repetirse.
const MESH_FLAT_N = 14, MESH_FLAT_Y = 340, MESH_FLAT_TOP = 660, MESH_FLAT_SKEW = 1.0;
// EL REACTOR mide `REACTOR_R` de la altura de la pantalla de radio NOMINAL; el radio real es
// el nominal por 486/512 (`radioMax()` de `reactor.js`), o sea `1.898 * REACTOR_R` de diametro.
// Era 0.3 = **57% del alto** (371px de 651): el objeto MAS GRANDE de la pantalla estaba en el
// punto mas LEJOS. Con 0.148 eran **28.1%** (183px de 651) y con 0.160 son **30.4%** (198px):
// se subio con el pedido de "jefe final", donde lo que crece es el ESTADO QUIETO, porque el del
// drop ya estaba topado por el cuadro (ver `REACTOR_SNAP`).
// `REACTOR_UP` sube el centro esa fraccion de su propio radio por encima del FONDO DE LA
// PISTA, que no es el horizonte: el horizonte analitico (`h*0.36` = 234.4, donde caeria
// z=infinito) esta **58.1px por encima** del sitio donde la pista de verdad muere, que es
// `proj(0,0,SPAWN_Z).y` = 292.5. Colgado del horizonte, el reactor dejaba **37..59px de cielo
// negro** entre la punta de la carretera y su borde de abajo (medido en captura: y=248 en el
// drop2, 233 quieto, 252 en el outro), o sea que se leia como un logo flotando y no como el
// jefe al final de la recta. El ancla es `proj(0,0,SPAWN_Z).y` y sirve en las TRES camaras
// sin un caso especial: de perfil `y=0` proyecta en `this.horizon` clavado (o sea el mismo
// numero de antes) y en 1a persona da 250.4, que es donde muere la pista desde ahi.
// `REACTOR_A` es el alpha global: lo mas lejano de la escena no puede ser lo mas saturado.
// EN LAS TRES CAMARAS se dibuja igual, y no hace falta un caso especial en ninguna:
//  - **1a persona**: el reactor va en espacio de PANTALLA y se cuelga de `this.horizon`, que
//    es el mismo en 1a persona que en atras (`h * (0.5 - 0.14*cos(roll))`), o sea que queda
//    exactamente donde estaba: entero por encima del horizonte y sin tapar un metro de pista
//    (verificado en captura). Con el 57% de antes si habia que sacarlo; con el 28% no.
//  - **lado**: antes cortaba con `cam.flat` y el nivel 2 de perfil era un vacio negro (la
//    malla y el reactor son lo unico que dibuja). Al ser espacio de pantalla, ahi tambien
//    sale bien: se cuelga del horizonte de esa camara (h*0.72) y queda sobre la ola.
// `REACTOR_UP` = **0.92** y no 1: el radio REAL del cuadro (486 nominales = 91.5px) es mayor
// que el semialto de lo que se DIBUJA (86.5px medido sobre la silueta), asi que 0.92 deja el
// borde de abajo 2px POR DEBAJO del fondo de la pista, o sea tocandolo. Con 1.0 quedaria un
// pelo colgado y con 0.75 (lo de antes, y ademas contra el horizonte) 44px en el aire.
// DE PERFIL manda `REACTOR_UP_FLAT`, que es otra cosa: ahi el ancla es la linea del suelo
// (h*0.72 = 468.7, que es donde proyecta y=0) y la banda donde se JUEGA va de 371 (el techo
// de un `block`) a 469. Con 0.75 el reactor caia en **y 293..467** (medido apagando la capa y
// restando los dos frames), o sea que el dia que el nivel 2 tenga guion el primer block
// entraria por detras de el. Con 2.2 quedaba en **y 176..350**, entero por encima de los 371.
// Al pasar `REACTOR_R` a 0.160 el radio crece un 8%, y `UP_FLAT` baja a **2.05** para que no se
// despegue hacia arriba: con el mismo 2.2 el centro subia a 0.386h (y 152..350) y ahi el reactor
// deja de rozar el suelo de perfil, que es su ancla. A 2.05 el borde de abajo del DIBUJO (0.945
// del radio del cuadro, medido sobre la silueta) cae en **y=359.5 de 651**, o sea 11.5px por
// encima del techo del `block`: el guion del nivel 2 pasa por delante y no por detras.
// `REACTOR_A` es el alpha con el que la escena lo manda al fondo, y NO es un multiplicador
// plano: `DIM` en `reactor.js` le pone una curva por pieza (el chasis se apaga mucho mas que
// las pantallas y el nucleo). 0.85 y no 0.5: desde que solo aparece en el drop ya no tiene
// que convivir con el buildup, y a 0.5 el jefe entraba lavado justo en el sitio donde se lo
// estrena. Efectivo por pieza a 0.85: chasis 0.69 / fondo 0.75 / rejilla 0.80 / luz 0.92 /
// traza 0.96 / nucleo 0.98 (contra 0.19 / 0.29 / 0.38 / 0.71 / 0.84 / 0.90 a 0.5).
const REACTOR_R = 0.160, REACTOR_UP = 0.92, REACTOR_UP_FLAT = 2.05, REACTOR_A = 0.85;
// cuanto crece el reactor con la creciente (ver `reacAt`): +34% de radio en el pico
const REACTOR_GROW = 0.34;
// EL FOGONAZO DEL SNARE LO AGRANDA (`REACTOR_SNAP`, dentro de `reacAt`). Se reporto que el
// flash de la f66 tiene que ser "ultra visible y no un detalle sutil", y medido no lo era: el
// reactor del fogonazo media **32.0% del alto (208.6px de 651) y el del drop 37.6%**, o sea que
// el anticipo salia MAS CHICO que lo que anuncia. El techo esta medido y no elegido: para que
// el borde de arriba no se salga del canto hace falta `(1 + 0.05*lat)*(1 + S) <= 1.4604`, o sea
// S <= 0.391 con lat=1, **y eso vale con `REACTOR_R` en 0.148**: el techo escala con el radio,
// asi que con 0.160 baja a S <= 0.287 (1.4604 * 0.148/0.160 / 1.05) y el 0.35 de entonces se
// saldria del cuadro. Con **0.25** el fogonazo mide LO MISMO en pantalla que antes (en su fila
// `hype` vale 0.41, o sea `1.898*0.160*1.1394*1.25` = **43.25%** contra el
// `1.898*0.148*1.1394*1.35` = 43.20% de antes) y sigue siendo lo mas grande del nivel: el drop
// da 40.7% con `hype`=1 y 43.1% con el acercamiento en su pico. Un jefe cortado por el borde se
// lee como bug. La envolvente sigue siendo `(1-p)²`, o sea que crece de golpe y se desinfla
// dentro de su propia fila: no le queda nada prestado al drop.
const REACTOR_SNAP = 0.25;
// SE MUEVE EN X y SE ACERCA. Los dos en fraccion de su propio radio, o sea que no hay que
// re-medirlos si cambia `REACTOR_R` ni si la creciente lo agranda. Los periodos son 4 y 8
// compases y no uno solo: con el mismo periodo el vaiven y el acercamiento pican juntos y se
// leen como UN movimiento; a 4 y 8 el acercamiento cae una vez en fase y la siguiente contra.
// ACERCARSE es sobre todo BAJAR y no agrandarse: el techo de arriba esta a 4.5px (con
// `hype`=1 el radio ya es 103.4 de los 122.4 que caben), o sea que el tamano no tiene de donde
// crecer sin (a) salirse del cuadro o (b) pasar al fogonazo del snare, que es lo mas grande
// del nivel y esta medido. Bajando, en cambio, hay pantalla de sobra: el borde de abajo se
// mete 0.275 radios por debajo del final de la pista, que sigue muy por encima de la banda de
// juego. `NEAR` es fraccion del radio, `NEAR_Y` es en radios hacia abajo.
const REACTOR_SWAY = 0.22, REACTOR_NEAR = 0.06, REACTOR_NEAR_Y = 0.30;
// EL TIRON DE LAS HELICES (`fx` de tipo `spin`, ver `draw`): cuantas VUELTAS ENTERAS da el
// reactor dentro del tramo. Entero y no fraccion: el extra vuelve a 0 al salir del tramo, y
// solo con vueltas enteras eso cae exactamente en la orientacion donde arranco (con media
// vuelta habria un salto). 1 vuelta en un tramo de 2 filas (0.876s) son 3 pasadas de ala, o
// sea 3.4Hz: se lee como que arranca, gira y frena, que es lo que pide el ease in/out.
const SPIN_TURNS = 1;
// LA SACUDIDA DE CADA MARCA (`fx` de tipo `jolt`): cuanto dura el golpe, en BEATS. Ver `draw`.
// 0.18 y no 0.35, y el numero sale de MEDIR el tramo del drop donde todavia hay color (f68-f89,
// 9.64s: de la f90 para adelante el nivel ya esta declarado en fantasma). Con 0.35 (153ms) el
// golpe dejaba ese tramo **46.9% en blanco y negro** (31.4% puesto por el jolt) y parpadeando a
// **2.08Hz**, o sea que media parte coloreada del drop era monocroma: eso se come justo lo que
// se pidio en el mismo mensaje (el color del reactor y la deriva de tono). Con 0.18 (79ms, unos
// 5 frames a 60fps) el golpe se sigue leyendo entero -la envolvente arranca en 1- y el tramo
// vuelve a ser de color.
const JOLT_B = 0.18;
// EL CIELO EN COLUMNAS (`sky.mode` = `drift`, ver `drawSky`). `SKY_DRIFT_N` = cuantas de las
// franjas de abajo se parten: solo las pegadas al horizonte, porque mas arriba el alpha ya
// cayo (a la 8a de 20 vale `(1-8/20)^2` = 0.36 del tope) y partirlas seria coste sin imagen.
// `SKY_COLS` = 16 y no 8: con 8 cada columna mide 84px de un cuadro de 1248 y la onda se lee
// como bloques; con 32 el ancho de columna (42px) baja del de la ola de la malla y compiten.
const SKY_COLS = 16, SKY_DRIFT_N = 8;
// LAS CRESTAS FACETADAS (`wave[sec].shape` = `"pyra"`, ver `drawMesh`). `PYRA_THR` es la altura
// de la ola (en -1..1) a partir de la cual una cresta se rellena.
// LA FACETA VIVE EN UNA RETICULA MAS GRUESA QUE EL ALAMBRE, y eso no es gusto: la celda de la
// malla mide `MESH_PX` = 16px de ancho (sale de Nyquist) por la separacion entre filas, o sea
// 33px en z=700 y 7px en z=1500. Cualquier faceta hecha sobre esa celda mide ~19x12px, y a 238
// por frame eso es confeti, que es lo que se reporto dos veces. Encima el criterio de maximo
// local se quedaba con UNA celda de una mancha de cresta que mide 2.53 columnas x 1.69 filas, o
// sea un cuarto: medido, el 76% de las facetas no tocaba a ninguna otra. Con paso `PYRA_NX` en x
// y `PYRA_DZ` en z se indexan los MISMOS `row`/`hs` (cero puntos nuevos) y salen 42 formas de
// 85x28px en vez de 238 de 19x12, con el 117% de adyacencia, o sea crestas seguidas y no puntos.
// `PYRA_A` baja de 0.55 a 0.32 porque la tinta sube de 3.18% a 5.62% del cuadro: tinta por alpha
// queda en 1.80 contra 1.75, o sea la misma, que es lo que deja la malla por debajo del suelo.
const PYRA_THR = 0.6, PYRA_A = 0.32, PYRA_NX = 5, PYRA_DZ = 3;
// ANILLOS DE RESONANCIA METALICA (referencia 4), el fondo del nivel 2. Salen del punto de
// fuga hacia afuera: por eso no son una capa de `layers` (esas se desplazan de costado con el
// parallax y un anillo que se desplaza deja de ser un anillo concentrico).
// El PARALLAX de estos es RADIAL: `songT * speed * RINGS_K` los va abriendo, o sea que el
// fondo tambien viaja con la pista, que es lo que se pidio.
const RINGS_N = 9, RINGS_K = 0.06, RINGS_STEP = 130, RINGS_SQ = 0.62;
// el blanco del contratiempo (`drawHat`). 0.14 y no 0.22 como el del kick del drop: ese cae
// una vez por beat y este otra vez mas, o sea el doble de destellos, y al mismo alpha el
// cielo se queda gris.
const HAT_A = 0.14;
// rayos electricos (ref 3): cuantos MAS que el primero salen en el pico de la creciente, y
// cuantos salen de golpe en el fogonazo del snare (ahi `hype` ya viene cayendo hacia el break:
// vale 0.41 en la f66, o sea 2 rayos, y un fogonazo de dos rayos no es un fogonazo).
const ARC_N = 3, SNAP_ARCS = 8;
// piramides de metal (ref 7): cuanto dura el estallido, de que tamano y cuantas.
// El color NO sale de la paleta del nivel: son gris y negro a proposito (metal), y por eso
// se leen igual en fantasma, que es donde el nivel las pide.
const BURST_T = 0.55, BURST_R = 0.17, BURST_SH = 14;
const BURST_LO = 0x2a3138, BURST_HI = 0xd8e2ea;
// el color del rig (`drawRig`) cuando el nivel no declara `neon.rig`: son las dos listas que
// estaban escritas dentro del renderer, y son distintas entre si (los focos no llevan
// accentSoft y el abanico arranca en cyan). Copiadas tal cual = el nivel 1 no se mueve.
const RIG_SPOT = [PALETTE.violet, PALETTE.cyan, PALETTE.pink];
const RIG_FAN = [PALETTE.cyan, PALETTE.violet, PALETTE.pink, PALETTE.accentSoft];
// EL HAZ DEL REACTOR (`beam`): cuanto baja por la pista y cuanto se abre.
// `BEAM_T` es lo que dura UN disparo en SEGUNDOS (y no una fraccion del hueco, ver `drawBeam`);
// `BEAM_Z0`/`BEAM_Z1` son la z del impacto al empezar y al terminar el barrido; `BEAM_PW`/
// `BEAM_PD` son el charco en el MUNDO (85 = medio paso de carril, el mismo que usa `drawGap`),
// y de ahi sale tambien el ancho del cono; `BEAM_PAIR` es cada cuanto salen DOS haces cruzados.
// `BEAM_A` sube de 0.30 a 0.45 porque el cono dejo de medir `w*0.10` = 124.8px fijos y ahora
// mide `BEAM_PW * s`, o sea 22.4px a z=2600 y 61.4px a z=946: entre 0.18 y 0.49 del viejo, o
// sea que a igual alpha el haz emite 2-5 veces menos luz. x1.5 lo deja igual por debajo.
const BEAM_A = 0.45, BEAM_T = 0.35, BEAM_Z0 = 2600, BEAM_Z1 = 760;
const BEAM_PW = 85, BEAM_PD = 150, BEAM_PAIR = 0.4;
// Cuanto se apaga el rig cuando cruza el mundo entero y no solo el cielo (`rigOver`). Medido en
// la BANDA DE JUEGO (la franja donde viven los obstaculos, y 332-419 de 582) en el buildup
// (t=10.7), luma media / p95: sin rig **20.32 / 48**, con rig a 0.55 **23.84 / 56**, con rig a 1
// **26.93 / 62**. O sea que 0.55 deja el aporte del rig en +3.52 en vez de +6.61: la mitad.
const RIG_DIM = 0.55;
// ...y hasta donde BAJA. El rig cruzando el mundo entero se queda en la mitad de ARRIBA: abajo
// esta el jugador (de pie ocupa y 405..498 de 582) y ahi el laser lo tapa. Solo se lee con
// `rigOver` puesto; sin el dial el rig llega al borde de abajo como siempre (nivel 1).
const RIG_CUT = 0.5;
// LUCES DE PISTA DE ATERRIZAJE (`lights`): a que distancia del borde, cada cuanto en z y de
// que tamano. El paso es MEDIO BEAT porque el chase de `chaseAt` cicla cada 4, o sea que la
// ola de luz tarda dos beats en recorrerse: a un beat por luz se lee como parpadeo suelto.
const LIGHT_OUT = 120, LIGHT_R = 13;
// LAS LUCES DIBUJAN UNA FIGURA, no una fila recta (`LIGHT_SHP`, una por compas via `hash`).
// `k` = ciclos de la figura a lo largo de la pista, `ax` = cuanto se corre en x (unidades del
// mundo) y `ay` = cuanto sube en y. Vale la pena que `ax` sea grande: mover la luz 40 del
// mundo a z=3000 son 4px de pantalla, o sea nada. La primera es la recta de siempre.
const LIGHT_SHP = [
  { k: 0, ax: 0, ay: 0 },        // recta: la de siempre
  // `k` = 2.5 y no 2: con un numero entero de ciclos por luz la fila entera se corre en bloque
  // (que es el "izquierda derecha izquierda derecha" que se reporto). Con 2.5 la onda CORRE a lo
  // largo de la pista, que es lo que se ve desde una cabina.
  { k: 2.5, ax: 190, ay: 0 },    // ola: la fila se abre hacia afuera y vuelve
  { k: 3, ax: 0, ay: 150 },      // saltos: la fila sube y baja del plano del suelo
  { k: 1.5, ax: 130, ay: 120 },  // helice: las dos cosas, desfasadas
];
// EL FOGONAZO DEL SNARE (`fx` de tipo `snap`): cuanto dura. 0.30s = 0.685 beats a 137bpm, o
// sea que se apaga dentro de su propia fila y el apagon del break se lo traga entero.
const SNAP_T = 0.30;
// ruido determinista: misma i = mismo valor siempre, para que rebobinar de el mismo fondo
const hash = (i) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };

class RunnerScene extends Phaser.Scene {
  constructor() { super("AIRunner"); }

  create() {
    this.g = this.fantasma(this.add.graphics());
    this.labels = Array.from({ length: MAX_LABELS }, () => this.add.text(0, 0, "", {
      fontSize: "11px", color: HEX.textMuted, fontFamily: FONTS.mono.fontFamily,
    }).setOrigin(0, 1).setVisible(false));
    this.tileLabels = Array.from({ length: MAX_TILES }, () => this.add.text(0, 0, "", {
      fontSize: "11px", color: HEX.textMuted, fontFamily: FONTS.mono.fontFamily,
    }).setOrigin(0.5, 1).setVisible(false));
    this.acid = Array.from({ length: MAX_ACID }, () => this.add.text(0, 0, "", {
      fontSize: "48px", color: HEX.lime, fontFamily: FONTS.mono.fontFamily, fontStyle: "bold",
    }).setOrigin(0.5).setVisible(false));
    // el orb pide MANTENER ↑, que no se deduce de mirarlo: se dice con todas las letras
    this.orbHint = this.add.text(0, 0, "", {
      fontSize: "15px", color: HEX.pink, fontFamily: FONTS.mono.fontFamily, fontStyle: "bold",
    }).setOrigin(0.5, 0).setVisible(false);
    this.hud = this.add.text(20, 18, "", {
      fontSize: "16px", color: HEX.cyan, fontFamily: FONTS.mono.fontFamily, lineSpacing: 3,
    });
    this.hint = this.add.text(20, 0, "", {
      fontSize: "12px", color: HEX.textMuted, fontFamily: FONTS.ui.fontFamily,
    }).setText(
      "←/→ carril · ↑ saltar (mantener = dash en orb) · ↓ deslizar · SPACE play/pausa · " +
      "1-5 x1/.5/.25/.1/.05 · ,/. ∓compas (shift=beat) · L loop 8c · G #cue · HOME inicio · M marcas · " +
      "T filas/tiles · J capas · P fantasma · C camara · H gravedad · Y grabar · U exportar · " +
      "clic en la tira = ir a ese sector (shift = compas) · " +
      "K inmune · X mute · V feel · -/+ sync"
    );
    this.msg = this.add.text(0, 0, "cargando…", {
      fontSize: "28px", color: HEX.cyan, fontFamily: FONTS.mono.fontFamily, align: "center",
    }).setOrigin(0.5);

    const k = this.input.keyboard;
    const on = (key, fn) => k.on(`keydown-${key}`, fn);
    for (const key of ["LEFT", "A"]) on(key, () => this.move(-1));
    for (const key of ["RIGHT", "D"]) on(key, () => this.move(1));
    for (const key of ["UP", "W"]) on(key, () => this.jump());
    this.holdKeys = k.addKeys("UP,W");   // el dash del orb se sostiene, no se pulsa
    for (const key of ["DOWN", "S"]) on(key, () => this.slide());
    // muerto no se toca nada: SPACE y el clic volverian a soltar el audio con el mundo congelado,
    // y la espera es la mecanica ("so its not like spaming retry"). En diseno `dead` vale 0 siempre.
    on("SPACE", () => { if (!this.dead) this.tp?.toggle(); });
    // De aca abajo son las teclas de DISENO: en modo juego no se atan (no hay con que rebobinar,
    // ni volverse inmune, ni exportar el guion). `holdKeys` queda arriba a proposito: el dash del
    // orb lo necesita siempre.
    if (!PLAY) {
      on("R", () => this.resetRun());
      on("HOME", () => this.seek(0));
      RATES.forEach((r, i) => on(RATE_KEYS[i], () => this.tp?.setRate(r)));
      on("COMMA", (e) => this.seekGrid(-1, e.shiftKey));
      on("PERIOD", (e) => this.seekGrid(1, e.shiftKey));
      on("L", () => this.toggleLoop());
      on("G", () => this.gotoCue());
      on("M", () => { this.marks = !this.marks; });
      on("T", () => { this.nums = (this.nums + 1) % 3; });   // off / filas / tiles
      on("J", () => { this.bgMode = (this.bgMode + 1) % 3; });   // todas / solo base / solo detalle
      on("P", () => { this.ghostKey = !this.ghostKey; });   // fantasma a mano (el del nivel es la f63)
      // C elige la camara "de base": dentro de una zona con `cam` manda la zona
      on("C", () => { this.camPick = (this.camIdx + 1) % CAMS.length; this.setCam(this.camPick); });
      // flip a mano para probar: es una cue de flip mas, puesta en el songT de la tecla,
      // asi que rebobinar antes de haberla apretado tambien la deshace
      on("H", () => { this.hflip.push(this.songT); });
      // Y graba DESDE DONDE ESTAS HASTA EL FINAL y no toca nada anterior: se tira lo grabado
      // de aca en adelante (lo estas rehaciendo) y se anota la fila, que es de donde `U` va a
      // empezar a dictar. Lo que ya esta escrito a mano en el guion no se puede pisar.
      on("Y", () => {
        this.recOn = !this.recOn;
        if (!this.recOn) return;
        this.rec = this.rec.filter((a) => a.t < this.songT);
        this.recFrom = this.lv ? Math.max(0, rowAt(this.songT, this.lv)) : 0;
      });
      on("U", () => this.dumpRec());
      on("K", () => { this.godmode = !this.godmode; });
      on("X", () => { this.muted = !this.muted; this.tp?.setMute(this.muted); });
      on("V", () => { this.mulIdx = (this.mulIdx + 1) % SPEED_MULS.length; });
      on("MINUS", () => { if (this.tp) this.tp.adj -= 0.005; });   // sync a ojo: la linea
      on("PLUS", () => { if (this.tp) this.tp.adj += 0.005; });     // tiene que pisar el kick
    }
    this.input.on("pointerdown", (p) => {
      if (this.stripSeek(p)) return;
      if (this.tp && !this.tp.playing && !this.dead) this.tp.play();
    });

    this.marks = !PLAY;
    this.nums = PLAY ? 0 : 1;   // modo diseno: arranca mostrando las filas
    this.bgMode = 0;
    this.fig = 0;            // figura de la constelacion: una por destello (`FIGS`)
    this.neg = false;        // negativo: la imagen entera invertida (tramo `fx`)
    this.ghost = false;      // fantasma: lo pone `draw()` (la f63) o la tecla
    this.ghostKey = false;   // fantasma forzado a mano (tecla P)
    this.godmode = !PLAY;  // modo diseno: chocar no corta el dictado
    this.dead = 0;         // segundos de espera que quedan tras morir (reloj real, no songT)
    // el HUD y la lista de teclas son herramientas de diseno: jugando no van
    if (PLAY) { this.hud.setVisible(false); this.hint.setVisible(false); }
    this.muted = false;
    this.mulIdx = 0;
    this.songT = 0;
    this.hflip = [];   // flips a mano (tecla H): tiempos de cancion, no estado del nivel
    this.rec = [];     // grabacion (tecla Y): { accion, songT, carril }
    this.recOn = false;
    this.recFrom = 0;  // fila desde la que se dicta: `U` no emite nada anterior
    this.grav = 1;
    this.roll = 0;
    this.camPick = 0;
    this.setCam(0);
    this.resetRun();
    this.boot();
  }

  async boot() {
    try {
      this.lv = await loadLevel(LEVEL);
      this.byRow = new Map();   // fila -> [glifo por carril], para el indicador al lado de f<n>
      for (const c of this.lv.cues) {
        if (c.lane == null || !GLYPH[c.kind]) continue;
        const a = this.byRow.get(c.row) ?? Array(this.lanes).fill("·");
        a[c.lane] = GLYPH[c.kind];
        this.byRow.set(c.row, a);
      }
      this.tp = await loadAudio(this.lv.level.audio);
      window.__dbg = this;   // consola: __dbg.lv.cues, __dbg.seek(12), __dbg.tp
      this.msg.setText("click o SPACE para empezar");
    } catch (e) {
      this.msg.setText(`no carga el nivel:\n${e.message}`);
      console.error(e);
    }
  }

  get speed() { return (this.lv?.speed ?? 700) * SPEED_MULS[this.mulIdx]; }

  // CARRILES: cuantos y donde lo dice el NIVEL (`lanes` en LEVELS -> `lanesX` en physics.js).
  // El fallback no es cosmetico: `create()` llama a `resetRun()` y `draw()` corre antes de que
  // `boot()` resuelva `this.lv`, o sea que los primeros frames no tienen nivel.
  get laneX() { return this.lv?.laneX ?? LANE_X; }
  get lanes() { return this.lv?.lanes ?? 3; }
  // Todos los indices de carril, para no repetir `[0,1,2]` (que asumia 3) por el fichero.
  get laneIdx() { return Array.from({ length: this.lanes }, (_, i) => i); }
  // El BORDE de la pista: medio paso por fuera del carril de afuera. Es de donde cuelga todo
  // lo que se ensancha con N (bandas del suelo, laseres, numeros de fila, portones).
  // Medido: 255 con 3 carriles (pista de 510) y 340 con 4 (pista de 680), o sea +85 = medio
  // paso, no un paso entero.
  get edge() { return -this.laneX[0] + 85; }
  // DECORADO por nivel: el nivel declara que capas enciende (`decor` en LEVELS). El nivel 1
  // lista las que ya dibujaba, o sea que su render no cambia; el 2 solo mesh y reactor.
  // Sin nivel devuelve FALSE y no true: `draw()` corre antes de que `boot()` resuelva `this.lv`
  // y con true los primeros frames del nivel 1 dibujaban la malla y el reactor del nivel 2.
  // El respaldo seguro de "que capas enciende este nivel" es ninguna.
  dec(name) { return this.lv ? this.lv.decor.includes(name) : false; }
  // LA FAMILIA DE COLOR ES DEL NIVEL (`neon.fam` en LEVELS): de aca sacan color los divisores
  // de carril, los pins, las formas, los portones, el eq y el traje del muneco. El nivel 1
  // declara exactamente los cuatro de siempre, o sea que no se mueve un pixel.
  // ...y la LISTA SE ROTA con cada marca del acid (`this.mk`, ver el `jolt` en `draw`): el
  // nivel vuelve del fogonazo con OTRO reparto de la misma familia, que es la "variacion" que
  // se pidio. Es un `slice` de 4 elementos por frame, no un color nuevo: la paleta sigue siendo
  // la del nivel y `KILL` no esta en ella, o sea que lo que mata no se entera.
  // Con `mk` = 0 (o sea el nivel 1, que no declara el tramo) devuelve la MISMA referencia.
  get neon() {
    const f = this.lv?.neon?.fam?.length ? this.lv.neon.fam : NEON;
    const k = (this.mk ?? 0) % f.length;
    return k ? f.slice(k).concat(f.slice(0, k)) : f;
  }
  // EL RIG SOBRE TODO EL MUNDO (`rigOver` en LEVELS) y no encerrado en el cielo por el orden
  // de dibujo. Es lo unico de esta tanda que se pidio con la etiqueta de "puede que lo quiera
  // rollbackear": es UN dial y se apaga borrandolo del nivel. Ademas es lo que abre las
  // variantes del abanico (`mode` en `drawRig`), o sea que sin el todo sigue como estaba.
  get rigOver() { return !!this.lv?.rigOver; }

  resetRun() {
    this.lane = (this.lanes - 1) >> 1;   // el del medio: 1 con 3 carriles y con 4
    this.x = this.laneX[this.lane];
    this.y = 0;
    this.vy = 0;
    this.sliding = 0;
    this.dash = 0;
    this.orbMiss = null;
    // lo que cobra el muneco: aterrizaje (rodillas), despegue (elige truco) y el tirón
    this.landT = -9;
    this.jumpT = -9;
    this.wobT = -9;
    this.wobDir = 0;
    this.lives = PLAY ? 1 : 3;   // jugando es UNA vida: el golpe mata
    this.invuln = 0;
    this.hit = new Set();
  }

  seek(t) {
    this.tp?.seek(t);
    this.songT = this.tp ? this.tp.pos() : t;
    this.resetRun();
    this.trimRec(this.songT);
  }

  // rebobinar tambien rebobina la grabacion: lo que pasaba de ahi ya no lo hiciste.
  // Y si rebobinas ANTES de donde arrancaste a grabar, es que queres dictar desde ahi.
  trimRec(t) {
    if (!this.recOn) return;
    this.rec = this.rec.filter((a) => a.t < t);
    if (this.lv) this.recFrom = Math.min(this.recFrom, Math.max(0, rowAt(t, this.lv)));
  }

  // La grabacion es (accion, songT): mismo reloj que el mundo, asi que se puede replayar.
  log(a, o) { if (this.recOn) this.rec.push({ a, t: this.songT, lane: this.lane, ...o }); }

  // Lo grabado -> directivas del script, a consola y a un .js pegable en music.js.
  dumpRec() {
    if (!this.lv || !this.rec.length) return;
    const { script, solid, cells, orbs, from } =
      toScript(this.rec, this.lv, this.speed, this.lv.length, 1 / 240, this.recFrom, this.lanes);
    // el rec crudo va al final: si el relleno hay que recalcularlo, no se vuelve a jugar
    const txt = `// ${this.rec.length} acciones -> ${script.length} directivas en ${cells} celdas`
      + ` (${(100 * script.length / cells).toFixed(0)}% de la pista, ${solid} cajas, ${orbs} jump orbs)\n`
      + `// DESDE LA FILA ${from}: se pega al final del script, no pisa nada anterior\n`
      + `// el negativo de la corrida: solo queda libre por donde pasaste\n${fmt(script)}\n`
      + `// rec crudo (v=${this.speed}): ${JSON.stringify(this.rec)}\n`;
    console.log(txt);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/javascript" }));
    a.download = `guion-${LEVEL}.js`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // busca por grilla: por compas, o por beat con shift
  seekGrid(dir, beatStep) {
    if (!this.lv) return;
    const s = beatStep ? this.lv.beat : this.lv.bar;
    const g = Math.round((this.songT - this.lv.off) / s) * s + this.lv.off;
    this.seek(Math.max(0, g + dir * s));
  }

  // loop del bloque de 8 compases donde estoy: repetir el tramo y dictar encima
  toggleLoop() {
    if (!this.tp || !this.lv) return;
    if (this.tp.loop) { this.tp.loop = null; return; }
    const blk = this.lv.bar * 8;
    const a = Math.max(0, Math.floor((this.songT - this.lv.off) / blk) * blk + this.lv.off);
    this.tp.loop = [a, Math.min(a + blk, this.lv.length)];
    this.seek(a);
  }

  gotoCue() {
    if (!this.lv) return;
    const s = (prompt("ir a la cue #  (f78 = fila 78)") || "").trim();
    const t = s[0] === "f" ? timeOfRow(parseInt(s.slice(1), 10), this.lv)
      : this.lv.cues.find((q) => q.n === parseInt(s, 10))?.t;
    if (t != null && !isNaN(t)) this.seek(Math.max(0, t - 2));
  }

  // En una zona de un carril no hay carriles: el jugador queda pegado al de la zona.
  // Es lo que hace legible la camara "lado" (2D plano: los tres carriles caen en la misma x).
  zone() { return this.lv && !this.recOn ? zoneAt(this.songT, this.lv) : null; }

  move(dir) {
    if (this.zone()) return;
    const to = Phaser.Math.Clamp(this.lane + dir, 0, this.lanes - 1);
    if (to !== this.lane) {
      this.log("lane", { to });   // el carril que DEJAS es el que se tapa
      this.wobT = this.songT; this.wobDir = dir;   // el tirón: lo cobra drawPlayer
    }
    this.lane = to;
  }

  held() { return this.holdKeys.UP.isDown || this.holdKeys.W.isDown; }

  jump() {
    // Colchon del orb: si lo pasaste SIN mantener, queda anotado ORB_GRACE segundos. Pulsar
    // tarde lo agarra igual (el orb es una ventana de 157ms a v=700: sin esto hay que
    // adivinarla). No es lo mismo que saltar: por eso va antes del corte de "en el aire".
    if (this.orbMiss && this.songT - this.orbMiss.t <= ORB_GRACE) {
      const c = this.orbMiss.c;
      this.orbMiss = null;
      if (!this.hit.has(c.n)) { this.takeOrb(c); return; }
    }
    if (this.grav * this.y > 0) return;   // en el aire no hay salto: tampoco se graba
    this.vy = this.grav * JUMP_V;
    this.sliding = 0;
    this.log("jump");
  }

  takeOrb(c) {
    this.hit.add(c.n);
    if (c.kind === "orbj") { this.vy = this.grav * JUMP_V; this.sliding = 0; return; }
    this.dash = DASH_T;
  }

  slide() {
    if (this.grav * this.y > 0) this.vy = -this.grav * JUMP_V; // fast fall
    this.sliding = SLIDE_T;
    this.log("slide");
  }

  update(time, delta) {
    // Muerto: el mundo se sigue DIBUJANDO congelado (songT no avanza porque el transporte esta
    // pausado) y lo que no corre es la fisica ni el choque. La espera va con el delta REAL de
    // Phaser y no con songT, que es justo lo que esta parado; y no la salta ni una tecla ni un
    // clic, que es toda la gracia de la cuenta.
    if (this.dead > 0) {
      this.dead -= delta / 1000;
      if (this.dead <= 0) { this.dead = 0; this.seek(0); this.tp?.play(); }
      this.draw();
      return;
    }
    if (this.tp) {
      const t = this.tp.tick();
      // FIN DEL NIVEL jugando: `tick` pausa solo al llegar al final, y sin HUD ni lista de
      // teclas no queda un solo texto que lo diga (medido: msg invisible, pantalla quieta).
      // Se reusa la espera de la muerte: mismo cartel y vuelta a empezar. Cual de las dos es
      // lo dice `lives`, que morir deja en 0.
      if (PLAY && !this.tp.playing && t >= this.tp.duration - 1e-2) this.dead = DEAD_T;
      let dt = t - this.songT;
      if (dt < 0 || dt > 0.25) { this.resetRun(); this.trimRec(t); dt = 0; }  // rebobinado o salto: el guy vuelve a cero
      this.songT = t;
      this.flip();
      this.camForZone();
      this.step(dt);
    }
    this.draw();
  }

  // Gravedad y giro de camara: paridad de las cues de flip hasta songT (mas el toggle de H).
  // Puro en songT, asi que rebobinar antes de la cue te devuelve al suelo.
  flip() {
    const f = flipAt(this.songT, this.lv?.cues ?? []);
    const h = this.hflip.filter((t) => t <= this.songT);
    const n = f.n + h.length;
    const k = Phaser.Math.Clamp((this.songT - Math.max(f.at, ...h)) / FLIP_T, 0, 1);
    this.grav = n % 2 ? -1 : 1;
    this.roll = Math.PI * (n - 1 + k * k * (3 - 2 * k));
  }

  step(dt) {
    const z = this.zone();
    if (z) this.lane = z.lane;   // entrar en la zona te alinea: es funcion de songT, no un evento
    this.x = Phaser.Math.Linear(this.x, this.laneX[this.lane], Math.min(1, dt * 12));
    const enAire = this.grav * this.y > 0;
    Object.assign(this, stepPlayer(this, dt, this.grav, this.held()));
    if (enAire && this.y === 0) this.landT = this.songT;   // aterrizaje: lo cobra drawPlayer
    if (!enAire && this.grav * this.y > 0) {
      this.jumpT = this.songT;                      // despegue: elige truco
      this.wobT = this.songT; this.wobDir = 0.7;    // y sacude un poco
    }
    if (this.invuln > 0) this.invuln -= dt;
    if (dt === 0 || this.recOn) return;   // grabando la pista esta vacia: no hay con que chocar
    for (const c of this.near()) {
      const orb = c.role === "orb";
      if ((!orb && c.role !== "obstacle") || c.lane !== this.lane || this.hit.has(c.n)) continue;
      if (!orb && (this.invuln > 0 || this.dash > 0)) continue;   // el dash atraviesa
      if (!hits(c.kind, zOf(c, this.songT, this.speed), this.y, this.sliding, this.grav)) continue;
      // el orb pide mantener ↑/W. Si pasaste sin mantener no se pierde: queda anotado y
      // `jump()` lo cobra hasta ORB_GRACE despues (ver ahi).
      if (orb) {
        if (this.held()) this.takeOrb(c);
        else this.orbMiss = { c, t: this.songT };
        continue;
      }
      this.hit.add(c.n);
      this.invuln = 1.2;
      this.wobT = this.songT; this.wobDir = 2.2;   // el golpe sacude mas que un carril
      if (!this.godmode) this.lives = Math.max(0, this.lives - 1);
      // MUERTE: pausar el transporte congela el mundo EN EL SITIO, porque todo lo que se dibuja
      // es funcion de songT. La cuenta atras la lleva `update` con el delta real.
      if (PLAY && !this.lives) { this.tp?.pause(); this.dead = DEAD_T; }
    }
  }

  // cues dentro de la pista: desde el spawn hasta un poco pasado el jugador
  near() {
    const t = this.songT, lead = leadOf(this.speed);
    return this.lv ? this.lv.cues.filter((c) => c.t > t - 0.4 && c.t < t + lead + 0.2) : [];
  }

  // Cambiar de camara solo cambia la proyeccion: se re-atan proj/frame y el z minimo
  // visible, y todo el dibujo (que ya pasa por proj) sale desde el sitio nuevo.
  setCam(i) {
    this.camIdx = ((i % CAMS.length) + CAMS.length) % CAMS.length;
    this.cam = CAMS[this.camIdx];
    this.zn = this.cam.zn;
    this.proj = this.cam.proj.bind(this);
    this.frame = this.cam.frame.bind(this);
  }

  // LA PANTALLA POR CUATRO (`fx` de tipo `grid`): la MISMA escena en una grilla 2x2.
  // `draw()` corre UNA vez y el mundo se recorre UNA vez: el cuadro se copia a una textura y de
  // ahi salen cuatro imagenes a la mitad de tamano, una por cuadrante.
  //
  // LO PRIMERO QUE SE PROBO FUERON CUATRO CAMARAS de Phaser (viewport de un cuarto, zoom 0.5,
  // `centerOn`), que es la via nativa y son tres lineas. Se descarto MIDIENDO: `GraphicsWebGL
  // Renderer` recorre el `commandBuffer` ENTERO una vez POR CAMARA (fuente de 3.90), y el del
  // nivel 2 tiene ~72000 entradas. Medido sobre 258 frames del propio tramo (f24-f31) y con la
  // misma vara para las dos vias (`draw()` + `renderer.render` del mismo frame), con la camara
  // principal apagada como corresponde:
  //
  //     sin grilla        5.89ms media / 6.6 p95 /  7.9 max     0 frames sobre 16.7
  //     4 camaras        16.47        / 17.7     / 44.2        60 de 258 frames sobre 16.7
  //     esto (textura)    5.96        /  6.7     / 15.4         0 frames sobre 16.7
  //
  // O sea que la via nativa se comia el presupuesto entero y tiraba uno de cada cuatro frames, y
  // la textura cuesta **+0.07ms de media**: un recorrido del Graphics y cuatro quads.
  //
  // LOS TEXTOS NO SE DUPLICAN. El HUD, los numeros de fila, la tira de diseno y las letras del
  // acid son HERRAMIENTAS (por eso sobreviven al apagon y al gate), y cuatro HUDs de medio tamano
  // no son una herramienta. Salen gratis: lo unico que se copia a la textura es `this.g`, y los
  // textos siguen siendo objetos de la escena dibujandose como siempre. Las cuatro imagenes van a
  // `depth` -1 para quedar POR DEBAJO de ellos, que es el orden que ya tiene el juego.
  //
  // `rt.draw(g)` NO MIRA `visible` (llama a `renderWebGL` derecho, ver `batchGameObject` en la
  // fuente de 3.90), o sea que apagar el Graphics mientras dura la grilla no impide copiarlo: eso
  // es lo que evita que el cuadro salga ademas a tamano entero por debajo.
  //
  // LA TEXTURA SE CREA LA PRIMERA VEZ QUE UN NIVEL LA PIDE, y eso es el respaldo: el nivel 1 no
  // declara `grid`, o sea que esto sale por la primera linea y no se crea ni una textura ni una
  // imagen y no se le toca el `visible` al Graphics. No es "una capa invisible que no molesta":
  // es que no existe. En `create()` no se podria, ademas, porque ahi todavia no hay nivel
  // (`boot()` es async, la misma razon por la que `dec()` devuelve false).
  setGrid(on, w, h) {
    if (!on && !this.quad) return;
    if (!this.quad) {
      this.rt = this.add.renderTexture(0, 0, w, h).setOrigin(0).setVisible(false);
      this.rt.saveTexture("gridRT");
      this.quad = [0, 1, 2, 3].map(() => this.add.image(0, 0, "gridRT")
        .setOrigin(0).setDepth(-1).setVisible(false));
    }
    this.g.setVisible(!on);
    // El tamano se rehace cada frame en vez de colgarse de un `resize`: `w` y `h` son los mismos
    // de los que sale TODO el dibujo, o sea que redimensionar ya esta contemplado y no queda un
    // segundo sitio que pueda desincronizarse.
    this.quad.forEach((q, i) => q.setVisible(on).setScale(0.5)
      .setPosition((i % 2) * (w / 2), ((i / 2) | 0) * (h / 2)));
    if (!on) return;
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);
    this.rt.clear();
    this.rt.draw(this.g);
    // ponytail: el clic en la tira (`stripSeek`) sigue midiendo en coordenadas del canvas entero,
    // o sea que mientras dura la grilla hay que pinchar donde estaria la tira sin duplicar. Se
    // arregla el dia que valga la pena partiendo el Graphics en mundo + tira.
  }

  // La zona manda sobre la camara mientras dura; fuera, la que elegiste con C.
  // Como zoneAt es funcion de songT, rebobinar entra y sale del 2D solo.
  camForZone() {
    const z = this.zone();
    const want = z ? CAMS.findIndex((c) => c.id === z.cam) : this.camPick;
    if (want >= 0 && want !== this.camIdx) this.setCam(want);
  }

  draw() {
    const g = this.g;
    const w = this.scale.width;
    const h = this.scale.height;
    this.frame(w, h);   // horizonte / escala / altura de camara: lo pone la camara activa
    g.clear();
    for (const l of this.labels) l.setVisible(false);
    for (const l of this.tileLabels) l.setVisible(false);

    const t = this.songT;
    const cues = this.near();
    const base = this.lv ? bgAt(t, this.lv.cues, this.lv.bg) : PALETTE.bg;
    const pulse = this.lv ? pulseAt(t, this.lv.cues) : 0;
    // Cuanta luz hay, por seccion. En el DROP el rig esta clavado arriba y late con el kick;
    // en el BUILDUP solo prende con las MARCAS (accent/voice, no el beat), o sea que la luz
    // va apareciendo a cuentagotas y el drop se siente; en el BREAK se apaga.
    const sec = this.lv ? sectionAt(t, this.lv.sections) : null;
    const mark = this.lv ? pulseAt(t, this.lv.cues, 0.3, "mark") : 0;
    // `startsWith` y no `===`: el drop del nivel 2 se llama "drop2", o sea que con la igualdad
    // su drop se quedaba con la luz del buildup (marcas a cuentagotas) en vez de clavada arriba.
    // CUAL SECCION ES EL DROP LO DICE EL NIVEL (`dropSec`), no el prefijo de su nombre: el
    // nivel 1 tiene un `drop` Y un `drop2` (59.08-87.69s), asi que `startsWith("drop")` le
    // encendia el rave clavado y el temblor en 28.6s que se disenaron sin ellos (medido:
    // 169813 px distintos a t=65 en la camara de atras). El respaldo es "drop", o sea lo que
    // el renderer hacia antes de existir el dial.
    const drop = sec === (this.lv?.dropSec ?? "drop");
    this.rave = drop ? Math.max(0.62, pulse) : sec === "break" ? 0 : mark * 0.9;
    // el color del guion va oscurecido: si no, un fondo saturado se come los obstaculos
    const tint = mix(base, 0xffffff, pulse * 0.18);
    const ground = mix(tint, 0x000000, 0.4);
    // Niebla: el color al que se va lo lejano (`drawBox`). Es la mitad entre suelo y cielo
    // porque una caja lejana toca los dos: la parte de abajo cae contra el suelo y la de
    // arriba contra el horizonte. Sin esto todas las cajas se dibujan igual a cualquier z y
    // una pared del fondo compite con la que tenes encima.
    this.fog = mix(ground, tint, 0.5);
    this.pulse = pulse;
    // Con que late lo que se juega (cajas, suelo, portones, formas): lo dice el nivel por
    // seccion (`glow`). Antes del drop van con los AGUDOS (accent/voice), o sea que el bajo
    // no aparece hasta que entra de verdad; en el drop pasan todos al bajo (el kick).
    // El rig, los pins y las barras siguen con el kick: son el decorado, no la lectura.
    this.beat = (this.lv?.glow?.[sec] ?? "bg") === "mark" ? mark : pulse;
    // LO QUE LATE CUANDO NO SUENA NADA. `this.beat` sale de las cues, o sea que se apaga con
    // ellas: medido en el nivel 2, `beat` vale 0 el 100% del outro (28.6s, un solo evento) y
    // `pulse` el 0% del drop2 y del outro (42.7s de 72.31 = el 59% del nivel). Todo lo que
    // late con eso se CONGELA: la malla se veia igual en el buildup, en el drop2 y en el outro.
    // `gridAt` es el metronomo de la grilla (funcion pura de songT, existe siempre) y va de
    // PISO, con la senal de acento encima. Solo en los niveles que lo piden (`metro` en
    // LEVELS): el nivel 1 no lo declara, o sea que ahi `lat === beat` y no cambia un pixel.
    // `metro` es el TECHO del metronomo, no un si/no: si llegara a 1 el metronomo pegaria tan
    // fuerte como una senal y la senal no mandaria nunca (medido: el 21.5% del nivel, 0% del
    // outro). Topado, el metronomo es el piso y `beat` sube por encima. Ver `metro` en LEVELS.
    this.lat = this.lv?.metro ? Math.max(this.beat, this.lv.metro * gridAt(t, this.lv)) : this.beat;
    // LA CRECIENTE (`hype` en LEVELS, `hypeAt` en music.js): 0..1 por FILA, o sea la unica
    // cosa del render que no es un latido sino un ARCO de varios compases. De aca cuelgan el
    // tamano del reactor, la apertura de los anillos del fondo y cuantos rayos salen.
    // Respaldo 0 = como si no existiera: el nivel 1 no la declara y no cambia un pixel.
    this.hype = this.lv ? hypeAt(t, this.lv) : 0;
    // EL GATE: 1 abierto, `floor` cerrado, y solo dentro de los tramos `fx` que lo pidan.
    // Fuera de ellos `gateAt` devuelve 1, o sea que no hay nada que dibujar.
    // MUERTO EL GATE SE ABRE: su fase sale de songT y songT esta congelado, o sea que un corte
    // que dura ~30ms se quedaria clavado 3 segundos. Medido en el tramo f36-f60 de orbit-motion
    // (25 filas con obstaculo, 21898 muestras a 0.5ms), la imagen esta cortada el 18.4% del
    // tiempo, y ahi `gateAt` da 0 exacto: congelado a t=24.60 el cuadro queda al 98.98% en negro
    // y lo unico que se ve es el cartel, en vez del mundo parado en el sitio.
    this.gate = this.lv && this.dec("gate") && !this.dead ? gateAt(t, this.lv) : 1;
    // el negativo es el MISMO motor que el gate con otro kind: 1 = imagen normal, cualquier
    // cosa por debajo = invertida. El nivel 1 no declara `fx`, o sea que ahi da 1 siempre.
    this.neg = this.lv ? gateAt(t, this.lv, "neg") < 1 : false;
    // TRAMOS `fx` QUE NO SON EL GATE. Van por fila igual que el, o sea que se leen una vez
    // aca y no una vez por capa. `row` sale de la grilla, o sea funcion pura de songT.
    const row = this.lv ? rowAt(t, this.lv) : 0;
    const fxo = (k) => (this.lv ? fxOfRow(row, this.lv, k) : null);
    // EL REACTOR NO EXISTE HASTA QUE EL NIVEL LO PIDE. Sin el tramo estaba puesto desde el
    // primer frame, o sea que el jefe del fondo se veia entero durante todo el buildup y
    // entrar al drop no lo estrenaba. Sin `fx` declarado sigue puesto siempre (nivel 1).
    // EL FOGONAZO DEL SNARE (`fx` de tipo `snap`): un frame de rayos + reactor en FANTASMA
    // sobre el apagon, o sea el aviso del drop. La envolvente es `(1-p)^2` desde el arranque de
    // la fila del tramo (el mismo idiom que `gridAt` y que el haz: ataque duro y cola), o sea
    // funcion pura de songT. Dura `SNAP_T` y no la fila entera: es un flash, no un tramo.
    const fsn = fxo("snap");
    this.snap = fsn
      ? Math.max(0, 1 - (t - timeOfRow(fsn.from, this.lv)) / SNAP_T) ** 2
      : 0;
    // EL REACTOR NO EXISTE HASTA QUE EL NIVEL LO PIDE... salvo en el fogonazo, que es
    // justamente ensenarlo un frame antes de que entre de verdad.
    this.reac = !this.lv?.fx ? 1 : fxo("reactor") || this.snap > 0.01 ? 1 : 0;
    // LASERES Y RELAMPAGOS SE TURNAN POR COMPAS Y NUNCA ESTAN LOS DOS (`arcTurn`). Se reporto
    // que no pueden "mezclarse" en ninguna parte del nivel, y medido estaban mezclados casi
    // siempre: el rig cubre el 50.3% del buildup y el 100% del drop2, y los rayos son un
    // SUBCONJUNTO suyo (buildup 39.2% de la seccion y los dos a la vez el 39.2%; drop2 72.8% y
    // los dos 72.8%), o sea que el **100% de los frames con rayo tenia laseres debajo**.
    // El turno es el COMPAS y no la seccion ni la cue: es la unidad que ya manda el color del
    // rig y la figura de las luces, dura 1.75s (o sea que se ve el cambio y no parpadea) y sale
    // de `songT`, asi que rebobinar lo rebobina. Los rayos van en los compases IMPARES: medido,
    // ahi caen 37 de las 60 marcas del acid y con los pares solo 23, o sea que los impares son
    // los que tienen algo que descargar. El fogonazo del snare NO mira esto: ahi el rig esta
    // apagado por el `dark` y el rayo es el efecto.
    this.arcTurn = this.dec("arcs")
      && Math.floor((t - (this.lv?.off ?? 0)) / (this.lv?.bar ?? 1.846)) % 2 !== 0;
    // EL APAGON DE LA VOZ: el tramo donde habla el cantante y vuelan las letras. Es el mismo
    // negro que el `flash` del nivel 1, declarado por fila en vez de por seccion.
    this.dark = fxo("dark") ? 1 : 0;
    this.beam = fxo("beam");
    // LA PANTALLA POR CUATRO (`fx` de tipo `grid`): ver `setGrid`. Se lee aca con los otros tramos
    // pero se APLICA al final de `draw()`, porque lo que hace es COPIAR el cuadro ya dibujado.
    this.grid = !!fxo("grid");
    // EL TIRON DE LAS HELICES (`fx` de tipo `spin`): el reactor gira lentisimo todo el nivel
    // (una vuelta cada 16 compases, ver `drawReactor`) y en dos sitios marcados da UNA VUELTA
    // ENTERA con ease in/out, la primera hacia un lado y la segunda hacia el contrario.
    // La vuelta es ENTERA a proposito: fuera del tramo el extra vale 0, y como `SPIN_TURNS` es
    // un numero redondo de vueltas la pieza termina exactamente donde arranco, o sea que
    // volver a 0 no se ve. Con una fraccion habria un salto al salir del tramo.
    // La curva es `p^2(3-2p)`: velocidad 0 en las dos puntas, que es lo que se pidio.
    const fsp = fxo("spin");
    this.spin = 0;
    if (fsp) {
      const t0 = timeOfRow(fsp.from, this.lv), t1 = timeOfRow(fsp.to + 1, this.lv);
      const p = Phaser.Math.Clamp((t - t0) / (t1 - t0), 0, 1);
      this.spin = (fsp.dir ?? 1) * SPIN_TURNS * Math.PI * 2 * p * p * (3 - 2 * p);
    }
    // LAS ESQUIRLAS, leidas ACA y no dentro de `drawBurst`: el estallido ademas manda el nivel
    // entero a FANTASMA mientras dura (se reporto que "a veces se ven y a veces no", y es que
    // gris y negro sobre una pantalla llena de cyan no se despegan de nada). En blanco y negro
    // el metal es lo unico que hay, o sea que el estallido se lee siempre igual.
    this.burst = 0;
    if (this.dec("burst")) for (const c of cues) {
      if (c.role !== "fx" || c.fx) continue;
      const p = (t - c.t) / BURST_T;
      if (p >= 0 && p < 1) this.burst = Math.max(this.burst, 1 - p);
    }
    // LA SACUDIDA DE CADA MARCA (`fx` de tipo `jolt`). Se pidio que en cada marca del acid del
    // drop "cambie algo de golpe y despues vuelva a lo normal CON UNA VARIACION", y son dos
    // cosas distintas y no una: el GOLPE (`this.jolt`, 0.35 de beat = 153ms de fantasma, o sea
    // el nivel entero en blanco y negro un instante) y el ESTADO (`this.mk`, cuantas marcas van),
    // que es lo que queda cuando el golpe se apago: rota la familia de color (ver `get neon`) y
    // da vuelta la forma de la ola. O sea que no vuelve a lo mismo, vuelve a otra cosa.
    // 0.35 y no mas: medido sobre el schema, las 28 marcas del drop2 tienen huecos de **min
    // 226ms (0.52 beat) y mediana 569ms**, asi que con 153ms el par mas apretado deja 73ms de
    // color entre golpe y golpe. Con medio beat los dos se fundirian en un apagon largo.
    // `this.lv.cues` y no `cues`: ese es `near()`, o sea SOLO las de alrededor del jugador, y
    // el numero de marca tiene que ser el GLOBAL o la paleta no rota (medido con `near()`: `mk`
    // se quedaba clavado en 1 durante todo el drop2, o sea que la variacion no existia).
    const mkn = fxo("jolt") ? markN(t, this.lv.cues) : null;
    this.jolt = mkn ? Math.max(0, 1 - mkn.age / (this.lv.beat * JOLT_B)) : 0;
    this.mk = mkn ? mkn.k : 0;
    // LA OLA POR SECCION (`wave` en LEVELS): `a` al empezar la seccion, `to` al terminarla, y
    // `mode` que forma. Se reporto que la ola "no se ve reactiva": es que su alpha solo
    // dependia del latido, o sea que la misma agua estaba puesta de punta a punta del nivel.
    // Ahora el buildup la lleva opaca y se va apagando hacia el apagon, el break la deja en 0
    // (ahi la pantalla es negra) y el drop la devuelve entera y CON OTRA FORMA.
    // Sin `wave` declarado da a=1 y mode=0, o sea lo que el renderer hacia antes del dial.
    const scw = this.lv?.sections?.find((x) => x.label === sec);
    const wv = this.lv?.wave?.[sec];
    const uw = scw ? Phaser.Math.Clamp((t - scw.start) / Math.max(1e-6, scw.end - scw.start), 0, 1) : 0;
    this.wave = wv
      ? { a: wv.a + ((wv.to ?? wv.a) - wv.a) * uw, mode: wv.mode ?? 0, shape: wv.shape ?? null }
      : { a: 1, mode: 0, shape: null };
    // ...y la marca la DA VUELTA (`jolt`): una marca si y otra no, el agua cambia de forma.
    // Es la variacion mas barata que existe (el otro `mode` ya esta medido: 8 -> 15 crestas en
    // z, 10 -> 8 a lo ancho) y no cuesta ni una llamada mas al Graphics.
    // El outrun (`mode` 2) se queda quieto: el `^ 1` da 3 y el `if (mode)` de `meshWave` pregunta
    // por verdadero, o sea que la cordillera se convertiria en el agua del nivel 2 en cada marca.
    if (this.mk & 1 && this.wave.mode < 2) this.wave.mode ^= 1;
    // EL RESPLANDOR DEL HORIZONTE tambien va por seccion (`sky.mode`, ver `drawSky`). Sale de
    // aca y no de dentro de `drawSky` para no volver a buscar la seccion: `uw` ya esta hecho.
    this.skyM = this.lv?.sky?.mode?.[sec] ?? null;
    this.secU = uw;
    // LA DERIVA DE TONO: cuantos grados esta girada la paleta AHORA (ver `hueAt` y `fantasma`).
    // Se lee aca, una vez por frame, y lo aplica la puerta del Graphics.
    this.hue = this.lv ? hueAt(t, this.lv) : 0;
    // EL CONTRATIEMPO: la corchea de en medio, medida sobre el audio (fase 0.505, ver
    // `hatAt`). No sale de ninguna cue porque en el schema no esta marcado: es la grilla.
    this.hat = this.lv && this.dec("hat") ? hatAt(t, this.lv) : 0;
    this.sec = sec;   // lo lee `drawBox` para saber con que animacion entran los obstaculos
    // EL FANTASMA es funcion de songT como todo lo demas, y aparece en dos lados:
    //  - la fila `GHOST_ROW` (la ultima del break, ya sin apagon y todavia sin drop), entera;
    //  - y despues **con las MARCAS**, la misma ventana que enciende las formas de los
    //    costados (`markWin`): prende EN una marca y apaga en la siguiente si estan a menos
    //    de 1.5 beats. En el drop eso es de #46 a #48 (f67-f68), de #52 a #54 (f71-f72), y
    //    asi: un destello de un beat por compas. Medido: 15 ventanas, 20% del drop, y 0% del
    //    buildup (ahi las marcas van filtradas y nunca caen tan cerca).
    // Lleve fantasma o no, `drawBars` dibuja la constelacion: van juntos.
    // Va por `decor` como el apagon: la `GHOST_ROW` es una fila del nivel 1 y su ventana de
    // marcas esta medida sobre SUS marcas. En el nivel 2 la marca es la linea del acid, que
    // esta abierta el 40% del buildup y el 69% del drop2, o sea que el nivel se pasaba mas de
    // media cancion en blanco y negro y su paleta cyan no se veia nunca. `P` lo sigue
    // forzando a mano en cualquier nivel: es una herramienta, no una capa del nivel.
    // ...y ademas un nivel puede pedirlo por TRAMO (`fx` de tipo `ghost`): el nivel 2 se va a
    // fantasma de la f90 al final, que es donde para el haz recto y arranca el otro.
    // ...y ademas lo TRAEN los dos efectos de metal: el fogonazo del snare (`snap`) y las
    // esquirlas (`burst`). Los dos son gris y negro, o sea que en color se hunden contra el
    // cyan del nivel y en blanco y negro son lo unico que hay en pantalla.
    // ...y lo trae tambien la SACUDIDA de cada marca del acid (`jolt`): es el golpe, y el
    // blanco y negro es el cambio mas grande que se puede hacer sin mover un solo pixel de
    // sitio, o sea sin tocar la lectura de la pista.
    this.ghost = this.ghostKey || !!fxo("ghost") || this.snap > 0.01 || this.burst > 0.02
      || this.jolt > 0.01
      || (this.lv && this.dec("ghost")
        ? rowAt(t, this.lv) === GHOST_ROW || markWin(t, this.lv.cues, this.lv.beat) > 0.02
        : false);
    // y que figura dibuja la constelacion: una por destello (`FIGS`), en orden
    this.fig = this.lv ? flashIdx(t, this.lv.cues, this.lv.beat) : 0;

    // WOOBY + QUAKE: se mueve la PANTALLA entera, no el mundo. Es un translate del canvas,
    // asi que no toca la proyeccion ni la fisica: se choca exactamente igual que con la
    // pantalla quieta, y como sale de `songT` y del kick, rebobinar lo rebobina.
    //  - wooby: vaiven lento de 2 compases (3.69s), siempre, +-16px.
    //  - quake: solo en el DROP y solo con el kick (`pulse^3`, o sea que entre kicks es 0):
    //    9.7Hz en x y 7.5Hz en y. El cubo es lo que lo hace un golpe y no un mareo.
    // EL GOLPE DEL SUELO NO PUEDE SALIR DE `pulse`. Medido sobre el drop2 de `orbit-motion`,
    // `pulse` vale 0 el **100%** del tramo (ese drop no tiene ni un evento de `bass`), o sea
    // que el temblor estaba APAGADO justo en el drop: eso es el "el reactor no se mueve en el
    // beat y no hay sacudida" que se reporto. Lo que si existe siempre es la GRILLA, y el kick
    // esta ahi: medido sobre el audio, hay un kick real en la fase 0.0 en el **95.8% de los
    // beats (158/165)** y en **31 de los 32 beats del drop2**.
    // `this.kik` = max(lo que suena, el metronomo), el mismo idiom que `this.lat`, y solo en
    // los niveles que declaran `metro`: el nivel 1 no lo declara, o sea que ahi `kik === pulse`
    // y no cambia un pixel (comprobado: 0 px de diferencia contra HEAD en t=12/36.3/50.2/65 y
    // en las tres camaras). Medido sobre los 841 frames del drop2 del nivel 2: el temblor pasa
    // de **0.00px de recorrido y 0% de frames sacudiendo** (con `pulse`, que ahi es 0 entero) a
    // **+-22.4px en x, +-16.4 en y y el 31.4% de los frames por encima de 2px**.
    this.kik = this.lv?.metro ? Math.max(pulse, gridAt(t, this.lv)) : pulse;
    const wob = Math.sin((t / ((this.lv?.bar ?? 1.846) * 2)) * Math.PI * 2) * 16;
    // ...y ademas la CRECIENTE lo empuja: en el pico sacude el doble que al entrar.
    const qk = sec === (this.lv?.dropSec ?? "drop") ? this.kik ** 3 * (1 + (this.hype ?? 0)) : 0;
    const qx = wob + Math.sin(t * 61) * 13 * qk, qy = Math.sin(t * 47) * 9 * qk;
    // el haz (`drawBeam`) se dibuja fuera del temblor pero su charco va en el PLANO DEL SUELO:
    // sin esto se quedaria quieto mientras la pista se sacude y se despegaria del carril.
    this.qx = qx; this.qy = qy;
    g.translateCanvas(qx, qy);
    // cielo + capas de detalle + suelo. El plano y=0 llena la mitad de pantalla del lado
    // en el que esta la camara: con la gravedad invertida (camY<0) la pista se va arriba
    // y tapa las capas. El salto de lado cae justo cuando el plano esta de canto.
    // Los dos rectangulos de base van 60px pasados de cada lado: con el temblor puesto, uno
    // del tamano exacto de la pantalla deja una franja sin pintar en el borde.
    g.fillStyle(this.bgMode === 2 ? 0x000000 : mix(tint, 0x000000, 0.15), 1);
    g.fillRect(-60, -60, w + 120, h + 120);
    // ANTES DEL SUELO: ahi el rig vive en el CIELO y los edificios lo tapan. Con `rigOver` no:
    // se dibuja al final, sobre el mundo entero (ver abajo). Se reporto asi, y se deja el dial
    // porque puede querer volverse atras.
    if (this.bgMode !== 1 && this.dec("rig") && !this.rigOver && !this.arcTurn) this.drawRig(w, h, pulse);
    g.fillStyle(ground, 1);
    g.fillRect(-60, this.camY >= 0 ? this.horizon : -60,
      w + 120, (this.camY >= 0 ? h - this.horizon : this.horizon) + 60);
    // el resplandor del horizonte va sobre los dos rectangulos de base y DEBAJO del reactor:
    // es lo que hace que el reactor tenga algo contra que estar (ver `drawSky`).
    if (this.bgMode !== 1) this.drawSky(w, h);
    // los anillos de resonancia van entre el resplandor y el reactor: son el FONDO contra el
    // que esta el reactor, no un adorno por delante de el.
    if (this.bgMode !== 1 && this.dec("rings") && this.reac) this.drawRings(w, h);
    // el reactor va entre los dos rectangulos de base y el resto del mundo: el punto de fuga
    // cae EN el horizonte, o sea justo en la junta, y dibujado antes el suelo le comeria la
    // mitad de abajo. Delante del color de fondo y detras de todo lo demas.
    if (this.bgMode !== 1 && this.dec("reactor") && this.reac) this.drawReactor(w, h);
    if (this.bgMode !== 1) this.drawLayers(w, pulse);   // despues del suelo: de cabeza van del otro lado

    // bandas del suelo: una por beat, asi la pista misma marca el tempo. La banda que cae en
    // el 1 del compas va encendida (color de la seccion), o sea que la pista tambien cuenta
    // los compases y el suelo deja de ser siempre el mismo gris.
    const band = this.lv ? this.lv.beat * this.speed : 200;
    const off = (((t * this.speed) % band) + band) % band;
    // el color de la seccion sale del NIVEL (`neon.sec` en LEVELS), no del renderer: el
    // nivel 1 declara exactamente este mapa (drop rosa / break accentSoft / resto violeta) y
    // el 2 el suyo, cyan. Antes el nivel 2 pintaba su marco y su suelo de violeta.
    const secColor = this.lv?.neon?.sec?.[sec] ?? this.lv?.neon?.def ?? PALETTE.violet;
    // la fila de la banda de mas lejos; de ahi para aca se va restando de a una
    const r0 = this.lv ? rowAt(t, this.lv) : 0;
    const b0 = Math.floor(t / (this.lv?.beat ?? 0.4615));
    // la cuna: de SPAWN_Z al punto de fuga, para que la pista no corte con un canto duro
    // (ver `drawFar`). Va antes de las bandas: ellas se dibujan encima y tapan la junta.
    this.drawFar(secColor);
    for (let z = SPAWN_Z, i = Math.round((SPAWN_Z - PLAYER_Z) / band); z > this.zn; z -= band, i--) {
      const z0 = Math.max(z - off, this.zn), z1 = Math.max(z - off + band / 2, this.zn);
      if (z1 <= this.zn) continue;
      const uno = (((b0 + i) % 4) + 4) % 4 === 0;   // el 1 de cada compas
      // SECTOR: cada tramo de filas tinta su pedazo de piso (`sectors` en LEVELS). Una banda
      // = una fila, asi que el corte del sector se ve como una junta en el suelo y se sabe en
      // que tramo del tema estas mirando la pista. Fuera de todo sector manda la seccion.
      const secCol = sectorOfRow(r0 + i, this.lv?.sectors)?.color ?? secColor;
      // TODAS las bandas laten, no solo la del 1: el suelo era lo unico de la pista que no se
      // movia con la musica. La del 1 ademas va encendida, asi que se sigue pudiendo contar
      // compases mirando el piso.
      // 0.32 de tinte base y no 0.45: medido en pantalla, con 0.45 el sector se comia la
      // pista entera y el suelo dejaba de ser suelo. El sector tiene que CAMBIAR un poco el
      // color, no pintarlo.
      // Late con `this.lat` y no con `this.beat`: en el nivel 2 el suelo se quedaba quieto el
      // 40% del tema (el outro no tiene cues). En el nivel 1 los dos son lo mismo.
      g.fillStyle(uno ? secCol : mix(PALETTE.surfaceLight, secCol, 0.32 + 0.35 * this.lat),
        uno ? 0.22 + 0.3 * this.rave + 0.45 * this.lat : 0.28 + 0.4 * this.lat);
      // de perfil (2D) la x del mundo no proyecta: z es el eje horizontal, o sea que la
      // banda es una franja vertical del lado del suelo, no un cuadrilatero en fuga
      if (this.cam.flat) {
        const a = this.proj(0, 0, z0).x, b = this.proj(0, 0, z1).x;
        g.fillRect(Math.min(a, b), this.camY >= 0 ? this.horizon : 0,
          Math.abs(b - a), this.camY >= 0 ? h - this.horizon : this.horizon);
        continue;
      }
      // 35 por fuera del borde de la pista, o sea que la banda desborda un poco los divisores.
      // Medido a 900x640: con 3 carriles el borde de la banda (±290) proyecta en x=721 de 900
      // y con 4 (±375) en x=800. Entra, pero es lo mas ancho que se dibuja en el mundo.
      const bw = this.edge + 35;
      g.fillPoints([[-bw, z0], [bw, z0], [bw, z1], [-bw, z1]].map(([x, zz]) => {
        const p = this.proj(x, 0, zz);
        return new Phaser.Geom.Point(p.x, p.y);
      }), true);
    }

    // lane dividers (en 2D no hay carriles que dividir: los tres son el mismo)
    if (!this.cam.flat) {
      // violeta y no accent: el accent es ahora el color de los obstaculos que se pasan con
      // una tecla, y dos rayas del mismo color cruzando la pista los diluian.
      g.lineStyle(2, this.neon[0], 0.45);
      // los divisores son los BORDES de los carriles, o sea `lanesX(N+1)`: N+1 lineas a medio
      // paso de cada centro. Con 3 da los cuatro de siempre ([-255,-85,85,255]) y con 4 da
      // cinco ([-340,-170,0,170,340]), o sea que la linea del medio aparece sola.
      for (const lx of lanesX(this.lanes + 1)) {
        const n = this.proj(lx, 0, this.zn + 10), f = this.proj(lx, 0, SPAWN_Z);
        g.lineBetween(n.x, n.y, f.x, f.y);
      }
    }

    // la malla va PRIMERA del bloque del mundo: es lo mas de atras del decorado y comparte
    // sitio con el barrido (`drawRave`), que hace lo mismo en el mismo plano.
    if (this.dec("lights")) this.drawLights();
    if (this.dec("mesh")) this.drawMesh();
    if (this.dec("pins")) this.drawPins();
    if (this.dec("gates")) this.drawGates(sec);
    if (this.dec("shapes")) this.drawShapes();
    if (this.dec("rave")) this.drawRave(cues);
    if (this.nums && this.lv) this.drawRowNums();
    if (this.marks) this.drawCueLines(cues);
    this.drawFlipGates(cues);

    // obstaculos y orbs: de lejos a cerca. Grabando no se dibuja ninguno: la gracia es
    // correr la pista vacia con las lineas, y que los obstaculos salgan de lo que hiciste.
    // en 2D solo se dibuja lo de la zona: fuera de ella hay tres carriles, y de perfil
    // colapsan en la misma linea (una alfombra roja ilegible). La zona es de un carril
    // justamente para que ahi si se lea.
    const obs = this.recOn ? []
      : cues.filter((c) => (c.role === "obstacle" || c.role === "orb")
          && (!this.cam.flat || zoneOfRow(c.row, this.lv)))
          .sort((a, b) => b.t - a.t);
    for (const c of obs) {
      const z = zOf(c, t, this.speed);
      if (c.role === "orb") this.drawOrb(c, z);
      else if (c.kind === "gap") this.drawGap(c, z);
      else this.drawBox(c, z);
    }
    // despues de las cajas: la guia de la zona va sobre el tunel o no se ve (las cajas
    // tambien son rojas). Dentro de la zona no hay cajas en esos carriles, no tapa nada.
    this.drawZoneTiles();
    this.drawOrbHint(obs);

    this.drawPlayer();
    g.translateCanvas(-qx, -qy);   // se acaba el temblor: el marco y los flashes van quietos
    // EL RIG SOBRE TODO (`rigOver`): se reporto que los laseres del fondo se veian solo en la
    // franja de arriba, o sea encerrados en el cielo por el orden de dibujo. Aca cruzan el
    // mundo entero, y por eso van a `RIG_DIM` de alpha (si no, tapan la pista).
    if (this.bgMode !== 1 && this.dec("rig") && this.rigOver && !this.arcTurn) this.drawRig(w, h, pulse);
    this.drawEdges(w, h, cues, t, secColor);
    if (this.dec("burst")) this.drawBurst(w, h, cues);
    if (this.arcTurn) this.drawArcs(w, h, mark);
    this.drawFlash(w, h, sec, t, pulse);
    if (this.dec("hat")) this.drawHat(w, h, sec);
    // el haz sale del reactor y cruza la pantalla: va por encima del mundo (como los rayos) y
    // por debajo del apagon y del gate, que son los dos que cortan la imagen entera.
    if (this.beam) this.drawBeam(w, h);
    // EL APAGON DE LA VOZ, justo antes del gate: los dos son negro a pantalla completa, y las
    // letras del acid son objetos de TEXTO de Phaser, o sea que sobreviven a los dos.
    if (this.dark) {
      g.fillStyle(0x000000, 1); g.fillRect(0, 0, w, h);
      // EL FOGONAZO DEL SNARE (`fx` de tipo `snap`, la f66): reactor + rayos POR ENCIMA del
      // apagon, o sea el unico sitio del nivel donde se ve al jefe antes del drop, y en
      // FANTASMA (`this.ghost` lo fuerza `snap`, ver `draw`). Va aca dentro y no en el bloque
      // del mundo justamente porque el apagon lo taparia: el orden ES el efecto.
      if (this.snap > 0.01) {
        if (this.dec("reactor")) this.drawReactor(w, h);
        this.drawArcs(w, h, this.snap, SNAP_ARCS, 1);
      }
    }
    this.drawAcid(this.lv ? fxAt(t, this.lv.cues, "acid") : null);
    // EL GATE VA EL ULTIMO: corta la imagen entera, o sea que tiene que estar por encima de
    // todo lo que dibuja el Graphics. Los textos (HUD, numeros de fila, tira) son objetos de
    // Phaser y van por encima igual, como en el apagon: son herramientas, no el juego.
    this.drawGate(w, h);
    if (this.marks) this.drawStrip(w, h);

    const rate = this.tp?.rate ?? 1;
    const mul = SPEED_MULS[this.mulIdx];
    const nxt = this.lv?.cues.find((c) => c.t >= t);
    const bar = this.lv ? Math.floor((t - this.lv.off) / this.lv.bar) + 1 : 0;
    // cuenta atras del flip: el porton de la pista dice DONDE, esto dice CUANDO
    const fl = this.lv?.cues.find((c) => c.role === "flip" && c.t > t && c.t - t < 3);
    this.hud.setText([
      `${t.toFixed(3)}s  c${bar}  f${this.lv ? rowAt(t, this.lv) : "-"}  ` +
        `${nxt?.section ?? "-"}  #${nxt?.n ?? "-"} ${nxt?.tag ?? ""}`,
      `x${rate}${this.tp?.playing ? "" : "  ||"}` +
        `${this.tp?.loop ? `  LOOP ${this.tp.loop[0].toFixed(1)}-${this.tp.loop[1].toFixed(1)}` : ""}` +
        `  v=${Math.round(this.speed)}${mul !== 1 ? ` (x${mul})` : ""}  ${"*".repeat(Math.max(0, this.lives))}` +
        `${this.camIdx ? `  cam ${this.cam.id}` : ""}` +
        `${this.grav < 0 ? "  FLIP" : ""}${fl ? `  ⟲ GRAVEDAD ${(fl.t - t).toFixed(1)}s` : ""}` +
        `${this.dash > 0 ? `  DASH ${this.dash.toFixed(2)}` : ""}` +
        `${this.recOn ? `  REC ${this.rec.length}` : this.rec.length ? `  rec ${this.rec.length}` : ""}` +
        `${this.ghost ? "  FANTASMA" : ""}${this.neg ? "  NEG" : ""}` +
        `${this.godmode ? "  K" : ""}${this.muted ? "  MUTE" : ""}` +
        `${this.tp?.adj ? `  sync ${(this.tp.adj * 1000).toFixed(0)}ms` : ""}`,
    ].join("\n"));
    // se envuelve solo: la lista de teclas ya no entra en una linea a 900px
    this.hint.setWordWrapWidth(w - 40).setPosition(20, h - 32 - this.hint.height);
    if (this.tp?.playing) this.started = true;   // pausar es normal al disenar: no molestar
    // `msg` es un texto de Phaser, o sea que va por encima del Graphics: el cartel de muerto se
    // lee igual dentro del apagon del break o de un corte del gate, como el HUD.
    // ...y dice CUANTO llevabas: `songT` esta congelado en el choque, o sea que el porcentaje es
    // el del sitio donde moriste. Terminando el nivel `t` vale la duracion entera, o sea 100%.
    if (this.dead > 0) {
      const pct = Math.round(Math.min(1, t / (this.tp?.duration || 1)) * 100);
      this.msg.setText(`${this.lives ? "FIN" : "MUERTO"}  ${pct}%\n${this.dead.toFixed(1)}`);
    }
    this.msg.setPosition(w / 2, h / 2).setVisible(this.dead > 0 || !this.started);
    // LA PANTALLA POR CUATRO: lo ULTIMO de todo, porque copia el cuadro que se acaba de dibujar.
    this.setGrid(this.grid, w, h);
  }

  // El flip no se veia venir: la gravedad cambiaba de golpe y no habia nada en la pista que
  // lo anunciara. Ahora la cue es un porton de lado a lado con flechas hacia donde te va a
  // tirar, y llega desde el spawn, o sea `leadOf(speed)` antes (4.7s a v=700).
  drawFlipGates(cues) {
    const g = this.g;
    const P = (x, y, z) => { const p = this.proj(x, y, z); return new Phaser.Geom.Point(p.x, p.y); };
    for (const c of cues) {
      if (c.role !== "flip") continue;
      const z = PLAYER_Z + (c.t - this.songT) * this.speed;
      if (z > SPAWN_Z || z < this.zn) continue;
      const to = -this.grav;   // el lado al que te manda: el contrario al que estas pisando
      const near = Phaser.Math.Clamp(1 - z / SPAWN_Z, 0.5, 1);
      // el medio porton va 65 por fuera del borde: cruza la pista entera y sobra un poco.
      // Medido: 320 con 3 carriles (el de siempre) y 405 con 4.
      const w = this.cam.flat ? 0 : this.edge + 65, h2 = 360;
      // el marco cruza el plano del suelo: por eso se lee que la pista sigue del otro lado
      const marco = [P(-w, -h2, z), P(-w, h2, z), P(w, h2, z), P(w, -h2, z)];
      g.fillStyle(PALETTE.lime, 0.1 * near);
      g.fillPoints(marco, true);
      g.lineStyle(Math.max(3, 9 * near), PALETTE.lime, near);
      g.strokePoints(marco, true);
      // chevrones espejados en el plano del suelo, apuntando a los DOS lados: se lee "se da
      // vuelta". Apuntando a uno solo se lee "agachate", que es otra tecla.
      for (const x of this.cam.flat ? [0] : this.laneX) {   // uno por carril, en su centro
        for (const lado of [to, -to]) {
          for (const d of [90, 220]) {
            const b = P(x, (60 + d) * lado, z);
            for (const s of [-1, 1]) {
              const q = P(x + s * 60, d * lado, z);
              g.lineBetween(b.x, b.y, q.x, q.y);
            }
          }
        }
      }
    }
  }

  // El orb no se choca: se agarra MANTENIENDO ↑/W, y eso no se ve mirandolo. Al que viene
  // entrando se le pone el cartel encima, y cambia cuando ya lo estas manteniendo.
  drawOrbHint(obs) {
    const o = obs.filter((c) => c.role === "orb" && !this.hit.has(c.n) && c.t > this.songT)
      .sort((a, b) => a.t - b.t)[0];
    if (!o || o.t - this.songT > 1.6) return this.orbHint.setVisible(false);
    const k = KINDS[o.kind] ?? KINDS.orb;
    const z = Math.max(zOf(o, this.songT, this.speed) + k.d / 2, this.zn);
    const p = this.proj(this.cam.flat ? 0 : this.laneX[o.lane], ((k.y0 + k.y1) / 2) * this.grav, z);
    this.orbHint.setVisible(true).setPosition(p.x, p.y + (k.w + 22) * p.s)
      .setText(this.held() ? "↑ OK" : "MANTENER ↑")
      .setColor(this.held() ? HEX.green : HEX.pink);
  }

  // Guia para entrar en una zona de un carril: los otros dos se pintan de rojo en el suelo,
  // desde lejos, para que sepas a cual moverte ANTES de llegar. En 2D no hay carriles.
  drawZoneTiles() {
    if (this.cam.flat || !this.lv?.zones?.length) return;
    const g = this.g, band = this.lv.beat * this.speed;
    const P = (x, zz) => { const p = this.proj(x, 0, zz); return new Phaser.Geom.Point(p.x, p.y); };
    for (let r = rowAt(this.songT, this.lv), n = 0; n < MAX_TILES; r++, n++) {
      const z = PLAYER_Z + (timeOfRow(r, this.lv) - this.songT) * this.speed;
      if (z > SPAWN_Z) break;
      const zone = zoneOfRow(r, this.lv);
      if (!zone) continue;
      const z0 = Math.max(z, this.zn), z1 = Math.max(z + band, this.zn);
      if (z1 <= this.zn) continue;
      // se dibuja sobre el tunel, que tambien es rojo: sin el contorno la guia no se ve
      const a = Phaser.Math.Clamp(1 - z / SPAWN_Z, 0.35, 0.7);
      for (const lane of this.laneIdx) {
        if (lane === zone.lane) continue;
        // ±85 = medio paso, y el paso no cambia con N: el carril mide lo mismo con 3 y con 4
        const x0 = this.laneX[lane] - 85, x1 = this.laneX[lane] + 85;
        const quad = [P(x0, z0), P(x1, z0), P(x1, z1), P(x0, z1)];
        g.fillStyle(COLORS.block, a);
        g.fillPoints(quad, true);
        g.lineStyle(2, PALETTE.text, a);
        g.strokePoints(quad, true);
      }
    }
  }

  // La pista numerada: una fila por beat (la banda del suelo), tile = fila*3 + carril.
  // Sirve para dictar donde NO hay senal: "en la fila 78 carril 0 una caja".
  // Al lado del numero va lo que pide esa fila, un caracter por carril (izq a der):
  // # caja · ^ saltar · v deslizar · O orb de salto · o orb de dash · · libre.
  drawRowNums() {
    const tiles = this.nums === 2;
    let i = 0;
    // desde la fila siguiente: la actual ya paso al jugador y su numero cae fuera de la pista
    for (let r = rowAt(this.songT, this.lv) + 1; i < MAX_TILES; r++) {
      const z = PLAYER_Z + (timeOfRow(r, this.lv) - this.songT) * this.speed;
      // `this.lanes` y no un 3: con 4 carriles y poca velocidad la fila entraba con i=45 y
      // escribia en `tileLabels[48]` (undefined) -> TypeError.
      if (z > 2600 || i + (tiles ? this.lanes : 1) > MAX_TILES) break;
      if (z < this.zn) continue;   // en 1a persona las filas ya pisadas quedan detras
      const alpha = Phaser.Math.Clamp(1 - z / SPAWN_Z, 0.2, 0.9);
      for (const lane of tiles ? this.laneIdx : [-1]) {
        // el f<n> va 27 por FUERA del borde: dentro caeria encima del carril de afuera.
        // Medido: -282 con 3 carriles (el de siempre) y -367 con 4.
        const p = this.proj(lane < 0 ? -(this.edge + 27) : this.laneX[lane], 1, z);
        this.tileLabels[i++].setVisible(true).setPosition(p.x, p.y - 2)
          // el tile va con N: `tiles()` en music.js resuelve las directivas con `lanes`, o
          // sea que sin el tercer argumento el nivel 2 mostraba 33 donde el guion pide 43.
          .setText(tiles ? `${tileOf(r, lane, this.lanes)}` : `f${r} ${this.rowGlyph(r)}`)
          .setAlpha(alpha);
      }
    }
  }

  // Que pide la fila r, un caracter por carril. Sale del mapa que se arma al cargar el
  // nivel: son 275 cues y esto corre por frame, no se puede recorrer la lista entera.
  rowGlyph(r) {
    const a = this.byRow?.get(r);
    const z = zoneOfRow(r, this.lv);
    return this.laneIdx.map((l) => (z && l !== z.lane ? "x" : a?.[l] ?? "·")).join("");
  }

  // Capas de detalle sobre el color base. Parallax = `k` por capa sobre la distancia
  // Parrilla de laseres del fondo: dos emisores fuera de cuadro que abren un abanico, mas
  // focos moviles. Va en espacio de PANTALLA, no del mundo: no depende de la camara.
  // Se dibuja ANTES del suelo y del skyline, o sea que solo se ve en el cielo y los edificios
  // lo tapan: por eso no hace falta recortarlo contra la pista (medido: a zn=60 el borde de
  // la pista proyecta en x=6395 de una pantalla de 2528, no hay franja lateral que valga).
  // Sincro, y todo funcion pura de songT: la intensidad es `this.rave` (que es el kick en el
  // drop, las MARCAS en el buildup y 0 en el break), el abanico barre con el compas y el
  // color lo elige el compas (hash del numero de compas, no random). El abanico ademas
  // ABRE Y CIERRA con el compas y se dobla por viga, o sea que no es un peine rigido.
  drawRig(w, h, pulse) {
    const g = this.g, rave = this.rave;
    if (rave <= 0.02) return;   // break: luces apagadas
    const bar = (this.lv?.beat ?? 0.4615) * 4;
    const ph = (this.songT / bar) * Math.PI * 2;
    // EL RIG POR ENCIMA DE TODO (`rigOver`, ver el bloque de dibujo): dibujado sobre el mundo
    // y no solo en el cielo, con el mismo alpha tapaba la pista, asi que ahi va a `RIG_DIM`.
    // Sin el dial vale 1 y el nivel 1 no se entera.
    const dim = this.rigOver ? RIG_DIM : 1;
    // ...Y NO BAJA DE LA MITAD DE LA PANTALLA (`RIG_CUT`). Bajarle el alpha no alcanzo: se
    // reporto que abajo tapa al jugador, y medido es cierto, el 35% del largo de trazo del rig
    // cae por debajo de la mitad (mode 0 47.6%, mode 1 25.2%, mode 2 34.5%, con el 18.6% de sus
    // vigas ENTERAS abajo), los focos cruzan la mitad en el 97% de los frames y llegan a y=531
    // de 582, y el muneco de pie ocupa y 405..498. Sin el dial `yc` es el borde de abajo, o sea
    // que la expresion es la de siempre y el nivel 1 no se entera.
    const yc = this.rigOver ? h * RIG_CUT : h;
    for (let i = 0; i < 3; i++) {   // focos moviles del fondo
      const s = 0.6 + 0.5 * hash(i);
      const cx = w * (0.5 + 0.62 * Math.sin(ph * 0.31 * s + i * 2.1));
      const cy = h * (0.16 + 0.24 * Math.sin(ph * 0.19 * s + i));
      // EL COLOR DEL RIG LO DECLARA EL NIVEL (`neon.rig`) y no es `neon.fam`: los tres focos y
      // el abanico traian dos listas hardcodeadas y distintas entre si (violeta/cyan/rosa los
      // focos, cyan/violeta/rosa/accentSoft el abanico), o sea que `fam` no es un respaldo
      // exacto de ninguna de las dos. El respaldo es lo que el renderer hacia antes de existir
      // el dial, que es lo que deja el nivel 1 en 0 px; el 2 declara su familia cyan.
      const col = (this.lv?.neon?.rig ?? RIG_SPOT)[i % (this.lv?.neon?.rig ?? RIG_SPOT).length];
      for (let k = 3; k >= 1; k--) {
        g.fillStyle(col, rave * dim * (0.06 + 0.08 * pulse) / k);
        // los focos no se arreglan acortandolos: son discos. Un disco cortado por una recta es
        // un SEGMENTO CIRCULAR, y eso es el mismo path que Phaser ya sabe cerrar con la cuerda.
        const rr = h * 0.17 * k * s;
        if (!this.rigOver || cy + rr <= yc) g.fillCircle(cx, cy, rr);
        else if (cy - rr < yc) {
          const f = Math.asin((yc - cy) / rr);   // |(yc-cy)/rr| < 1: lo garantizan los dos ifs
          g.beginPath(); g.arc(cx, cy, rr, Math.PI - f, Math.PI * 2 + f); g.fillPath();
        }                                        // entero por debajo del corte: no se dibuja
      }
    }
    const rig = this.lv?.neon?.rig ?? RIG_FAN;
    const nb = Math.floor(this.songT / bar);
    const col = rig[Math.floor(hash(nb) * rig.length)];
    const a = rave * (0.5 + 0.5 * pulse) * dim;
    const abre = 0.72 + 0.42 * Math.sin(ph * 0.5);   // el abanico respira cada dos compases
    // EL ABANICO TIENE VARIANTES Y CUAL VA LO DICE EL COMPAS. Cuelgan de `rigOver`, o sea que
    // un nivel que no lo declara (el 1) no puede entrar aca ni por hash: sigue siendo el mismo
    // codigo de siempre, que es lo que lo deja en 0 px.
    const mode = this.rigOver ? Math.floor(hash(nb * 5 + 3) * 3) : 0;
    if (mode === 0) for (const s of [-1, 1]) {
      const ex = w / 2 + s * w * 0.56, ey = -h * 0.05;   // emisor fuera de cuadro, arriba
      for (let i = 0; i < 11; i++) {
        // angulo desde la vertical hacia adentro: apertura que respira + barrido por viga
        const ang = 0.16 + 1.3 * abre * (i / 10) + 0.22 * Math.sin(ph * 2 + s * 1.6 + i * 0.5);
        const dx = -s * Math.sin(ang), dy = Math.cos(ang);
        // EL CORTE VA DESPAREJO viga por viga (hasta un 6% del alto, por hash y no random): con
        // el corte seco las 11 vigas mueren en la MISMA y (medido, hasta 22 en y=291) y eso se
        // lee como una raya horizontal dibujada a proposito. Medido a h=582, los cortes quedan
        // repartidos en y 258..289, todos por encima de la mitad.
        const yi = yc - (this.rigOver ? h * 0.06 * hash(i + 13) : 0);
        const x1 = ex + dx * (yi - ey) / dy, br = a * (0.45 + 0.55 * hash(i + 7));
        g.lineStyle(12 + 22 * pulse, col, br * 0.16);   // halo
        g.lineBetween(ex, ey, x1, yi);
        g.lineStyle(2 + 3 * pulse, col, Math.min(1, br * 1.5));   // nucleo
        g.lineBetween(ex, ey, x1, yi);
      }
    }
    // ABANICO HORIZONTAL (las fotos de referencia): los emisores se van a los COSTADOS, fuera
    // de cuadro, y las vigas CRUZAN la pantalla de lado a lado en vez de caer del cielo. El
    // modo 2 pone dos alturas por lado, o sea que los dos abanicos se cruzan en el medio.
    // El segundo emisor del mode 2 estaba en 0.66, o sea POR DEBAJO del corte: recortando y ya,
    // perdia el 52% de su largo y el 37% de sus vigas enteras y "los cuatro abanicos cruzandose"
    // quedaba en tres. Se espeja al otro lado del corte (0.44). Medido, sobrevive: 0.26 -> 83%,
    // 0.42 -> 76%, 0.44 -> 74% del largo, y CERO vigas tiradas en los tres.
    else for (const s of [-1, 1]) for (const yy of (mode === 1 ? [0.42] : [0.26, 0.44])) {
      const ex = s < 0 ? -w * 0.06 : w * 1.06, ey = h * yy, L = w * 1.25;
      for (let i = 0; i < 11; i++) {
        const ang = -0.55 + 1.15 * abre * (i / 10) + 0.22 * Math.sin(ph * 2 + s * 1.6 + i * 0.5);
        const dx = -s * Math.cos(ang), dy = Math.sin(ang);
        const br = a * (0.45 + 0.55 * hash(i + 7));
        // aca el extremo es parametrico y `dy` cambia de signo, asi que el recorte es el general
        // (una sola cuenta por viga, reusada por el halo y el nucleo).
        let bx = ex + dx * L, by = ey + dy * L;
        const yi = yc - (this.rigOver ? h * 0.06 * hash(i + 13) : 0);
        if (ey > yi && by > yi) continue;              // viga entera debajo del corte
        if (by > yi) { const tc = (yi - ey) / (by - ey); bx = ex + (bx - ex) * tc; by = yi; }
        g.lineStyle(12 + 22 * pulse, col, br * 0.16);
        g.lineBetween(ex, ey, bx, by);
        g.lineStyle(2 + 3 * pulse, col, Math.min(1, br * 1.5));
        g.lineBetween(ex, ey, bx, by);
      }
    }
  }

  // ONDAS DIGITALES: una malla de alambre en el PLANO DEL SUELO, a los dos lados de la pista
  // y espejada. Va FUERA de la pista (del borde para afuera, hasta |x| = 1400) por lo mismo
  // que el barrido del rave: adentro taparia los obstaculos, que es la queja que arreglaron
  // los huecos. Es la capa mas de atras del decorado del mundo.
  //
  // Funcion pura de songT, como todo: las filas se desplazan con la pista (su z sale de
  // `songT * speed`, el mismo idiom que las bandas del suelo), o sea que rebobinar la
  // rebobina, y la forma sale de TRES senos de periodos distintos en x, en z y en x+z. Tres
  // y no uno: con un solo seno las crestas quedan paralelas y se lee como chapa acanalada;
  // con los tres batiendo entre si las crestas se cortan y se lee como oleaje.
  //
  // COSTO MEDIDO contando las llamadas al Graphics de 20 pasadas (1248x651, drop2 del nivel 2,
  // t=36): antes **508 de dibujo** (60 `strokePoints` + 448 `lineBetween`) con 60 `lineStyle`,
  // o sea 568 en total; ahora **772 de dibujo** (34 `strokePoints` + 738 `lineBetween`) con
  // 772 `lineStyle`, o sea 1544. El `lineStyle` sube uno por segmento porque el color va POR
  // SEGMENTO: Phaser Graphics no tiene color por vertice, y una polilinea de un solo tono es
  // justo lo que hacia que la ola saliera plana.
  // Lo que paga las 18 columnas (Nyquist, ver arriba) es que las de CRUCE van una de cada 4:
  // con todas serian 1360 de dibujo y ademas volveria la cuadricula.
  // Tiempo medido sobre 60 pasadas de `drawMesh` solo: **0.078ms de media, 0.20 p95, 0.90
  // max**, o sea que no mueve el presupuesto de `draw()` (0.4ms de media medidos en el nivel 1).
  // Estirarla hasta `SPAWN_Z` (ver `MESH_FOG`) mas la cuna y el resplandor del horizonte suben
  // las llamadas al Graphics de 9056 a 13803 por frame, y `draw()` entero de **0.53ms de media
  // y 0.95 p95 a 0.59 y 1.05** (1160 frames del drop2 a x1 sonando, dos corridas por lado):
  // 0.06ms sobre un presupuesto de 16.7.
  // LA OLA, con signo y normalizada a -1..1 por la suma de los pesos VIVOS (2.15 mas lo que
  // quede del rizo): asi el oleaje de las filas de lejos, que es el que esta medido contra las
  // fotos de referencia, no se achica un 16% por un termino que ahi vale 0.
  // Vive aparte porque la usan las DOS proyecciones (`drawMesh` y `drawMeshFlat`): de perfil
  // es la misma agua mirada de canto, y dos copias del mismo seno se separan solas.
  // `mode` 1 es LA OTRA OLA, la del drop (`wave` en LEVELS): el doble de crestas en z, la
  // deriva al reves (viene hacia vos en vez de alejarse) y el termino largo cruzado en `x - z`
  // en vez de `x + z`, o sea que las crestas se inclinan para el otro lado. Es la misma malla
  // con otro ritmo, que es lo que se pidio, y no una capa nueva que haya que medir de cero.
  // `mode` 2 es el SUELO OUTRUN del nivel 1: la cordillera de `fx.js`, plana al lado de la pista
  // y en pico. Va ANTES del `if (mode)`, que pregunta por verdadero y no por 1: un 2 caeria en
  // la ola del nivel 2. No lleva `t` ni `rip`: una montana no ondula (ver `outrun`).
  // `x0` es donde arranca a levantarse y lo pone el que dibuja: el borde de ADENTRO de la fila
  // (`xi`), que es de PANTALLA y no del mundo. Sin el, la cordillera no existia en el campo
  // cercano (medido: relieve 0.0px a z=700 y 3.4px a z=1100, contra 4.0 y 21.2 con el borde de
  // la fila). Los otros modos lo ignoran: el agua del nivel 2 ondula desde el borde mismo.
  meshWave(x, z, t, rip = 0, mode = 0, x0) {
    if (mode === 2) return outrun(x, z, x0);
    if (mode) {
      return (Math.sin(x * MESH_KX * 0.7 + t * 1.65)
        + 0.70 * Math.sin(z * MESH_KZ * 2 + t * 1.70)
        + 0.45 * Math.sin((x - z) * MESH_KD * 3 - t * 0.90)
        + rip * Math.sin(x * MESH_KR - t * 1.9)) / (2.15 + rip);
    }
    return (Math.sin(x * MESH_KX + t * 1.10)
      + 0.70 * Math.sin(z * MESH_KZ - t * 0.85)
      + 0.45 * Math.sin((x + z) * MESH_KD + t * 0.45)
      + rip * Math.sin(x * MESH_KR - t * 1.9)) / (2.15 + rip);
  }

  // La rampa de color de la malla, en UN solo sitio: la habia copiada en `drawMesh` y en
  // `drawMeshFlat` y ya se desincronizo una vez (el nivel 1 se quedo en cyan de perfil porque
  // se parcheo una sola de las dos). `f` es la niebla y solo la mete la camara de atras; de
  // perfil llega 0, y `mix(c, fog, 0)` devuelve `c` exacto (redondeo por canal de `a+(b-a)*0`),
  // o sea que unificarlas es byte a byte lo mismo que estaba.
  meshTone(v, f) {
    const c = mix(this.lv?.mesh?.lo ?? MESH_LO, this.lv?.mesh?.hi ?? MESH_HI, ((v + 1) / 2) ** 0.55);
    return f ? mix(c, this.fog, f * 0.75) : c;
  }

  drawMesh() {
    if (this.cam.flat) return this.drawMeshFlat();
    const g = this.g, t = this.songT;
    // LA OLA SUBE CON EL METRONOMO, no con las cues. Con `this.beat` a secas la ola quedaba
    // CONGELADA el 59% del nivel (medido: `pulse` <= 0.05 en 42.7s de 72.31, y `beat` = 0 el
    // 100% del outro), o sea que el buildup, el drop2 y el outro daban la misma imagen.
    // `this.lat` es el metronomo de la grilla con la senal de acento encima (ver `gridAt`).
    // 0.40 + 0.70 y no 0.45 + 0.55: con el metronomo topado (`metro` = 0.45) `lat` medio pasa
    // a 0.150 en el outro y 0.460 en el drop2, y con los coeficientes viejos esos dos extremos
    // daban amplitud x0.532 contra x0.703, o sea **un 32%**. Con 0.40 + 0.70 son x0.505 contra
    // **x0.722 (+43%)**, y ademas baja la media, que es lo que devuelve la pista por delante de
    // la malla (ver el alpha).
    const amp = MESH_AMP * (0.40 + 0.70 * this.lat);
    // EL TIRON de lo que HACES (cambiar de carril, saltar, comerte una caja): la misma
    // envolvente que el bamboleo del muneco (seno por exponencial, ~0.45s), asi que la cresta
    // de al lado del jugador se levanta y se apaga sola. Los DOS lados a la vez: `wobDir` es
    // direccion en el cambio de carril pero magnitud en el salto (0.7) y en el golpe (2.2),
    // o sea que su signo no dice un lado y usarlo mentiria en dos de los tres casos.
    const dw = t - this.wobT;
    const tir = dw >= 0 && dw < 0.9
      ? Math.sin(dw * 22) * Math.exp(-dw / 0.16) * Math.min(1, Math.abs(this.wobDir)) : 0;
    const off = (((t * this.speed) % MESH_DZ) + MESH_DZ) % MESH_DZ;
    for (const s of [-1, 1]) {
      let prev = null, prevH = null;
      // la fila de la reticula GRUESA (una de cada `PYRA_DZ`) y su contador
      let base = null, baseH = null, ri = 0;
      // de `MESH_FAR` para aca y no de `SPAWN_Z`: mas alla de ahi la niebla propia ya la dejo
      // por debajo de alpha 0.05 (medido), o sea que serian filas invisibles y pagadas.
      for (let z = MESH_FAR; z > this.zn; z -= MESH_DZ) {
        const zz = Math.max(z - off, this.zn + 4);
        if (zz <= this.zn + 4) { prev = null; base = null; ri = 0; continue; }
        const f = Phaser.Math.Clamp((zz - PLAYER_Z) / MESH_FOG, 0, 1) ** 1.4;
        // el alpha va por DEBAJO del de las bandas del suelo (0.28 + 0.4*lat) a proposito:
        // el suelo es la pista y la malla es el fondo, la jerarquia estaba invertida.
        // Salia de `this.pulse`, que en este nivel vale 0 el 0% del buildup pero el **100% del
        // drop2 y del outro** (42.7s de 72.31): el alpha se quedaba clavado en el piso mas de
        // media cancion y la malla se veia igual en las tres secciones. Ahora sale del
        // metronomo (`this.lat`), que existe siempre, y la senal solo lo levanta.
        // Piso 0.15 y techo 0.45, contra las bandas del suelo (0.28 -> 0.68). El techo esta
        // topado por MEDICION y no a ojo: con 0.60 la malla marcaba p95 de luma 92/114/82 en
        // buildup/drop2/outro contra 79/84/76 del suelo, o sea que le pasaba a la pista en las
        // tres.
        // El PISO bajo de 0.19 a 0.15 y el recorrido subio de 0.25 a 0.30 por lo mismo que la
        // amplitud: es lo que separa el drop2 del outro (a 0.294 contra 0.195, o sea +51%
        // contra el +22% de antes) y ademas baja la MEDIA de la malla, que era lo que le
        // ganaba al suelo (medido: en el quieto 36.0 de luma media contra 34.3 del suelo, y en
        // el break 19.3 contra 15.7). La pista es lo que hay que leer.
        // ...y en 1a PERSONA se apaga ademas lo que tenes ENCIMA, con el mismo `pasa(z)` que
        // usan las cajas: la camara esta dentro de la pista, o sea que la fila de malla mas
        // cercana (a 4 del plano cercano, s = fov/94 = 7.3) proyecta a pantalla entera y las
        // 28 columnas convergen en un abanico de lineas que se derrama SOBRE el plano del
        // suelo. Es geometria correcta y se lee como un bug, igual que la caja del carril de
        // al lado. AL CUBO y no crudo: `pasa` es una rampa lineal hasta 500, y a 94 (que es
        // donde cae la fila mas cercana) todavia vale 0.19, o sea que el abanico seguia
        // dibujado, solo que mas tenue (medido: 6718 -> 5344px, y en la captura se sigue
        // leyendo igual). Al cubo esa fila da 0.007 y el corte de `a < 0.02` que ya existe la
        // tira entera, mientras que a 400 todavia vale 0.51: se apaga sin saltar de un frame
        // al otro. Es el mismo truco del quake y del flash del drop (`pulse³`).
        // Medido en el drop2 de esa camara: la malla por debajo de y=340 (donde ya no hay
        // fondo, es el plano del suelo que se juega) pasa de **6718px = 1.73% de esa banda a
        // 2549px = 0.66%**, la malla entera de 6.53% a 6.00% del cuadro, y lo mas bajo que
        // llega deja de ser y=557 (por debajo del muneco) para ser y=454: lo que queda es la
        // malla LEJANA vista de frente, no el abanico encima tuyo. En 3a persona y de perfil
        // `pasa` devuelve 1 y no cambia un pixel
        // (`cam.body`), asi que el nivel 1 tampoco se entera.
        const a = (0.15 + 0.30 * this.lat) * this.wave.a * (1 - f) * this.pasa(zz) ** 3;
        if (a < 0.02) { prev = null; base = null; ri = 0; continue; }
        const alza = tir * 150 * Phaser.Math.Clamp(1 - Math.abs(zz - PLAYER_Z) / 700, 0, 1);
        // columnas LINEALES: `proj` es lineal en x (x * fov/z), o sea que parejas en el mundo
        // son parejas en PANTALLA. El `u^1.7` de antes las apretaba contra la pista y dejaba
        // 17px entre las dos internas contra 107 entre las dos externas.
        // El borde de ADENTRO sale de la fila (`MESH_GAP` es pixeles, ver arriba), asi que se
        // recalcula por fila: es lo que devuelve la malla al campo cercano.
        // Y el de AFUERA es **siempre el borde de la PANTALLA**. Estuvo topado a 1400 del
        // mundo, y ese tope no se ve como un tope: se ve como DOS CUNAS NEGRAS en las esquinas
        // de arriba, entre el resplandor del horizonte y la malla. Es que el plano del suelo
        // llega al borde de cuadro a cualquier z y la malla moria en 1400: medido en el drop2,
        // a **y=312** (20px por debajo de la punta de la pista) la malla iba de x=279 a x=999,
        // o sea **527px = el 42% de la fila** en negro repartido entre las dos esquinas, y a
        // y=332 eran 328px (26%).
        // El tope estaba por NYQUIST, no por gusto: con las columnas fijas en 28, llevar el
        // borde a la pantalla sube el paso a 120 del mundo a z=4000 contra un periodo de 262,
        // o sea 2.2 muestras, y la ola lejana se aliasa. Se arregla donde estaba el problema:
        // el numero de columnas sale del PASO EN PANTALLA (`MESH_PX`) y no es fijo. Como
        // `proj` es lineal en x, un paso constante en pantalla es un Nyquist constante en
        // pantalla, que es donde se ve el alias. Medido: la fila cercana (z=700) se queda en
        // las 28 de siempre (282px de ancho en pantalla) y las de lejos, que ahora cruzan la
        // pantalla entera (556px), piden **35**; el periodo de la ola en pantalla nunca baja
        // de 3.0 muestras y de las 4.4 a z=2993, que es donde estaba la cuna.
        const sz = this.proj(0, 0, zz).s;
        const xi = this.edge + MESH_GAP / sz;
        const xo = (this.scale.width / 2 + 80) / sz;
        const nx = Math.max(MESH_NX, Math.round(((xo - xi) * sz) / MESH_PX) + 1);
        const row = [], hs = [];
        let med = 0;
        // el rizo del campo cercano (ver `MESH_KR`): entero encima del jugador y cero a 1000
        // de ahi. Es por FILA, o sea una resta por fila y no una por columna.
        const rip = MESH_RIP * Phaser.Math.Clamp(1 - (zz - PLAYER_Z) / MESH_RIP_Z, 0, 1);
        for (let k = 0; k < nx; k++) {
          const x = xi + ((xo - xi) * k) / (nx - 1);
          const v = this.meshWave(x, zz, t, rip, this.wave.mode, xi);
          hs.push(v);
          med += v / nx;
          const p = this.proj(s * x, (v * amp + alza) * this.grav, zz);
          row.push(new Phaser.Geom.Point(p.x, p.y));
        }
        // EL COLOR ES POR SEGMENTO Y CON SIGNO. Antes salia de un `max` POR FILA y se aplicaba
        // a la polilinea entera, o sea que las 15 filas salian del mismo tono y `MESH_HI` no
        // aparecia nunca: la ola no tenia crestas encendidas ni valles oscuros, era plana.
        // Con `(v+1)/2` el valle llega de verdad a `MESH_LO` y la cresta a `MESH_HI`.
        // ...y con GAMMA, porque la mezcla lineal nunca llegaba a `MESH_HI`: `v` es la suma de
        // cuatro senos, o sea que su distribucion se apila en el medio y el 1.0 solo sale
        // cuando los cuatro coinciden. Medido en pantalla, con la mezcla lineal la malla
        // llegaba a p99 de luma **55.6** y solo 222px del canvas (0.027%) pasaban de 60: era
        // cyan apagado, no neon. Con `u^0.55` la mitad de arriba de la ola ya vive en el
        // color de cresta y el valle sigue cayendo a `MESH_LO`.
        // Los dos colores los puede declarar el NIVEL (`mesh` en LEVELS): la misma malla es agua
        // cyan en el nivel 2 y una cordillera dorada en el 1. El respaldo son las constantes de
        // arriba, o sea lo de siempre.
        const tono = (v) => this.meshTone(v, f);
        // halo ancho: UNA pasada de toda la fila con el tono medio (es difuso, no necesita
        // resolucion de color) y el nucleo fino va segmento a segmento. Con las dos pasadas
        // por segmento el coste se duplicaba sin que se note nada.
        g.lineStyle(3.5, tono(med), a * 0.3);
        g.strokePoints(row, false);
        // el ALPHA tambien sale de la altura, no solo el color: la cresta se enciende y el
        // valle se apaga, que es lo que separa una ola de una cuadricula pintada de dos tonos.
        // La cresta llega a 1.35 veces el alpha de la fila y el valle se queda en 0.5: antes
        // era 0.55..1.30 y con eso la diferencia entre cresta y valle era de 2.4 a 1, poca
        // para que la ola tenga relieve de lejos. Ahora es de 2.7 a 1. El techo de 1.5 que se
        // probo primero daba mas relieve pero subia el p95 de la malla por encima del suelo.
        const alto = (v) => Math.min(1, a * (0.5 + 0.85 * ((v + 1) / 2)));
        for (let k = 1; k < row.length; k++) {
          g.lineStyle(1.2, tono((hs[k] + hs[k - 1]) / 2), alto((hs[k] + hs[k - 1]) / 2));
          g.lineBetween(row[k - 1].x, row[k - 1].y, row[k].x, row[k].y);
        }
        // las de CRUCE, una de cada `MESH_CROSS`: son las que hacen la cuadricula, y la
        // referencia es un mesh de crestas largas. Con todas vuelve la reja.
        // Hasta la MENOR de las dos filas: desde que `nx` sale del paso en pantalla, dos filas
        // vecinas no tienen por que tener las mismas columnas.
        if (prev) for (let k = 0, n = Math.min(row.length, prev.length); k < n; k += MESH_CROSS) {
          g.lineStyle(1.2, tono((hs[k] + prevH[k]) / 2), alto((hs[k] + prevH[k]) / 2) * 0.7);
          g.lineBetween(prev[k].x, prev[k].y, row[k].x, row[k].y);
        }
        // LAS CRESTAS SE FACETAN (`wave[sec].shape` = `"pyra"`): se reporto que la ola digital
        // "sigue sin estar" y que en el buildup se deje como esta pero que en el drop use
        // piramides. No es una capa nueva ni otra geometria: es EL MISMO campo, rellenando el
        // cuadro que ya esta calculado entre la fila de atras y esta, partido en DOS TRIANGULOS
        // de distinto gris. Ese es el idiom de `pyraFaces` (dos caras compartiendo una arista,
        // lo que las hace leer como volumen es el gris y no el contorno), aplicado al terreno
        // en vez de a una esquirla, y por eso no hace falta ni un punto nuevo: la malla ya tenia
        // los cuatro.
        //
        // Solo por encima de `PYRA_THR`, y eso es lo que la hace barata y lo que la hace leerse:
        // rellenando cada cuadro la malla dejaria de ser malla (seria un plano opaco); en las
        // crestas quedan los picos macizos con los valles todavia de alambre, que es un terreno
        // low-poly y no una lamina.
        // Mismo idiom que `pyraFaces` (dos caras que comparten una arista y se leen como
        // volumen por el TONO y no por el contorno), pero sobre la reticula gruesa: la faceta
        // va de `base` (PYRA_DZ filas atras) a `row` y de `k - PYRA_NX` a `k`. La altura que
        // manda es la MAYOR de las cuatro esquinas: en un cuadro de 5x3 celdas la cresta cae
        // adentro, y pedirsela al centro se la comeria. El `zz > PLAYER_Z` es porque las filas
        // de delante del jugador proyectan invertidas (xo < xi) y darian cuadros degenerados;
        // medido, ese campo cercano aporta el 0.07% de la tinta, o sea que no se pierde nada.
        // Las dos caras se separan en COLOR y no solo en alpha: la de sombra va al tono del
        // VALLE de la misma rampa (`tono(-1)` = `MESH_LO` con su niebla). Con las dos del mismo
        // tono y solo el alpha distinto, sobre un cielo negro suman el mismo color y el pico se
        // lee plano, que es lo que `pyraFaces` resuelve con el gris.
        if (this.wave.shape === "pyra" && base && zz > PLAYER_Z) {
          const np = Math.min(row.length, base.length), bajo = tono(-1);
          for (let k = PYRA_NX; k < np; k += PYRA_NX) {
            const j = k - PYRA_NX;
            const hv = Math.max(hs[k], hs[j], baseH[k], baseH[j]);
            if (hv < PYRA_THR) continue;
            const al = alto(hv) * PYRA_A;
            g.fillStyle(tono(hv), al);
            g.fillPoints([base[j], base[k], row[k]], true);
            g.fillStyle(bajo, al * 0.42);
            g.fillPoints([base[j], row[k], row[j]], true);
          }
        }
        prev = row;
        prevH = hs;
        // la reticula gruesa avanza una de cada `PYRA_DZ` filas
        if (ri % PYRA_DZ === 0) { base = row; baseH = hs; }
        ri++;
      }
    }
  }

  // DE PERFIL la x del mundo no proyecta (los carriles colapsan en una linea), asi que la
  // malla entera se dibujaria una fila encima de otra. Pero en esa camara **z ES el eje
  // horizontal**, o sea que la misma ola se lee de canto: cortes a distintas x del mundo,
  // recorridos en z. Scrollea sola porque su fase sale de `songT`, igual que todo lo demas.
  //
  // ANTES ERAN CUATRO SENOS SUELTOS y no un campo: cuatro polilineas en y150..360, separadas
  // 70 del mundo (45px), sin lineas de cruce y con un alpha fijo por curva. Eso no es la capa
  // que tiene el nivel en 3a persona, es un decorado de cuatro rayas, y encima pasaban por
  // DELANTE del reactor (la malla se dibuja despues que el).
  //
  // Ahora es el mismo campo, con la profundidad FINGIDA: `MESH_FLAT_N` franjas, cada una un
  // corte de la ola a otra x del mundo, y la franja `i` se dibuja mas arriba, con la ola mas
  // chica (`1 - 0.65*d`) y mas apagada. El reparto en altura va con `d^0.75` y no lineal: las
  // de arriba se apretan, que es lo que hace que se lea como un plano en fuga y no como una
  // escalera. Y llevan lineas de CRUCE (una de cada `MESH_CROSS`), que es lo que cose las
  // franjas en una malla.
  //
  // DOS COSAS QUE NO PUEDE PISAR, y las dos medidas:
  //  - LA BANDA DE JUEGO: de perfil se juega entre y=371 (el techo de un `block`) y y=469 (el
  //    suelo). La franja mas baja arranca en `MESH_FLAT_Y` = 460 del mundo y con la ola entera
  //    en el valle llega a 374, o sea que su punto mas bajo cae en **y=225** de pantalla, 146px
  //    por encima del techo del `block`.
  //  - EL REACTOR: se dibuja ANTES que la malla, asi que sin esto la ola le pasa por encima.
  //    `reacAt` dice donde cayo y el alpha se va a 0 dentro de su disco con 26px de borde
  //    blando: se lee como que el reactor la TAPA, que es lo que hace en 3a persona.
  drawMeshFlat() {
    const g = this.g, t = this.songT, w = this.scale.width;
    const amp = MESH_AMP * (0.40 + 0.70 * this.lat);
    const paso = MESH_DZ / 2;   // en z hay que muestrear el DOBLE: z es el eje de la pantalla
    // solo el tramo de z que cae DENTRO del cuadro: de perfil la escala es fija (fov = h/1000)
    // y la pantalla es una ventana en z, asi que barrer hasta SPAWN_Z era pagar 4/5 de las
    // muestras fuera de cuadro.
    const zA = PLAYER_Z - (w * 0.2) / this.fov - paso, zB = PLAYER_Z + (w * 0.8) / this.fov + paso;
    // 0 dentro del reactor, 1 fuera de el mas 26px de borde blando. **Solo si el nivel tiene
    // reactor**: sin el, `reacAt` igual devuelve un sitio y un radio (es geometria de pantalla,
    // no mira el `decor`) y la malla del nivel 1 saldria con un agujero de ~198px donde no hay
    // nada que tapar.
    const re = this.reacAt(w, this.scale.height);
    const tapa = this.dec("reactor")
      ? (p) => Phaser.Math.Clamp((Math.hypot(p.x - re.x, p.y - re.y) - re.r) / 26, 0, 1)
      : () => 1;
    let prev = null, prevH = null;
    for (let i = 0; i < MESH_FLAT_N; i++) {
      const d = i / (MESH_FLAT_N - 1);
      const y0 = MESH_FLAT_Y + (MESH_FLAT_TOP - MESH_FLAT_Y) * d ** 0.75;
      const k = 1 - 0.65 * d;                       // la ola se achica con la distancia
      const x0 = this.edge + MESH_GAP + i * 210;    // otra franja de la MISMA agua
      const a = (0.15 + 0.30 * this.lat) * (1 - 0.55 * d);
      const row = [], hs = [];
      for (let z = zA; z <= zB; z += paso) {
        // el corte va SESGADO (ver `MESH_FLAT_SKEW`): a x fija las 10 franjas salen iguales
        // De perfil el `mode` va SOLO para el outrun: el 1 (la ola del drop del nivel 2) esta
        // medido de frente y aca movia sus pixeles de la camara de lado sin que nadie lo pidiera.
        const v = this.meshWave(x0 + (z - PLAYER_Z) * MESH_FLAT_SKEW, z, t, 0, this.wave.mode === 2 ? 2 : 0);
        hs.push(v);
        const p = this.proj(0, (v * amp * k + y0) * this.grav, z);
        row.push(new Phaser.Geom.Point(p.x, p.y));
      }
      // copia #2 de la rampa de color (aca sin la niebla: de perfil no hay z que se aleje).
      // El nivel manda igual que en `drawMesh`, o si no la camara de lado se quedaba en cyan.
      const tono = (v) => this.meshTone(v, 0);
      const alto = (v, p) => Math.min(1, a * (0.5 + 0.85 * ((v + 1) / 2))) * tapa(p);
      for (let n = 1; n < row.length; n++) {
        const v = (hs[n] + hs[n - 1]) / 2;
        g.lineStyle(1.2, tono(v), alto(v, row[n]));
        g.lineBetween(row[n - 1].x, row[n - 1].y, row[n].x, row[n].y);
      }
      if (prev) for (let n = 0; n < row.length; n += MESH_CROSS) {
        const v = (hs[n] + prevH[n]) / 2;
        g.lineStyle(1.2, tono(v), alto(v, row[n]) * 0.7);
        g.lineBetween(prev[n].x, prev[n].y, row[n].x, row[n].y);
      }
      prev = row;
      prevH = hs;
    }
  }

  // EL HORIZONTE NO ES UN CANTO. Dos funciones, las dos puro DIBUJO (no tocan la proyeccion,
  // ni la fisica, ni `SPAWN_Z`) y las dos del NIVEL: salen de `sky` en LEVELS, asi que el
  // nivel 1 (que no lo declara) no dibuja ni un pixel de esto.
  //
  // `drawSky`: el cielo del nivel 2 era NEGRO ABSOLUTO (medido: luma 7.4 de media, 5.9 en la
  // banda pegada al horizonte), o sea que el reactor no tenia nada contra que estar y se leia
  // como un logo pegado. Las referencias de la malla de olas tampoco son negro plano: tienen
  // el fondo levantado cerca del horizonte. Es un degradado que SALE del horizonte hacia los
  // dos lados: alto hacia el cielo (`up`) y corto hacia el suelo (`down`), porque abajo la
  // pista tiene que seguir siendo pista.
  // Pasos de ~8px y no 3 franjas: medido, con pasos gruesos el degradado se ve escalonado.
  // Va DEBAJO del reactor (se dibuja antes), o sea que le hace de fondo y no lo lava. Medido a
  // t=36: el cielo pasa de luma **7.4 a 14.6** de media y de **5.9 a 28.8** en la banda pegada
  // al horizonte, y el nucleo del reactor sigue clavado en **229.4**, o sea que sigue siendo el
  // pico del cielo (lo mas brillante que queda fuera del reactor es el HUD, 146.7).
  // CUATRO VARIANTES (`sky.mode` por seccion). Se reporto que el degradado "es demasiado
  // simple" y que hace falta algo que **no robe la atencion** pero que se mueva con la musica.
  // Por eso ninguna de las cuatro agrega geometria: son la MISMA franja con el alto, el alpha,
  // la curva o el reparto en columnas movidos, o sea el mismo numero de `fillRect` (salvo
  // `drift`, que parte 8 franjas en columnas y eso se mide). Nada de FFT: el analizador es lo
  // unico del render que no es funcion de `songT` (en pausa da ceros), y un fondo a pantalla
  // completa que cambia al pausar rompe el rebobinado a 0 px. Manda `lat`, el metronomo, que
  // esta vivo el 100% del nivel.
  //  - `swell` (buildup): el exponente de la caida respira con el latido, o sea que la franja
  //    se estira y se encoge sin cambiar de brillo. Es lo mas quieto de los cuatro a proposito:
  //    el buildup ya tiene la malla opaca y el gate.
  //  - `shut` (break): se cierra hasta CERO a lo largo de la seccion mientras el poco que
  //    queda se concentra. Cae dentro del `dark`, o sea que ademas es gratis en pixeles.
  //  - `duck` (drop2): se AGACHA en cada kick de la grilla (`kik²`), que es lo que recorta al
  //    reactor contra el cielo justo en el golpe en vez de dejarlo sobre una lamina fija.
  //  - `drift` (outro): la parte pegada al horizonte se reparte en columnas y una onda las
  //    recorre, una vuelta por compas. Es el unico con estructura horizontal, y va en el outro
  //    porque es la seccion sin reactor nuevo que mirar.
  drawSky(w, h) {
    const s = this.lv?.sky;
    if (!s) return;
    const g = this.g;
    const dir = this.camY >= 0 ? 1 : -1;   // hacia donde queda el suelo
    const m = this.skyM, u = this.secU ?? 0, L = this.lat ?? 0, K = this.kik ?? 0;
    let upk = 1, am = 1, pw = 2, cols = 1;
    if (m === "swell") { pw = 2 - 0.7 * L; upk = 0.88 + 0.24 * L; }
    else if (m === "duck") { am = 1 - 0.75 * K ** 2; upk = 1 - 0.35 * K; }
    else if (m === "shut") { upk = 1 - u; am = 1 + 0.6 * u; }
    else if (m === "drift") { cols = SKY_COLS; }
    for (const [alto, lado] of [[s.up, -dir], [s.down, dir]]) {
      // `n` sale del alto SIN modular: si el numero de franjas cambiara con el latido, el
      // redondeo haria parpadear las juntas. Lo que se modula es el grosor de cada una.
      const n = Math.max(2, Math.round((h * alto) / 8));
      const th = (h * alto * upk) / n;
      for (let i = 0; i < n; i++) {
        // al cuadrado: pegado al horizonte manda el color y a media altura ya casi no esta.
        // Lineal deja una franja de color plano que se lee como una banda, no como aire.
        const al = s.a * am * (1 - i / n) ** pw;
        // los bordes van REDONDEADOS y las franjas se tocan exactamente: con un `+1` de
        // solape (lo primero que se probo) cada junta suma dos alphas y salen 24 rayas
        // horizontales cruzando el cielo, que es justo lo que se venia a arreglar.
        const a = Math.round(this.horizon + lado * i * th);
        const b = Math.round(this.horizon + lado * (i + 1) * th);
        // ...y `drift` parte SOLO las franjas pegadas al horizonte (las 8 primeras): mas
        // arriba el alpha ya cayo por debajo de lo que se ve y partirlas seria coste sin
        // imagen. La onda da UNA vuelta por compas y va en el mundo de la columna, no en el
        // tiempo suelto: rebobinar la rebobina.
        if (cols > 1 && i < SKY_DRIFT_N) {
          const cw = (w + 120) / cols;
          for (let k = 0; k < cols; k++) {
            const cu = (k + 0.5) / cols;
            const on = 0.55 + 0.45 * Math.sin(Math.PI * 2 * (1.5 * cu - this.songT / (this.lv?.bar ?? 1.846)));
            g.fillStyle(s.col, al * on);
            g.fillRect(-60 + k * cw, Math.min(a, b), cw + 1, Math.abs(b - a));
          }
          continue;
        }
        g.fillStyle(s.col, al);
        g.fillRect(-60, Math.min(a, b), w + 120, Math.abs(b - a));
      }
    }
  }

  // `drawFar`: la pista se dibuja hasta `SPAWN_Z` y ahi corta. Medido a h=651, `SPAWN_Z`
  // proyecta **58.1px por debajo del horizonte**, o sea que el fondo de la pista flotaba con
  // 58px de negro entre el y el punto de fuga: se veia el fin del mundo, una rampa colgada.
  // Esto NO alarga la pista en el MUNDO: `SPAWN_Z` no se toca (de el salen el viaje del
  // obstaculo y `enterDz`). Es la misma banda repetida hacia el punto de fuga, cada tramo
  // 1.9 veces mas lejos que el anterior, o sea que en pantalla cada uno mide la mitad del
  // anterior: 27.5px el primero, 14.5 el segundo, y con 7 se llega a 0.6px del horizonte.
  // El alpha cae con la misma razon (0.68^i): es niebla, no una rampa pintada.
  // Medido en la franja central (x 560-690): la primera fila encendida pasa de **y=290 (55.6px
  // por debajo del horizonte) a y=234, o sea al horizonte mismo**: la cuna esta cerrada.
  // De perfil no: ahi la x del mundo no proyecta y no hay punto de fuga que rellenar.
  drawFar(col) {
    if (!this.lv?.sky || this.cam.flat) return;
    const g = this.g, bw = this.edge + 35;
    // el mismo color y el mismo latido que una banda del suelo normal, para que la junta con
    // la ultima banda no se vea
    let z = SPAWN_Z;
    for (let i = 0; i < 7; i++) {
      const z1 = z * 1.9;
      // LA CUNA SE DISUELVE, no es una punta pintada. Se reporto que "el final de la pista se
      // ve siempre asi", y es que la cuna salia al 0.8 del alpha de una banda cayendo 0.68 por
      // tramo, o sea una punta MACIZA y mas plana que la pista rayada de aca (las bandas de
      // cerca alternan medio beat encendido y medio apagado; la cuna no alterna nada).
      // Medido en la banda de la cuna (x 573-673, y 210-260 de canvas, drop2 a t=30.9): luma
      // media **43.89 -> 38.66** y p95 **64 -> 59**, con la banda de pista de justo debajo
      // clavada en 62.39 / 133, o sea que la cuna pasa de 0.70 a **0.62** de la luma de la
      // pista de verdad y deja de competir con ella. Se probo ademas llevar el color al del
      // cielo tramo a tramo y se saco: 38.66 -> 38.58, o sea nada.
      g.fillStyle(mix(PALETTE.surfaceLight, col, 0.32 + 0.35 * this.lat),
        (0.28 + 0.4 * this.lat) * 0.42 * 0.52 ** i);
      g.fillPoints([[-bw, z], [bw, z], [bw, z1], [-bw, z1]].map(([x, zz]) => {
        const p = this.proj(x, 0, zz);
        return new Phaser.Geom.Point(p.x, p.y);
      }), true);
      z = z1;
    }
  }

  // EL REACTOR, al fondo de la pista. La geometria entera vive en `reactor.js` y aca solo se
  // resuelve DONDE va y con que late.
  // Va en espacio de PANTALLA colgado del PUNTO DE FUGA (centro en x, `this.horizon` en y) y
  // no en el mundo con una z fija: la gracia es que este siempre al final de la pista, mire
  // donde mire la camara. Por eso `P` es una semejanza (escala + traslacion), que es justo lo
  // que `drawReactor` asume para medir radios y grosores.
  // NO va centrado en el horizonte: va COLGADO por encima (`REACTOR_UP`), rozandolo. Centrado
  // metia 185px dentro de la pista (el 44% de su alto visible), o sea que un ala tapaba dos
  // filas y las bandas de las cues se dibujaban sobre ella: geometria correcta que se lee como
  // z-fighting. Y va al 50% de alpha (`REACTOR_A`, opcion `alpha` de `drawReactor`): estando en
  // el punto mas lejano no puede ser lo mas contrastado de la pantalla.
  //  - de PERFIL (`flat`) TAMBIEN se dibuja: es espacio de pantalla, no del mundo, asi que no
  //    depende de que haya punto de fuga. Ahi `this.horizon` es la linea del suelo (h*0.72) y
  //    el reactor queda colgado en el cielo, que es lo unico que hay en esa vista del nivel 2.
  //  - en 1a PERSONA si: el horizonte es el mismo y el reactor sigue estando al fondo, que es
  //    lo unico que le da profundidad a esa vista con el fondo vacio. Tapaba el centro del
  //    campo de vision cuando media el 57% del alto y estaba centrado en el horizonte; a 28%
  //    y por encima del horizonte ya no hay nada que apagar, es el mismo arreglo.
  // Con la gravedad invertida NO se da vuelta: es la pista la que cuelga, y un reactor de
  // cabeza en el punto de fuga se leeria como que la pantalla se rompio.
  // COSTO MEDIDO: 194 primitivas = 528 llamadas al Graphics por frame. Sobre 1629 frames del
  // drop2 a x1 (1280x720), `draw()` pasa de 0.40ms media / 0.70 p95 sin decorado a 0.53 / 0.90
  // con solo el reactor: es la mitad cara de las dos capas nuevas (la malla no mueve el p95).
  // DONDE cae el reactor en PANTALLA. Lo usan `drawReactor` (para dibujarlo) y `drawMeshFlat`
  // (para no cruzarlo): dos copias de esta cuenta se separan el dia que el reactor se mueva.
  // El ancla es el FONDO REAL DE LA PISTA (`proj(0,0,SPAWN_Z).y`) y no el horizonte analitico
  // (ver `REACTOR_UP`), y el centro sube `up` radios REALES (486 nominales) por encima: lo que
  // tiene que tocar la punta de la carretera es el borde de lo que se DIBUJA, no el del cuadro.
  // CRECE CON LA CRECIENTE (`this.hype`): `REACTOR_GROW` = 0.34, o sea que va de 0.148 a
  // 0.198 del alto (28.1% -> 37.7% de diametro). El tope esta en que el reactor NO puede
  // pasar a ser el objeto mas grande de la pantalla estando en el punto mas lejos (con 0.3
  // fijo daba el 57% y eso es lo que se arreglo cuando se puso en 0.148). Va DENTRO de
  // `reacAt` y no en `drawReactor` para que `drawMeshFlat`, que usa esta misma cuenta para no
  // cruzarlo, siga tapando el disco correcto: dos copias de la cuenta se separan el dia que
  // el reactor se mueva, y este se mueve.
  reacAt(w, h) {
    // ...y RESPIRA con el latido (5%): es lo unico que le da movimiento propio a la pieza
    // entre golpe y golpe, y como sale de `this.lat` existe aunque la seccion no tenga cues.
    // ...y NO esta clavado en el centro: se corre de lado (4 compases de ida y vuelta) y cada
    // 8 se ACERCA (bump con coseno, 4 compases de subida y bajada, o sea que llega y se va, no
    // salta). Sale de `songT` y del compas del nivel, como todo: rebobinar lo rebobina. El
    // ancla de abajo no cambia, o sea que acercarse tambien lo sube: sigue pegado al final de
    // la pista y la holgura medida contra la punta de la carretera se conserva.
    const bar = this.lv?.bar ?? 1.846, ts = this.songT ?? 0;
    const q = ((ts / (bar * 8)) % 1 + 1) % 1;
    const near = q > 0.5 ? 0.5 - 0.5 * Math.cos((q - 0.5) * 4 * Math.PI) : 0;
    const k = (h * REACTOR_R * (1 + REACTOR_GROW * (this.hype ?? 0)) * (1 + 0.05 * (this.lat ?? 0))
      * (1 + REACTOR_NEAR * near) * (1 + REACTOR_SNAP * (this.snap ?? 0))) / 512;
    const r = 486 * k;
    const sw = r * REACTOR_SWAY * Math.sin((ts / (bar * 4)) * Math.PI * 2);
    const up = (this.cam.flat ? REACTOR_UP_FLAT : REACTOR_UP) - REACTOR_NEAR_Y * near;
    return { k, r, x: w / 2 + sw, y: this.proj(0, 0, SPAWN_Z).y - r * up };
  }

  drawReactor(w, h) {
    const { k, x: cx, y: cy } = this.reacAt(w, h);
    const P = (x, y) => ({ x: cx + (x - RCX) * k, y: cy + (y - RCY) * k });
    // gira LENTISIMO: una vuelta cada 16 compases (28.0s a 137bpm). Como las tres alas estan
    // a 120 grados, el ciclo aparente es un tercio de eso (9.3s).
    // gira LENTISIMO en reposo (una vuelta cada 16 compases) pero la CRECIENTE lo acelera x3
    // (una cada 5.3, o sea 9.3s a 137bpm) y encima el latido lo tironea 0.12 rad: quieto se
    // lee como un logo, y el sitio donde se lo mira es justo el drop, donde `hype` vale 1.
    // ...y encima el TIRON de los tramos `spin` (ver `draw`), que es una vuelta entera con
    // ease in/out en dos sitios marcados del drop2, uno para cada lado.
    const spin = (this.songT / ((this.lv?.bar ?? 1.846) * 16)) * Math.PI * 2 * (1 + 2 * (this.hype ?? 0))
      + 0.12 * (this.lat ?? 0) + (this.spin ?? 0);
    // las tres trazas salen del FFT REAL del audio que esta sonando, igual que el modo
    // `spectro` del eq. Es lo unico del render que NO es funcion de songT: en pausa el
    // analizador da todo ceros y `wave()` devuelve la linea base, o sea que la pantalla del
    // osciloscopio queda plana en vez de desaparecer o reventar.
    // el alpha va DENTRO de `drawReactor` (opcion `alpha`) y no como un dim global del
    // Graphics: ahi cada pieza puede bajar lo suyo (el chasis se apaga mas que las pantallas
    // y el nucleo), que es lo que un multiplicador unico no puede hacer.
    // ...y en el FOGONAZO va a 1, o sea sin dim: en alpha=1 la curva `DIM` es la identidad
    // (chasis 0.69 -> 1, fondo 0.75 -> 1, rejilla 0.80 -> 1), asi que es el unico frame del
    // nivel donde el jefe se ve entero y no atenuado como fondo. Es la mitad del "ultra
    // visible" que se pidio; la otra mitad es el tamano (`REACTOR_SNAP`).
    paintReactor(this.g, P, {
      t: this.songT, beat: this.lat, pulse: this.pulse, spin,
      alpha: this.snap > 0.01 ? 1 : REACTOR_A,
      fft: this.tp?.spectrum() ?? null, bt: this.bt,
    });
  }

  // BEATS TRANSCURRIDOS desde el `off` de la grilla. Es lo que le da a la portadora de la traza
  // (`wave` en reactor.js) UN CICLO EXACTO POR BEAT: se reporto que las ondas de las pantallas
  // no van en sincro, y es que corrian a `t * 5.5` rad/s, o sea 0.383 ciclos por beat, un
  // numero que no tiene nada que ver con el tempo. Sin nivel devuelve undefined y `wave` cae en
  // su respaldo, que es exactamente la cuenta vieja (el SVG estatico no se entera).
  get bt() {
    return this.lv ? (this.songT - (this.lv.off ?? 0)) / this.lv.beat : undefined;
  }

  // Pin spots: tubos de luz a los costados de la pista, en el MUNDO (viajan con ella, o sea
  // que su z sale de songT). Cada compas todo el rig apunta a la misma direccion, sacada de
  // `PIN_DIRS` con `hash(nro de compas)`: abajo, a los lados, o las diagonales de arriba.
  // Espejado: el de la izquierda y el de la derecha son simetricos, como un rig de verdad.
  // El haz es un triangulo (el cono) mas el nucleo; el brillo es `this.rave`, o sea que en el
  // break se apagan y en el buildup solo prenden con las marcas.
  drawPins() {
    const rave = this.rave;
    if (rave <= 0.02 || this.cam.flat) return;
    const g = this.g, t = this.songT;
    const beat = this.lv?.beat ?? 0.4615, bar = beat * 4;
    const P = (x, y, z) => { const p = this.proj(x, y, z); return new Phaser.Geom.Point(p.x, p.y); };
    const paso = beat * 2 * this.speed;   // un tubo cada dos beats
    const off = (((t * this.speed) % paso) + paso) % paso;
    const nb = Math.floor(t / bar);
    const d = PIN_DIRS[Math.floor(hash(nb) * PIN_DIRS.length)];
    const gir = 0.3 * Math.sin((t / bar) * Math.PI * 2);   // barre dentro del compas
    const col = this.neon[Math.floor(hash(nb + 0.5) * this.neon.length)];
    for (let z = SPAWN_Z; z > this.zn; z -= paso) {
      const zz = Math.max(z - off, this.zn + 4);
      if (zz <= this.zn + 4) continue;
      // se apaga de lejos Y de muy cerca: el cono de al lado del jugador es enorme en pantalla
      // y lavaria justo el obstaculo que tenes que leer.
      const a = rave * Phaser.Math.Clamp(1 - (zz - PLAYER_Z) / 3000, 0.12, 1)
        * Phaser.Math.Clamp((zz - PLAYER_Z) / 500, 0, 1);
      if (a < 0.02) continue;
      for (const s of [-1, 1]) {
        // 175 por fuera del borde: pegado al carril de afuera el cono lavaria la lectura.
        // Medido: 430 con 3 carriles (el de siempre) y 515 con 4.
        const x0 = s * (this.edge + 175), y0 = 200 * this.grav;   // al costado y por encima
        const ang = Math.atan2(d[1], s * d[0]) + s * gir;
        // el cono era de 620 de largo y 0.13 de apertura: cruzaban la pista como hilos. Con
        // 900 x 0.26 son vigas, que es lo unico que se lee de lejos. Dos conos, uno ancho y
        // tenue y otro angosto y fuerte: eso es lo que le da el borde marcado a un laser.
        const dx = Math.cos(ang) * 900, dy = Math.sin(ang) * 900 * this.grav;
        for (const [ap, al] of [[0.26, 0.13], [0.09, 0.2]]) {
          g.fillStyle(col, al * a);
          g.fillPoints([P(x0, y0, zz), P(x0 + dx - dy * ap, y0 + dy + dx * ap, zz),
            P(x0 + dx + dy * ap, y0 + dy - dx * ap, zz)], true);
        }
        g.lineStyle(5, col, 0.9 * a);   // nucleo
        const p0 = P(x0, y0, zz), p1 = P(x0 + dx, y0 + dy, zz);
        g.lineBetween(p0.x, p0.y, p1.x, p1.y);
        g.fillStyle(PALETTE.text, 0.9 * a);   // la lampara
        g.fillCircle(p0.x, p0.y, Math.max(2, 5 * this.proj(x0, y0, zz).s));
      }
    }
  }

  // Tunel: portones de luz que cruzan la pista y viajan con ella (su z sale de songT, o sea
  // que rebobinar los rebobina). El mismo dibujo, dos usos:
  //  - BREAK: uno por beat, tenues y con la boca mas ancha -> el embudo. Es el unico efecto
  //    de "camara" del break, pero la camara NO cambia: es geometria del mundo, asi que
  //    sigue siendo 3a persona y la lectura de la pista no se mueve ni un pixel.
  //  - DROP: uno cada dos beats y el brillo es el bajo (`this.beat`), o sea que el tunel
  //    late con el kick.
  // No se dibuja el lado del piso: un porton cerrado abajo se lee como obstaculo.
  drawGates(sec) {
    if (this.cam.flat || (sec !== "break" && sec !== "drop")) return;
    const g = this.g, t = this.songT, beat = this.lv?.beat ?? 0.4615;
    const br = sec === "break";
    const paso = beat * (br ? 1 : 2) * this.speed;
    const off = (((t * this.speed) % paso) + paso) % paso;
    // violeta y no rosa: el rosa quedo a un paso del KILL de las paredes y el tunel no
    // puede tener el color de lo que mata.
    const col = br ? PALETTE.accentSoft : PALETTE.violet;
    const P = (x, y, z) => { const p = this.proj(x, y, z); return new Phaser.Geom.Point(p.x, p.y); };
    let prev = null, prevA = 0;
    for (let z = SPAWN_Z; z > this.zn; z -= paso) {
      const zz = Math.max(z - off, this.zn + 4);
      if (zz <= this.zn + 4) continue;
      const d = (zz - PLAYER_Z) / (SPAWN_Z - PLAYER_Z);   // 0 encima, 1 recien salido
      // el embudo: los de cerca abren la boca, los del fondo se cierran
      const k = br ? 1 + 0.5 * (1 - d) : 1;
      // el de encima tuyo se apaga (`d*3`): un porton gigante ocupando la pantalla entera
      // se lee como andamio, no como tunel. El tunel es el que se va cerrando adelante.
      const a = (br ? 0.55 : 0.2 + 0.8 * this.beat)
        * Phaser.Math.Clamp(1 - d * 1.2, 0.05, 1) * Phaser.Math.Clamp(d * 3, 0, 1);
      if (a < 0.02) continue;
      // ARCO de 6 puntos, no un rectangulo: el marco cuadrado se leia como andamio. Los
      // hombros a media altura son lo que lo hace un porton. En el drop ademas es casi el
      // doble de grande (760x620 contra 420x340) y respira con el bajo.
      const bt = br ? 0 : this.beat;
      const W = (br ? 420 : 760) * k * (1 + 0.07 * bt);
      const H = (br ? 340 : 620) * k * this.grav * (1 + 0.07 * bt);
      const q = [P(-W, 0, zz), P(-W, H * 0.5, zz), P(-W * 0.62, H, zz),
        P(W * 0.62, H, zz), P(W, H * 0.5, zz), P(W, 0, zz)];
      // dos pasadas (halo ancho + nucleo): un solo trazo grueso se lee como tuberia
      for (const [wd, al] of [[br ? 7 : 12 + 18 * bt, 0.22], [br ? 2 + 3 * (1 - d) : 3 + 6 * bt, 1]]) {
        g.lineStyle(wd, col, a * al);
        g.strokePoints(q, false);
      }
      // las aristas largas entre porton y porton: sin esto son marcos sueltos, con esto
      // es un tunel. Se dibujan con el alpha del mas tenue de los dos.
      if (prev) {
        g.lineStyle(1.5, col, Math.min(a, prevA) * 0.7);
        for (let i = 0; i < q.length; i++) g.lineBetween(q[i].x, q[i].y, prev[i].x, prev[i].y);
      }
      prev = q; prevA = a;
    }
  }

  // La UNICA capa que se dibuja SOBRE todo lo demas. Dos efectos, los dos anuncian el drop:
  //  - BLINDERS, el ultimo compas del buildup: los focos que apuntan al publico. Estrobo que
  //    ACELERA de 1/2 beat a 1/8 y sube de brillo. Eso es lo que dice "algo va a pasar".
  //  - APAGON, todo el break: negro entero, fondo incluido. Las letras del acid son objetos
  //    de texto de Phaser, o sea que van por encima de este Graphics y quedan flotando solas
  //    en el vacio, que es justo lo que se quiere. El HUD y la tira de diseno tambien: son
  //    herramientas, no el juego.
  //    Se levanta UN BEAT antes del drop (0.462s = la ventana de reaccion de una fila). Es
  //    jugable porque esta medido: en el break NO hay ni un obstaculo (los de alrededor caen
  //    en 27.23 y en 29.54), y el primero del drop pide saltar sin cambiar de carril.
  // El MARCO de la pantalla, en espacio de pantalla y por encima del mundo. Reacciona a dos
  // cosas distintas: al beat (siempre, tenue) y al obstaculo que te esta pasando por encima
  // (`imp`, +-140ms de su hora de llegada), que es lo que hace que el borde "reciba" la caja.
  // Abajo pega el doble que a los lados: es donde esta el jugador y donde entra todo.
  drawEdges(w, h, cues, t, col) {
    const g = this.g;
    let imp = 0;
    for (const c of cues) {
      if (c.role !== "obstacle") continue;
      imp = Math.max(imp, 1 - Math.min(1, Math.abs(t - c.t) / 0.14));
    }
    const e = Math.max(this.beat * 0.5, imp);
    if (e < 0.02) return;
    const c2 = mix(col, 0xffffff, 0.35 * imp);
    for (const [k, al] of [[1, 0.16], [0.32, 0.4]]) {   // banda ancha tenue + filo fuerte
      g.fillStyle(c2, al * e);
      g.fillRect(0, h - (14 + 54 * e) * k, w, (14 + 54 * e) * k);
      const vw = (8 + 26 * e) * k;
      g.fillRect(0, 0, vw, h);
      g.fillRect(w - vw, 0, vw, h);
    }
  }

  drawFlash(w, h, sec, t, pulse) {
    if (!this.lv) return;
    const g = this.g, beat = this.lv.beat, bar = this.lv.bar;
    // DROP: blanco en CADA kick. `pulse^3` deja el fondo limpio entre golpes (medido: el
    // alpha esta por debajo de 0.01 el 60% del beat) y 0.22 de tope es lo que se vio que
    // pega sin lavar la pista: con 0.3 el cielo se ponia gris y la niebla se comia el fondo.
    // `startsWith` y no `=== "drop"`: la seccion del nivel 2 se llama `drop2` y su drop se
    // quedaba SIN respuesta de pantalla. El nivel 1 no cambia (su seccion sigue siendo
    // `drop`) y esto va antes del corte por `decor`: el golpe blanco es de todos los niveles,
    // lo que es del nivel 1 es el apagon del break y los blinders violetas de abajo.
    if (sec?.startsWith("drop")) {
      // ...con `this.kik` y no con `pulse`: en el drop2 del nivel 2 `pulse` vale 0 el 100% del
      // tramo (cero eventos de `bass`), o sea que el golpe blanco no salia NUNCA justo donde
      // tiene que salir. En el nivel 1 `kik === pulse` (no declara `metro`): 0 px.
      const a = 0.22 * this.kik ** 3;
      if (a > 0.01) { g.fillStyle(0xffffff, a); g.fillRect(0, 0, w, h); }
    }
    // APAGON Y BLINDERS: solo donde el nivel los pide (`flash` en `decor`). El nivel 2 los
    // heredaba sin pedirlos: 2.47s de negro absoluto en su break y un estrobo VIOLETA, que
    // ademas no es ni su paleta.
    if (!this.dec("flash")) return;
    const br = this.lv.sections.find((s) => s.label === "break");
    if (!br) return;
    if (sec === "break" && t < br.end - beat) {
      // entra en 0.12s: de golpe se lee como un bug de render, no como un apagon
      g.fillStyle(0x000000, Phaser.Math.Clamp((t - br.start) / 0.12, 0, 1));
      g.fillRect(0, 0, w, h);
      return;   // en el apagon no hay blinders: el apagon ES el efecto
    }
    const d = br.start - t;
    if (d <= 0 || d >= bar) return;
    const p = 1 - d / bar;                 // 0 al empezar el compas, 1 al entrar al break
    // La fase va INTEGRADA, no `t % sub`: con `sub` cambiando, `t % sub` no es una fase y
    // sale parpadeo caotico en vez de un estrobo que acelera. `4u + 8u^2` arranca en 4
    // flashes por compas (uno por beat) y termina en 20 (uno cada 1/5 de beat).
    const ph = (4 * p + 8 * p * p) % 1;
    const a = (0.22 + 0.4 * p) * Math.max(0, 1 - ph * 2.2);   // cada flash decae, no es cuadrado
    if (a < 0.01) return;
    g.fillStyle(mix(PALETTE.violet, 0xffffff, 0.75), a);
    g.fillRect(0, 0, w, h);
  }

  // ANILLOS DE RESONANCIA METALICA (referencia 4): el fondo del nivel 2. Salen del punto de
  // fuga hacia afuera y su parallax es RADIAL (`songT * speed * RINGS_K`), o sea que el fondo
  // tambien viaja con la pista. No pueden ser una capa de `layers` porque esas se desplazan
  // de COSTADO y un anillo desplazado deja de ser concentrico.
  //
  // Se cuelgan del centro del REACTOR y no del centro de la pantalla: la resonancia sale de
  // la pieza que la produce, y como `reacAt` ya crece con la creciente, los anillos crecen
  // con el sin una segunda cuenta.
  //
  // Dos pasadas como los pins y los portones (halo ancho + nucleo fino): un solo trazo grueso
  // se lee como un tubo, no como una onda. Van aplastados en y (`RINGS_SQ`) porque el cielo
  // esta en fuga: circulos perfectos se leen como un blanco de tiro pegado a la lente.
  drawRings(w, h) {
    const g = this.g, t = this.songT;
    const { x: cx, y: cy, r: rr } = this.reacAt(w, h);
    const col = this.lv?.neon?.def ?? PALETTE.violet;
    const step = RINGS_STEP * (1 + 0.55 * this.hype);   // la creciente los ABRE, no los acelera
    const off = (((t * this.speed * RINGS_K) % step) + step) % step;
    for (let i = 0; i < RINGS_N; i++) {
      const r = off + i * step;
      // se apaga DENTRO del reactor (ahi el anillo seria un aro pegado al chasis) y en el
      // borde de la pantalla (si no, el ultimo aparece de golpe al cruzar el paso)
      const fin = Phaser.Math.Clamp((r - rr * 0.75) / (rr * 0.6), 0, 1);
      const fout = Phaser.Math.Clamp(1 - (r - w * 0.32) / (w * 0.5), 0, 1);
      // A LA MITAD de lo que estaban (0.10 + 0.26): se reporto que se ven de mas. Y ya no
      // aparecen en el buildup, porque cuelgan del reactor y el reactor no existe hasta el
      // drop (ver `this.reac`), que es lo otro que se pidio.
      const a = (0.05 + 0.13 * this.lat) * fin * fout;
      if (a < 0.02) continue;
      for (const [lw, al] of [[7, 0.35], [1.6, 1]]) {
        g.lineStyle(lw, col, a * al);
        g.strokeEllipse(cx, cy, r * 2, r * 2 * RINGS_SQ);
      }
    }
  }

  // EL BLANCO DEL CONTRATIEMPO (`hatAt`): la corchea de en medio, medida sobre el audio (fase
  // 0.505 del beat, en los cuatro tiempos por igual). Es el mismo golpe blanco a pantalla
  // completa que ya llevaba cada kick del drop, en la otra mitad del compas.
  //
  // Sale de la GRILLA y no de una cue, y eso no es comodidad: el hat no esta marcado en el
  // schema, y ademas medido no suena en todo el nivel (100% del buildup, 83% del break, 98.5%
  // del outro, pero solo el 50% del drop2: de la f68 a la f83 no hay ni uno, ahi el agudo
  // dominante cae en el 1 y es un crash). Siguiendo el audio, el destello se apagaria 16
  // filas justo dentro del drop; siguiendo la grilla, el compas se sigue leyendo entero.
  //
  // SE CORTA EN EL BREAK y vuelve para el drop, que es lo que hace el tema: ahi habla el
  // cantante y vuelan las letras, y un estrobo encima no deja leer ninguna de las dos cosas.
  drawHat(w, h, sec) {
    if (sec === "break") return;
    const a = HAT_A * this.hat * (0.55 + 0.45 * this.hype);
    if (a < 0.01) return;
    this.g.fillStyle(0xffffff, a);
    this.g.fillRect(0, 0, w, h);
  }

  // RAYOS ELECTRICOS (referencia 3): salen del REACTOR hacia el borde de la pantalla cuando
  // pega un acento de la linea (`mark`, o sea el acid). La geometria es de `fx.js`.
  //
  // Van con `mark` al cuadrado y no con `markWin`: la ventana del acid de este nivel esta
  // abierta el 40% del buildup y el 69% del drop2 (medido), o sea que de ventana los rayos
  // estarian puestos media cancion y dejarian de ser una descarga. Al cuadrado es el ATAQUE.
  //
  // Cuantos salen lo dice la CRECIENTE: 1 en el arranque del buildup y `1 + ARC_N` en el pico.
  // La semilla es el numero de BEAT, o sea que el rayo se redibuja una vez por beat y no cada
  // frame: a 60fps un rayo nuevo por frame es ruido blanco, no un relampago.
  // `nOver` fuerza cuantos salen y lo usa el fogonazo del snare: ahi `hype` ya viene cayendo
  // hacia el break (0.41 en la f66, o sea 2 rayos) y un fogonazo de dos rayos no es un fogonazo.
  // `big` (0/1) es el fogonazo del snare: rayos mas largos (x1.6) y mas gruesos (x1.8). Va
  // BINARIO y no `= this.snap`: con un valor continuo el grosor y el largo crecerian mientras
  // dura el flash y se leeria como que el rayo se estira, no como una descarga.
  drawArcs(w, h, mark, nOver, big = 0) {
    const e = mark ** 2;
    if (e < 0.05) return;
    const g = this.g, t = this.songT;
    const { x: cx, y: cy, r } = this.reacAt(w, h);
    const col = this.lv?.neon?.fam?.[0] ?? PALETTE.accentSoft;
    const nb = Math.floor((t - (this.lv?.off ?? 0)) / (this.lv?.beat ?? 0.4615));
    const n = nOver ?? 1 + Math.round(ARC_N * this.hype);
    // DE DONDE SALEN. Con el reactor en pantalla salen de EL, hacia arriba. Sin reactor no
    // pueden: se reporto que en el buildup los relampagos "muestran la posicion del reactor"
    // cuando el reactor todavia no existe (entra en el drop, f68), o sea que marcaban un sitio
    // vacio; ahi caen desde el canto de ARRIBA. Son las dos unicas puntas posibles, porque la
    // direccion ya no es libre (ver `arcDir`): los origenes horizontales que habia (de los
    // costados al centro, y del carril del jugador hacia los lados) daban rayos de mediana 10.1
    // y 17.2 grados sobre la horizontal, o sea justo lo que el reporte pide que no exista.
    const org = this.reac ? 0 : 1;
    for (let i = 0; i < n; i++) {
      const s = nb * 13 + i * 7 + 1;
      // sale del borde del reactor y llega al borde de la pantalla: el largo es lo que hace
      // que se lea como descarga y no como chispa.
      // y el FOGONAZO los tira hacia ABAJO aunque salgan del reactor: hacia arriba el reactor
      // esta a 130px del canto (de 508), o sea que los 8 rayos se iban de cuadro enseguida y el
      // fogonazo medido daba una caja de 247x88, mas chica que la del rayo suelto de antes.
      // Hacia abajo tienen la pantalla entera y siguen siendo una de las tres familias
      // permitidas (arriba-abajo y las dos diagonales); ademas caen SOBRE la pista, que es
      // justo lo que el fogonazo viene a mostrar.
      // Y desde el reactor salen en REDONDO (`all`): las tres familias de arriba mas las tres
      // espejadas hacia abajo. Se reporto que "solo van hacia arriba" y que tienen que salir
      // "desde todos los ejes desde el centro", que es lo que hace un nucleo de plasma. No
      // afloja la regla: el peor caso sigue a 50 grados de la horizontal, solo que ahora
      // tambien para el otro lado. El fogonazo NO (`big`): ahi los 8 van todos abajo a
      // proposito, y el origen de arriba tampoco, que ya nace en el canto de la pantalla.
      const ang = arcDir(s, org || big ? 1 : -1, org || big ? 0 : 1);
      const ux = Math.cos(ang), uy = Math.sin(ang);
      let len = w * (0.34 + 0.5 * hash(s + 0.5)) * (1 + 0.6 * big), x0, y0;
      if (org === 0) {
        // el origen si va aplastado (`0.7`), como los anillos: nace en el canto del reactor,
        // que en pantalla es una elipse. La DIRECCION no, o el aplastado tumbaria el rayo.
        x0 = cx + ux * r * 0.8; y0 = cy + uy * 0.7 * r * 0.8;
      } else {                         // de ARRIBA hacia abajo
        x0 = w * (0.12 + 0.76 * hash(s)); y0 = 0;
        len = h * (0.55 + 0.5 * hash(s + 0.5)) * (1 + 0.6 * big);
      }
      const x1 = x0 + ux * len, y1 = y0 + uy * len;
      const dx = x1 - x0, dy = y1 - y0;
      // el `y` del rayo es LATERAL a su recta, o sea perpendicular: por eso va con (-dy, dx)
      const P = (p, sc = 1) => ({ x: x0 + dx * p.x - dy * p.y * sc, y: y0 + dy * p.x + dx * p.y * sc });
      const main = bolt(s).map((p) => P(p));
      // SE VA AFINANDO Y APAGANDO HACIA LA PUNTA, o sea segmento a segmento y no una polilinea
      // de grosor constante. Una descarga es mas gruesa donde nace y se deshilacha al final;
      // con las tres pasadas de ancho fijo el rayo se leia como un cable doblado pegado al
      // reactor, que es lo que se reporto. El halo ancho si va de una pasada: es difuso.
      const gr = 1 + 0.8 * big;
      g.lineStyle(9 * gr, col, 0.14 * e);
      g.strokePoints(main, false);
      for (let k = 1; k < main.length; k++) {
        const u = k / (main.length - 1);
        const cae = (1 - u) ** 0.7;                       // 1 en el nucleo, 0 en la punta
        g.lineStyle((0.8 + 3.4 * cae) * gr, col, Math.min(1, 0.75 * e * (0.25 + cae)));
        g.lineBetween(main[k - 1].x, main[k - 1].y, main[k].x, main[k].y);
        g.lineStyle((0.5 + 1.3 * cae) * gr, 0xffffff, Math.min(1, e * (0.2 + 0.85 * cae)));
        g.lineBetween(main[k - 1].x, main[k - 1].y, main[k].x, main[k].y);
      }
      // las ramas son lo que separa una descarga de un cable doblado. Cada una lleva SU
      // geometria (`f.pts`): recalcular `bolt(s*5+1, ...)` para las tres dibujaba tres veces
      // la misma rama, o sea que el rayo tenia una sola bifurcacion repetida en tres sitios.
      for (const f of forks(s)) {
        const b = main[Math.round(f.at * (main.length - 1))];
        const ca = Math.cos(f.dir), sa = Math.sin(f.dir);
        const fx = (dx * ca - dy * sa) * f.len, fy = (dy * ca + dx * sa) * f.len;
        const pts = f.pts.map((p) => ({ x: b.x + fx * p.x - fy * p.y, y: b.y + fy * p.x + fx * p.y }));
        const fa = e * (1 - f.at) ** 0.7;   // las de la punta se apagan con el rayo
        g.lineStyle(2.6 * gr, col, 0.4 * fa);
        g.strokePoints(pts, false);
        g.lineStyle(1 * gr, 0xffffff, 0.7 * fa);
        g.strokePoints(pts, false);
      }
    }
  }

  // ESQUIRLAS METALICAS (referencia 7, con la forma de la 2): estallan en las cues de rol
  // `fx`, que en este nivel son exactamente las RAFAGAS que el schema tenia marcadas y que de
  // marca dejarian el nivel a oscuras compases enteros (`response1` 3 golpes en la f10 y 2 en
  // la f11 y despues 71 beats sin nada; `response2` 3 en la f19; el `snare` 5 entre la f32 y
  // la f34). O sea: la rafaga que no puede llevar la luz del nivel es justo la que revienta.
  //
  // Dura `BURST_T` desde la cue. El sitio sale de `hash(c.t)`, nunca de random: rebobinar
  // trae el mismo estallido en el mismo sitio.
  drawBurst(w, h, cues) {
    const g = this.g, t = this.songT;
    for (const c of cues) {
      if (c.role !== "fx" || c.fx) continue;   // las letras del acid tienen su propio dibujo
      const p = (t - c.t) / BURST_T;
      if (p < 0 || p >= 1) continue;
      const r0 = hash(c.t * 97), r1 = hash(c.t * 97 + 0.5);
      const cx = w * (0.18 + 0.64 * r0), cy = h * (0.22 + 0.42 * r1);
      const R = h * BURST_R * (0.7 + 0.6 * (c.v ?? 1));
      for (const s of pyras(c.t * 31 + 1, BURST_SH, p)) {
        const a = s.a * 0.9;
        if (a < 0.03) continue;
        // DOS CARAS Y DOS GRISES: eso es lo que la hace una piramide y no un poligono. El
        // contorno no alcanza (una silueta plana con borde sigue siendo plana) y el color no
        // sale de la paleta: son metal, o sea gris y negro, y por eso se leen igual cuando el
        // nivel se va a fantasma, que es donde estan pedidas.
        for (const f of pyraFaces(s)) {
          const pts = f.pts.map((q) => new Phaser.Geom.Point(cx + q.x * R, cy + q.y * R));
          // EL HALO ES LO QUE LAS ENFOCA. Se reporto que "a veces funcionan y a veces no": sin
          // el, una esquirla es un parche de gris de 20-30px (`r` 0.07-0.18 de `R`, y `R` =
          // h*0.17*(0.7+0.6v) = 129px a h=582) contra un fondo que tiene malla, rig y anillos,
          // y por eso parecia que unas veces salian y otras no. Dos pasadas anchas de blanco por
          // debajo del relleno (5.5 y 2.6 de grosor) la despegan de lo que tenga detras.
          // Medido en el estallido de t=14.25 (bbox 115x90px, 14 esquirlas): el halo toca
          // **5558px = 0.68% del cuadro** y dentro de esa caja la luma media pasa de **51.1 a
          // 64.1 (+25%)** y el p95 de **169 a 190**, o sea que enfoca sin repintar la pantalla.
          g.lineStyle(5.5, 0xffffff, a * 0.10);
          g.strokePoints(pts, true);
          g.lineStyle(2.6, 0xffffff, a * 0.18);
          g.strokePoints(pts, true);
          g.fillStyle(mix(BURST_LO, BURST_HI, f.shade), a * (0.55 + 0.35 * f.shade));
          g.fillPoints(pts, true);
          g.lineStyle(1.1, 0xffffff, a * (0.25 + 0.6 * f.shade));   // el filo la despega del fondo
          g.strokePoints(pts, true);
        }
      }
      // el fogonazo del arranque: sin el, las esquirlas salen de la nada
      const f = Math.max(0, 1 - p * 5);
      if (f > 0.02) {
        g.fillStyle(0xffffff, f * 0.5);
        g.fillCircle(cx, cy, R * 0.22 * (0.4 + f));
      }
    }
  }

  // EL GATE: la imagen se CORTA a tiempo, como un gate de audio. `gateAt` da 1 abierto y
  // `floor` cerrado, con la fase sacada de la grilla (o sea funcion pura de songT: rebobinar
  // lo rebobina y toda la pantalla va en la misma fase), y solo dentro de los tramos `fx` que
  // lo pidan. Fuera de ellos devuelve 1 y aca no se dibuja nada.
  //
  // Es un negro por encima de todo y no un `setVisible(false)`: apagar el Graphics apagaria
  // tambien el marco y el HUD, y lo que se quiere es que la IMAGEN parpadee, no el juego.
  drawGate(w, h) {
    if (this.gate >= 0.99) return;
    this.g.fillStyle(0x000000, 1 - this.gate);
    this.g.fillRect(0, 0, w, h);
  }

  // EL HAZ DEL REACTOR (`fx` de tipo `beam`). Sale del NUCLEO y baja hasta la pista, o sea que
  // es lo unico que conecta al jefe del fondo con el sitio donde estas.
  //
  // DISPARA y no esta puesto. La envolvente sigue siendo `(1-p)^2`, pero `p` pasa a ser
  // SEGUNDOS/`BEAM_T` y no la fraccion del hueco: normalizada al hueco, el corte `e < 0.03` se
  // cumple en `p <= 1 - sqrt(0.03)`, o sea el **82.7% de CUALQUIER division** por construccion,
  // y con eso el haz estaba en pantalla el **48.6% de la cancion** (medido muestreando los dos
  // tramos a 10ms, 7232 muestras). Ademas el periodo pasa de un beat / medio beat a un COMPAS /
  // dos beats, o sea la cuarta parte de disparos. Medido: **289ms = 0.66 beats** por disparo,
  // duty 16.5% del drop y 33.0% del outro, **17.6% de la cancion**, 42 disparos en vez de 172.
  // El modo 1 (el del final, con el nivel en fantasma) sigue yendo al doble de ritmo que el 0.
  //
  // APUNTA A UN CARRIL, no al centro. El objetivo va en el PLANO DEL SUELO
  // (`this.proj(x, 0, z)`, el mismo idiom que las bandas de la pista y que `drawLights`), asi
  // que el charco cae en perspectiva SOBRE la pista en vez de ser una elipse pegada a la lente.
  // Antes el 100% de los disparos era simetrico a `w/2` (el recto apuntaba a `w/2`, el anillo
  // era concentrico y el par estaba espejado), y con 4 carriles no hay ninguno en x=0: el recto
  // pegaba justo en el DIVISOR entre el carril 1 y el 2, y encima su objetivo `(w/2, h)` cae en
  // **z=558 del mundo, detras del jugador** (`PLAYER_Z` = 720).
  //
  // Y BARRE: sale del carril `a` alla lejos y llega al carril `b` encima tuyo. El parametro del
  // barrido es `q = 1 - e`, o sea el complemento EXACTO de la envolvente (sale de golpe y
  // frena: el mismo idiom que `pyras`, y el que ya usaba el anillo para abrirse mientras se
  // apagaba), asi que no hay una segunda cuenta que se pueda desincronizar. Medido a 1248x651:
  // el impacto recorre **332px (268 en x, 196 en y)** y el haz **gira de 16.5 a 63.0 grados**
  // segun el par de carriles (media 34.9); hasta la mitad del disparo, con `e` todavia en 0.36,
  // ya se movio 101px en x. El cono mide `BEAM_PW * s`, o sea exactamente lo que mide su propio
  // charco (16/45/103px a z=2600, 51/143/328 a z=815): antes eran 124.8px de semiancho fijo a
  // cualquier distancia, o sea un triangulo plano sin fuga pegado al reactor.
  //
  // El ANILLO que era una de las tres formas se fue: `drawRings` ya dibuja eso mismo (colgado
  // del mismo centro y con el mismo aplastado), o sea que era un duplicado, y ademas era la
  // unica que no tocaba la pista, que es lo unico que se le pide al haz. Queda uno o dos, y el
  // segundo barre AL REVES: se cruzan en la mitad del disparo en vez de ser un par espejado.
  drawBeam(w, h) {
    const g = this.g, t = this.songT, f = this.beam;
    const { x: cx, y: cy } = this.reacAt(w, h);
    const beat = this.lv?.beat ?? 0.4615, off = this.lv?.off ?? 0;
    const div = beat * (f.mode ? 2 : 4);          // un compas, o dos beats en el modo 1
    const u = (t - off) / div, i = Math.floor(u);
    const p = Math.min(1, ((((u % 1) + 1) % 1) * div) / BEAM_T);   // segundos desde el disparo
    const e = (1 - p) ** 2;
    if (e < 0.03) return;
    const q = 1 - e;                              // el barrido es el complemento del apagado
    const col = this.lv?.neon?.fam?.[2] ?? PALETTE.accentSoft;
    const z = Math.max(BEAM_Z0 + (BEAM_Z1 - BEAM_Z0) * q, this.zn + 4);
    const qx = this.qx ?? 0, qy = this.qy ?? 0;   // el suelo tiembla: el impacto tambien
    const N = this.laneX.length;
    const haz = (a, b) => {
      // de perfil la x del mundo no proyecta (los carriles se colapsan): ahi barre solo la z
      const lx = this.cam.flat ? 0 : this.laneX[a] + (this.laneX[b] - this.laneX[a]) * q;
      const im = this.proj(lx, 0, z);
      const tx = im.x + qx, ty = im.y + qy;
      const dx = tx - cx, dy = ty - cy, L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L, ny = dx / L;
      const wd = BEAM_PW * im.s;                  // el cono mide lo que su propio charco
      for (const [k, al] of [[2.3, 0.20], [1, 0.55], [0.36, 1]]) {
        g.fillStyle(col, BEAM_A * e * al);
        g.fillPoints([[cx - nx * wd * k * 0.08, cy - ny * wd * k * 0.08],
          [cx + nx * wd * k * 0.08, cy + ny * wd * k * 0.08],
          [tx + nx * wd * k, ty + ny * wd * k], [tx - nx * wd * k, ty - ny * wd * k]]
          .map(([x, y]) => new Phaser.Geom.Point(x, y)), true);
      }
      g.lineStyle(2 + 5 * e, 0xffffff, Math.min(1, 0.9 * e));
      g.lineBetween(cx, cy, tx, ty);
      g.fillStyle(0xffffff, Math.min(1, 0.5 * e));          // la boca, en el nucleo del reactor
      g.fillCircle(cx, cy, 3 + 12 * e);
      // EL CHARCO VA EN LA SUPERFICIE: un cuadro del plano del suelo alrededor del impacto,
      // proyectado por sus cuatro esquinas, o sea que sale en trapecio como las bandas de la
      // pista. De perfil seria una linea (la x no proyecta): ahi queda el haz solo.
      if (this.cam.flat) return;
      for (const [ex, al] of [[1.7, 0.10], [1, 0.26]]) {
        g.fillStyle(col, al * e);
        g.fillPoints([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => {
          const c = this.proj(lx + sx * BEAM_PW * ex, 0,
            Math.max(z + sz * BEAM_PD * ex, this.zn + 4));
          return new Phaser.Geom.Point(c.x + qx, c.y + qy);
        }), true);
      }
    };
    const a = Math.floor(hash(i * 1.9 + 7) * N);
    const b = (a + 1 + Math.floor(hash(i * 5.3) * (N - 1))) % N;   // nunca el mismo carril
    haz(a, b);
    if (hash(i * 3.7) < BEAM_PAIR) haz(b, a);     // el segundo cruza al primero
  }

  // LUCES DE PISTA DE ATERRIZAJE, a los dos costados de los carriles y en el PLANO DEL SUELO.
  // Es la misma idea que la X de los huecos del nivel 1: una luz cada medio beat y el chase de
  // `CHASE` corriendo por encima, o sea que se lee como una ola de luz que se va y no como
  // cuatro lamparas parpadeando por su cuenta.
  //
  // CORRE HACIA ADELANTE, o sea desde el jugador hacia el fondo: la fase va `hb - idx` y no
  // `idx + hb` como en los huecos (ahi la zanja viene hacia vos porque es lo que te va a
  // pegar; aca es la pista que se aleja, que es como se ve una aproximacion desde la cabina).
  // Todo funcion pura de songT: la z sale de `songT * speed` como las bandas del suelo.
  drawLights() {
    if (this.cam.flat) return;   // de perfil la x del mundo no proyecta: las dos filas se pisan
    const g = this.g, t = this.songT;
    const beat = this.lv?.beat ?? 0.4615;
    const col = this.lv?.neon?.fam?.[2] ?? PALETTE.accentSoft;
    const paso = (beat / 2) * this.speed;
    const off = (((t * this.speed) % paso) + paso) % paso;
    const hb = Math.floor(t / (beat / 2));
    // van por FUERA del carril de afuera y por DENTRO de la malla (`MESH_GAP` son 90px de
    // pantalla): la pista es lo que se juega y esto la enmarca, no la cruza.
    const x0 = this.edge + LIGHT_OUT;
    // LA FILA DIBUJA UNA FIGURA Y NO UNA RECTA (`LIGHT_SHP`, una por compas via hash, nunca
    // random). La primera es la recta de siempre, o sea que una de cada cuatro se ve como
    // estaba. `mv(idx)` es funcion pura de (indice de luz, songT): la figura entera se mueve
    // sola y rebobinar la rebobina.
    const sh = LIGHT_SHP[Math.floor(hash(Math.floor(t / (beat * 4)) * 3 + 1) * LIGHT_SHP.length)];
    // EL DESPLAZAMIENTO EN X ES SOLO HACIA AFUERA (`0.5 + 0.5*sin`, o sea 0..ax y no -ax..+ax).
    // Se reporto que la figura que entra "dentro de los carriles" no sirve, y medido entraba: la
    // serpentina llegaba a x=270 del mundo con el borde de la pista en 340, o sea **70 adentro**
    // (101 contando el halo) y pasada del centro del carril de afuera (255); la helice llegaba a
    // 330, o sea 10 adentro. Con la ola de un solo lado el minimo de las cuatro figuras es el
    // borde de afuera (`x0`) y ninguna cruza. Y no es la misma figura recortada: la fila abre y
    // cierra hacia el descampado, que es lo que hace de verdad una pista de aterrizaje.
    const mv = (idx) => {
      if (!sh.k) return [0, 0];
      const q = (idx * sh.k * 0.5 + t / (beat * 2)) * Math.PI * 2;
      return [(0.5 + 0.5 * Math.sin(q)) * sh.ax, (0.5 - 0.5 * Math.cos(q)) * sh.ay];
    };
    for (let z = SPAWN_Z; z > this.zn; z -= paso) {
      const zz = Math.max(z - off, this.zn + 4);
      if (zz <= this.zn + 4) continue;
      const idx = Math.round((t * this.speed + zz) / paso);   // indice estable de la luz
      const on = CHASE[(((hb - idx) % CHASE.length) + CHASE.length) % CHASE.length];
      // se apaga de lejos: la niebla se las come igual que a las cajas
      const a = on ** 1.6 * Phaser.Math.Clamp(1 - (zz - PLAYER_Z) / 3600, 0.1, 1);
      if (a < 0.03) continue;
      const [mx, my] = mv(idx);
      for (const sg of [-1, 1]) {
        // el desplazamiento va ESPEJADO en x (`sg * mx`): las dos filas son la misma figura,
        // como un rig de verdad, y no dos luces sueltas moviendose cada una por su lado.
        const p = this.proj(sg * (x0 + mx), my * this.grav, zz);
        const rad = LIGHT_R * p.s * (0.7 + 0.5 * this.lat);
        if (rad < 0.6) continue;
        // tres pasadas: halo ancho de color, cuerpo, y nucleo BLANCO. Una luz de pista es
        // blanca con el color derramado alrededor, igual que las formas y los rayos.
        g.fillStyle(col, a * 0.22);
        g.fillCircle(p.x, p.y, rad * 2.0);
        g.fillStyle(col, a * 0.55);
        g.fillCircle(p.x, p.y, rad);
        g.fillStyle(0xffffff, a);
        g.fillCircle(p.x, p.y, rad * 0.45);
      }
    }
  }

  // Formas flotando a los costados: triangulos, cuadrados y hexagonos que giran, laten con
  // la musica y cambian de color por compas. Una por compas y por lado; la z sale de songT
  // como todo lo demas, y la silueta de hash(i), nunca de Math.random().
  // Van fuera de la pista (|x| >= 620) a proposito: adentro taparian obstaculos.
  drawShapes() {
    if (this.cam.flat || this.rave <= 0.02) return;
    const g = this.g, t = this.songT;
    // Se encienden EN una marca (la linea amarilla) y se apagan en la siguiente: un destello
    // de un beat por compas, no un adorno que esta siempre. Ver `markWin` en music.js.
    const win = this.lv ? markWin(t, this.lv.cues, this.lv.beat) : 1;
    if (win <= 0.02) return;
    const bar = (this.lv?.beat ?? 0.4615) * 4;
    const paso = bar * this.speed;
    const off = (((t * this.speed) % paso) + paso) % paso;
    for (let z = SPAWN_Z; z > this.zn; z -= paso) {
      const zz = z - off;
      if (zz < PLAYER_Z + 200) continue;   // pegadas a la camara son manchas
      const i = Math.round((t * this.speed + zz) / paso);   // indice estable de la forma
      // el piso de 0.6 (antes 0.45 y multiplicado por rave) es lo que las hace visibles entre
      // beat y beat: latiendo desde 0 se veian solo en el golpe y el resto del compas no estaban.
      // EL ACENTO LAS EMPUJA, y cuanto lo dice la CRECIENTE: se reporto que flotan sin seguir
      // nada. El termino extra va multiplicado por `this.hype`, o sea que en el nivel 1 (que no
      // la declara) vale 0 y no se mueve un pixel, y en el drop del 2, donde `hype` = 1, la
      // forma pega el doble con cada marca en vez de respirar un 40%.
      const pop = this.hype * this.beat;
      const a = win * this.rave * Phaser.Math.Clamp(1 - (zz - PLAYER_Z) / 3200, 0.15, 1)
        * Math.min(1, 0.6 + 0.4 * this.beat + 0.5 * pop);
      if (a < 0.03) continue;
      for (const s of [-1, 1]) {
        const r = hash(i * 2 + (s > 0 ? 1 : 0));
        const n = [3, 4, 6][Math.floor(hash(i + s) * 3)];
        const x = s * (620 + r * 420);
        const y = (140 + hash(i + 0.3) * 420 + Math.sin(t * 0.8 + i) * 40) * this.grav;
        const p = this.proj(x, y, zz);
        const rad = (85 + r * 70) * p.s * (1 + 0.3 * this.beat + 0.45 * pop);
        if (rad < 3) continue;
        const rot = t * (0.3 + r * 0.5) + i + pop * 0.9;   // y ademas se sacuden en el golpe
        const pts = [];
        for (let k = 0; k < n; k++) {
          const ang = rot + (k / n) * Math.PI * 2;
          pts.push(new Phaser.Geom.Point(p.x + Math.cos(ang) * rad, p.y + Math.sin(ang) * rad));
        }
        const col = this.neon[Math.floor(hash(i + 0.7) * this.neon.length)];
        g.fillStyle(mix(col, 0xffffff, 0.3), 0.22 * a);
        g.fillPoints(pts, true);
        // GLOW RETRO: cuatro pasadas, de muy ancha y tenue a fina y BLANCA. El neon de verdad
        // es un tubo blanco con el color derramado alrededor, no un contorno de color: por eso
        // el nucleo va en 0xffffff y el color solo en las capas anchas. Con una sola pasada del
        // color se hundian contra el skyline.
        for (const [wd, cc, al] of [
          [26 + 34 * this.beat, col, 0.14],
          [12 + 16 * this.beat, col, 0.34],
          [5 + 6 * this.beat, mix(col, 0xffffff, 0.55), 0.9],
          [2.5, 0xffffff, 1],
        ]) {
          g.lineStyle(wd, cc, al * a);
          g.strokePoints(pts, true);
        }
      }
    }
  }

  // recorrida (songT * speed), asi que el fondo sigue siendo funcion del tiempo.
  // Las formas salen de hash(i), no de random: la misma i da siempre la misma silueta.
  drawLayers(w, pulse) {
    const g = this.g, y = this.bgY;   // de perfil el fondo no se apoya en el horizonte
    // de cabeza el suelo ocupa la mitad de arriba: se espeja el fondo en vez de taparlo
    const upside = this.camY < 0;
    if (upside) { g.save(); g.translateCanvas(0, y); g.scaleCanvas(1, -1); g.translateCanvas(0, -y); }
    for (const L of this.lv?.layers ?? []) {
      const st = layerAt(this.songT, this.lv.cues, L);
      if (!st.vis) continue;
      if (L.kind === "bars") { if (this.dec("bars")) this.drawBars(L, st, w, y, pulse); continue; }
      const d = this.songT * this.speed * L.k;
      const i0 = Math.floor(d / L.step);
      g.fillStyle(st.color, 1);
      for (let j = 0, n = Math.ceil(w / L.step) + 2; j < n; j++) {
        const i = i0 + j, x = i * L.step - d, r = hash(i);
        if (L.kind === "stars") { const s = 1 + 2 * r; g.fillRect(x, hash(i + 0.5) * y * L.h, s, s); continue; }
        const bh = y * L.h * (0.3 + 0.7 * r);   // el skyline no se mueve
        g.fillRect(x, y - bh, L.step * 0.74, bh);
      }
    }
    if (upside) g.restore();
  }

  // El `eq` del fondo tiene VARIANTES y cual va lo decide el SECTOR (`modes` en la capa, un
  // nombre por sector): asi una corrida entera las muestra todas y se elige mirandolas, no
  // describiendolas. Ninguna toca la jugabilidad: es la capa mas de atras del fondo.
  //   analyzer = cada barra resuena en su subdivision del beat (1, 1/2, 1/3, 1/4) + peak hold
  //   sweep    = el golpe CRUZA de izquierda a derecha, una pasada por compas, con estela
  //   center   = el golpe sale del CENTRO a los dos lados, uno por beat
  //   spectro  = FFT REAL del audio que esta sonando
  //   color    = el mismo FFT, cada banda con su color de NEON, rotando con el compas
  //   constelacion = no es analizador: rombos que flotan y laten. Va sola en el sector del
  //                  break, o sea que solo se la ve en el beat del fantasma (`GHOST_ROW`)
  // Solo `analyzer` lleva PARALLAX (su identidad viaja con la pista). Las demas van pegadas
  // a la PANTALLA: un analizador que se desplaza lateralmente no se lee como analizador.
  drawBars(L, st, w, y, pulse) {
    const g = this.g;
    const beat = this.lv?.beat ?? 0.4615, bar = this.lv?.bar ?? 1.846;
    const secs = this.lv?.sectors ?? [];
    const si = secs.indexOf(sectorOfRow(this.lv ? rowAt(this.songT, this.lv) : 0, secs));
    // el fantasma TRAE la constelacion: son un solo efecto, no dos que hay que sincronizar
    const mode = this.ghost ? "constelacion" : L.modes?.[si] ?? L.modes?.[0] ?? "analyzer";
    const n = Math.ceil(w / L.step) + 2, hMax = y * L.h, bw = L.step * 0.62;
    // FFT real: en pausa da todo ceros (no es funcion de songT), asi que sin el la barra
    // queda en su piso y el fondo no desaparece.
    const fft = mode === "spectro" || mode === "color" ? this.tp?.spectrum() : null;
    // cometa: 1 en la cabeza (u = p) y la cola queda DETRAS, o sea del lado por el que ya
    // paso. Es lo que le da DIRECCION al barrido; con un on/off las barras parpadean por su
    // cuenta y no se ve para donde va.
    const cola = (u, p) => Math.exp(-((p - u + 1) % 1) * 3.5);

    if (mode === "constelacion") {
      // La figura CAMBIA con cada destello (`this.fig`, ver `draw()`): el primero (la f63) es
      // el rombo de siempre y de ahi en mas van saliendo las otras. El tamano es el beat.
      const fig = FIGS[this.fig % FIGS.length];
      for (let j = 0; j < n; j++) {
        const x = j * L.step + L.step / 2, r = hash(j);
        const ph = this.songT / bar * Math.PI * 2 + r * 6.283;
        const cy = y - hMax * (0.25 + 0.55 * r) + Math.sin(ph) * hMax * 0.16;
        // 0.4 de radio base y no 0.22: con el rombo chico esto se leia como confeti, no como
        // una capa de fondo. El contorno claro es lo que lo despega del skyline.
        const rad = L.step * (0.4 + 0.45 * r) * (0.8 + 0.45 * this.beat);
        // el vaiven horizontal va a media vuelta del vertical: asi la figura describe un 8 y
        // no una diagonal, que es lo que hace que se lea como que FLOTA y no que se desliza.
        const cx = x + Math.sin(ph * 0.5) * L.step * fig.sway;
        const ang = fig.rot + (this.songT / bar) * fig.spin * Math.PI * 2 + r * 6.283 * fig.spin;
        const pts = Array.from({ length: fig.n }, (_, k) => {
          const a = ang - Math.PI / 2 + (k / fig.n) * Math.PI * 2;
          return new Phaser.Geom.Point(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
        });
        // GLOW RETRO, el mismo que las formas de los costados: cuatro pasadas de muy ancha y
        // tenue a fina y BLANCA. Es el fondo, asi que va a la mitad de alpha que las formas
        // (si pega igual, la constelacion compite con los obstaculos y no es lo que se juega).
        // En FANTASMA el relleno va BLANCO ENTERO: el resto de la pantalla es gris al 28% y
        // linea blanca, asi que un rombo relleno de blanco es lo unico macizo que queda.
        g.fillStyle(this.ghost ? 0xffffff : mix(st.color, 0xffffff, 0.15 + 0.35 * pulse), 0.45 + 0.3 * r);
        g.fillPoints(pts, true);
        for (const [wd, cc, al] of [
          [10 + 14 * this.beat, st.color, 0.1],
          [5 + 6 * this.beat, mix(st.color, 0xffffff, 0.4), 0.22],
          [2.5, mix(st.color, 0xffffff, 0.75), 0.5 + 0.4 * this.beat],
          [1, 0xffffff, 0.5 + 0.5 * this.beat],
        ]) {
          g.lineStyle(wd, cc, al);
          g.strokePoints(pts, true);
        }
      }
      return;
    }

    const d = this.songT * this.speed * L.k, i0 = Math.floor(d / L.step);
    g.fillStyle(st.color, 1);
    for (let j = 0; j < n; j++) {
      const i = i0 + j, r = hash(i);
      const x = mode === "analyzer" ? i * L.step - d : j * L.step;
      const u = (j + 0.5) / n;   // 0 en el borde izquierdo, 1 en el derecho
      let e, col = st.color;
      switch (mode) {
        // el piso es 0.18 y no 0.1: con 0.1 lo que no esta barriendo se lee como apagado y
        // medida pantalla queda en negro. El kick levanta el resto, o sea que igual late.
        case "sweep":
          e = Math.min(1, 0.18 + 0.8 * cola(u, (this.songT % bar) / bar) + 0.34 * pulse);
          break;
        // desde el centro: `u` pasa a ser la distancia al centro, o sea que el mismo cometa
        // sale hacia los dos lados a la vez sin duplicar nada.
        case "center":
          e = Math.min(1, 0.18 + 0.8 * cola(Math.abs(2 * u - 1), (this.songT % beat) / beat)
            + 0.34 * pulse);
          break;
        case "spectro":
        case "color": {
          // el bin sale de u^1.7: lineal deja todo el grave apilado en el borde izquierdo y
          // las tres cuartas partes de la pantalla planas.
          const b = Math.min(fft.length - 1, Math.floor(u ** 1.7 * fft.length * 0.8));
          e = Math.max(0.06, (fft[b] / 255) ** 1.3);
          if (mode === "color") {
            col = this.neon[(j + Math.floor(this.songT / bar)) % this.neon.length];
            col = mix(col, 0xffffff, 0.45 * e);
          }
          break;
        }
        default: {   // analyzer, el de siempre
          const sub = 1 + Math.floor(hash(i + 3) * 4);
          const osc = Math.abs(Math.sin(Math.PI * (this.songT / beat) * sub + r * 6.283));
          e = Math.min(1, 0.14 + 0.55 * osc * (0.4 + 0.6 * r) + 0.36 * pulse * osc);
        }
      }
      g.fillStyle(col, 1);
      g.fillRect(x, y - hMax * e, bw, hMax * e);
      // el pico: se despega y baja mas lento que la barra, como el peak hold de un
      // analizador de verdad. Es lo unico brillante del fondo, o sea que marca el borde.
      const pk = hMax * Math.min(1, e + 0.18 * (1 - pulse));
      g.fillStyle(mix(col, 0xffffff, 0.45 + 0.4 * pulse), 0.9);
      g.fillRect(x, y - pk - 3, bw, 3);
    }
  }

  // "THIS IS ACID" en el break: cada letra viene de lejos y frena en su sitio, escalonadas
  // sobre la duracion de la voz. Todo sale de p (0..1 dentro de la cue), o sea de songT.
  drawAcid(p) {
    const txt = (this.lv?.acid ?? ACID).slice(0, MAX_ACID);
    const n = txt.length;
    // ESTILO Y GESTO POR NIVEL (`acidFx` en LEVELS). Respaldo `null` = el nivel 1: ni se toca
    // el estilo del pool ni se sale de este gesto, o sea 0 px de diferencia.
    const fx = this.lv?.acidFx;
    // el estilo se aplica UNA vez por nivel y no por frame: `setStyle` re-renderiza la textura
    // de cada letra, o sea 24 texturas nuevas 60 veces por segundo. El padding es obligatorio
    // con stroke y glow: la textura se recorta en la caja del glifo y el resplandor sale
    // cortado en cuadrado.
    if (fx?.style && this.acidSty !== fx.style) {
      this.acidSty = fx.style;
      for (const l of this.acid) l.setStyle(fx.style).setPadding(20);
    }
    if (fx?.move === "stamp") return this.acidStamp(p, txt, n, fx);
    const out = p == null ? 0 : Math.max(0, (p - 0.85) / 0.15);   // al final revienta hacia la camara
    for (let i = 0; i < this.acid.length; i++) {
      const l = this.acid[i];
      const q = p == null || i >= n ? -1 : p * 3.6 - (i / n) * 1.9;
      if (q <= 0 || txt[i] === " ") { l.setVisible(false); continue; }
      if (l.text !== txt[i]) l.setText(txt[i]);
      const z = (3200 - 2500 * Math.min(1, q)) * (1 - out * 0.72);
      const pr = this.proj((i - (n - 1) / 2) * 36, 250, z);
      const sh = Math.sin(this.songT * 60 + i * 2) * 5 * Math.min(1, q);   // tiembla
      l.setVisible(true).setPosition(pr.x + sh, pr.y)
        .setScale(pr.s * 1.1).setAlpha(Math.min(1, q * 2) * (1 - out));
    }
  }

  // EL GESTO DEL NIVEL 2 (`acidFx.move` = "stamp"). Su break es NEGRO ENTERO (`fx` de tipo
  // `dark`, f63-f67) y las letras son objetos de texto, o sea LO UNICO que se ve en 2.47s: no
  // tienen de que despegarse, asi que no vienen de lejos como en el nivel 1. Se ESTAMPAN
  // palabra por palabra (medido: una cada 219.5ms = 0.501 beats, o sea medio beat a 137bpm),
  // llegando ENCIMA de la camara y clavandose en su sitio, y al final se las traga el punto de
  // fuga, que es exactamente donde 26.8ms despues aparece el reactor con el fogonazo del snare
  // (`snap`, la f66). O sea la salida al REVES que la del nivel 1, que revienta hacia la camara.
  // Funcion pura de p y de songT igual que el otro: rebobinar al break lo repite identico.
  acidStamp(p, txt, n, fx) {
    const gap = fx.gap ?? 36;
    // WORD = medio beat con `dur` 1.65 (medido: 219.5ms contra 219.0). SET = lo que tarda una
    // palabra en clavarse (99ms). OUT = de aca al final se van: 330ms = 0.75 beats, y terminan
    // en p=1, o sea 285.8ms antes del drop2. El gesto no alarga la cue ni un frame.
    const WORD = 0.133, SET = 0.06, OUT = 0.80;
    const out = p == null ? 0 : Math.max(0, (p - OUT) / (1 - OUT));
    let w = 0;
    for (let i = 0; i < this.acid.length; i++) {
      const l = this.acid[i];
      if (i > 0 && txt[i - 1] === " ") w++;   // el escalonado es por PALABRA, no por letra
      const q = p == null || i >= n ? -1 : (p - w * WORD) / SET;
      if (q <= 0 || txt[i] === " ") { l.setVisible(false); continue; }
      if (l.text !== txt[i]) l.setText(txt[i]);
      // la palabra entra encima de la camara y se clava: z de 406 a 700, o sea escala x1.72 a
      // x1. Y la salida es z creciendo, con lo que las letras convergen SOLAS al punto de fuga
      // (lo hace `proj`, no hace falta una segunda cuenta de escala ni de posicion).
      const e = Math.min(1, q), k = (1 - e) * (1 - e);
      const z = 700 * (1 - k * 0.42) + out * out * 5200;
      // el zigzag late con el METRONOMO de la grilla (`this.lat`) y no con las cues: en el
      // break no hay de que colgarse (1 bass y 2 acid), y `lat` esta vivo el 100% del nivel.
      const sh = this.lat * 10 * Math.sin(i * 1.7);
      const pr = this.proj((i - (n - 1) / 2) * gap, 250 + sh, z);
      l.setVisible(true).setPosition(pr.x, pr.y)
        .setScale(pr.s * 1.1).setAlpha(Math.min(1, e * 3) * (1 - out));
    }
  }

  // Las senales de la cancion, dibujadas sobre la pista y numeradas.
  // Esto es lo que se referencia al dictar: "la #34 que cambie el fondo".
  // Laseres de los bordes: las senales de audio que NO son el kick (`accent` y `voice`) se
  // dibujan en el plano del suelo pero FUERA de la pista, mas una viga que sube desde el
  // borde de afuera. Van afuera a proposito: adentro taparian obstaculos, que es justo la
  // queja que arreglamos con los huecos. Alto y grosor salen de `v` (la intensidad de la
  // senal) y el brillo de la distancia al jugador, o sea que revienta cuando la senal pasa.
  // La z sale de songT como todo: rebobinar los rebobina.
  drawRave(cues) {
    if (this.cam.flat) return;   // de perfil los bordes de la pista quedan fuera de cuadro
    const g = this.g;
    const P = (x, y, z) => { const p = this.proj(x, y, z); return new Phaser.Geom.Point(p.x, p.y); };
    for (const c of cues) {
      // por ROL y no por nombre de canal: la segunda tanda trae otros tags (acidbass,
      // response, snare) y el rol es justo lo que dice "esto no es el kick"
      if (c.role !== "mark" && c.role !== "fx") continue;
      // una cue con EFECTO PROPIO (`fx: "acid"`) la dibuja ese efecto y no el suelo: su `dur`
      // esta puesto para que las letras tengan de donde sacar progreso (2.2s), y a v=1400 eso
      // son 3080z de barrido, o sea una losa que tapa la malla entera en vez de un barrido.
      if (c.fx) continue;
      const z = PLAYER_Z + (c.t - this.songT) * this.speed;
      if (z > SPAWN_Z || z + 40 < this.zn) continue;
      // en el mundo van en la familia del nivel; el amarillo/verde de TAG_COLORS se queda
      // para las lineas numeradas del modo diseno, que son otra cosa
      // ...y la familia es la del NIVEL (`neon.fam`), no el violeta del renderer: el nivel 1
      // declara fam[0]=violet y fam[1]=accentSoft, o sea exactamente lo que estaba escrito a
      // mano aca, y el 2 barre en su cyan en vez de tirar dos bandas violetas sobre la malla.
      const col = (c.tag === "voice" || c.tag === "acidbass")
        ? (this.lv?.neon?.fam?.[1] ?? PALETTE.accentSoft)
        : (this.lv?.neon?.fam?.[0] ?? PALETTE.violet);
      const v = c.v ?? 1;
      const a = v * Phaser.Math.Clamp(1 - (z - PLAYER_Z) / 2600, 0, 1);
      const zf = Math.max(z, this.zn);
      const zb = Math.max(z + (c.dur ? c.dur * this.speed : 30 + 90 * v), this.zn + 6);
      if (zb <= zf) continue;
      for (const s of [-1, 1]) {
        // solo el lavado de suelo: la viga vertical que habia aca se leia como un andamio
        // amarillo cruzando el cielo, y el cielo ya es del rig (`drawRig`).
        g.fillStyle(col, 0.34 * a);
        // arranca 45 por FUERA del borde de la pista (300 con 3 carriles, 385 con 4): adentro
        // taparia obstaculos. El 1400 de afuera es el ancho de pantalla proyectado, no la
        // pista, asi que no depende de N.
        const xi = this.edge + 45;
        g.fillPoints([P(s * xi, 0, zf), P(s * 1400, 0, zf), P(s * 1400, 0, zb), P(s * xi, 0, zb)], true);
        g.lineStyle(Math.max(1, 4 * a), col, 0.8 * a);   // el filo de afuera, que marca el pulso
        const p0 = P(s * 1400, 0, zf), p1 = P(s * 1400, 0, zb);
        g.lineBetween(p0.x, p0.y, p1.x, p1.y);
      }
    }
  }

  drawCueLines(cues) {
    const g = this.g;
    let li = 0;
    // las lineas numeradas cruzan la pista entera y sobran 45 de cada lado (300 con 3
    // carriles, 385 con 4): mas cortas que la pista, el carril de afuera se quedaria sin
    // marca y es justo lo que se referencia al dictar.
    const lw = this.edge + 45;
    // linea de impacto: donde el centro del obstaculo pisa al jugador (en 1a persona
    // esta a los pies de la camara, o sea detras del plano cercano: no se dibuja)
    if (PLAYER_Z >= this.zn) {
      const a0 = this.proj(-lw, 1, PLAYER_Z), b0 = this.proj(lw, 1, PLAYER_Z);
      g.lineStyle(2, PALETTE.text, 0.45);
      g.lineBetween(a0.x, a0.y, b0.x, b0.y);
    }

    for (const c of cues) {
      const z = PLAYER_Z + (c.t - this.songT) * this.speed;
      if (z < this.zn) continue;
      const col = TAG_COLORS[c.tag] || PALETTE.text;
      const alpha = Phaser.Math.Clamp(1 - z / SPAWN_Z, 0.15, 0.9);
      const a = this.proj(-lw, 1, z), b = this.proj(lw, 1, z);
      if (c.dur) {  // marca con rango (la voz): banda hasta t+dur
        const z2 = Math.max(z - c.dur * this.speed, this.zn);
        const a2 = this.proj(-lw, 1, z2), b2 = this.proj(lw, 1, z2);
        g.fillStyle(col, alpha * 0.18);
        g.fillPoints([a, b, b2, a2].map((p) => new Phaser.Geom.Point(p.x, p.y)), true);
      }
      g.lineStyle(c.role === "obstacle" ? 3 : 2, col, alpha);
      g.lineBetween(a.x, a.y, b.x, b.y);
      // los obstaculos dictados por tile solo se etiquetan con T: en un nivel denso
      // son una fila por beat y los #tNNN se comen la pantalla. La grilla ya los numera.
      if (li < MAX_LABELS && z < 2600 && (typeof c.n === "number" || this.nums)) {
        this.labels[li++].setVisible(true).setPosition(b.x + 6, a.y + 4)
          .setText(`#${c.n}`).setColor(`#${col.toString(16).padStart(6, "0")}`)
          .setAlpha(Math.min(1, alpha + 0.2));
      }
    }
  }

  // Barra de la cancion: secciones, playhead y loop. Para saber donde estoy al rebobinar.
  drawStrip(w, h) {
    if (!this.lv) return;
    const g = this.g, x0 = 20, y = h - 22, ww = w - 40, len = this.lv.length;
    const t0 = this.lv.doc.track.trim.start;
    g.fillStyle(PALETTE.surface, 0.9);
    g.fillRect(x0, y, ww, 8);
    this.lv.doc.sections.forEach((s, i) => {
      const a = ((s.start - t0) / len) * ww, b = ((s.end - t0) / len) * ww;
      g.fillStyle([PALETTE.violet, PALETTE.cyan, PALETTE.orange, PALETTE.green][i % 4], 0.7);
      g.fillRect(x0 + a, y, Math.max(1, b - a), 8);
    });
    if (this.tp?.loop) {
      const [a, b] = this.tp.loop;
      g.fillStyle(PALETTE.yellow, 0.35);
      g.fillRect(x0 + (a / len) * ww, y - 3, ((b - a) / len) * ww, 14);
    }
    // marcas de SECTOR: son a donde salta el clic, asi que se tienen que ver para poder apuntar
    for (const s of this.lv.sectors ?? []) {
      const t = timeOfRow(s.from, this.lv);
      if (t < 0 || t > len) continue;
      g.fillStyle(PALETTE.text, 0.55);
      g.fillRect(x0 + (t / len) * ww, y - 5, 1, 18);
    }
    g.fillStyle(PALETTE.pink, 1);
    g.fillRect(x0 + (this.songT / len) * ww - 1, y - 4, 3, 16);
    this.strip = { x0, y, ww, len };   // lo usa `stripSeek` (clic para saltar)
  }

  // CLIC EN LA TIRA = ir a ese sector. Es la unica forma de empezar a grabar en el medio del
  // nivel sin pasar por `G` y acordarse del numero de fila. Cae en el ARRANQUE del sector que
  // pisaste (no en el punto exacto): un sector es un tramo de 14-20 filas del suelo, o sea la
  // unidad con la que se mira el nivel. Con shift va al compas mas cercano, para afinar.
  stripSeek(p) {
    const s = this.strip;
    if (!this.marks || !s || !this.lv) return false;
    if (p.x < s.x0 || p.x > s.x0 + s.ww || p.y < s.y - 8 || p.y > s.y + 20) return false;
    const t = ((p.x - s.x0) / s.ww) * s.len;
    if (p.event?.shiftKey) {
      this.seek(Math.max(0, Math.round((t - this.lv.off) / this.lv.bar) * this.lv.bar + this.lv.off));
      return true;
    }
    const row = rowAt(t, this.lv);
    const sec = (this.lv.sectors ?? []).find((q) => row >= q.from && row <= q.to);
    this.seek(Math.max(0, timeOfRow(sec ? sec.from : row, this.lv)));
    return true;
  }

  // Los orbs: anillo flotante, se agarran manteniendo ↑/W y no chocan nunca.
  // Amarillo (kind "orb") = dash sostenido. Rosa con flecha (kind "orbj") = salto en el aire,
  // el de geometry dash: va donde encadenaste dos saltos con menos de 1.5 beats de hueco.
  drawOrb(o, z) {
    const g = this.g, k = KINDS[o.kind] ?? KINDS.orb;
    if (z + k.d < this.zn) return;
    const col = COLORS[o.kind] ?? COLORS.orb;
    const p = this.proj(this.laneX[o.lane], ((k.y0 + k.y1) / 2) * this.grav, Math.max(z + k.d / 2, this.zn));
    const r = (k.w + 14 + 5 * Math.sin(this.songT * 9)) * p.s;   // late a ~1.4Hz
    const a = this.hit.has(o.n) ? 0.2 : 1;
    // Mantener ↑/W es la condicion, asi que se ve: manteniendo el orb se llena, suelto queda
    // hueco. Mas el cartel del que viene entrando (drawOrbHint), que lo dice con letras.
    if (a === 1 && this.held()) {
      g.fillStyle(col, 0.85);
      g.fillCircle(p.x, p.y, r * 0.55);
    }
    g.fillStyle(col, 0.22 * a);
    g.fillCircle(p.x, p.y, r);
    g.lineStyle(Math.max(2, 5 * p.s), col, a);
    g.strokeCircle(p.x, p.y, r);
    if (o.kind !== "orbj") return;
    // flecha hacia donde te va a mandar (con la gravedad invertida, hacia abajo)
    const d = r * 0.5 * this.grav;
    g.lineBetween(p.x, p.y + d, p.x, p.y - d);
    g.lineBetween(p.x - d * 0.6, p.y - d * 0.4, p.x, p.y - d);
    g.lineBetween(p.x + d * 0.6, p.y - d * 0.4, p.x, p.y - d);
  }

  // Hueco en el suelo: NO es una caja, es un agujero. Se dibuja en el plano del suelo, asi
  // que no tapa nada de lo que viene detras (esa es la gracia: guiar sin pared roja).
  // Se salta, o se pasa por otro carril. Fisicamente es una caja bajo el piso: ver KINDS.gap.
  // En 1a PERSONA la camara esta DENTRO de la pista: lo que ya te paso (o el carril de al lado
  // a tu misma altura) proyecta contra el plano cercano y se come media pantalla. Es geometria
  // correcta y se lee como un bug. Los ultimos 500 (0.71s a v=700, o sea despues de la ventana
  // de reaccion: ya decidiste) se apagan. En 3a persona no cambia nada.
  pasa(zf) {
    return this.cam.body ? 1 : Phaser.Math.Clamp((zf - PLAYER_Z) / 500, 0, 1);
  }

  // FANTASMA (tecla `P`): todo en blanco y negro y solo las LINEAS. No es un shader: es un
  // filtro en la UNICA puerta por la que pasa el dibujo entero. `fillStyle`/`lineStyle` del
  // Graphics se envuelven UNA vez, asi que ninguna de las 20 funciones de dibujo se entera y
  // no hay un solo `if (ghost)` desperdigado. Un PostFXPipeline de WebGL daria lo mismo a
  // cambio de escribir un shader (y de perder el fallback a canvas).
  // El relleno se va a GRIS (la luma del color, al 28%): sigue tapando lo que hay detras, o
  // sea que las siluetas y el orden de profundidad se leen, pero deja de competir con las
  // lineas. A negro seco el jugador desaparecia: es todo relleno (torso, cabeza).
  // El trazo se va a blanco puro conservando grosor y alpha, MENOS el negro, que se queda
  // negro: ese es el contorno que despega al muneco y a los miembros del fondo.
  fantasma(g) {
    const fill = g.fillStyle.bind(g), line = g.lineStyle.bind(g);
    const luma = (c) => {
      const l = Math.round(((c >> 16 & 255) * 0.3 + (c >> 8 & 255) * 0.59 + (c & 255) * 0.11) * 0.28);
      return (l << 16) | (l << 8) | l;
    };
    // LA DERIVA DE TONO (`hue` en LEVELS, `hueAt` en music.js) va en la MISMA puerta y ANTES
    // del fantasma: se pidio "una variacion de color, un movimiento de tono y no un pase
    // directo a rosa", o sea la paleta entera girada en el circulo de color y de vuelta.
    // Aca y no en cada capa por la misma razon que el fantasma: es una sola puerta contra
    // veinte funciones de dibujo. En fantasma no se aplica porque ahi no hay tono que girar.
    //
    // `KILL` SE QUEDA QUIETO Y NO PUEDE NO QUEDARSE: es lo unico que mata y por eso es lo unico
    // caliente en todos los niveles (misma regla que lo saca de `neon`). Un rojo que deriva
    // hacia el color del decorado es exactamente lo que la regla prohibe.
    // El blanco, el negro y los grises no hacen falta exceptuarlos: tienen saturacion 0 y girar
    // el tono de un gris devuelve el mismo gris.
    //
    // Se MEMOIZA por frame: el Graphics recibe entre 9000 y 13800 llamadas de estilo por frame
    // y los colores distintos son unas decenas, o sea que la conversion se hace una vez por
    // color y no una por llamada. El cache se tira cuando el giro cambia (una vez por frame).
    const memo = new Map();
    let hk = null;
    const gira = (c) => {
      const d = this.hue ?? 0;
      if (!d || c === KILL) return c;
      if (d !== hk) { memo.clear(); hk = d; }
      const m = memo.get(c);
      if (m !== undefined) return m;
      const v = rotHue(c, d);
      memo.set(c, v);
      return v;
    };
    // el blanco puro se queda blanco: es la unica forma de que algo (la constelacion) siga
    // siendo macizo cuando todo lo demas es gris al 28%.
    // El NEGATIVO va ULTIMO, envolviendo al fantasma y a la deriva de tono. Medido con el cyan
    // del nivel: fantasma solo da #2c2c2c, invirtiendo ANTES da #1c1c1c (16/255, o sea que el
    // fantasma se lo come) e invirtiendo DESPUES da #d3d3d3 (167/255). Y rotar el tono de un
    // color ya invertido lo manda a otra familia, o sea que la deriva medida deja de ser esa.
    // KILL NO esta exento, al reves que en la deriva de tono: `^0xffffff` es una isometria, asi
    // que invertirlo TAMBIEN conserva su separacion exacta contra el decorado (239 minima /
    // 153 grados, los mismos numeros que en normal); eximirlo la hunde a 86.0 y 2 grados, o sea
    // que lo que mata se confundiria con el fondo. Respaldo del dial: con this.neg = false,
    // neg(v) === v, o sea las dos lineas de siempre.
    const neg = (v) => (this.neg ? v ^ 0xffffff : v);
    g.fillStyle = (c, a) => fill(neg(this.ghost && c !== 0xffffff ? luma(c) : gira(c)), a);
    g.lineStyle = (w, c, a) => line(w, neg(this.ghost && c ? 0xffffff : gira(c)), a);
    return g;
  }

  drawGap(o, z) {
    const g = this.g, k = KINDS.gap;
    if (z + k.d < this.zn) return;
    const zf = Math.max(z, this.zn), zb = Math.max(z + k.d, this.zn + 10);
    const alpha = (this.hit.has(o.n) ? 0.3 : 1) * this.pasa(zf);
    const P = (xx, zz) => { const p = this.proj(xx, 0, zz); return new Phaser.Geom.Point(p.x, p.y); };
    // de perfil el suelo es una linea: el hueco se ve como una muesca hacia abajo
    const x0 = this.cam.flat ? 0 : this.laneX[o.lane] - k.w;
    const x1 = this.cam.flat ? 0 : this.laneX[o.lane] + k.w;
    const quad = this.cam.flat
      ? (() => { const a = P(0, zf), b = P(0, zb), d = 46 * this.grav;
        return [a, b, new Phaser.Geom.Point(b.x, b.y + d), new Phaser.Geom.Point(a.x, a.y + d)]; })()
      : [P(x0, zf), P(x1, zf), P(x1, zb), P(x0, zb)];
    // Se leia como una baldosa cyan: parecia decoracion, no un agujero que mata. Ahora es
    // negro con dos anillos hacia adentro (eso es lo que le da fondo: sin ellos es una mancha
    // plana) y el borde ROJO, el mismo color que la caja que mata. Late con la musica como
    // las cajas. Los anillos se calculan tirando cada esquina al centro, asi que salen igual
    // en 3D y de perfil sin un solo if.
    const cx = quad.reduce((s, p) => s + p.x, 0) / 4;
    const cy = quad.reduce((s, p) => s + p.y, 0) / 4;
    const dentro = (kk) => quad.map((p) =>
      new Phaser.Geom.Point(p.x + (cx - p.x) * kk, p.y + (cy - p.y) * kk));
    g.fillStyle(0x000000, alpha);
    g.fillPoints(quad, true);
    g.fillStyle(mix(KILL, 0x000000, 0.7), 0.7 * alpha);
    g.fillPoints(dentro(0.2), true);
    g.fillStyle(0x000000, alpha);
    g.fillPoints(dentro(0.42), true);
    // CHASE: los huecos de una zanja se encienden EN FILA, uno cada medio beat (ver `chaseAt`).
    const chase = chaseAt(o.row, this.songT, this.lv?.beat ?? 0.4615);
    for (const [wd, al] of [[5 + 14 * this.beat, 0.25], [3, 0.95]]) {
      g.lineStyle(wd * (1 + chase), KILL, al * alpha * (0.45 + 0.55 * chase));
      g.strokePoints(quad, true);
    }
    // La X dentro del hueco: el `gap` mata igual que el `block`, asi que lleva el MISMO
    // simbolo. Sin ella el agujero se leia como una baldosa y habia que saber que el borde
    // rojo mata; con la X no depende del color. Debajo de 26px de diagonal no se dibuja,
    // igual que los glifos de las cajas: de lejos es una mancha.
    const d = Math.hypot(quad[2].x - quad[0].x, quad[2].y - quad[0].y);
    if (d > 26) {
      const q = dentro(0.26);
      g.lineStyle(Math.max(2, d * 0.1), PALETTE.text, (0.3 + 0.7 * chase) * alpha);
      g.lineBetween(q[0].x, q[0].y, q[2].x, q[2].y);
      g.lineBetween(q[1].x, q[1].y, q[3].x, q[3].y);
    }
  }

  drawBox(o, z) {
    const g = this.g;
    const k = KINDS[o.kind];
    let x = this.laneX[o.lane];
    if (z + k.d < this.zn) return;
    const zf = Math.max(z, this.zn);
    const zb = Math.max(z + k.d, this.zn + 10);
    // Niebla + latido, las dos por caja. `f` es lo que le falta de viaje (0 encima tuyo,
    // 1 recien salida) al cuadrado: lo cercano queda limpio y el fondo se apaga rapido, que
    // es lo que hace que una pared no tape la lectura de la que viene detras.
    // 1600 y no SPAWN_Z-PLAYER_Z (3280): medido a v=700, las cajas caen una cada 323z (una por
    // beat), asi que con 3280 la 2a y la 3a (z=1069, 1392) daban f=0.02 y 0.05, o sea nada. Con
    // 1600 la que tenes encima y la siguiente siguen limpias (f=0.00 y 0.05), la 3a empieza a
    // irse (0.17) y de la 5a (z=2361) en adelante esta hundida del todo.
    const f = Phaser.Math.Clamp((zf - PLAYER_Z) / 1600, 0, 1) ** 2;
    const cerca = 1 - f;
    // el latido es del kick y se lo come la niebla: de lejos ni brilla
    const color = mix(mix(COLORS[o.kind], this.fog, f * 0.8), 0xffffff, this.beat * 0.75 * cerca);
    const alpha = (this.hit.has(o.n) ? 0.25 : 1) * (1 - 0.4 * f) * this.pasa(zf);
    let y0 = k.y0 * this.grav, y1 = k.y1 * this.grav;   // con gravedad invertida cuelgan
    let w = k.w, ea = 1, rot = 0;
    // ENTRADA: como aparece el obstaculo, por seccion (`enter` en LEVELS). A la velocidad del
    // nivel termina a 1019 del jugador, o sea 3.2 beats antes del impacto y ya legible: con
    // 5 beats terminaba hundida en la niebla y por eso no se veia. `enterDz` la topa para que
    // eso siga valiendo con `V` (feel) puesto: a x2 el viaje entero dura 5.08 beats y sin
    // topar la caja llegaba con la entrada a medias. Es puro dibujo: la hitbox sale de KINDS
    // y no se entera.
    const e = enterOf(zf, enterDz(this.lv?.beat ?? 0.4615, this.speed));
    if (e < 1) {
      const q = 1 - (1 - e) ** 2;   // ease-out: entra rapido y frena
      switch (this.lv?.enter?.[this.sec] ?? "fade") {
        case "grow": y1 = y0 + (y1 - y0) * q; break;                    // crece desde el piso
        // cae del cielo: 2600 es mas que la altura de la pantalla a esa z, o sea que entra
        // literalmente desde fuera de cuadro y se clava. Con 900 el viaje quedaba dentro de
        // la caja y se leia como un temblor.
        case "slam": { const dy = (1 - q) * 2600 * this.grav; y0 += dy; y1 += dy; break; }
        case "wide": w = k.w * (1 + 3 * (1 - q)); break;                // ancho y se cierra
        // rueda: gira 135 grados sobre su base. Va en PANTALLA y no en el mundo (rotar una
        // caja en 3D es reproyectarla entera; girar sus 4 esquinas ya proyectadas son dos
        // senos), y como el pivote es la base, la caja nunca se despega del carril.
        case "roll": rot = (1 - q) * Math.PI * 0.75 * this.grav; break;
        // entra de costado: sale de fuera de la pista (1500 en el mundo, o sea mas alla del
        // carril de afuera) y se DESLIZA hasta el suyo. El lado sale de `hash(fila)`, nunca
        // de Math.random: rebobinar la trae del mismo lado. Va en el MUNDO y no en pantalla
        // (al reves que `roll`): asi la caja llega con la perspectiva de su carril y no
        // aterriza corrida. En la camara de perfil la x no proyecta, o sea que ahi es solo
        // el alpha; el buildup no usa esa camara.
        case "side": x += (1 - q) * 1500 * (hash(o.row ?? 0) < 0.5 ? -1 : 1); break;
      }
      ea = 0.25 + 0.75 * q;   // todas suben de alpha ademas: si no, aparecen de la nada
    }
    // El `high` cuelga a la altura de la cabeza: encima tuyo tapa la pista entera y no deja
    // ver lo que viene detras. De cerca se le va el RELLENO (0.2 cuando te pisa) pero el
    // contorno y el simbolo se quedan enteros: la silueta se lee, la pared no tapa.
    const velo = o.kind === "high"
      ? 0.2 + 0.8 * Phaser.Math.Clamp((zf - PLAYER_Z) / 700, 0, 1) : 1;
    const aFill = alpha * ea * velo, aLine = alpha * ea;

    const P = (xx, yy, zz) => {
      const p = this.proj(xx, yy, zz);
      return new Phaser.Geom.Point(p.x, p.y);
    };
    // de perfil (2D) la x del mundo no proyecta: la cara del bloque es el rectangulo (z, y).
    // Sin esto el ancho sale de x-k.w a x+k.w, que colapsa, y la caja queda en una raya.
    // El orden de las esquinas es el mismo que en 3D (y1/zf, y1/zb, y0/zb, y0/zf), asi que
    // `drawGlyph` no se entera de en que camara esta.
    let cara = this.cam.flat
      ? [P(0, y1, zf), P(0, y1, zb), P(0, y0, zb), P(0, y0, zf)]
      : [P(x - w, y1, zf), P(x + w, y1, zf), P(x + w, y0, zf), P(x - w, y0, zf)];
    // La pared que MATA es un TRIANGULO, no un muro: las esquinas de arriba eran justo lo que
    // tapaba la pista de atras, y la punta se lee como "por aca no" mejor que un rectangulo.
    // La hitbox NO cambia: sigue siendo la caja entera de KINDS y se choca por indice de
    // carril, no por pixel, asi que el carril sigue cerrado de punta a punta.
    const tri = o.kind === "block";
    const mid = (a, b) => new Phaser.Geom.Point((a.x + b.x) / 2, (a.y + b.y) / 2);
    let sil = tri ? [mid(cara[0], cara[1]), cara[2], cara[3]] : cara;
    // caras de arriba: la caja tiene tapa, el triangulo tiene dos aguas hasta la punta
    let tapas = [];
    if (!this.cam.flat) {
      const apF = mid(cara[0], cara[1]), apB = P(x, y1, zb);
      tapas = tri
        ? [[P(x - w, y0, zf), apF, apB, P(x - w, y0, zb)],
          [P(x + w, y0, zf), apF, apB, P(x + w, y0, zb)]]
        : [[cara[0], cara[1], P(x + w, y1, zb), P(x - w, y1, zb)]];
    }
    if (rot) {
      const pv = mid(cara[2], cara[3]);   // pivote: la base, o sea el suelo del carril
      const c = Math.cos(rot), s = Math.sin(rot);
      const gira = (arr) => arr.map((p) => new Phaser.Geom.Point(
        pv.x + (p.x - pv.x) * c - (p.y - pv.y) * s,
        pv.y + (p.x - pv.x) * s + (p.y - pv.y) * c));
      cara = gira(cara); sil = gira(sil); tapas = tapas.map(gira);
    }
    for (const tp of tapas) {
      g.fillStyle(color, 0.55 * aFill);
      g.fillPoints(tp, true);
    }
    // front face
    g.fillStyle(color, 0.9 * aFill);
    g.fillPoints(sil, true);
    // halo en el color puro (el de la cara ya vino lavado). Dos pasadas: una ancha y tenue y
    // otra angosta y fuerte, que es lo que se lee como neon en vez de como borde grueso.
    // Se reporto que la pared no reaccionaba a la musica: el halo iba a 0.22/0.55 de alpha y
    // el contorno era fijo. Ahora el halo pega el doble y el contorno tambien engorda y
    // aclara con el beat, que es lo que se ve de lejos.
    const gl = this.beat * cerca;
    if (gl > 0.05) {
      for (const [wd, al] of [[5 + 26 * gl, 0.35], [2 + 10 * gl, 0.85]]) {
        g.lineStyle(wd, COLORS[o.kind], al * gl * aLine);
        g.strokePoints(sil, true);
      }
    }
    g.lineStyle(2 + 3 * gl, PALETTE.text, (0.35 + 0.5 * gl) * aLine);
    g.strokePoints(sil, true);
    this.drawGlyph(o.kind, cara, aLine * (0.75 + 0.25 * gl));
  }

  // el simbolo de la tecla, interpolado bilinealmente dentro de la cara: sirve para cualquier
  // proyeccion sin recalcular nada (ver GLYPH_UV).
  drawGlyph(kind, cara, alpha) {
    const trazos = GLYPH_UV[kind];
    if (!trazos) return;
    const [tl, tr, br, bl] = cara;
    const d = Math.hypot(br.x - tl.x, br.y - tl.y);
    if (d < 26) return;   // de lejos es una mancha
    const at = (u, v) => ({
      x: (tl.x + (tr.x - tl.x) * u) * (1 - v) + (bl.x + (br.x - bl.x) * u) * v,
      y: (tl.y + (tr.y - tl.y) * u) * (1 - v) + (bl.y + (br.y - bl.y) * u) * v,
    });
    this.g.lineStyle(Math.max(3, d * 0.09), PALETTE.text, 0.95 * alpha);
    for (const t of trazos) {
      for (let i = 1; i < t.length; i++) {
        const a = at(t[i - 1][0], t[i - 1][1]), b = at(t[i][0], t[i][1]);
        this.g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
  }

  // 1a PERSONA: no hay muneco, o sea que no hay nada en el campo cercano y la vista se leia
  // como una foto de la pista. Esto es el "capo": la sombra y el anillo de beat proyectados
  // por DELANTE de la camara (a 260 de los ojos), o sea lo unico que se mueve con la cadencia
  // y con el carril. Es el mismo anillo del muneco: dice en que carril estas (se corre con
  // `this.x`), que estas en el suelo (desaparece en el aire) y en que beat vas.
  drawHood() {
    const g = this.g;
    const p = this.proj(this.x, 0, PLAYER_Z + 260);
    const rw = 34 * p.s * 1.6;
    const aire = Math.min(1, Math.max(0, 1 - this.y / 60));   // saltando se despega y se apaga
    if (aire > 0.02) {
      g.fillStyle(0x000000, 0.3 * aire);
      g.fillEllipse(p.x, p.y, rw, rw * 0.32);
    }
    if (this.beat > 0.05) {
      g.lineStyle(Math.max(1, 3 * this.beat), PALETTE.cyan, 0.5 * this.beat);
      g.strokeEllipse(p.x, p.y, rw * (1.15 + 1 * (1 - this.beat)), rw * 0.34 * (1.15 + 1 * (1 - this.beat)));
    }
  }

  // El muneco lo dibuja `avatar.js` (el mismo que `tools/avatar.html`, el banco donde se
  // toca la pose sin el nivel encima). Aca solo se resuelve DONDE va: el sitio en la pista,
  // la sombra, el anillo del beat y el giro de la gravedad.
  drawPlayer() {
    const g = this.g;
    if (!this.cam.body) return this.drawHood();   // en 1a persona la camara ya esta dentro
    // el parpadeo de inmunidad se salta MUERTO: `invuln` se descuenta con dt y con el mundo
    // congelado se queda clavado en el 1.2 del golpe, o sea que floor(1.2*12)=14 es par SIEMPRE
    // y el muneco no se dibujaba en ninguno de los 3 segundos (medido: 6735px de diferencia,
    // bbox 130x199, o sea el muneco entero). Y lo que se pidio es esperar EN EL SITIO.
    if (!this.dead && this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0) return;
    const sliding = this.sliding > 0 && this.y === 0;
    const air = this.grav * this.y > 0;
    const corre = !air && !sliding && this.dash <= 0;
    // No hay paso que sincronizar: la tabla flota sobre una pista plana. Lo unico que se
    // mueve solo es un flote lento y los brazos, y los dos salen de la cancion.
    const an = ride(this.songT, this.lv?.beat ?? 0.4615);
    // EL BAMBOLEO SALE DE LO QUE HACES, no de ir hacia adelante: cambiar de carril, saltar o
    // comerte una caja. Es un tirón que se apaga solo (seno por exponencial, 0.45s), asi que
    // yendo derecho el muneco esta quieto, que es justo lo que se pedia.
    const dw = this.songT - this.wobT;
    const wob = dw >= 0 && dw < 0.9
      ? Math.sin(dw * 22) * Math.exp(-dw / 0.16) * 0.16 * this.wobDir : 0;
    const bote = corre ? an.hover : 0;
    // amortiguado del aterrizaje: 120ms de rodillas, si no vuelve a correr de golpe
    const land = corre
      ? Phaser.Math.Clamp(1 - (this.songT - this.landT) / 0.12, 0, 1) : 0;

    const base = this.proj(this.x, this.y + this.grav * bote * HOVER, PLAYER_Z);
    const s = base.s;
    const bw = 34 * s;         // ancho de referencia para la sombra y el anillo

    // Sombra larga: elipses negras pegadas al piso detras del muneco. Es lo unico que le
    // queda en el mundo (hubo una cola de particulas y un halo, los dos se sacaron: en una
    // pantalla que ya esta llena de luz, mas luz encima del muneco lo esconde en vez de
    // marcarlo). Lo que lo ata al suelo es la sombra, no el brillo.
    for (let i = 1; i <= 5; i++) {
      const zz = PLAYER_Z - i * 95;
      if (zz <= this.zn + 4) break;
      const p = this.proj(this.x, 0, zz);
      g.fillStyle(0x000000, 0.26 * (1 - i / 6));
      g.fillEllipse(p.x, p.y, bw * (1.7 + i * 0.5), bw * (0.5 + i * 0.12));
    }
    // La sombra se queda en el piso y encoge con el bote: es lo que dice cuanto despegaste.
    const sh = this.proj(this.x, 0, PLAYER_Z);
    g.fillStyle(0x000000, 0.35 * (1 - 0.25 * bote));
    g.fillEllipse(sh.x, sh.y, bw * 1.6 * (1 - 0.12 * bote), bw * 0.5 * (1 - 0.12 * bote));
    // anillo del beat a los pies: el pulso tambien pasa por el jugador, no solo por el decorado
    if (this.beat > 0.05) {
      g.lineStyle(Math.max(1, 3 * this.beat), PALETTE.cyan, 0.5 * this.beat);
      g.strokeEllipse(sh.x, sh.y, bw * (1.8 + 1.6 * (1 - this.beat)), bw * (0.55 + 0.5 * (1 - this.beat)));
    }

    // El cuerpo se dibuja en pantalla, no con `proj`: para colgarlo del techo se gira el
    // canvas sobre los pies en vez de meterle el signo a treinta offsets. El vaiven suma su
    // grado de balanceo: de espaldas eso es lo que se lee de la rotacion de caderas.
    // La tabla APUNTA hacia donde vas: `x` persigue al carril, asi que lo que falta para
    // llegar es la direccion y la fuerza del giro. Va casi todo al `yaw` (la tabla gira en el
    // suelo, que es lo que se lee de espaldas) y solo un resto a la inclinacion de pantalla.
    const gira = Phaser.Math.Clamp((this.laneX[this.lane] - this.x) / 70, -1, 1);
    g.save();
    g.translateCanvas(base.x, base.y);
    g.rotateCanvas(this.roll + gira * 0.10 * this.grav);
    g.translateCanvas(-base.x, -base.y);

    // 1 unidad = el alto del muneco, asi que la perspectiva es un solo factor. El aplastado
    // del apoyo y las rodillas del aterrizaje entran en el mapeo, no en la pose.
    const u = PLAYER_H * s;
    const kx = 1 + 0.09 * land, ky = 1 - 0.13 * land;
    const P = (x, y) => ({ x: base.x + x * kx * u, y: base.y - y * ky * u });
    const beat = this.lv?.beat ?? 0.4615;
    // el eq de la mochila late con la musica de verdad: cada barra en su propia subdivision
    // del beat, igual que las del fondo, y el kick las empuja a todas
    const eq = (i) => {
      const sub = 1 + Math.floor(hash(i + 7) * 4);
      const osc = Math.abs(Math.sin(Math.PI * (this.songT / beat) * sub + hash(i) * 6.283));
      return Math.min(1, 0.2 + 0.6 * osc + 0.4 * this.pulse * osc);
    };
    // El truco del salto sale de `hash(cuando saltaste)`, o sea que es el mismo cada vez que
    // rebobinas, y el avance sale de `vy` (JUMP_V al despegar, -JUMP_V al caer): no hay que
    // guardar ni un contador. Es solo dibujo: la hitbox no se entera.
    const tp = air ? Phaser.Math.Clamp((JUMP_V - this.grav * this.vy) / (2 * JUMP_V), 0, 1) : 0;
    // el traje toma el color del compas (como el rig y las formas) y brilla con el beat
    const nb = Math.floor(this.songT / (this.lv?.bar ?? 1.846));
    const neon = {
      col: this.neon[Math.floor(hash(nb + 2.5) * this.neon.length)],
      a: 0.55 + 0.45 * this.beat,
    };
    drawAvatar(g, pose({ arm: an.arm, air, rising: this.grav * this.vy > 0, sliding, land,
      yaw: gira * 0.6, tp, trick: TRICKS[Math.floor(hash(this.jumpT * 7.7) * TRICKS.length)] }),
      P, u, kx, eq, neon, wob);

    // burbuja del dash: el muneco va dentro, no se cambia de pose
    if (this.dash > 0) {
      const c = P(0, 0.45);
      for (const [r, w, al] of [[0.44, 10, 0.18], [0.42, 3, 0.5]]) {
        g.lineStyle(w * s, COLORS.orb, al);
        g.strokeCircle(c.x, c.y, r * u);
      }
    }
    g.restore();
  }
}

export const createAIRunnerGame = (parent) =>
  new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 900,
    height: 640,
    backgroundColor: HEX.bg,
    scene: [RunnerScene],
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
  });
