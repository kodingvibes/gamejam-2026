// Del schema maestro a las cues del juego.
// El schema solo trae SENALES (kick / accent / voice + intensidad). Que hace cada senal
// lo decide el nivel, a mano, aca abajo. No hay editor de niveles: se toca LEVELS y listo.
import { KINDS, PLAYER_Z, SPAWN_Z, lanesX } from "./physics.js";

export const LEVELS = {
  "insomnia-drop": {
    schema: "assets/insomnia.schema.json",
    audio: "assets/insomnia-cut.mp3",
    // z/s de la pista: mueve el VIAJE, no la hora de llegada. Se subio de 700 a 1060 despues
    // de jugarlo: es la velocidad del nivel, y `V` (feel) sigue multiplicando sobre esta.
    // No afloja nada (todas las ventanas se ABREN al correr mas: la fila sigue durando un
    // beat y lo que se acorta es el rato que el obstaculo esta encima tuyo), y el solver de
    // `test-music.js` lo resuelve a esta velocidad, no a la vieja.
    speed: 1060,
    lanes: 3,          // los de siempre: lanesX(3) = [-170, 0, 170]
    bg: "#0b0d17",     // color por defecto del fondo
    // DECORADO encendido, por nombre de capa. No es una feature nueva: es la lista de lo que
    // este nivel YA dibuja, sacada del `draw()` actual, para que un nivel pueda apagarlo.
    // El nivel 2 arranca con el fondo vacio y solo enciende "mesh" y "reactor".
    //   rig = las vigas del cielo | pins = los tubos de los costados | gates = los portones
    //   shapes = los poligonos flotando | rave = el barrido del suelo | bars = el eq del fondo
    //   flash = el apagon del break y los blinders | ghost = el fantasma de la f63 y las marcas
    //   mesh = la malla del plano del suelo, aca con la ola `mode` 2 (ver `wave` y `mesh`)
    decor: ["rig", "pins", "gates", "shapes", "rave", "bars", "flash", "ghost", "mesh"],
    // EL SUELO OUTRUN. La malla es la MISMA capa del nivel 2 (ni una funcion de dibujo nueva):
    // lo que cambia son la ola (`wave.mode` = 2, la cordillera de `outrun` en `fx.js`) y estos
    // dos colores. El dorado es el atardecer de las referencias retro y ademas es lo que hace
    // que la malla no compita con lo que se juega: el nivel entero es violeta y `KILL` es el
    // rosa caliente, o sea que un fondo cyan (el respaldo, `MESH_LO`/`MESH_HI`) seria un color
    // mas en una pantalla que ya tiene tres. `lo` es el valle y `hi` la cresta; el medio da
    // #c19c47.
    // LA MALLA QUEDA POR DEBAJO DE LA PISTA y eso esta medido en pantalla, no en la cuenta: se
    // aisla la capa (la misma fila con y sin `mesh` en `decor`, restando los dos PNG) y se compara
    // la luma de SU tinta contra el parche del plano del suelo de la misma banda (y400-520, o sea
    // z 1250..2400). Un parche "de afuera" mentiria: en el nivel 1 ahi ya hay pins, rave, formas
    // y skyline. Ratio malla/suelo en media, con los `a` de abajo: buildup **0.40 / 0.32**, break
    // **0** (el apagon se la come entera), drop **0.55 / 0.96**, drop2 **0.96 / 1.00**, outro
    // **0.94 / 0.91**. Los dos que estaban por encima de 1 son los que bajaron de `a` (ver `wave`).
    mesh: { lo: "#3b2a04", hi: "#ffd166" },
    // LA PALETA ES DEL NIVEL. `fam` es la familia de la que salen los divisores de carril,
    // los pins, las formas, el eq en modo `color` y el traje del muneco; `sec` es el color
    // del marco y de las bandas del suelo por seccion. Estos cuatro y este mapa son
    // EXACTAMENTE lo que estaba hardcodeado en el renderer, o sea que el nivel 1 no cambia
    // un pixel. `KILL` no entra aca ni puede: es lo unico que mata y por eso es el unico
    // color caliente, en todos los niveles.
    neon: {
      fam: ["#8b5cf6", "#818cf8", "#6366f1", "#7c3aed"],
      sec: { drop: "#ec4899", break: "#818cf8" },
      def: "#8b5cf6",
    },
    // Capas de detalle sobre el color base. k = parallax: cuanto de la distancia
    // recorrida (songT * speed) se mueve la capa. Se declaran aca, no en el renderer.
    layers: [
      { id: "stars", kind: "stars", k: 0.01, step: 90, h: 0.9, color: "#3b4166" },
      { id: "far", kind: "skyline", k: 0.05, step: 140, h: 0.55, color: "#171a2e" },
      { id: "near", kind: "skyline", k: 0.13, step: 90, h: 0.34, color: "#232741" },
      // Una VARIANTE del eq por sector del suelo (ver `drawBars`), para verlas todas en una
      // corrida y elegir mirandolas. La `constelacion` va SOLA en el sector 3 (el break): sus
      // tres primeras filas estan en negro por el apagon, o sea que aparece recien en la f63
      // (GHOST_ROW), el beat del fantasma, y no se la ve en ningun otro lado del nivel.
      // f0-19 f20-39 f40-59  f60-63       f64-79 f80-95 f96-111 f112-127
      //   f128-143 f144-159 f160-175 f176-189 f190-203 f204-219
      { id: "eq", kind: "bars", k: 0.3, step: 32, h: 0.34, color: "#4a54a8",
        modes: ["analyzer", "sweep", "center", "constelacion",
          "spectro", "color", "sweep", "analyzer",
          "center", "spectro", "color", "sweep", "analyzer", "center"] },
    ],
    // canal -> rol del juego. min filtra por intensidad, every N se queda con 1 de cada N.
    // El accent ya NO genera obstaculos: los obstaculos son los grabados (script, abajo).
    // Sigue siendo "mark" para que la linea numerada quede en pantalla y se pueda dictar.
    map: {
      kick: { role: "bg", min: 0.5 },
      accent: { role: "mark", min: 0.85, every: 2 },
      voice: { role: "fx", fx: "acid" },
      // Segunda tanda (f128-219): marcada A MANO en el beatmapper, no detectada del audio,
      // asi que no traen `v` (todas valen 1) y no se filtran por intensidad. Los nombres son
      // los que puso el tag en el beatmapper; el ROL sigue eligiendolo el nivel, como siempre.
      // El acido viene de a PARES (medido: 0.50-0.75 beats entre los dos, y 7 beats hasta el
      // par siguiente), o sea exactamente la cadencia de los accent del drop: un destello de
      // medio compas por compas. Por eso es la MARCA de este tramo.
      // La `response` cae en la linea de compas, 0.25-1.00 beats DESPUES del par: si tambien
      // fuera marca, los tres se encadenan (medido: 19 de 34 huecos a <=1.5 beats) y la
      // constelacion se transformaria en pantalla en vez de aparecer ya siendo otra figura.
      // Va de "fx" sin nombre: barre el suelo con el rave y deja su linea en modo diseno,
      // pero no abre ventana de marca. El snare, tres en todo el tramo, igual.
      kicks: { role: "bg" },        // el bajo: `pulse`, rig, pins, barras del fondo
      acidbass: { role: "mark" },   // la linea de acido: barre el suelo Y abre los destellos
      response: { role: "fx" },     // la respuesta al 1 de cada compas: solo barre
      snare: { role: "fx" },        // 3 remates en todo el tramo: solo barren
    },
    // por seccion se puede pisar el mapeo: mismo filtro de siempre, asi el #n no se mueve
    sections: {
      buildup: { mark: { min: 0.95, every: 2 } },
      break: { mark: null },
    },
    // QUE LATE CON QUE, por seccion. "bg" = el kick (el bajo), "mark" = accent/voice (los
    // agudos). Antes del drop las cajas y el suelo van con los agudos, o sea que el bajo
    // no aparece hasta que entra de verdad; en el drop todo pasa a ir con el bajo.
    // Lo consume `draw()` (`this.beat`): obstaculos, bandas del suelo, portones, formas.
    // (el break va con "bg" porque no tiene marcas: medido, 1 kick y 0 accent en sus 1.85s.
    // O sea que en el break casi nada late, que es justo lo que se quiere ahi.)
    glow: { buildup: "mark", break: "bg", drop: "bg", drop2: "bg", outro: "bg" },
    // LA OLA POR SECCION. Aca no es una ola: `mode` 2 es la cordillera outrun (`outrun` en
    // `fx.js`), o sea que lo que se mueve es `a`, cuanto pesa la malla en cada tramo.
    // LAS CINCO SECCIONES VAN DECLARADAS y eso no es de mas: la seccion que falta cae en el
    // respaldo `{ a: 1, mode: 0 }`, que es el AGUA del nivel 2, y la cordillera se convertiria
    // en olas cyan a mitad de la cancion.
    // El arco sigue al del nivel: entra alta, se apaga hacia el apagon (el break la deja en 0,
    // ahi la pantalla es negra igual), los dos drops la devuelven enteras y el outro la baja.
    // LOS CINCO PARES ESTAN MEDIDOS aislando la capa (la misma fila con y sin `mesh` en `decor`,
    // restando los dos PNG, dos frames por seccion separados medio beat), igual que los del nivel
    // 2. Cobertura del cuadro / luma media del aporte / ratio contra el parche de pista de la
    // misma banda (ver `mesh` arriba):
    //   buildup  a=1.20  12.32%  0.93   0.40 / 0.32
    //   break    a=0.80   0.00%  0.00   0        <- el apagon se la come entera
    //   drop     a=1.45  12.51%  1.79   0.55 / 0.96
    //   drop2    a=0.75  12.41%  0.97   0.96 / 1.00
    //   outro    a=0.85  12.28%  0.99   0.94 / 0.91
    // El drop2 iba en 1.45 y el outro en 1.30, y ahi la malla le GANABA a la pista (1.26/1.32 y
    // 1.11/1.07): la del nivel 1 en drop2 y outro es la mas apagada del nivel (luma 26.1/24.2 y
    // 24.6/25.2 contra 58.8/46.0 en el drop), o sea que el mismo alpha que en el drop la deja por
    // encima. Barrido medido en vivo, drop2: 1.15 -> 1.13/1.19, 0.95 -> 1.06/1.10, 0.85 ->
    // 1.01/1.05, 0.75 -> 0.96/1.00; outro: 1.05 -> 1.02/0.98, 0.85 -> 0.94/0.91. La cobertura casi
    // no se mueve (12.66% -> 12.41%): lo que baja es el brillo de la linea, no cuanta hay.
    // El drop se queda en 1.45 porque ahi la pista es lo mas brillante del nivel y el ratio ya da
    // por debajo de 1.
    wave: {
      buildup: { a: 1.20, to: 0.80, mode: 2 },
      break: { a: 0.80, to: 0, mode: 2 },
      drop: { a: 1.45, mode: 2 },
      drop2: { a: 0.75, mode: 2 },
      outro: { a: 0.85, to: 0.35, mode: 2 },
    },
    // EL NEGATIVO, dos tramos. Es el mismo motor del gate con otro `kind` (`gateAt(t, lv,
    // "neg")`), o sea que trae gratis `div`, `cut` y `ramp` y late con la GRILLA en vez de
    // estar puesto: rebobinar lo rebobina y toda la pantalla va en la misma fase.
    // `div` = 1 (un corte por beat) y no 4: a 130bpm son 2.167 destellos por segundo, o sea
    // por debajo de los 3/s de la WCAG 2.3.1. Un negativo a pantalla completa es el efecto que
    // mas parpadea de todo el nivel y no hay motivo para acercarse al limite.
    // `cut` es lo CERRADO (o sea invertido) de cada corte y `ramp` es a donde llega al final
    // del tramo: el tajo mismo hace la creciente, igual que el gate del nivel 2.
    // DONDE: dos tramos de 16 filas (4 compases) en el ultimo cuarto del buildup y en el final
    // del outro, o sea entrando y saliendo del nivel. Lo que NO se toca:
    //   - la f56-f63: los blinders (f56-f59), el apagon (f60-f62) y el beat del fantasma
    //     (f63, `GHOST_ROW`), que son tres efectos a pantalla completa ya medidos.
    //   - el drop y el drop2: ahi el fantasma esta puesto el 23.3% del tramo y el negativo lo
    //     ENVUELVE (se aplica ultimo, ver `fantasma()`), o sea que se sumarian dos filtros.
    fx: [
      { kind: "neg", from: 40, to: 55, div: 1, cut: 0.08, ramp: 0.30 },
      { kind: "neg", from: 204, to: 219, div: 1, cut: 0.10, ramp: 0.36 },
    ],
    // COMO ENTRA el obstaculo cuando aparece, por seccion. Es puro dibujo y termina a 1018 del
    // jugador (ver `enterDz`): no toca la hitbox ni la lectura. El buildup y el drop entran
    // distinto a proposito, asi la entrada tambien cuenta en que parte del tema estas.
    //   "side"  = entra de costado y se desliza a su carril (buildup)
    //   "slam"  = cae de 2600 de altura y se clava (drop)
    //   "roll"  = entra girada 135 grados y se endereza sobre su base
    //   "grow"  = sale del piso creciendo, el suave
    //   "wide"  = entra ancho y se cierra de golpe
    //   "fade"  = el de siempre, solo alpha
    enter: { buildup: "side", break: "wide", drop: "slam", drop2: "roll", outro: "grow" },
    // SECTORES del suelo: tramos de FILAS (las dos incluidas) con su propio tinte. Es SOLO
    // color de las bandas del piso: no toca cues, ni fisica, ni la hitbox. Sirve para que la
    // pista misma diga en que tramo del tema estas sin mirar el HUD, con mas resolucion que
    // las tres secciones. Cortados cada 20 filas (5 compases) dentro del buildup y cada 16
    // (4 compases) dentro del drop; el break es su propio sector.
    sectors: [
      { from: 0, to: 19, color: "#4c4a8a" },
      { from: 20, to: 39, color: "#6d4aa8" },
      { from: 40, to: 59, color: "#8b5cf6" },
      { from: 60, to: 63, color: "#818cf8" },
      { from: 64, to: 79, color: "#a855f7" },
      { from: 80, to: 95, color: "#7c3aed" },
      { from: 96, to: 111, color: "#c026d3" },
      { from: 112, to: 127, color: "#9333ea" },
      // segunda mitad (drop2 f128-189 + outro f190-219). El corte de la f190 es el mismo que
      // el de la seccion, asi que la junta del suelo dice donde empieza el outro.
      { from: 128, to: 143, color: "#7e22ce" },
      { from: 144, to: 159, color: "#a21caf" },
      { from: 160, to: 175, color: "#6d28d9" },
      { from: 176, to: 189, color: "#8b5cf6" },
      { from: 190, to: 203, color: "#4c4a8a" },
      { from: 204, to: 219, color: "#312e6e" },
    ],
    // ZONAS: tramos de filas con otras reglas. `from`/`to` son filas, las dos incluidas.
    //   lane: la zona es de UN carril. Se tiran los obstaculos de los otros dos, el jugador
    //         queda pegado a ese carril (no se puede salir) y los otros dos se pintan de
    //         rojo en el suelo, de lejos, para que sepas a cual moverte antes de entrar.
    //   cam:  la camara de la zona ("lado" = 2D plano, sin carriles). Al salir vuelve a la
    //         que tenias con `C`.
    // Los bordes salen de la grabacion, no de la vista: el ultimo cambio de carril antes de
    // la zona es el de la f77 (al 1, t=35.880) y el siguiente el de la f83 (al 0, t=38.643).
    // Dentro de la zona `move()` no hace nada, asi que la zona tiene que empezar cuando YA
    // estas en su carril y **soltarte una fila antes** del proximo cambio (con `to: 83` el
    // pin se comia el movimiento de la f83 y morias a los 38.65s).
    // Empieza en la f76 y no en la f78 a proposito: al final de la f75 ya venis en el 1, y
    // esas **dos filas de entrada van vacias** (923ms). Cambiar de camara y tener que saltar
    // en el mismo beat no era una dificultad, era no ver: la entrada es para leer el plano.
    // El CONTENIDO tampoco sale de la grabacion (ahi no hiciste nada, y de perfil un tramo
    // vacio no es un tramo 2D): esta escrito a mano, f78 low / f79 high / f80 low / f81 high
    // / f82 low. Que se pueda pasar no es a ojo, lo resuelve `test-music.js` con un solver de
    // un carril que incluye la fila de salida, y mide la ventana de cada pulsacion.
    // El tramo 2D (f76-f82, carril 1, cam "lado") SE SACO: de perfil el nivel se lee como
    // otro juego, y este ya pide bastante. El mecanismo sigue entero (zonas, `zoneAt`, la
    // camara, sus tests): lo unico que se saco es la zona del nivel. Para devolverla:
    //   zones: [{ from: 76, to: 82, lane: 1, cam: "lado" }]
    // Si vuelve, tiene que ser de UN carril: en esa proyeccion la x del mundo no proyecta,
    // asi que dos cajas de carriles distintos se dibujan una encima de la otra.
    zones: [],
    // GUION: lo que me vas dictando mientras jugas, por numero de cue (#n en pantalla).
    //   { at: 34, bg: "#ef4444", over: 2 }        -> en la #34 el fondo va a rojo en 2s
    //   { from: 12, to: 40, role: "obstacle", kind: "block" }  -> ese tramo, todo cajas
    //   { at: 67, off: true }                     -> borra esa cue
    // Y por posicion de la pista, aunque no haya senal (tecla T para ver los numeros):
    //   { tile: [323, 324], kind: "low" }         -> caja en esos tiles (fila*3 + carril)
    //   { row: 78, lane: 1, kind: "high" }        -> misma fila, carril del medio
    // Y las capas de fondo, tambien por #n:
    //   { at: 34, layer: "eq", tint: "#ec4899", over: 1 }   -> tinta la capa en 1s
    //   { at: 40, layer: "far", vis: false }                -> la apaga
    // El nivel ES la grabacion del 30/07: el negativo de la corrida (`Y` graba, `U` exporta).
    // Todo lo que no pisaste queda tapado, o sea la pista es un tunel con la forma de esa
    // vuelta. 268 directivas de fila: 265 obstaculos (92 cajas, 123 huecos, 34 low, 16 high)
    // + 2 jump orbs donde encadenaste saltos + 1 flip. Sin el break (f60-f63, ahi no hay nada
    // que esquivar). La zona de un carril se come 10, o sea 255 obstaculos vivos.
    // Los 123 HUECOS no salen de la grabacion: son el interior de las paredes de 5+ cajas
    // seguidas, vaciado. Una zanja de 3 filas no se cruza (salto = 454ms de aire, fila =
    // 462ms; `test.js` lo comprueba), asi que la pared sigue cerrada pero deja ver la pista.
    // El rec crudo esta en tools/rec-insomnia-drop.json: se puede recalcular sin volver a jugar.
    script: [
      { row: 0, lane: 0, kind: "block" },
      { row: 0, lane: 2, kind: "block" },
      { row: 1, lane: 0, kind: "block" },
      { row: 1, lane: 2, kind: "gap" },
      { row: 2, lane: 1, kind: "block" },
      { row: 2, lane: 2, kind: "gap" },
      { row: 3, lane: 0, kind: "low" },
      { row: 3, lane: 1, kind: "block" },
      { row: 3, lane: 2, kind: "gap" },
      { row: 4, lane: 0, kind: "block" },
      { row: 4, lane: 2, kind: "gap" },
      { row: 5, lane: 0, kind: "gap" },
      { row: 5, lane: 2, kind: "gap" },
      { row: 6, lane: 0, kind: "gap" },
      { row: 6, lane: 2, kind: "gap" },
      { row: 7, lane: 0, kind: "gap" },
      { row: 7, lane: 1, kind: "high" },
      { row: 7, lane: 2, kind: "gap" },
      { row: 8, lane: 0, kind: "gap" },
      { row: 8, lane: 2, kind: "block" },
      { row: 9, lane: 0, kind: "gap" },
      { row: 9, lane: 1, kind: "block" },
      { row: 9, lane: 2, kind: "low" },
      { row: 10, lane: 0, kind: "gap" },
      { row: 10, lane: 1, kind: "block" },
      { row: 11, lane: 0, kind: "block" },
      { row: 11, lane: 2, kind: "block" },
      { row: 12, lane: 0, kind: "low" },
      { row: 12, lane: 1, kind: "block" },
      { row: 12, lane: 2, kind: "gap" },
      { row: 13, lane: 0, kind: "low" },
      { row: 13, lane: 1, kind: "block" },
      { row: 13, lane: 2, kind: "gap" },
      { row: 14, lane: 0, kind: "high" },
      { row: 14, lane: 1, kind: "block" },
      { row: 14, lane: 2, kind: "gap" },
      { row: 15, lane: 1, kind: "block" },
      { row: 15, lane: 2, kind: "gap" },
      { row: 16, lane: 0, kind: "block" },
      { row: 16, lane: 2, kind: "gap" },
      { row: 17, lane: 0, kind: "block" },
      { row: 17, lane: 1, kind: "high" },
      { row: 17, lane: 2, kind: "block" },
      { row: 18, lane: 0, kind: "block" },
      { row: 18, lane: 1, kind: "block" },
      { row: 19, lane: 0, kind: "block" },
      { row: 19, lane: 2, kind: "block" },
      { row: 20, lane: 1, kind: "low" },
      { row: 20, lane: 2, kind: "gap" },
      { row: 21, lane: 1, kind: "block" },
      { row: 21, lane: 2, kind: "gap" },
      { row: 22, lane: 1, kind: "gap" },
      { row: 22, lane: 2, kind: "gap" },
      { row: 23, lane: 0, kind: "low" },
      { row: 23, lane: 1, kind: "gap" },
      { row: 23, lane: 2, kind: "gap" },
      { row: 24, lane: 0, kind: "high" },
      { row: 24, lane: 1, kind: "gap" },
      { row: 24, lane: 2, kind: "gap" },
      { row: 25, lane: 1, kind: "block" },
      { row: 25, lane: 2, kind: "gap" },
      { row: 26, lane: 0, kind: "low" },
      { row: 26, lane: 2, kind: "block" },
      { row: 27, lane: 0, kind: "block" },
      { row: 27, lane: 1, kind: "high" },
      { row: 27, lane: 2, kind: "high" },
      { row: 28, lane: 0, kind: "gap" },
      { row: 28, lane: 2, kind: "low" },
      { row: 29, lane: 0, kind: "gap" },
      { row: 29, lane: 2, kind: "block" },
      { row: 30, lane: 0, kind: "gap" },
      { row: 30, lane: 2, kind: "block" },
      { row: 31, lane: 0, kind: "gap" },
      { row: 31, lane: 1, kind: "block" },
      { row: 32, lane: 0, kind: "block" },
      { row: 32, lane: 2, kind: "low" },
      { row: 33, lane: 1, kind: "block" },
      { row: 33, lane: 2, kind: "block" },
      { row: 34, lane: 1, kind: "gap" },
      { row: 34, lane: 2, kind: "gap" },
      { row: 35, lane: 1, kind: "gap" },
      { row: 35, lane: 2, kind: "gap" },
      { row: 36, lane: 0, kind: "high" },
      { row: 36, lane: 1, kind: "gap" },
      { row: 36, lane: 2, kind: "gap" },
      { row: 37, lane: 1, kind: "gap" },
      { row: 37, lane: 2, kind: "gap" },
      { row: 38, lane: 1, kind: "block" },
      { row: 38, lane: 2, kind: "gap" },
      { row: 39, lane: 0, kind: "block" },
      { row: 39, lane: 2, kind: "gap" },
      { row: 40, lane: 0, kind: "gap" },
      { row: 40, lane: 1, kind: "high" },
      { row: 40, lane: 2, kind: "gap" },
      { row: 41, lane: 0, kind: "gap" },
      { row: 41, lane: 2, kind: "block" },
      { row: 42, lane: 0, kind: "gap" },
      { row: 42, lane: 2, kind: "low" },
      { row: 43, lane: 0, kind: "block" },
      { row: 43, lane: 1, kind: "block" },
      { row: 44, lane: 0, kind: "low" },
      { row: 44, lane: 2, kind: "block" },
      { row: 45, lane: 1, kind: "block" },
      { row: 45, lane: 2, kind: "gap" },
      { row: 46, lane: 0, kind: "block" },
      { row: 46, lane: 2, kind: "gap" },
      { row: 47, lane: 0, kind: "gap" },
      { row: 47, lane: 1, kind: "low" },
      { row: 47, lane: 2, kind: "gap" },
      { row: 48, lane: 0, kind: "gap" },
      { row: 48, lane: 2, kind: "gap" },
      { row: 49, lane: 0, kind: "gap" },
      { row: 49, lane: 2, kind: "gap" },
      { row: 50, lane: 0, kind: "gap" },
      { row: 50, lane: 2, kind: "gap" },
      { row: 51, lane: 0, kind: "gap" },
      { row: 51, lane: 2, kind: "gap" },
      { row: 52, lane: 0, kind: "gap" },
      { row: 52, lane: 2, kind: "block" },
      { row: 53, lane: 0, kind: "gap" },
      { row: 54, lane: 0, kind: "gap" },
      { row: 54, lane: 1, kind: "block" },
      { row: 55, lane: 0, kind: "block" },
      { row: 55, lane: 2, kind: "block" },
      { row: 56, lane: 1, kind: "low" },
      { row: 56, lane: 2, kind: "gap" },
      { row: 57, lane: 0, kind: "low" },
      { row: 57, lane: 2, kind: "gap" },
      { row: 58, lane: 0, kind: "block" },
      { row: 58, lane: 2, kind: "gap" },
      { row: 59, lane: 0, kind: "block" },
      { row: 59, lane: 2, kind: "block" },
      { row: 64, lane: 0, kind: "block" },
      { row: 64, lane: 1, kind: "low" },
      { row: 64, lane: 2, kind: "block" },
      { row: 65, lane: 1, kind: "low" },
      { row: 65, lane: 2, kind: "block" },
      { row: 66, lane: 0, kind: "block" },
      { row: 66, lane: 2, kind: "block" },
      { row: 67, lane: 0, kind: "block" },
      { row: 67, lane: 1, kind: "block" },
      { row: 68, lane: 0, kind: "block" },
      { row: 68, lane: 2, kind: "low" },
      { row: 69, lane: 1, kind: "low" },
      { row: 69, lane: 2, kind: "block" },
      { row: 70, lane: 2, kind: "block" },
      { row: 71, lane: 0, kind: "block" },
      { row: 71, lane: 1, kind: "low" },
      { row: 72, lane: 0, kind: "gap" },
      { row: 72, lane: 2, kind: "block" },
      { row: 73, lane: 0, kind: "gap" },
      { row: 73, lane: 1, kind: "low" },
      { row: 73, lane: 2, kind: "block" },
      { row: 74, lane: 0, kind: "gap" },
      { row: 74, lane: 1, kind: "low" },
      { row: 75, lane: 0, kind: "block" },
      { row: 75, lane: 2, kind: "block" },
      { row: 76, lane: 2, kind: "block" },
      { row: 77, lane: 0, kind: "block" },
      { row: 78, lane: 0, kind: "gap" },
      { row: 78, lane: 1, kind: "low" },
      { row: 78, lane: 2, kind: "low" },
      { row: 79, lane: 0, kind: "gap" },
      { row: 79, lane: 1, kind: "high" },
      { row: 79, lane: 2, kind: "block" },
      { row: 80, lane: 0, kind: "gap" },
      { row: 80, lane: 1, kind: "low" },
      { row: 80, lane: 2, kind: "gap" },
      { row: 81, lane: 0, kind: "gap" },
      { row: 81, lane: 1, kind: "high" },
      { row: 81, lane: 2, kind: "gap" },
      { row: 82, lane: 0, kind: "gap" },
      { row: 82, lane: 1, kind: "low" },
      { row: 82, lane: 2, kind: "gap" },
      { row: 83, lane: 0, kind: "block" },
      { row: 83, lane: 1, kind: "high" },
      { row: 83, lane: 2, kind: "gap" },
      { row: 84, lane: 1, kind: "block" },
      { row: 84, lane: 2, kind: "gap" },
      { row: 85, lane: 0, kind: "low" },
      { row: 85, lane: 1, kind: "block" },
      { row: 85, lane: 2, kind: "gap" },
      { row: 86, lane: 0, kind: "high" },
      { row: 86, lane: 1, kind: "block" },
      { row: 86, lane: 2, kind: "gap" },
      { row: 87, lane: 0, kind: "block" },
      { row: 87, lane: 2, kind: "gap" },
      { row: 88, lane: 1, kind: "block" },
      { row: 88, lane: 2, kind: "gap" },
      { row: 89, lane: 0, kind: "high" },
      { row: 89, lane: 1, kind: "block" },
      { row: 89, lane: 2, kind: "gap" },
      { row: 90, lane: 0, kind: "block" },
      { row: 90, lane: 2, kind: "gap" },
      { row: 91, lane: 1, kind: "block" },
      { row: 91, lane: 2, kind: "block" },
      { row: 92, lane: 0, kind: "block" },
      { row: 93, lane: 0, kind: "gap" },
      { row: 93, lane: 1, kind: "block" },
      { row: 94, lane: 0, kind: "gap" },
      { row: 94, lane: 1, kind: "block" },
      { row: 95, lane: 0, kind: "gap" },
      { row: 95, lane: 2, kind: "low" },
      { row: 96, lane: 0, kind: "gap" },
      { row: 96, lane: 1, kind: "low" },
      { row: 97, lane: 0, kind: "gap" },
      { row: 97, lane: 2, kind: "low" },
      { row: 98, lane: 0, kind: "block" },
      { row: 98, lane: 1, kind: "block" },
      { row: 99, lane: 0, kind: "low" },
      { row: 99, lane: 2, kind: "block" },
      { row: 100, lane: 1, kind: "block" },
      { row: 100, lane: 2, kind: "gap" },
      { row: 101, lane: 0, kind: "high" },
      { row: 101, lane: 1, kind: "gap" },
      { row: 101, lane: 2, kind: "gap" },
      { row: 102, lane: 1, kind: "gap" },
      { row: 102, lane: 2, kind: "gap" },
      { row: 103, lane: 0, kind: "high" },
      { row: 103, lane: 1, kind: "gap" },
      { row: 103, lane: 2, kind: "gap" },
      { row: 104, lane: 1, kind: "gap" },
      { row: 104, lane: 2, kind: "gap" },
      { row: 105, lane: 1, kind: "block" },
      { row: 105, lane: 2, kind: "gap" },
      { row: 106, lane: 2, kind: "gap" },
      { row: 107, lane: 1, kind: "low" },
      { row: 107, lane: 2, kind: "gap" },
      { row: 108, lane: 0, kind: "block" },
      { row: 108, lane: 2, kind: "gap" },
      { row: 109, lane: 0, kind: "gap" },
      { row: 109, lane: 2, kind: "gap" },
      { row: 110, lane: 0, kind: "gap" },
      { row: 110, lane: 2, kind: "gap" },
      { row: 111, lane: 0, kind: "gap" },
      { row: 111, lane: 2, kind: "block" },
      { row: 112, lane: 0, kind: "gap" },
      { row: 112, lane: 1, kind: "block" },
      { row: 113, lane: 0, kind: "gap" },
      { row: 113, lane: 2, kind: "block" },
      { row: 114, lane: 0, kind: "gap" },
      { row: 114, lane: 1, kind: "block" },
      { row: 115, lane: 0, kind: "gap" },
      { row: 116, lane: 0, kind: "gap" },
      { row: 116, lane: 1, kind: "block" },
      { row: 117, lane: 0, kind: "gap" },
      { row: 117, lane: 2, kind: "low" },
      { row: 118, lane: 0, kind: "gap" },
      { row: 118, lane: 1, kind: "high" },
      { row: 118, lane: 2, kind: "block" },
      { row: 119, lane: 0, kind: "gap" },
      { row: 119, lane: 1, role: "orb", kind: "orbj" },
      { row: 119, lane: 2, kind: "gap" },
      { row: 120, lane: 0, kind: "gap" },
      { row: 120, lane: 2, kind: "gap" },
      { row: 121, lane: 0, kind: "gap" },
      { row: 121, lane: 1, role: "orb", kind: "orbj" },
      { row: 121, lane: 2, kind: "gap" },
      { row: 122, lane: 0, kind: "gap" },
      { row: 122, lane: 2, kind: "block" },
      { row: 123, lane: 0, kind: "gap" },
      { row: 123, lane: 1, kind: "block" },
      { row: 124, lane: 0, kind: "gap" },
      { row: 124, lane: 1, kind: "block" },
      { row: 124, lane: 2, kind: "low" },
      { row: 125, lane: 0, kind: "gap" },
      { row: 125, lane: 1, kind: "block" },
      { row: 126, lane: 0, kind: "gap" },
      { row: 126, lane: 2, kind: "low" },
      { row: 127, lane: 0, kind: "block" },
      { row: 127, lane: 2, kind: "block" },
      // NO hay flip en este nivel: el mecanismo sigue vivo (role "flip", `flipAt`, el porton
      // verde, la tecla `H` para probarlo), pero de cabeza no se lee que tecla es cual y este
      // nivel ya pide bastante. Para volver a ponerlo: { row: [88, 104], role: "flip" }.
    ],
  },

  // NIVEL 2. Arranca siendo lo MINIMO que se puede correr: 4 carriles, fondo vacio y ni un
  // obstaculo. El guion se dicta bailando despues (`Y` graba, `U` exporta), igual que el 1.
  "orbit-motion": {
    schema: "assets/orbit.schema.json",
    audio: "assets/orbit-cut.mp3",
    // CUATRO carriles. El paso sigue siendo 170 (ver `lanesX` en physics.js), o sea que la
    // pista se ensancha de 510 a 680: si el paso bajara a 113 para meter 4 en el ancho viejo,
    // un `high` (w=70, o sea 140 de ancho) se solaparia con el carril de al lado.
    lanes: 4,
    // VELOCIDAD MEDIDA, no copiada. La ventana de cambio de carril es `beat - (d+PLAYER_D)/v`
    // con d=75 (block) y PLAYER_D=28, o sea 103/v de descuento. El nivel 1 corre a 1060 con
    // beat 0.46154s (130bpm): ventana de carril **364.4ms**, la caja te tapa **97.2ms**.
    // Este tiene beat 0.43796s (137bpm), o sea 23.6ms MENOS por fila. Para dejar la MISMA
    // ventana de carril hace falta v = 103 / (0.43796 - 0.36437) = 1399.7, o sea 1400:
    // medido a 1400 la ventana de carril da **364.4ms** (la misma que el nivel 1, 0.02ms de
    // diferencia) y la caja te tapa **73.6ms** (contra 97.2), o sea que el unico efecto de
    // correr mas es que el obstaculo esta menos rato encima: las ventanas no se cierran.
    // El hueco (`gap`, d=130) pasa de 149.1 a **112.9ms** por lo mismo.
    // Lo que SI se acorta es el viaje: 7.07 -> **5.35 beats**, o sea menos que los 7 de
    // `ENTER_BEATS`, asi que la entrada va topada por `enterDz` (medido: termina a 1349 del
    // jugador, 2.20 beats antes del impacto, por dentro de los 1600 de la niebla).
    speed: 1400,
    bg: "#03060a",     // negro casi puro: las dos referencias del fondo son sobre negro
    // ...pero NEGRO PLANO no: medido, el cielo daba luma 7.4 de media y 5.9 pegado al
    // horizonte, o sea que el reactor no tenia nada contra que estar y se leia como un logo
    // pegado en el vacio. `sky` es el resplandor que SALE del horizonte hacia los dos lados
    // (ver `drawSky` en el renderer), y ademas es lo que enciende la cuna de `drawFar`.
    // `up`/`down` son fraccion del alto de pantalla: arriba llega lejos (es cielo) y abajo
    // poco (abajo esta la pista, que tiene que seguir ganandole al fondo).
    // El color es el cyan medio de la familia del nivel, no un azul cualquiera.
    // ...y ese resplandor NO ES EL MISMO EN LAS CUATRO SECCIONES (`mode`). Se reporto que el
    // degradado "es demasiado simple" y que tiene que ser algo que no robe la atencion pero que
    // se mueva con la musica, como el resto del nivel. Son cuatro variantes de la MISMA franja
    // (ni una llamada mas al Graphics, ni geometria nueva): `swell` respira con el metronomo,
    // `shut` se cierra hasta cero al entrar el break, `duck` se AGACHA en cada kick (que es lo
    // que hace que el reactor se recorte contra el cielo justo en el golpe) y `drift` reparte
    // la franja pegada al horizonte en columnas con una onda que da una vuelta por compas.
    // Sin `mode` declarado sale la franja de siempre, y el nivel 1 no declara ni `sky`.
    sky: {
      col: "#0a4f6e", a: 0.42, up: 0.30, down: 0.10,
      mode: { buildup: "swell", break: "shut", drop2: "duck", outro: "drift" },
    },
    // LA DERIVA DE TONO (`hueAt` en este fichero). Se pidio que el color no se quede clavado:
    // 4 beats en el cyan de siempre y despues la paleta ENTERA girando hacia el violeta neon y
    // de vuelta, "un movimiento de tono y no un pase directo a rosa". 16 beats = 4 compases =
    // **7.01s** de ciclo, de los cuales los 4 primeros (1.75s) van quietos. 70 grados es lo
    // que hay del cyan del nivel (`#00d8ff`, tono 209) al violeta neon (279): el pico cae
    // exactamente ahi y no en el rosa, que a un paso de `KILL` no puede ser el decorado.
    hue: { beats: 16, hold: 4, deg: 70 },
    // FONDO VACIO de CAPAS (`layers`: ni estrellas, ni skyline, ni eq). Lo que hay detras son
    // los ANILLOS DE RESONANCIA (`rings`, referencia 4), que no son una capa de `layers`
    // porque no se desplazan de costado: salen del punto de fuga hacia afuera.
    layers: [],
    decor: [
      "mesh", "reactor",       // las dos de siempre: la ola de los costados y el jefe del fondo
      "rings",                 // ref 4: el fondo de resonancia metalica, con parallax
      "hat",                   // el blanco del CONTRATIEMPO (ver `hatAt`)
      "gate",                  // el corte de imagen de los tramos `fx`
      "arcs",                  // ref 3: los rayos electricos sobre los acentos del acid
      "burst",                 // ref 7 + 2: las esquirlas metalicas sobre response/snare
      "rave", "shapes",        // los laseres y las figuras que ya existian, para los acentos
      "rig",                   // el abanico de vigas del nivel 1, ahora en la familia del 2
      "lights",                // las luces de pista de aterrizaje a los costados de los carriles
    ],
    // EL RIG CRUZA EL MUNDO ENTERO y no solo el cielo (se reporto que los laseres del fondo se
    // veian nada mas que en la franja de arriba). Es UN dial y se apaga borrando esta linea:
    // se pidio con la etiqueta de "puede que quiera volver atras", asi que no se toco el orden
    // de dibujo para todos. De aca cuelgan tambien las VARIANTES del abanico (el horizontal de
    // las fotos de referencia): sin el dial solo existe el de arriba, que es el de siempre.
    rigOver: true,
    // `dark`, `beam`, `ghost` y `reactor` NO van aca aunque se dibujen: no son capas del nivel
    // sino TRAMOS (`fx`, por fila). `decor` dice que puede encenderse en todo el nivel y `fx`
    // cuando. El reactor si esta en `decor` porque el tramo solo lo apaga: el nivel 1 no lo
    // tiene declarado y ahi ni existe.
    // LA PALETA DEL NIVEL 2: la familia cyan-verde de las dos referencias (la malla de ondas
    // y el reactor), o sea la MISMA de la que sale `MESH_LO`/`MESH_HI` en el renderer. Antes
    // los divisores de carril, el marco y las bandas del suelo salian del violeta del nivel
    // 1, que no tiene nada que ver con este fondo. `KILL` sigue siendo el de siempre: es lo
    // unico que mata y por eso es lo unico caliente, aca tambien.
    // El `drop2` va al cyan claro (es el tramo en el que se juega) y el resto al cyan medio.
    neon: {
      fam: ["#00d8ff", "#5fe8ff", "#a8ffff", "#3ef2b5"],
      sec: { drop2: "#5fe8ff", break: "#00d8ff" },
      def: "#00d8ff",
      // EL RIG NO SALE DE `fam`: en el nivel 1 sus dos listas estan escritas a mano en el
      // renderer (violeta/cyan/rosa los focos, cyan/violeta/rosa/accentSoft el abanico) y no
      // son `fam`, asi que si el abanico pasara a leer `fam` el nivel 1 cambiaria de color.
      // `rig` es el dial nuevo y su respaldo es exactamente esas dos listas.
      rig: ["#00d8ff", "#3ef2b5", "#a8ffff"],
    },
    // sin `flash` en `decor`: el apagon del break y los blinders violetas son del nivel 1
    // (su break es lo que prepara SU drop). Aca el break no se apaga.
    // canal -> rol. Sin obstaculos todavia: los roles solo alimentan la luz (`pulse`, `beat`)
    // y las lineas numeradas del modo diseno, que es lo que se referencia para dictar.
    map: {
      // el pulso: 32 golpes, 31 en el buildup y en filas impares, y 23 de sus 31 huecos miden
      // exactamente 2.00 beats. Es un metronomo a la blanca, o sea lo unico que puede hacer
      // de kick. Medido: `pulse` > 0.05 el 55% del buildup.
      bass: { role: "bg" },
      // la linea: 60 eventos y lo UNICO que suena en el drop2 (28 de 28). Su cadencia es de
      // frase, no de acento (hueco mediano 0.86 beats en el buildup y 1.30 en el drop2), asi
      // que `markWin` no da el destello de un beat por compas del nivel 1 sino una luz que se
      // enciende con la frase. Medido: abierta el 40% del buildup, 27% del break y 69% del
      // drop2. Para esta malla eso es lo que se quiere: respira con la linea.
      acid: { role: "mark" },
      // rafagas, no pulso: response1 mete 3 golpes en la f10 y 2 en la f11 y despues NADA
      // durante 71.32 beats; response2 mete 3 en la f19 y despues nada durante 55.38; el
      // snare mete 5 entre la f32 y la f34 y despues nada durante 32.32. De marca dejarian el
      // nivel a oscuras compases enteros. De "fx" barren y quedan numeradas para dictar.
      response1: { role: "fx" },
      response2: { role: "fx" },
      snare: { role: "fx" },
      // sus 2 eventos caen en la f63 y la f66, o sea DENTRO del break y justo antes del drop2
      // (f67): es el aviso, y es el momento en el que habla el cantante. De ahi vuelan las
      // LETRAS (`fx: "acid"` -> `drawAcid`), igual que en el break del nivel 1.
      // La `dur` la pone el rol porque el schema no trae ninguna (ver `cues`), y sin ella
      // `fxAt` no devuelve progreso y las letras no se mueven.
      // `every: 2` = SOLO EL PRIMERO. Los dos eventos caen en t=27.706 (#77, f63) y t=29.334
      // (#79, f66), o sea a 1.628s = 3.72 beats uno del otro, y el drop2 arranca en 29.642:
      // con los dos puestos el segundo corria hasta 31.534, o sea **4.3 beats DENTRO del drop**,
      // y por eso la frase se repetia justo en los primeros beats del drop (reportado).
      // `dur` 1.65 y no 2.2: 27.706 + 1.65 = **29.356**, o sea que la ultima letra se apaga
      // 27ms antes del golpe de snare de la f66 (29.383), que es lo que abre el `snap`.
      "let the bass quick down": { role: "fx", fx: "acid", dur: 1.65, every: 2 },
    },
    // la frase que vuela, por nivel (el 1 se queda con "THIS IS ACID", que es lo que decia el
    // renderer antes de existir el dial).
    // Sale del NOMBRE DEL CANAL, no de escribirla a mano: el tag del schema es literalmente
    // "let the bass quick down" y por escribirla a mano se habia colado "LET THE BASS DOWN",
    // sin el QUICK (reportado). Son 23 caracteres, o sea que entra en el pool de 24 sin que
    // `slice(0, MAX_ACID)` corte nada.
    acid: "LET THE BASS QUICK DOWN",
    // ESTILO Y GESTO DE LAS LETRAS, por nivel. El nivel 1 no lo declara (respaldo `null`), o
    // sea que ahi sigue el pool de `create()` tal cual (mono bold 48px lime) y el gesto de
    // siempre (vienen de lejos, frenan escalonadas y revientan hacia la camara).
    // Aca el break es NEGRO ENTERO (`fx` de tipo `dark`, f63-f67): las letras son objetos de
    // texto, o sea lo unico que se ve en 2.47s, y por eso ni la fuente ni el gesto pueden ser
    // los del nivel 1, donde hay un nivel entero detras del que hay que despegarse.
    acidFx: {
      move: "stamp",
      // 42 y no 36: la fuente nueva es proporcional. Cada letra va CENTRADA en su ranura, o
      // sea que el choque es (ancho[i] + ancho[i+1])/2 contra el paso. Medido sobre Impact
      // (fontTools, upm 2048: W=0.814em, O=0.546, media 0.52) el peor par de la frase es OW:
      // a 52px son 38.0px de tinta contra 41.0px de paso, o sea +3.0px de holgura. La frase
      // entera mide 902px de un cuadro de 1248 (72.3%; la del nivel 1 mide el 62.0%).
      gap: 42,
      // Sin ficheros de fuente nuevos: `index.html` no carga ni uno (`FONTS.mono` ya cae al
      // monospace del navegador). Impact esta en el sistema (mac y windows) y es condensado y
      // macizo, o sea lo contrario de una mono. El respaldo NO puede ser Arial Black: medido,
      // su par OW se pasa 10.2px del paso; 'Arial Narrow' entra con +1.6px.
      // El estilo va COMPLETO a proposito (family, size, color, fontStyle, stroke, shadow):
      // `setStyle` mezcla sobre lo que ya tiene el objeto, y el pool viene en `bold`, que en
      // Impact seria un negrita fingida y mas ancha que lo medido.
      style: {
        fontFamily: "Impact, Haettenschweiler, 'Arial Narrow', sans-serif",
        fontSize: "52px", fontStyle: "", color: "#a8ffff",
        stroke: "#00d8ff", strokeThickness: 4,
        shadow: { offsetX: 0, offsetY: 0, color: "#00d8ff", blur: 22, stroke: true, fill: true },
      },
    },
    // LA CRECIENTE (`hypeAt`). Filas: buildup f0-f60, break f61-f66, drop2 f67-f98,
    // outro f99-f164. De aca cuelgan el tamano del reactor, los anillos del fondo, la
    // frecuencia de los rayos y el alcance de las esquirlas.
    // El break CAE a 0.12 a proposito: es donde habla el cantante y donde vuelan las letras,
    // o sea que si el decorado se quedara arriba no se leeria ni una. El drop2 entra de golpe
    // en 1 (un tramo de una fila) porque un drop no es una rampa: es un corte.
    // aca EL drop es el `drop2`: esta cancion no tiene ninguna seccion llamada "drop"
    dropSec: "drop2",
    // Las filas salen de las SECCIONES medidas, no a ojo: buildup f0-f61, break f62-f67,
    // drop2 f68-f99, outro f100-f164 (la seccion de una fila se mira a mitad de beat).
    // El break NO cae de una: se reporto que "todos los efectos del buildup se paran en el
    // #73" (f60) cuando tienen que llegar hasta el **#78** (f63, el primer "let the bass"),
    // asi que la creciente se queda ARRIBA (a=b=1) hasta la f63 y recien de la f64 a la f67
    // cae a 0.12 para dejar leer las letras.
    hype: [
      { from: 0, to: 61, a: 0, b: 1 },
      { from: 62, to: 63, a: 1, b: 1 },
      { from: 64, to: 67, a: 1, b: 0.12 },
      { from: 68, to: 68, a: 1, b: 1 },
      { from: 100, to: 164, a: 1, b: 0.2 },
    ],
    // TRAMOS DE EFECTO POR FILA (ver `fxOfRow`). Los dos son GATE, o sea imagen cortada a
    // tiempo, y los dos salen de donde el schema ya tenia una rafaga marcada:
    //  - la del `response1` (#7 f10 arranque, #9 f10 medio, #11 f11 final) y de ahi hasta el
    //    final de SU sector del suelo, la f19: el gate es el tramo, la rafaga es el aviso.
    //  - la del `snare` (#30 #31 #32 #34 #35, f32-f34; el #33 de en medio es un `bass`), con
    //    el corte al doble de rapido y sin cerrar del todo (`floor` 0.08): son 5 golpes en 3
    //    filas y a negro seco se lee como que se cuelga el juego.
    fx: [
      // los dos tramos de RAFAGA que ya tenian el tajo (#7 response1, #30-#35 snare).
      // El primero DURA LA RAFAGA Y NADA MAS: el `response1` mete sus 5 golpes en la f10 y la
      // f11 y despues no suena nada durante 71.32 beats, o sea que estirarlo hasta la f19 (el
      // final de su sector del suelo) dejaba **8 filas de tajo sobre silencio**, que es el
      // "despues del #12 el gate se queda y queda tonto" que se reporto (#12 = f11). El #17
      // (f19) es el `response2` y se lleva su propia fila.
      { kind: "gate", from: 10, to: 11, div: 4, cut: 0.18 },
      { kind: "gate", from: 19, to: 19, div: 4, cut: 0.18 },
      { kind: "gate", from: 32, to: 35, div: 8, cut: 0.12, floor: 0.08 },
      // y desde el **#38** (f36, el primer acid del segundo par) el tajo se vuelve loco EN
      // CRECIENTE hasta el final del buildup: arranca comiendose el 5% de cada semicorchea y
      // termina comiendose el 34%, o sea que el gate mismo es la rampa. Llega hasta la **f62**
      // y no hasta la f60: el buildup tiene que seguir vivo hasta el #78 (f63).
      { kind: "gate", from: 36, to: 62, div: 4, cut: 0.05, ramp: 0.34 },
      // LA PANTALLA POR CUATRO, para probar. La misma escena en una grilla 2x2 (ver `setGrid` en
      // el renderer: no se dibuja nada dos veces, se duplican las CAMARAS).
      // La f24-f31 no es un sitio cualquiera: son los compases 6 y 7 ENTEROS (medido, la f24 cae
      // en el 6.000 de la grilla de compases y la f32 en el 8.000) y son las unicas 8 filas del
      // buildup donde no hay declarado nada mas. Medido: el buildup tiene tres tramos sin gate
      // (f0-f9, f12-f18, f20-f31) y de los tres este es el unico que ademas no lleva marcas,
      // porque las 4 del f20-f31 son la ENTRADA de la linea del acid (#20-#24, f20-f23) y pisarlas
      // seria tapar lo que el tramo viene a presentar. De la f24 a la f31 quedan 4 golpes de
      // `bass` y nada mas, o sea el metronomo: el sitio donde la cancion aguanta la respiracion
      // antes de la rafaga de snare de la f32. 8 filas = 3.504s, lo que se tarda en registrar que
      // son cuatro cuadros y no uno. La cancion entera en 2x2 es inmirable, y por eso esto es un
      // tramo y no un `decor`.
      { kind: "grid", from: 24, to: 31 },
      // EL APAGON del break: es donde habla el cantante y donde vuelan las letras. Las letras
      // son objetos de TEXTO de Phaser, o sea que sobreviven al negro (igual que el HUD).
      // Arranca en la **f63** (el #78, donde entra la frase) y no en la f62: el buildup se
      // queda encendido un compas mas.
      { kind: "dark", from: 63, to: 67 },
      // EL FOGONAZO DEL SNARE (#79/#80, f66): un frame de RAYOS + REACTOR en FANTASMA sobre el
      // apagon, o sea el aviso del drop. Es su propio tramo y no una capa de `decor` porque
      // dura una fila: lo que hace es FORZAR el reactor, los rayos y el fantasma dentro del
      // `dark`, que es donde ninguno de los tres estaria.
      { kind: "snap", from: 66, to: 66 },
      // el reactor NO EXISTE hasta el drop: aparece con el, que es lo que lo hace un jefe.
      { kind: "reactor", from: 68, to: 164 },
      // el haz que sale del nucleo: recto por la pista en el drop, y en el outro en anillo.
      { kind: "beam", from: 68, to: 89, mode: 0 },
      { kind: "beam", from: 90, to: 164, mode: 1 },
      // y de la f90 para adelante el nivel entero va en FANTASMA (blanco y negro, solo lineas)
      { kind: "ghost", from: 90, to: 164 },
      // EL TIRON DE LAS HELICES. Se pidio "del #86 al #89" y "lo mismo en el #106, para el otro
      // lado y el mismo tiempo". Medido: el #86 cae en 32.900s (f75), el #89 en 33.663s (f76) y
      // el #106 en 40.011s (f91), o sea que el primer tramo son las filas 75-76 y el segundo,
      // para que dure lo mismo, las 91-92. **0.876s cada uno** (2 filas de 0.43796).
      { kind: "spin", from: 75, to: 76, dir: 1 },
      { kind: "spin", from: 91, to: 92, dir: -1 },
      // LA SACUDIDA DE CADA MARCA DEL ACID (`jolt`), todo el drop2: ver `markN`.
      // EL NEGATIVO: la imagen entera con los colores dados vuelta, un tajo por BEAT y en
      // creciente (`cut` -> `ramp`, el mismo motor que el gate, o sea la fase sale de la grilla
      // y rebobinar la rebobina). Va en la f20-f31 porque es la corrida mas larga del nivel SIN
      // ningun tramo `fx` (12 filas, 5.26s; las otras dos son f0-f9 y f12-f18) y porque ahi entra
      // el acid (f20-f23) y despues se calla 11 filas. No PUEDE pisar un `gate`, un `dark` ni un
      // `ghost`: los tres son negro o blanco a pantalla completa por la misma puerta del Graphics,
      // o sea que el negativo les daria vuelta el color y el apagon saldria blanco entero.
      // Medido: f20 53ms invertido (3.2 frames a 60fps) -> f31 149ms (8.9), 23.0% del tramo y
      // 2.28 destellos/s, por debajo de los 3/s de WCAG 2.3.1. `cut: 1` seria macizo: es UN dial.
      { kind: "neg", from: 20, to: 31, div: 1, cut: 0.12, ramp: 0.34 },
      { kind: "jolt", from: 68, to: 99 },
    ],
    // QUE LATE CON QUE, por seccion (ver el nivel 1). Medido evento a evento:
    //   buildup: 31 bass + 30 acid -> va con la MARCA (el acido), como el buildup del 1.
    //   break:   1 bass y 2 acid en 2.47s -> "bg", o sea casi nada late, que es lo que se
    //            quiere en un break.
    //   drop2:   28 acid y CERO bass -> tiene que ser "mark" o no late nada.
    //   outro:   1 solo evento (un response1) en 28.6s, o sea que **pase el rol que pase
    //            `beat` vale 0 el 100% del outro**: 65 beats sin marcar. La malla y el
    //            reactor tienen que leer la fase del beat de la GRILLA (que existe siempre:
    //            es funcion de songT) y usar `beat`/`pulse` solo como acento encima.
    glow: { buildup: "mark", break: "bg", drop2: "mark", outro: "bg" },
    // ...y por eso este nivel late ademas con el METRONOMO DE LA GRILLA (`gridAt` en este
    // fichero): `this.lat` = max(lo que suena, el metronomo), o sea que la malla y las bandas
    // del suelo respiran las 72s y las senales quedan de acento. Sin esto la malla estaba
    // CONGELADA el 59% del nivel (medido: 42.7s de 72.31 con `pulse` <= 0.05).
    // `metro` NO es un si/no: es el TECHO del metronomo, y por eso vale 0.45 y no 1. Con 1 el
    // metronomo llegaba tan alto como una senal, o sea que la SENAL solo mandaba el 21.5% del
    // nivel (medido a 60Hz: 0% del outro) y el otro 78.5% era metronomo puro. Consecuencia
    // medida: `lat` medio 0.458 buildup / 0.365 break / 0.566 drop2 / 0.332 outro, o sea que
    // entre la seccion mas floja y el drop habia un 70% y la amplitud de la ola solo cambiaba
    // un 20%; y el p95 daba 0.94 en TODAS (el pico del buildup salia igual de brillante que el
    // del drop). Con el techo en 0.45 el metronomo es el PISO (la ola nunca se congela) y la
    // senal el TECHO: la senal manda el **33.4%** del nivel y `lat` pasa a **0.319 / 0.195 /
    // 0.460 / 0.150**, o sea drop2 x1.4 sobre el buildup y **x3.1 sobre el outro**, con p95
    // 0.857 / 0.446 / 0.918 / 0.406. El nivel 1 no declara `metro` (vale 0), o sea que ahi
    // `lat === beat` y no cambia un pixel.
    metro: 0.45,
    // LA OLA POR SECCION (`drawMesh`). Se reporto que "no se ve reactiva": su alpha solo
    // dependia del latido, o sea la misma agua de punta a punta. `a` es el factor al empezar la
    // seccion y `to` al terminarla (rampa lineal dentro de la seccion), y `mode` que forma usa
    // `meshWave`. El buildup entra opaco y se va APAGANDO hacia el apagon (1.35 -> 0.15), el
    // break la deja en 0 (ahi la pantalla es negra igual) y el drop2 la devuelve entera y con
    // la OTRA ola (`mode` 1: el doble de crestas en z y la deriva al reves). El nivel 1 no
    // declara `wave`, o sea a=1 y mode=0: lo que el renderer hacia antes del dial.
    wave: {
      buildup: { a: 1.35, to: 0.15 },
      // el break YA NO la borra de una: la seccion arranca a mitad de la f62 y los efectos del
      // buildup tienen que llegar al #78 (f63), asi que se apaga DENTRO del break (1.2 -> 0) y
      // para cuando entra el apagon ya no queda nada que tapar.
      break: { a: 1.2, to: 0 },
      // `shape: "pyra"` = las crestas se rellenan como caras de piramide (ver `drawMesh`). Solo
      // en el drop: en el buildup la ola se queda como esta, que es lo que se pidio.
      drop2: { a: 1.35, mode: 1, shape: "pyra" },
      outro: { a: 1.2, to: 0.45, mode: 1 },
    },
    // COMO ENTRA el obstaculo, por seccion. Todavia no hay obstaculos: queda declarado para
    // que el dia que se dicte el guion no entren todos igual, y para que no falte una seccion.
    enter: { buildup: "side", break: "wide", drop2: "slam", outro: "grow" },
    // SECTORES del suelo (solo color de las bandas). 165 filas: f0..f164, medido con
    // `rowAt(len - 1e-9)`; la f165 arrancaria justo en el corte.
    // Cortados por COMPASES enteros (4 filas) y pegados a las secciones, que caen en las
    // filas 61.94 (buildup/break), 67.57 (break/drop2) y 99.76 (drop2/outro):
    //   f0-f59   buildup, cada 20 filas (5 compases), igual que el nivel 1
    //   f60-f67  el break, con las 2 filas de cola del buildup: 2 compases
    //   f68-f99  el drop2, cada 16 filas (4 compases)
    //   f100-164 el outro, cada 20 filas; el ultimo tramo se queda con la fila suelta (165
    //            no es multiplo de 4, o sea que f164 es el resto del corte).
    sectors: [
      { from: 0, to: 19, color: "#0d5a5a" },
      { from: 20, to: 39, color: "#0e7a72" },
      { from: 40, to: 59, color: "#12a08c" },
      { from: 60, to: 67, color: "#0b3a55" },
      { from: 68, to: 83, color: "#00d8ff" },
      { from: 84, to: 99, color: "#5fe8ff" },
      { from: 100, to: 119, color: "#2f8fbf" },
      { from: 120, to: 139, color: "#1f6f9f" },
      { from: 140, to: 159, color: "#164f78" },
      { from: 160, to: 164, color: "#0b2f4a" },
    ],
    zones: [],
    // EL GUION, dictado bailando (`Y` / `U`) sobre la corrida del 01/08 y pegado aca.
    // Es el NEGATIVO de esa corrida: 130 de sus 163 filas dejan un solo carril libre, que es
    // por donde paso. Tres ediciones sobre el volcado crudo, ninguna de diseno:
    //  - la f165 se tiro (3 directivas): `rowAt(len - 1e-9)` da 164, o sea que la f165
    //    arranca justo en el corte y sus cajas llegan cuando la cancion ya termino.
    //  - el APAGON va vacio (17 directivas, f63-f67): el `dark` es negro entero y ahi pedia
    //    dos slides (f63 carril 2, f64 carril 1) y tres filas de un solo carril libre. Es la
    //    misma regla que el break del nivel 1, donde esta medido que no hay ni un obstaculo.
    //    La f62 SI se queda: es break pero todavia esta encendida (el `dark` arranca en la
    //    f63) y su gate cierra 34.0% del beat en 4 trozos de 37ms, o sea parpadeo y no negro.
    //  - las 24 PAREDES de 5+ cajas seguidas se vaciaron por dentro (288 cajas -> `gap`),
    //    con el mismo patron exacto del nivel 1 (B + huecos + B, medido sobre su script:
    //    f4:BggggggB, f108:BggggggggggggggggggB...). No ablanda nada: la zanja mas corta que
    //    queda es de 3 y a v=1400 ni siquiera una de 2 se cruza (551ms de zanja contra 455ms
    //    de aire; una de 3 son 989ms). Lo que se gana es ver la pista: 78% de la pista tapada
    //    por cajas macizas no deja leer el nivel que hay detras.
    // Medido con el solver por filas de `test-music.js` a v=1400 y 4 carriles: pasable con
    // g=1 y con g=-1, sin bajar de 7 estados vivos en ninguna fila.
    // 488 directivas: 170 block, 288 gap, 15 low, 12 high, 3 jump orb.
    script: [
      { row: 3, lane: 1, kind: "block" },
      { row: 3, lane: 2, kind: "block" },
      { row: 3, lane: 3, kind: "block" },
      { row: 4, lane: 1, kind: "block" },
      { row: 4, lane: 2, kind: "block" },
      { row: 4, lane: 3, kind: "gap" },
      { row: 5, lane: 0, kind: "block" },
      { row: 5, lane: 2, kind: "block" },
      { row: 5, lane: 3, kind: "gap" },
      { row: 6, lane: 0, kind: "block" },
      { row: 6, lane: 1, kind: "block" },
      { row: 6, lane: 3, kind: "gap" },
      { row: 7, lane: 0, kind: "block" },
      { row: 7, lane: 2, kind: "block" },
      { row: 7, lane: 3, kind: "gap" },
      { row: 8, lane: 1, kind: "block" },
      { row: 8, lane: 2, kind: "block" },
      { row: 8, lane: 3, kind: "gap" },
      { row: 9, lane: 0, kind: "block" },
      { row: 9, lane: 2, kind: "block" },
      { row: 9, lane: 3, kind: "gap" },
      { row: 10, lane: 0, kind: "gap" },
      { row: 10, lane: 1, kind: "block" },
      { row: 10, lane: 3, kind: "gap" },
      { row: 11, lane: 0, kind: "gap" },
      { row: 11, lane: 2, kind: "block" },
      { row: 11, lane: 3, kind: "gap" },
      { row: 12, lane: 0, kind: "gap" },
      { row: 12, lane: 1, kind: "block" },
      { row: 12, lane: 3, kind: "gap" },
      { row: 13, lane: 0, kind: "block" },
      { row: 13, lane: 2, kind: "low" },
      { row: 13, lane: 3, kind: "gap" },
      { row: 14, lane: 1, kind: "block" },
      { row: 14, lane: 2, kind: "block" },
      { row: 14, lane: 3, kind: "gap" },
      { row: 15, lane: 0, kind: "block" },
      { row: 15, lane: 2, kind: "block" },
      { row: 15, lane: 3, kind: "gap" },
      { row: 16, lane: 0, kind: "block" },
      { row: 16, lane: 1, kind: "block" },
      { row: 16, lane: 3, kind: "gap" },
      { row: 17, lane: 0, kind: "block" },
      { row: 17, lane: 2, kind: "block" },
      { row: 17, lane: 3, kind: "gap" },
      { row: 18, lane: 1, kind: "block" },
      { row: 18, lane: 2, kind: "block" },
      { row: 18, lane: 3, kind: "gap" },
      { row: 19, lane: 0, kind: "block" },
      { row: 19, lane: 2, kind: "block" },
      { row: 19, lane: 3, kind: "gap" },
      { row: 20, lane: 0, kind: "gap" },
      { row: 20, lane: 1, kind: "low" },
      { row: 20, lane: 2, kind: "block" },
      { row: 20, lane: 3, kind: "gap" },
      { row: 21, lane: 0, kind: "gap" },
      { row: 21, lane: 1, kind: "block" },
      { row: 21, lane: 3, kind: "gap" },
      { row: 22, lane: 0, kind: "gap" },
      { row: 22, lane: 2, kind: "block" },
      { row: 22, lane: 3, kind: "gap" },
      { row: 23, lane: 0, kind: "gap" },
      { row: 23, lane: 2, kind: "block" },
      { row: 23, lane: 3, kind: "gap" },
      { row: 24, lane: 0, kind: "gap" },
      { row: 24, lane: 2, kind: "block" },
      { row: 24, lane: 3, kind: "gap" },
      { row: 25, lane: 0, kind: "gap" },
      { row: 25, lane: 2, kind: "block" },
      { row: 25, lane: 3, kind: "gap" },
      { row: 26, lane: 0, kind: "gap" },
      { row: 26, lane: 1, kind: "block" },
      { row: 26, lane: 3, kind: "gap" },
      { row: 27, lane: 0, kind: "gap" },
      { row: 27, lane: 1, kind: "gap" },
      { row: 27, lane: 2, kind: "low" },
      { row: 27, lane: 3, kind: "block" },
      { row: 28, lane: 0, kind: "gap" },
      { row: 28, lane: 1, kind: "gap" },
      { row: 28, lane: 2, kind: "block" },
      { row: 29, lane: 0, kind: "gap" },
      { row: 29, lane: 1, kind: "gap" },
      { row: 29, lane: 3, kind: "block" },
      { row: 30, lane: 0, kind: "gap" },
      { row: 30, lane: 1, kind: "gap" },
      { row: 30, lane: 2, kind: "high" },
      { row: 30, lane: 3, kind: "gap" },
      { row: 31, lane: 0, kind: "gap" },
      { row: 31, lane: 1, kind: "gap" },
      { row: 31, lane: 3, kind: "gap" },
      { row: 32, lane: 0, kind: "gap" },
      { row: 32, lane: 1, kind: "block" },
      { row: 32, lane: 2, kind: "high" },
      { row: 32, lane: 3, kind: "gap" },
      { row: 33, lane: 0, kind: "gap" },
      { row: 33, lane: 1, kind: "low" },
      { row: 33, lane: 3, kind: "gap" },
      { row: 34, lane: 0, kind: "gap" },
      { row: 34, lane: 2, kind: "block" },
      { row: 34, lane: 3, kind: "gap" },
      { row: 35, lane: 0, kind: "gap" },
      { row: 35, lane: 2, kind: "block" },
      { row: 35, lane: 3, kind: "gap" },
      { row: 36, lane: 0, kind: "gap" },
      { row: 36, lane: 1, kind: "block" },
      { row: 36, lane: 3, kind: "gap" },
      { row: 37, lane: 0, kind: "block" },
      { row: 37, lane: 1, kind: "gap" },
      { row: 37, lane: 3, kind: "gap" },
      { row: 38, lane: 1, kind: "gap" },
      { row: 38, lane: 2, kind: "block" },
      { row: 38, lane: 3, kind: "gap" },
      { row: 39, lane: 0, kind: "block" },
      { row: 39, lane: 1, kind: "gap" },
      { row: 39, lane: 3, kind: "gap" },
      { row: 40, lane: 0, kind: "gap" },
      { row: 40, lane: 1, kind: "block" },
      { row: 40, lane: 2, kind: "low" },
      { row: 40, lane: 3, kind: "gap" },
      { row: 41, lane: 0, kind: "gap" },
      { row: 41, lane: 2, kind: "block" },
      { row: 41, lane: 3, kind: "gap" },
      { row: 42, lane: 0, kind: "gap" },
      { row: 42, lane: 2, kind: "block" },
      { row: 42, lane: 3, kind: "gap" },
      { row: 43, lane: 0, kind: "gap" },
      { row: 43, lane: 1, kind: "low" },
      { row: 43, lane: 2, kind: "block" },
      { row: 43, lane: 3, kind: "gap" },
      { row: 44, lane: 0, kind: "gap" },
      { row: 44, lane: 1, kind: "block" },
      { row: 44, lane: 3, kind: "block" },
      { row: 45, lane: 0, kind: "gap" },
      { row: 45, lane: 1, kind: "block" },
      { row: 45, lane: 2, kind: "block" },
      { row: 46, lane: 0, kind: "gap" },
      { row: 46, lane: 2, kind: "block" },
      { row: 46, lane: 3, kind: "block" },
      { row: 47, lane: 0, kind: "gap" },
      { row: 47, lane: 1, kind: "block" },
      { row: 47, lane: 3, kind: "block" },
      { row: 48, lane: 0, kind: "gap" },
      { row: 48, lane: 1, kind: "block" },
      { row: 49, lane: 0, kind: "gap" },
      { row: 49, lane: 3, kind: "block" },
      { row: 50, lane: 0, kind: "gap" },
      { row: 50, lane: 1, kind: "block" },
      { row: 50, lane: 3, kind: "gap" },
      { row: 51, lane: 0, kind: "gap" },
      { row: 51, lane: 2, kind: "block" },
      { row: 51, lane: 3, kind: "gap" },
      { row: 52, lane: 0, kind: "gap" },
      { row: 52, lane: 1, kind: "block" },
      { row: 52, lane: 3, kind: "gap" },
      { row: 53, lane: 0, kind: "gap" },
      { row: 53, lane: 1, kind: "block" },
      { row: 53, lane: 2, role: "orb", kind: "orbj" },
      { row: 53, lane: 3, kind: "gap" },
      { row: 54, lane: 0, kind: "gap" },
      { row: 54, lane: 1, kind: "block" },
      { row: 54, lane: 2, kind: "low" },
      { row: 54, lane: 3, kind: "gap" },
      { row: 55, lane: 0, kind: "block" },
      { row: 55, lane: 2, kind: "block" },
      { row: 55, lane: 3, kind: "gap" },
      { row: 56, lane: 1, kind: "block" },
      { row: 56, lane: 2, kind: "block" },
      { row: 56, lane: 3, kind: "gap" },
      { row: 57, lane: 0, kind: "block" },
      { row: 57, lane: 2, kind: "block" },
      { row: 57, lane: 3, kind: "gap" },
      { row: 58, lane: 0, kind: "gap" },
      { row: 58, lane: 1, kind: "block" },
      { row: 58, lane: 3, kind: "gap" },
      { row: 59, lane: 0, kind: "gap" },
      { row: 59, lane: 1, kind: "gap" },
      { row: 59, lane: 3, kind: "gap" },
      { row: 60, lane: 0, kind: "gap" },
      { row: 60, lane: 1, kind: "gap" },
      { row: 60, lane: 3, kind: "gap" },
      { row: 61, lane: 0, kind: "gap" },
      { row: 61, lane: 1, kind: "gap" },
      { row: 61, lane: 2, kind: "high" },
      { row: 61, lane: 3, kind: "gap" },
      { row: 62, lane: 0, kind: "block" },
      { row: 62, lane: 1, kind: "block" },
      { row: 62, lane: 2, kind: "high" },
      { row: 62, lane: 3, kind: "block" },
      { row: 68, lane: 0, kind: "block" },
      { row: 68, lane: 2, kind: "block" },
      { row: 68, lane: 3, kind: "block" },
      { row: 69, lane: 0, kind: "block" },
      { row: 69, lane: 2, kind: "block" },
      { row: 69, lane: 3, kind: "gap" },
      { row: 70, lane: 0, kind: "block" },
      { row: 70, lane: 2, kind: "low" },
      { row: 70, lane: 3, kind: "gap" },
      { row: 71, lane: 1, kind: "block" },
      { row: 71, lane: 2, kind: "block" },
      { row: 71, lane: 3, kind: "gap" },
      { row: 72, lane: 0, kind: "block" },
      { row: 72, lane: 2, kind: "block" },
      { row: 72, lane: 3, kind: "gap" },
      { row: 73, lane: 0, kind: "gap" },
      { row: 73, lane: 1, kind: "low" },
      { row: 73, lane: 2, kind: "block" },
      { row: 73, lane: 3, kind: "gap" },
      { row: 74, lane: 0, kind: "gap" },
      { row: 74, lane: 1, kind: "block" },
      { row: 74, lane: 3, kind: "gap" },
      { row: 75, lane: 0, kind: "gap" },
      { row: 75, lane: 1, kind: "block" },
      { row: 75, lane: 2, kind: "low" },
      { row: 75, lane: 3, kind: "gap" },
      { row: 76, lane: 0, kind: "block" },
      { row: 76, lane: 2, kind: "block" },
      { row: 76, lane: 3, kind: "gap" },
      { row: 77, lane: 1, kind: "block" },
      { row: 77, lane: 2, kind: "gap" },
      { row: 77, lane: 3, kind: "gap" },
      { row: 78, lane: 1, kind: "block" },
      { row: 78, lane: 2, kind: "gap" },
      { row: 78, lane: 3, kind: "gap" },
      { row: 79, lane: 1, kind: "block" },
      { row: 79, lane: 2, kind: "gap" },
      { row: 79, lane: 3, kind: "gap" },
      { row: 80, lane: 0, kind: "block" },
      { row: 80, lane: 2, kind: "gap" },
      { row: 80, lane: 3, kind: "gap" },
      { row: 81, lane: 0, kind: "gap" },
      { row: 81, lane: 1, role: "orb", kind: "orbj" },
      { row: 81, lane: 2, kind: "gap" },
      { row: 81, lane: 3, kind: "gap" },
      { row: 82, lane: 0, kind: "gap" },
      { row: 82, lane: 2, kind: "block" },
      { row: 82, lane: 3, kind: "gap" },
      { row: 83, lane: 0, kind: "gap" },
      { row: 83, lane: 1, kind: "block" },
      { row: 83, lane: 3, kind: "gap" },
      { row: 84, lane: 0, kind: "gap" },
      { row: 84, lane: 1, kind: "block" },
      { row: 84, lane: 3, kind: "block" },
      { row: 85, lane: 0, kind: "gap" },
      { row: 85, lane: 1, kind: "block" },
      { row: 85, lane: 2, kind: "block" },
      { row: 86, lane: 0, kind: "gap" },
      { row: 86, lane: 1, kind: "block" },
      { row: 86, lane: 3, kind: "block" },
      { row: 87, lane: 0, kind: "gap" },
      { row: 87, lane: 2, kind: "block" },
      { row: 87, lane: 3, kind: "gap" },
      { row: 88, lane: 0, kind: "gap" },
      { row: 88, lane: 1, kind: "block" },
      { row: 88, lane: 3, kind: "gap" },
      { row: 89, lane: 0, kind: "block" },
      { row: 89, lane: 2, kind: "block" },
      { row: 89, lane: 3, kind: "gap" },
      { row: 90, lane: 1, kind: "block" },
      { row: 90, lane: 2, kind: "block" },
      { row: 90, lane: 3, kind: "gap" },
      { row: 91, lane: 2, kind: "block" },
      { row: 91, lane: 3, kind: "gap" },
      { row: 92, lane: 2, kind: "block" },
      { row: 92, lane: 3, kind: "gap" },
      { row: 93, lane: 0, kind: "block" },
      { row: 93, lane: 1, kind: "block" },
      { row: 93, lane: 3, kind: "block" },
      { row: 94, lane: 0, kind: "gap" },
      { row: 94, lane: 1, kind: "block" },
      { row: 94, lane: 2, kind: "block" },
      { row: 95, lane: 0, kind: "gap" },
      { row: 95, lane: 1, kind: "block" },
      { row: 95, lane: 3, kind: "low" },
      { row: 96, lane: 0, kind: "gap" },
      { row: 96, lane: 2, kind: "block" },
      { row: 96, lane: 3, kind: "block" },
      { row: 97, lane: 0, kind: "gap" },
      { row: 97, lane: 1, kind: "high" },
      { row: 97, lane: 2, kind: "block" },
      { row: 97, lane: 3, kind: "gap" },
      { row: 98, lane: 0, kind: "gap" },
      { row: 98, lane: 1, kind: "block" },
      { row: 98, lane: 3, kind: "gap" },
      { row: 99, lane: 0, kind: "gap" },
      { row: 99, lane: 2, kind: "block" },
      { row: 99, lane: 3, kind: "gap" },
      { row: 100, lane: 0, kind: "gap" },
      { row: 100, lane: 2, kind: "block" },
      { row: 100, lane: 3, kind: "gap" },
      { row: 101, lane: 0, kind: "gap" },
      { row: 101, lane: 1, kind: "block" },
      { row: 101, lane: 2, kind: "high" },
      { row: 101, lane: 3, kind: "gap" },
      { row: 102, lane: 0, kind: "gap" },
      { row: 102, lane: 2, kind: "block" },
      { row: 102, lane: 3, kind: "gap" },
      { row: 103, lane: 0, kind: "gap" },
      { row: 103, lane: 1, kind: "high" },
      { row: 103, lane: 2, kind: "block" },
      { row: 103, lane: 3, kind: "gap" },
      { row: 104, lane: 0, kind: "gap" },
      { row: 104, lane: 1, kind: "block" },
      { row: 104, lane: 3, kind: "block" },
      { row: 105, lane: 0, kind: "gap" },
      { row: 105, lane: 1, kind: "block" },
      { row: 105, lane: 2, kind: "block" },
      { row: 106, lane: 0, kind: "gap" },
      { row: 106, lane: 1, kind: "block" },
      { row: 106, lane: 3, kind: "block" },
      { row: 107, lane: 0, kind: "gap" },
      { row: 107, lane: 2, kind: "block" },
      { row: 107, lane: 3, kind: "gap" },
      { row: 108, lane: 0, kind: "block" },
      { row: 108, lane: 1, kind: "high" },
      { row: 108, lane: 2, kind: "gap" },
      { row: 108, lane: 3, kind: "gap" },
      { row: 109, lane: 1, kind: "block" },
      { row: 109, lane: 2, kind: "gap" },
      { row: 109, lane: 3, kind: "gap" },
      { row: 110, lane: 0, kind: "high" },
      { row: 110, lane: 1, kind: "block" },
      { row: 110, lane: 2, kind: "gap" },
      { row: 110, lane: 3, kind: "gap" },
      { row: 111, lane: 0, kind: "block" },
      { row: 111, lane: 1, kind: "high" },
      { row: 111, lane: 2, kind: "block" },
      { row: 111, lane: 3, kind: "gap" },
      { row: 112, lane: 0, kind: "gap" },
      { row: 112, lane: 1, kind: "high" },
      { row: 112, lane: 2, kind: "high" },
      { row: 112, lane: 3, kind: "gap" },
      { row: 113, lane: 0, kind: "gap" },
      { row: 113, lane: 1, kind: "block" },
      { row: 113, lane: 2, role: "orb", kind: "orbj" },
      { row: 113, lane: 3, kind: "gap" },
      { row: 114, lane: 0, kind: "gap" },
      { row: 114, lane: 1, kind: "block" },
      { row: 114, lane: 3, kind: "gap" },
      { row: 115, lane: 0, kind: "gap" },
      { row: 115, lane: 1, kind: "low" },
      { row: 115, lane: 3, kind: "gap" },
      { row: 116, lane: 0, kind: "block" },
      { row: 116, lane: 2, kind: "block" },
      { row: 116, lane: 3, kind: "gap" },
      { row: 117, lane: 1, kind: "block" },
      { row: 117, lane: 2, kind: "block" },
      { row: 117, lane: 3, kind: "gap" },
      { row: 118, lane: 0, kind: "block" },
      { row: 118, lane: 2, kind: "block" },
      { row: 118, lane: 3, kind: "gap" },
      { row: 119, lane: 0, kind: "gap" },
      { row: 119, lane: 3, kind: "gap" },
      { row: 120, lane: 0, kind: "gap" },
      { row: 120, lane: 2, kind: "block" },
      { row: 120, lane: 3, kind: "gap" },
      { row: 121, lane: 0, kind: "gap" },
      { row: 121, lane: 2, kind: "block" },
      { row: 121, lane: 3, kind: "gap" },
      { row: 122, lane: 0, kind: "gap" },
      { row: 122, lane: 1, kind: "block" },
      { row: 122, lane: 3, kind: "gap" },
      { row: 123, lane: 0, kind: "gap" },
      { row: 123, lane: 1, kind: "block" },
      { row: 123, lane: 3, kind: "gap" },
      { row: 124, lane: 0, kind: "gap" },
      { row: 124, lane: 1, kind: "block" },
      { row: 124, lane: 3, kind: "gap" },
      { row: 125, lane: 0, kind: "block" },
      { row: 125, lane: 2, kind: "block" },
      { row: 125, lane: 3, kind: "gap" },
      { row: 126, lane: 1, kind: "low" },
      { row: 126, lane: 2, kind: "block" },
      { row: 126, lane: 3, kind: "gap" },
      { row: 127, lane: 0, kind: "block" },
      { row: 127, lane: 1, kind: "low" },
      { row: 127, lane: 3, kind: "block" },
      { row: 128, lane: 0, kind: "gap" },
      { row: 128, lane: 1, kind: "block" },
      { row: 128, lane: 2, kind: "block" },
      { row: 129, lane: 0, kind: "gap" },
      { row: 129, lane: 1, kind: "block" },
      { row: 129, lane: 3, kind: "block" },
      { row: 130, lane: 0, kind: "gap" },
      { row: 130, lane: 1, kind: "block" },
      { row: 130, lane: 2, kind: "low" },
      { row: 130, lane: 3, kind: "gap" },
      { row: 131, lane: 0, kind: "gap" },
      { row: 131, lane: 2, kind: "block" },
      { row: 131, lane: 3, kind: "gap" },
      { row: 132, lane: 0, kind: "gap" },
      { row: 132, lane: 2, kind: "block" },
      { row: 132, lane: 3, kind: "gap" },
      { row: 133, lane: 0, kind: "gap" },
      { row: 133, lane: 1, kind: "block" },
      { row: 133, lane: 3, kind: "gap" },
      { row: 134, lane: 0, kind: "gap" },
      { row: 134, lane: 1, kind: "block" },
      { row: 134, lane: 3, kind: "gap" },
      { row: 135, lane: 0, kind: "gap" },
      { row: 135, lane: 2, kind: "block" },
      { row: 135, lane: 3, kind: "gap" },
      { row: 136, lane: 0, kind: "gap" },
      { row: 136, lane: 2, kind: "gap" },
      { row: 136, lane: 3, kind: "gap" },
      { row: 137, lane: 0, kind: "gap" },
      { row: 137, lane: 2, kind: "gap" },
      { row: 137, lane: 3, kind: "gap" },
      { row: 138, lane: 0, kind: "gap" },
      { row: 138, lane: 2, kind: "gap" },
      { row: 138, lane: 3, kind: "gap" },
      { row: 139, lane: 0, kind: "gap" },
      { row: 139, lane: 2, kind: "gap" },
      { row: 139, lane: 3, kind: "gap" },
      { row: 140, lane: 0, kind: "gap" },
      { row: 140, lane: 2, kind: "gap" },
      { row: 140, lane: 3, kind: "gap" },
      { row: 141, lane: 0, kind: "gap" },
      { row: 141, lane: 2, kind: "gap" },
      { row: 141, lane: 3, kind: "gap" },
      { row: 142, lane: 0, kind: "gap" },
      { row: 142, lane: 2, kind: "gap" },
      { row: 142, lane: 3, kind: "gap" },
      { row: 143, lane: 0, kind: "gap" },
      { row: 143, lane: 2, kind: "gap" },
      { row: 143, lane: 3, kind: "gap" },
      { row: 144, lane: 0, kind: "gap" },
      { row: 144, lane: 2, kind: "gap" },
      { row: 144, lane: 3, kind: "gap" },
      { row: 145, lane: 0, kind: "gap" },
      { row: 145, lane: 2, kind: "gap" },
      { row: 145, lane: 3, kind: "gap" },
      { row: 146, lane: 0, kind: "gap" },
      { row: 146, lane: 2, kind: "gap" },
      { row: 146, lane: 3, kind: "gap" },
      { row: 147, lane: 0, kind: "gap" },
      { row: 147, lane: 2, kind: "gap" },
      { row: 147, lane: 3, kind: "gap" },
      { row: 148, lane: 0, kind: "gap" },
      { row: 148, lane: 2, kind: "gap" },
      { row: 148, lane: 3, kind: "gap" },
      { row: 149, lane: 0, kind: "gap" },
      { row: 149, lane: 2, kind: "gap" },
      { row: 149, lane: 3, kind: "gap" },
      { row: 150, lane: 0, kind: "gap" },
      { row: 150, lane: 2, kind: "gap" },
      { row: 150, lane: 3, kind: "gap" },
      { row: 151, lane: 0, kind: "gap" },
      { row: 151, lane: 2, kind: "gap" },
      { row: 151, lane: 3, kind: "gap" },
      { row: 152, lane: 0, kind: "gap" },
      { row: 152, lane: 2, kind: "gap" },
      { row: 152, lane: 3, kind: "gap" },
      { row: 153, lane: 0, kind: "gap" },
      { row: 153, lane: 2, kind: "gap" },
      { row: 153, lane: 3, kind: "gap" },
      { row: 154, lane: 0, kind: "gap" },
      { row: 154, lane: 2, kind: "gap" },
      { row: 154, lane: 3, kind: "gap" },
      { row: 155, lane: 0, kind: "gap" },
      { row: 155, lane: 2, kind: "gap" },
      { row: 155, lane: 3, kind: "gap" },
      { row: 156, lane: 0, kind: "gap" },
      { row: 156, lane: 2, kind: "gap" },
      { row: 156, lane: 3, kind: "gap" },
      { row: 157, lane: 0, kind: "gap" },
      { row: 157, lane: 2, kind: "gap" },
      { row: 157, lane: 3, kind: "gap" },
      { row: 158, lane: 0, kind: "gap" },
      { row: 158, lane: 2, kind: "gap" },
      { row: 158, lane: 3, kind: "gap" },
      { row: 159, lane: 0, kind: "gap" },
      { row: 159, lane: 2, kind: "gap" },
      { row: 159, lane: 3, kind: "gap" },
      { row: 160, lane: 0, kind: "gap" },
      { row: 160, lane: 2, kind: "gap" },
      { row: 160, lane: 3, kind: "gap" },
      { row: 161, lane: 0, kind: "gap" },
      { row: 161, lane: 2, kind: "gap" },
      { row: 161, lane: 3, kind: "gap" },
      { row: 162, lane: 0, kind: "gap" },
      { row: 162, lane: 2, kind: "gap" },
      { row: 162, lane: 3, kind: "gap" },
      { row: 163, lane: 0, kind: "gap" },
      { row: 163, lane: 2, kind: "gap" },
      { row: 163, lane: 3, kind: "gap" },
      { row: 164, lane: 0, kind: "block" },
      { row: 164, lane: 2, kind: "block" },
      { row: 164, lane: 3, kind: "block" },
    ],
  },
};

const hex2n = (s) => (typeof s === "string" ? parseInt(s.replace("#", ""), 16) : s);
export const mix = (a, b, k) => {
  const f = (sh) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * k);
  return (f(16) << 16) | (f(8) << 8) | f(0);
};

// GIRAR EL TONO de un color, en grados sobre el circulo (ver `hueAt` y `fantasma`). Va por
// HSL y no por una matriz sobre RGB: la matriz de rotacion de tono cambia la luminancia (los
// canales no pesan lo mismo) y aca lo que tiene que quedarse quieto es cuanto ILUMINA cada
// pieza, que es de donde salen todas las medidas de contraste del nivel. Con HSL la `l` y la
// `s` son las mismas de entrada y de salida.
// Un GRIS (mx === mn, o sea saturacion 0) se devuelve tal cual: no tiene tono que girar, y de
// ahi sale que el blanco, el negro y los contornos del muneco no haga falta exceptuarlos.
export function rotHue(c, deg) {
  const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx === mn) return c;
  const l = (mx + mn) / 2, d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = ((((h / 6 + deg / 360) % 1) + 1) % 1);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (u) => {
    u = ((u % 1) + 1) % 1;
    return u < 1 / 6 ? p + (q - p) * 6 * u
      : u < 1 / 2 ? q
      : u < 2 / 3 ? p + (q - p) * (2 / 3 - u) * 6 : p;
  };
  const cl = (u) => Math.max(0, Math.min(1, f(u)));
  let R = cl(h + 1 / 3), G = cl(h), B = cl(h - 1 / 3);
  // ...Y SE LE DEVUELVE LA LUMA. HSL conserva la L, que no es la luminosidad que se ve: el
  // verde y el azul pesan 0.7152 y 0.0722, o sea que girar el cyan del nivel 30 grados hacia
  // el azul deja la misma L y la LUMA se cae de **172.9 a 81.3** (medido). Eso no es una
  // deriva de tono, es un fundido a oscuras, y encima todas las mediciones de contraste del
  // proyecto (malla contra suelo, rig contra banda de juego, reactor contra cielo) estan
  // hechas en luma: si el tono la mueve, ninguna de esas jerarquias se sostiene.
  // Se le devuelve mezclando hacia el BLANCO o hacia el NEGRO, no escalando: la luma es lineal
  // en esa mezcla, o sea que el factor sale de una division y da la luma EXACTA en los dos
  // sentidos. Escalar los tres canales no sirve porque el cyan del nivel ya tiene un canal en
  // 255: no hay hacia donde subir sin desaturar (medido, escalando el peor desvio EMPEORA a
  // 152.3). El precio es que un tono oscuro a la luma del cyan sale palido, que es exactamente
  // lo que es un neon claro.
  const L = (x, y, z) => 0.2126 * x + 0.7152 * y + 0.0722 * z;
  const l0 = L(r, g, b), l1 = L(R, G, B);
  if (l1 > 1e-6 && l0 > l1) {
    const k = (l0 - l1) / (1 - l1);
    R += k * (1 - R); G += k * (1 - G); B += k * (1 - B);
  } else if (l1 > 1e-6) {
    const k = l0 / l1;
    R *= k; G *= k; B *= k;
  }
  const to = (u) => Math.round(Math.max(0, Math.min(1, u)) * 255);
  return (to(R) << 16) | (to(G) << 8) | to(B);
}

// --- numeracion de la pista: filas y tiles ---
// Una fila por BEAT: es la banda que ya se ve en el suelo y el hueco mas corto en el que
// se puede reaccionar (0.462s a 130bpm; el test exige >0.35s). Mas fino no se juega.
// Anclada al mismo `off` que los compases, asi fila = (compas-1)*4 + beat.
export const grid = (doc) => {
  const beat = 60 / doc.tempo.bpm;
  const bar = beat * doc.tempo.beatsPerBar;
  return { beat, bar, off: (((doc.tempo.offset - doc.track.trim.start) % bar) + bar) % bar };
};
export const timeOfRow = (row, g) => g.off + row * g.beat;
// el epsilon es para que el borde exacto de la fila caiga en la fila nueva y no en la vieja
export const rowAt = (t, g) => Math.floor((t - g.off) / g.beat + 1e-9);
// EL BEAT DEL FANTASMA: la ULTIMA fila del break, o sea el beat en el que el apagon se
// levanta y todavia no entro el drop. Ahi (y solo ahi) el nivel entero pasa a blanco y negro
// y aparece la `constelacion` del eq. Es una fila y no medio compas porque una fila es lo que
// dura el hueco entre apagon y drop: mas largo pisaria el drop, mas corto es un parpadeo.
export const GHOST_ROW = 63;
// `n` = carriles del nivel (`lanes` en LEVELS). Default 3: es lo que asumen los llamadores
// que no tienen nivel a mano, y con 3 la numeracion de tiles del nivel 1 no se mueve.
export const tileOf = (row, lane, n = 3) => row * n + lane;
export const laneOfTile = (tile, n = 3) => ((tile % n) + n) % n;
export const rowOfTile = (tile, n = 3) => Math.floor(tile / n);

// --- zonas: tramos de filas con otras reglas (un solo carril, otra camara) ---
// Funciones puras de la fila / del tiempo, o sea que rebobinar entra y sale de la zona solo.
// `to` es inclusiva: la zona termina cuando termina esa fila.
export const zoneOfRow = (row, lv) =>
  (lv?.zones ?? lv?.level?.zones ?? []).find((z) => row >= z.from && row <= z.to) ?? null;
export const zoneAt = (t, lv) => (lv ? zoneOfRow(rowAt(t, lv), lv) : null);

// SECTOR del suelo de una fila (`sectors` en LEVELS): mismo criterio que las zonas, pero
// esto es SOLO el tinte de las bandas del piso. Fuera de todo sector devuelve null y el
// suelo va con el color de la seccion, como antes.
export const sectorOfRow = (row, sectors = []) =>
  sectors.find((s) => row >= s.from && row <= s.to) ?? null;

// Directivas del guion que CREAN obstaculo donde no hay senal. `n` es "t<tile>", no un
// numero: asi no se mezcla con la numeracion de cues ni la mueve.
function tiles(rules = [], g, n = 3) {
  const out = [];
  const mid = (n - 1) >> 1;   // el carril de arranque: 1 con 3 carriles y con 4
  for (const d of rules) {
    const ts = [].concat(d.tile ?? []).concat([].concat(d.row ?? []).map((r) => tileOf(r, d.lane ?? mid, n)));
    for (const tile of ts) out.push({
      t: timeOfRow(rowOfTile(tile, n), g), n: `t${tile}`, tile, row: rowOfTile(tile, n),
      role: d.role ?? "obstacle", kind: d.kind ?? (d.role === "orb" ? "orb" : "block"), lane: laneOfTile(tile, n),
      tag: "tile", v: d.v ?? 1, section: null, ...(d.fx ? { fx: d.fx } : {}),
    });
  }
  return out;
}

// doc + nivel -> lista de cues ordenada por t (relativa al inicio del corte)
export function cues(doc, level) {
  const secOf = Object.fromEntries(doc.sections.map((s) => [s.id, s.label]));
  const t0 = doc.track.trim.start;
  const out = [];
  const seen = {};
  for (const e of doc.events) {
    let rule = level.map[e.tag];
    if (!rule) continue;
    const over = level.sections?.[secOf[e.section]]?.[rule.role];
    if (over === null) continue;
    rule = over ? { ...rule, ...over } : rule;
    if (e.v != null && rule.min != null && e.v < rule.min) continue;
    const k = e.tag + rule.role;
    seen[k] = (seen[k] || 0) + 1;
    if (rule.every && (seen[k] - 1) % rule.every) continue;
    out.push({
      t: e.t - t0,
      role: rule.role,
      tag: e.tag,
      v: e.v ?? 1,
      beat: e.beat,
      section: secOf[e.section] || null,
      // `dur` la trae el evento, y si no la trae la pone el ROL del nivel (`dur` en `map`).
      // Hace falta porque `fxAt` sin `dur` no da progreso: el schema de `orbit-motion` no
      // trae ni una, o sea que sin esto sus efectos de barrido serian un golpe puntual.
      ...(e.dur ?? rule.dur ? { dur: e.dur ?? rule.dur } : {}),
      ...(rule.fx ? { fx: rule.fx } : {}),
    });
  }
  out.sort((a, b) => a.t - b.t);
  let oi = 0;
  const g = grid(doc);
  // cada cue sabe en que fila cae: asi se puede dictar por #n o por fila indistintamente
  const n = level.lanes ?? 3;
  out.forEach((c, i) => {
    c.n = i + 1; c.row = rowAt(c.t, g);
    if (c.role === "obstacle") defaults(c, oi++, n);
    // el guion lo mueve con { lane }; por defecto va al del medio, que con 3 y con 4 es el 1
    if (c.role === "orb") { c.kind = "orb"; c.lane = (n - 1) >> 1; }
  });
  // En una zona de un carril se tiran los obstaculos y orbs de los otros dos: si no, en la
  // camara "lado" (2D plano, sin carriles) se dibujarian dos cajas una encima de la otra.
  // Las cues sin carril (marcas, bg, fx) no las toca.
  const keep = (c) => {
    const z = zoneOfRow(c.row, level);
    return !z || c.lane == null || c.lane === z.lane;
  };
  return script(out, level.script)
    .concat(tiles(level.script, g, n))
    .filter(keep)
    .sort((a, b) => a.t - b.t);
}

// Reglas por defecto hasta que dictes otra cosa. Deterministas a proposito:
// si dependieran de random, rebobinar daria otro nivel.
function defaults(c, i, n = 3) {
  const sub = Math.round((((c.beat % 1) + 1) % 1) * 4);   // 0 = a negra, 1..3 = semicorcheas
  c.kind = c.v >= 0.99 ? "block" : sub === 1 ? "low" : "high";  // fuerte = cambiar carril
  // zigzag que recorre TODOS los carriles sin repetir: con n=3 da 0,2,1 (identico a lo de
  // siempre) y con n=4 da 0,3,2,1. El `(i*2)%n` de antes solo funciona con n impar: con 4
  // da 0,2,0,2, o sea la mitad de la pista muerta.
  c.lane = (i * (n - 1)) % n;
}

// Aplica el guion. at = una cue, from/to = tramo. role/tag filtran dentro del tramo.
function script(list, rules = []) {
  for (const d of rules) {
    if (d.tile != null || d.row != null) continue;   // esas crean obstaculo (tiles()), no tocan cues
    const a = d.at ?? d.from ?? 1;
    const b = d.at ?? d.to ?? list.length;
    for (const c of list) {
      if (c.n < a || c.n > b) continue;
      if (d.role && c.role !== d.role) continue;
      if (d.tag && c.tag !== d.tag) continue;
      if (d.off) { c.off = true; continue; }
      if (d.kind) c.kind = d.kind;
      if (d.lane != null) c.lane = d.lane;
      if (d.role2) { c.role = d.role2; if (d.role2 === "orb") c.kind = "orb"; }
      if (d.fx) c.fx = d.fx;
      if (d.bg) { c.bg = hex2n(d.bg); c.over = d.over ?? 0; }
      if (d.layer) {
        c.layer = d.layer;
        if (d.vis != null) c.vis = d.vis;
        if (d.tint) { c.tint = hex2n(d.tint); c.over = d.over ?? 0; }
      }
    }
  }
  return list.filter((c) => !c.off);
}

// --- el mundo como funcion del tiempo de la cancion ---

// z del obstaculo: su CENTRO pisa al jugador exactamente en c.t.
// Por eso aparece antes y hace el viaje: en t = c.t - lead esta en SPAWN_Z.
export const zOf = (c, t, speed) =>
  PLAYER_Z - (KINDS[c.kind]?.d ?? 0) / 2 + (c.t - t) * speed;

// segundos que tarda en recorrer la pista: cuanto antes hay que soltarlo
export const leadOf = (speed) => (SPAWN_Z - PLAYER_Z) / speed;
export const spawnAt = (c, speed) => c.t - leadOf(speed);

// ENTRADA del obstaculo: 0 recien salido, 1 con la animacion terminada. Funcion de z, o sea
// del tiempo, o sea que rebobinar la rebobina como todo lo demas.
// 7 beats y no 1: con 1 beat (323z a v=700) la animacion entera pasa entre z=4000 y z=3677,
// donde la caja mide 2px y no se ve nada. Con 5 terminaba en z=2385, dentro de la niebla
// (f=0.68): tampoco se veia, que es lo que se reporto. Con 7 termina en z=1739, a 1019 del
// jugador (f=0.41, o sea legible) y todavia a 1.46s = 3.2 beats del impacto, o sea que la
// caja esta quieta mucho antes de la ventana de reaccion (1 beat).
// Es solo dibujo: la hitbox sale de KINDS y no se entera.
export const ENTER_BEATS = 7;
// ...pero 7 beats de VIAJE solo entran si el viaje dura mas que eso, y `V` (feel) lo acorta:
// a v=700 el viaje son 10.15 beats, a x1.5 son 6.77 y a x2 **5.08**, o sea menos que la
// entrada. Medido a x2 sin topar: la caja te pisaba con la entrada al **73%**, o sea un
// `slam` a medio caer flotando **185** sobre el piso (mide 150 de alto), que es exactamente
// el "nunca llegan al suelo" que se reporto. Por eso `dz` va topado a lo que quepa dejando
// ENTER_END_BEATS libres: la entrada esta HECHA antes de la ventana de lectura a cualquier
// velocidad. 2.2 y no 2: a x2 esos 2.2 beats son 1421z, o sea que la entrada termina antes
// de los 1600 en los que la niebla lo hunde todo. Con 2.5 se pasaba (1615).
export const ENTER_END_BEATS = 2.2;
export const enterDz = (beat, speed) => Math.max(1, Math.min(
  ENTER_BEATS * beat * speed,
  SPAWN_Z - PLAYER_Z - ENTER_END_BEATS * beat * speed));
export const enterOf = (z, dz) => Math.min(1, Math.max(0, (SPAWN_Z - z) / dz));

// CHASE de los huecos: cuanto esta encendida la X de la fila `row` en el instante `t`.
// Un hueco cada medio beat y vuelve al principio cada 4, o sea que una zanja se lee como
// una luz corriendo hacia el jugador. Funcion pura de (fila, songT): no hay estado, todos
// los huecos de la pista van en la misma fase, y rebobinar lo rebobina.
// Los 0.35/0.12 son la ESTELA: con on/off seco cada hueco parpadea por su cuenta y no se
// ve para donde corre.
export const CHASE = [1, 0.35, 0.12, 0.12];
export const chaseAt = (row, t, beat) => CHASE[(row + Math.floor(t / (beat / 2))) % CHASE.length];

// VENTANA DE MARCAS: se enciende EN una marca (las lineas amarillas del modo diseno:
// accent/voice) y se apaga en la SIGUIENTE, y solo si esas dos estan a menos de `max` beats.
// En el drop las marcas vienen de a PARES (una por compas y su respuesta un beat despues),
// asi que esto es un destello de un beat por compas y no un parpadeo continuo; entre par y par
// (3 beats) devuelve 0. Funcion pura de songT: rebobinar lo rebobina.
// El `ramp` de 60ms es para que prenda y apague sin escalon de un frame.
// EL NUMERO DE DESTELLO: cuantas ventanas de marca se abrieron hasta `t`, o sea que figura le
// toca a la constelacion. Antes del primer par da 0 (el rombo de siempre, que es lo que se ve
// en la f63), en el primer destello 1, y asi. Dentro de una ventana no cambia: la marca que
// la cierra no abre otra (entre par y par hay 3 beats), asi que la figura no se transforma a
// mitad del destello. Funcion pura de songT: rebobinar trae la misma figura.
export function flashIdx(t, cues, beat, max = 1.5) {
  const m = cues.filter((c) => c.role === "mark").map((c) => c.t);
  let k = 0;
  for (let i = 0; i + 1 < m.length; i++) if (m[i] <= t && m[i + 1] - m[i] <= beat * max) k++;
  return k;
}

// LA MARCA QUE QUEDO ATRAS Y HACE CUANTO. `flashIdx` cuenta PARES (ventanas de `markWin`) y
// aca hace falta UNA POR MARCA: el acid del drop2 son 28 eventos sueltos y lo que se pidio es
// que en cada uno "cambie algo y vuelva con una variacion", o sea que cada marca tiene que
// dejar OTRO estado. `k` es ese estado (cuantas marcas van) y `age` el tiempo desde la ultima,
// de donde sale la envolvente del golpe. Funcion pura de songT como todo lo demas.
export function markN(t, cues) {
  let k = 0, at = -1e9;
  for (const c of cues) { if (c.t > t) break; if (c.role === "mark") { k++; at = c.t; } }
  return { k, age: t - at };
}

export function markWin(t, cues, beat, max = 1.5, ramp = 0.06) {
  let a = null, b = null;
  for (const c of cues) {
    if (c.role !== "mark") continue;
    if (c.t <= t) { a = c.t; b = null; } else if (b === null) { b = c.t; break; }
  }
  if (a === null || b === null || b - a > beat * max) return 0;
  return Math.min(1, (t - a) / ramp, (b - t) / ramp);
}

// Color del fondo en t: ultima cue con bg, interpolando `over` segundos desde la anterior.
export function bgAt(t, list, base) {
  let from = base, to = base, at = -1e9, over = 0;
  for (const c of list) {
    if (c.t > t) break;
    if (c.bg == null) continue;
    from = to; to = c.bg; at = c.t; over = c.over || 0;
  }
  const k = over > 0 ? Math.min(1, (t - at) / over) : 1;
  return mix(from, to, k);
}

// Estado de una capa de fondo en t: mismo criterio que bgAt pero por capa.
export function layerAt(t, list, layer) {
  let from = layer.color, to = layer.color, at = -1e9, over = 0, vis = layer.vis !== false;
  for (const c of list) {
    if (c.t > t) break;
    if (c.layer !== layer.id) continue;
    if (c.vis != null) vis = c.vis;
    if (c.tint == null) continue;
    from = to; to = c.tint; at = c.t; over = c.over || 0;
  }
  return { vis, color: mix(from, to, over > 0 ? Math.min(1, (t - at) / over) : 1) };
}

// Progreso 0..1 dentro de una cue de fx, null fuera: el efecto es funcion pura de t,
// asi que rebobinar al break lo repite identico.
export function fxAt(t, list, fx) {
  for (const c of list) {
    if (c.fx !== fx || !c.dur) continue;
    if (t >= c.t && t < c.t + c.dur) return (t - c.t) / c.dur;
  }
  return null;
}

// Gravedad en t: la paridad de las cues de rol "flip" vistas hasta t, y cuando fue la
// ultima (para girar la camara). Funcion pura de t: rebobinar antes del flip te devuelve
// al suelo, sin estado pegajoso.
export function flipAt(t, list) {
  let n = 0, at = -1e9;
  for (const c of list) {
    if (c.t > t) break;
    if (c.role === "flip") { n++; at = c.t; }
  }
  return { n, at, g: n % 2 ? -1 : 1 };
}

// Golpe de las cues de un rol: 0..1, decae en tau. "bg" es el kick (flash a beat);
// "mark" son las senales que NO son el kick (accent/voice), que es lo que enciende los
// laseres en el buildup.
export function pulseAt(t, list, tau = 0.16, role = "bg") {
  let p = 0;
  for (const c of list) {
    if (c.t > t) break;
    if (c.role !== role || t - c.t > 5 * tau) continue;
    p = Math.max(p, c.v * Math.exp(-(t - c.t) / tau));
  }
  return p;
}

// EL METRONOMO DE LA GRILLA: la unica envolvente que existe SIEMPRE, porque no mira las cues
// sino `songT` y la grilla (`off` + `beat`), o sea que es funcion pura del tiempo igual que la
// posicion de todo lo demas. `pulseAt` depende de que haya eventos, y medido sobre el nivel 2:
// `pulse` > 0.05 cubre el 55% del buildup, el 19% del break, el **0% del drop2** y el **0% del
// outro** (21% del nivel: 57.0s de 72.31 apagada), y `beat` vale 0 el **100% del outro** (28.6s
// con UN solo evento). Todo lo que late con esos dos se congela mas de la mitad del nivel.
// De aca sale el piso: la ola respira con el metronomo del tema las 72s y la senal queda de
// ACENTO encima (`Math.max`, ver `this.lat` en el renderer).
// El exponente es 2 y no 1: con 1 la envolvente es una sierra y el latido no tiene golpe
// (media 0.5 y la mitad del beat por encima de 0.5); con 2 la media es 1/3 y el 58% del beat
// esta por debajo de 0.25, o sea que pega y suelta como un kick.
export const gridAt = (t, g, k = 2) => (1 - ((((t - g.off) / g.beat) % 1) + 1) % 1) ** k;

// EL CONTRATIEMPO, la otra mitad del compas. Es `gridAt` medio beat corrido, o sea que pica
// en `off + (n + 0.5) * beat` en vez de en el beat.
//
// No es una eleccion: se MIDIO sobre el audio de `orbit-motion`. El transitorio agudo del
// tema (el "hat") cae en la fase **0.505 del beat** (o sea el contratiempo exacto) y lo hace
// en los CUATRO tiempos por igual: la dispersion entre ellos es 1.08-1.14, y si fuera el 2 y
// el 4 del compas dos de los cuatro tendrian que estar en el piso y ninguno lo esta. Es la
// corchea fuerte de una grilla de semicorcheas (las otras miden 0.26-0.52 de su amplitud).
//
// Y el KICK no sale de las cues: el canal `bass` marcado a mano NO es el kick. Medido, el
// audio tiene un kick real en la fase 0.0 en el **95.8% de todos los beats (158/165)**, y en
// **31 de los 32 beats del drop2, donde `bass` no tiene ni un evento**. O sea que el golpe
// del suelo tiene que salir de la grilla (`gridAt`), no de una senal que ahi no existe.
// (La banda de 35-100Hz no sirve para detectarlo: el bajo sostenido del acid la domina y da
// un +77ms falso. 120-400Hz los separa limpio, y ahi el kick cae +2.9ms y el hat +2.0ms
// contra la grilla `off`, sin deriva en 72s, o sea que no hay sesgo que corregir.)
// El exponente por defecto es 4 y no 2: `gridAt` es una sierra, o sea que medio beat despues
// de su pico todavia vale (1/2)^k. Con k=2 eso es 0.25, y por el alpha del blanco (0.14) da
// 0.035 puesto en pantalla el beat entero, o sea un velo permanente en vez de un golpe.
// Con k=4 el piso queda en 0.0625 -> 0.0088, por debajo del corte de 0.01 del renderer.
export const HAT_K = 4;
export const hatAt = (t, g, k = HAT_K) => gridAt(t + g.beat / 2, g, k);

// LA CRECIENTE (`hype` en LEVELS): una lista de tramos de FILAS, cada uno con de donde sale y
// a donde llega (`a` -> `b`, por defecto 0 -> 1). Fuera de un tramo se queda en el `b` del
// ultimo que paso, o sea que "sube durante el buildup y despues se queda arriba" es un tramo
// y no dos. Antes del primero vale el `a` del primero.
//
// El nivel 1 no la declara, o sea que ahi vale 0 y no cambia un pixel.
//
// **La creciente NO es de volumen y eso esta medido**: el RMS por compas del buildup de
// `orbit-motion` se mueve **+0.62dB del compas 0 al 15**, con **3.16dB** entre su minimo y su
// maximo, y el maximo cae en el compas **13, no en el 15**; una rampa lineal y una exponencial
// ajustan igual de mal (**R2 0.276** las dos). Lo que si sube monotono es el BRILLO y lo que
// baja es el GRAVE: el sub (<60Hz) va de 0.0578 a 0.0075 (**-17.77dB**) y el centroide
// espectral de 758Hz a ~1400Hz. Por eso de `hype` cuelgan cosas que ACLARAN y AGRANDAN (el
// tamano del reactor, los anillos, los rayos) y ninguna que suba el volumen de un latido.
export function hypeAt(t, lv) {
  const hs = lv?.hype ?? [];
  if (!hs.length) return 0;
  const r = rowAt(t, lv);
  let v = hs[0].a ?? 0;
  for (const h of hs) {
    if (r < h.from) break;
    const a = h.a ?? 0, b = h.b ?? 1;
    v = r >= h.to ? b : a + (b - a) * ((r - h.from) / Math.max(1, h.to - h.from));
  }
  return v;
}

// LA DERIVA DE TONO (`hue` en LEVELS). Se pidio que el nivel no se quede en un solo color:
// "los primeros 4 beats el color que teniamos, despues todo el reactor y todos los colores
// principales se van a rosado/violeta", y sobre todo **"un movimiento de tono, no un pase
// directo a rosa"**. O sea que no es un cambio de paleta: es la MISMA paleta girada en el
// circulo de color, y vuelve.
//
//   `beats` = cuanto dura el ciclo · `hold` = cuantos beats se queda en el color de siempre
//   · `deg` = cuanto gira en el pico.
//
// La curva es `sin(PI*u)` sobre lo que queda despues del `hold`: vale 0 en las dos puntas, o
// sea que engancha con el tramo quieto sin escalon, y el pico cae en la mitad. Funcion pura de
// songT (sale de la GRILLA, no de las cues), asi que existe aunque la seccion no marque nada y
// rebobinar la rebobina. Sin `hue` declarado devuelve 0: el nivel 1 no gira un grado.
export function hueAt(t, lv) {
  const h = lv?.hue;
  if (!h) return 0;
  const bt = (t - (lv.off ?? 0)) / lv.beat;
  const p = ((bt % h.beats) + h.beats) % h.beats;
  const u = Math.max(0, (p - h.hold) / Math.max(1e-6, h.beats - h.hold));
  return h.deg * Math.sin(Math.PI * u);
}

// TRAMOS DE EFECTO POR FILA (`fx` en LEVELS): hermanos de `sectors` y `zones`, y NO del
// `script`. En el `script` un `row`/`tile` CREA un obstaculo y un `at`/`from`/`to` direcciona
// cues `#n`: ninguna de las dos cosas es "de la f10 a la f19 la imagen se corta".
export const fxOfRow = (row, lv, kind) =>
  (lv?.fx ?? []).find((f) => f.kind === kind && row >= f.from && row <= f.to) ?? null;

// EL GATE (el de un compresor con sidechain, o el de un plugin de gate: la imagen se CORTA a
// tiempo). Devuelve 1 abierto y `floor` cerrado, con la fase sacada de la grilla y no de un
// contador, o sea que rebobinar lo rebobina y todo el nivel va en la misma fase.
// `div` = cuantos cortes por beat (4 = semicorcheas) y **`cut` = que fraccion de cada corte
// esta CERRADA**, no abierta. El sentido importa: con `duty` (la fraccion ABIERTA) el valor
// natural es 0.5 y la pantalla se pasaba la MITAD del tramo en negro, o sea que no se leia
// como un corte sino como un apagon intermitente. Con `cut` el valor natural es chico (0.18)
// y lo que se ve es un tajo: la imagen esta, y se corta.
//
// `ramp` es el corte al FINAL del tramo: el tajo se va comiendo la subdivision a medida que el
// tramo avanza, o sea que el gate mismo hace la creciente en vez de estar puesto o no puesto.
export function gateAt(t, lv, kind = "gate") {
  const row = rowAt(t, lv);
  const f = lv ? fxOfRow(row, lv, kind) : null;
  if (!f) return 1;
  const ph = ((((t - lv.off) / (lv.beat / (f.div ?? 4))) % 1) + 1) % 1;
  let cut = f.cut ?? 0.18;
  if (f.ramp != null) {
    const r = Math.min(1, Math.max(0, (row - f.from) / Math.max(1, f.to - f.from)));
    cut += (f.ramp - cut) * r;
  }
  return ph < cut ? (f.floor ?? 0) : 1;
}

// La seccion de la cancion en t (buildup / break / drop). Los tiempos del schema son
// absolutos del track original, asi que van con `trim.start` restado, igual que las cues.
export function sectionAt(t, secs) {
  for (const s of secs) if (t >= s.start && t < s.end) return s.label;
  return null;
}

// Carga el nivel: schema + cues + grilla de compases relativa al corte.
export async function loadLevel(name) {
  const level = LEVELS[name];
  const doc = await (await fetch(level.schema)).json();
  return {
    name, level, doc, ...grid(doc),
    bg: hex2n(level.bg),
    // carriles del nivel: cuantos y donde. El paso es siempre 170 (ver `lanesX`), o sea que
    // con 4 la pista se ensancha. Es la unica via por la que el renderer se entera de N.
    lanes: level.lanes ?? 3,
    laneX: lanesX(level.lanes ?? 3),
    // capas de decorado encendidas (ver `decor` en LEVELS): el renderer no decide, el nivel si
    decor: level.decor ?? [],
    // la familia de color del nivel, ya en numero: `fam` para el decorado y `sec` para el
    // marco y las bandas del suelo por seccion (con `def` de respaldo). Ver `neon` en LEVELS.
    neon: {
      fam: (level.neon?.fam ?? []).map(hex2n),
      sec: Object.fromEntries(
        Object.entries(level.neon?.sec ?? {}).map(([k, v]) => [k, hex2n(v)]),
      ),
      def: hex2n(level.neon?.def ?? "#8b5cf6"),
      // el rig es opcional: sin el, el renderer se queda con sus dos listas de siempre
      ...(level.neon?.rig ? { rig: level.neon.rig.map(hex2n) } : {}),
    },
    // el resplandor del horizonte (`sky` en LEVELS): sin el, el renderer no dibuja ni la
    // franja ni la cuna del fondo de la pista, o sea que el nivel 1 queda exactamente igual.
    sky: level.sky ? { ...level.sky, col: hex2n(level.sky.col) } : null,
    // los dos colores de la malla (`mesh` en LEVELS): valle y cresta. Sin declararlo mandan
    // `MESH_LO`/`MESH_HI` del renderer, o sea el cyan de siempre.
    mesh: level.mesh ? { lo: hex2n(level.mesh.lo), hi: hex2n(level.mesh.hi) } : null,
    zones: level.zones ?? [],
    // `metro`: TECHO del metronomo de la grilla (`gridAt`), que va de piso de lo que late.
    // 0 = apagado. Va por nivel y no siempre porque el nivel 1 tiene cues de sobra (su `beat`
    // no se apaga) y ponerselo le cambiaria el latido del suelo, o sea el nivel entero.
    metro: level.metro ?? 0,
    // la creciente y los tramos de efecto por fila. Los dos con respaldo VACIO: el nivel 1 no
    // los declara, o sea que `hypeAt` da 0 y `gateAt` da 1 (abierto) y ahi no cambia nada.
    // cual seccion es EL drop (rave clavado + temblor). Respaldo "drop": el nivel 1 tiene un
    // `drop` Y un `drop2` (59.08-87.69s) y solo el primero es su drop.
    dropSec: level.dropSec ?? "drop",
    // el rig cruzando el mundo entero en vez de vivir en el cielo (ver `rigOver` en LEVELS).
    // Respaldo FALSE: es el orden de dibujo que el renderer tenia antes del dial.
    rigOver: !!level.rigOver,
    hype: level.hype ?? [],
    fx: level.fx ?? [],
    // la ola por seccion (ver `wave` arriba). Vacio = a 1 y mode 0, o sea el de siempre.
    wave: level.wave ?? null,
    // la deriva de tono (ver `hueAt`). Sin el, `hueAt` devuelve 0 y no se gira un grado.
    hue: level.hue ?? null,
    // la frase que vuela en el break (`drawAcid`). Por nivel, con el respaldo puesto en lo que
    // el renderer decia antes de existir el dial.
    acid: level.acid ?? "THIS IS ACID",
    // el estilo y el gesto de esas letras (`acidFx` en LEVELS). Respaldo `null`: el nivel 1 no
    // lo declara, o sea que no se toca el estilo del pool ni se cambia de gesto.
    acidFx: level.acidFx ?? null,
    glow: level.glow ?? {},
    enter: level.enter ?? {},
    sectors: (level.sectors ?? []).map((s) => ({ ...s, color: hex2n(s.color) })),
    layers: (level.layers ?? []).map((l) => ({ ...l, color: hex2n(l.color) })),
    speed: level.speed,
    cues: cues(doc, level),
    sections: (doc.sections ?? []).map((s) => ({
      label: s.label, start: s.start - doc.track.trim.start, end: s.end - doc.track.trim.start,
    })),
    length: doc.track.trim.end - doc.track.trim.start,
  };
}
