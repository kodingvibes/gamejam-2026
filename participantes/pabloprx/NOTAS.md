# NOTAS - la noche del 29/30

Cinco tandas de ideas encima de `v1-visto`. Todo sigue: sin npm, sin bundler,
`python3 -m http.server 8123` y el mundo es funcion de `songT`.

Para volver a lo que viste: `git reset --hard v1-visto`.
Esto es `v2-noche`.

## Que entro

| commit | que | como se prueba |
|---|---|---|
| `9cccba9` | pista numerada por filas y tiles, y `script` que crea obstaculos donde no hay senal | `T` cicla apagado / filas / tiles |
| `bda00a3` | fondo por capas con parallax + "THIS IS ACID" en el break | `J` cicla capas; `G` -> `28` para el break |
| `da8d4e9` | orbs con dash sostenido y gravedad invertida por cue | `↑`/`W` **mantenido** sobre el orb; `H` invierte a mano |
| `c04ca34` | tres camaras del mismo mundo | `C` cicla atras / lado / 1a persona |
| `997b870` | grabar gameplay y volcarlo como guion | `Y` graba con la pista vacia, `U` exporta |
| (tanda 6) | zonas (un carril + camara 2D), jump orbs, indicador de fila, 1a persona agachada | `G` -> `f78` (zona 2D), `f119` (jump orb), `C` x2 + `↓` |
| (esta tanda) | cajas mas chicas, huecos en el suelo, porton del flip, colchon del orb, tramo 2D con saltos | `G` -> `f46` (huecos), `f78` (2D), `f85` (porton), `f119` (orb) |
| (esta tanda) | simbolo en la cara de cada caja (`^` / `v` / `X`), hitbox 40 -> 28, laseres en los bordes con los accents, fuera el flip, el 2D arranca dos filas antes | `G` -> `f20` (los tres simbolos), `f67` (laseres en el drop), `f76` (entrada al 2D) |
| (nivel 2) | **segundo nivel, `?level=orbit-motion`**: 4 carriles, campo de olas a los costados y reactor en el punto de fuga | abrir `/?level=orbit-motion`; el nivel 1 sigue en `/` y se comprueba a 0 px contra HEAD |

El guion que sale de `U` es el **negativo** de tu corrida: en cada fila y carril prueba una
caja entera, y si tu vuelta se la comia prueba el hueco por el que pasaste (`low` si ibas
por el aire, `high` si ibas agachado). Donde estabas parado no va nada. O sea la pista
queda tapada menos por donde pasaste: un tunel con la forma de tu vuelta, jugable por
construccion. Se llena ~70% de la pista; el 30% libre es tu camino.

## Teclas

Esto es el **modo diseno**, o sea `?level=<id>` sin `?play`. Entrando por el menu solo quedan
las de jugar (flechas/WASD, `SPACE` y el clic) y el resto no se ata: ver la tanda del menu.

| tecla | que hace |
|---|---|
| `←` `→` / `A` `D` | cambiar de carril |
| `↑` / `W` | saltar. **Mantenido** sobre un orb = dash (1.2s a media altura, atraviesa cajas) |
| `↓` / `S` | deslizar (y caida rapida si estas en el aire) |
| `SPACE` | play / pausa |
| `R` | reiniciar la corrida (no mueve la cancion) |
| `1`-`5` | x1 / .5 / .25 / .1 / .05 (jugador **y** musica) |
| `,` `.` | ∓ compas (con `shift`, ∓ beat) |
| `L` | loop del bloque de 8 compases donde estas |
| `G` | ir a una cue (`52`) o a una fila (`f78`); cae 2s antes |
| `HOME` | al inicio |
| `M` | lineas de cue y barra de la cancion |
| `T` | numeros: apagado / filas / tiles |
| `J` | capas de fondo: todas / solo base / solo detalle |
| `C` | camara: atras / lado / 1a persona |
| `H` | invertir la gravedad a mano (se comporta como una cue de flip en ese `songT`) |
| `Y` | grabar: corre la pista VACIA y anota lo que hiciste |
| `U` | exportar lo grabado como directivas del `script` (consola + `.js` descargable) |
| `K` | inmune (arranca encendido: chocar no corta el dictado) |
| `X` | mute |
| `V` | feel: multiplica la velocidad de la pista sin desincronizar nada |
| `-` `+` | sync fino de ∓5ms (`outputLatency` no siempre acierta) |

## Como se dicta un cambio

Todo va a `LEVELS["insomnia-drop"].script` en `music.js`, y a ningun otro lado.

**Por `#cue`** (una senal de la cancion, el numero que ves sobre la pista con `M`):

    { at: 34, bg: "#ef4444", over: 2 }                        // en la #34 el fondo va a rojo en 2s
    { from: 12, to: 40, role: "obstacle", kind: "block" }      // ese tramo, todo cajas
    { at: 67, off: true }                                     // borra esa cue
    { at: 34, layer: "eq", tint: "#ec4899", over: 1 }          // tinta una capa de fondo

**Por fila** (`T` -> filas; una fila = un beat = 0.4615s a 130bpm):

    { row: 78, lane: 0, kind: "block" }     // caja en la fila 78, carril izquierdo
    { row: 88, role: "flip" }               // ahi se invierte la gravedad
    { row: 70, lane: 1, role: "orb" }       // orb en el medio

**Por tile** (`T` -> tiles; `tile = fila * 3 + carril`, carril 0 = izquierda):

    { tile: [323, 324], kind: "low" }       // fila 107 carril 2, y fila 108 carril 0

Las dos ultimas formas **crean** el obstaculo donde no hay senal. Su `n` es `"t323"`, no un
numero, asi que no entran en la numeracion de cues ni la corren, y las reglas por `#n`
(`from`/`to`) no las tocan.

**El `script` ya no es demo: es tu vuelta del 30/07 dada vuelta.** 115 acciones grabadas con
`Y` -> 275 obstaculos en 384 celdas (72% de la pista, 223 cajas enteras). El `accent` dejo de
generar obstaculos (`role: "mark"`): la linea numerada sigue en pantalla para dictar, pero lo
que se choca es lo grabado. Los flips y el orb de DEMO se fueron: la grabacion asume gravedad
normal. El rec crudo quedo en `tools/rec-insomnia-drop.json`, asi que el relleno se puede
recalcular (otro `ORDER`, otra `speed`) sin volver a jugar.

## Medido esta noche (headed, 1200x805 CSS, pantalla de 100Hz)

- fps con TODO encendido (tiles + capas + marcas + obstaculos, x1 sonando):
  atras 100.0 / lado 100.0 / 1a persona 100.0, p95 11.5 / 11.7 / 11.8ms.
  **La pantalla capa a 100Hz: el numero real es el coste de `draw()`**, que es
  0.252ms en atras y 0.233ms en 1a persona (media de 300 frames, max 0.5 / 1.5ms).
  O sea sobra el 97% del frame; no hay nada que optimizar.
- **Con los huecos y el porton del flip** (300 frames desde t=40 a x1 sonando):
  `draw()` media 0.58ms, p95 0.90ms, max 5.8ms. Se duplico y sigue siendo el 6% del frame.
- **La corrida entera contra la escena de verdad** (`step()`, colisiones, pin de carril y
  orbs reales, 59.08s a 240Hz), replayando la grabacion mas las seis pulsaciones del tramo 2D:
  **0 muertes, 3 vidas, 2 orbs**, camaras `atras -> lado (35.08s) -> atras (38.31s)`, o sea
  3.23s de perfil. Los dos cambios de carril que se come la zona (f76 y f77) son la ida y
  vuelta al carril 2 que ya no hace falta. Sin mantener `↑`: **0 muertes** tambien, 1 orb
  (el otro lo cobra el colchon).
- determinismo: pausado, `seek(t)` -> serializar (songT, gravedad, roll, estado del jugador,
  set de golpes, `bgAt`, `pulseAt`, `fxAt`, `flipAt`, `layerAt` de las 4 capas, fila, y las
  cues cercanas con su `z`) -> irse a 3.1 y a 58.0 -> volver a `t`: **identico** en
  t = 12.5 / 27.9 / 41.0 / 55.0. Sin estado pegajoso.
- `node test.js` y `node test-music.js` en verde.
- consola sin errores.

## Arreglado esta noche

1. **Bug de verdad**: una directiva por fila o tile (`{ row: 78, lane: 0, kind: "block" }`)
   pisaba el `kind` y el `lane` de **todas** las cues del nivel, porque `script()` la trataba
   como una regla sin `from`/`to`. Estaba en la documentacion como ejemplo, o sea que el
   primer dictado real lo hubieras comido. Un `continue` en `music.js` + assert en
   `test-music.js`.
2. Con la gravedad invertida el suelo tapaba las capas de fondo (atras y de lado): ahora se
   espejan en el horizonte y la ciudad cuelga del techo.
3. El numero de la fila en la que estas se dibujaba fuera de la pista, encima del texto de
   ayuda. Empieza en la fila siguiente.
4. **Los 12 obstaculos del break se fueron** (filas 60-63): ahi no hay nada que esquivar,
   suena "THIS IS ACID" y la pista queda vacia. El guion paso de 275 a 264 directivas.
5. **La camara de lado no era 2D**: proyectaba los tres carriles en diagonal. Ahora es
   ortografica plana (`flat: true`), z es el eje horizontal y los tres carriles COLAPSAN,
   como en geometry dash. Por eso existe `zones`: un tramo de `cam: "lado"` tiene que ser
   de un carril o dos cajas se dibujarian una encima de la otra. `test.js` lo asegura.
6. **En 1a persona agachado la camara no se movia**: los ojos van a `SLIDE_H*0.72` en vez de
   `PLAYER_H*0.72`. Medido en vivo: `camY` 79.2 -> 39.6.

## Lo que saliste diciendo despues de jugarlo (y que se hizo)

1. *"no llego a cambiar de carril, las cajas son muy grandes"* -> **la caja paso de
   `{y1:200, w:60, d:130}` a `{y1:150, w:45, d:75}`**. No es estetica: con las cajas a una
   por beat el hueco libre de un carril es `beat - (d+40)/v`, o sea **217ms** con `d=130`,
   por debajo del tiempo de reaccion. Con `d=75` son **297ms**. Bajar el alto de 200 a 150
   es lo que destapa la pantalla, y la caja sigue sin poder saltarse (el salto llega a
   `y=111.6`; `test.js` lo comprueba a las cinco velocidades).
2. *"las cajas rojas me tapan la vista"* + *"guiar con algo que no sea solo rojo"* ->
   **123 de las 215 cajas son ahora HUECOS en el suelo** (`kind: "gap"`, cyan). Se dibujan en
   el plano del suelo, o sea que no tapan nada. Salen de vaciar el **interior de las paredes
   de 5+ cajas seguidas**, y la pared sigue cerrada: la zanja mas corta que genera es de 3
   filas, y desde 3 no se cruza (salto = 454ms de aire, fila = 462ms). Medido en `test.js`
   (se cruzan hasta 2 seguidos) y asegurado en `test-music.js` (falla si queda una zanja de
   menos de 3). Fisicamente el hueco es una caja **debajo** del piso, asi que `hits()` lo
   resuelve sola y se espeja con la gravedad invertida como todo lo demas.
3. *"el cambio de gravedad no se ve"* -> el flip **no** se saco, se telegrafia: un porton
   verde de lado a lado que llega desde el spawn (4.7s antes a v=700) con chevrones
   espejados en el plano del suelo, mas `⟲ GRAVEDAD <n>s` en el HUD los ultimos 3 segundos.
   Los chevrones van a los DOS lados a proposito: apuntando a uno solo se leen "agachate".
   (Despues igual se saco del nivel, ver el 10: telegrafiarlo no arreglaba que de cabeza no
   se lee que tecla es cual.)
4. *"los orbs de doble salto son un asco"* -> se mantiene el mantener (`↑`/`W`), pero:
   el orb que viene entrando trae el cartel **`MANTENER ↑`** (pasa a `↑ OK` verde cuando ya
   lo mantenes), el anillo se rellena mientras mantengas, y hay **150ms de colchon**: si lo
   pasaste sin mantener, pulsar despues lo cobra igual. La ventana cruda del orb son 157ms a
   v=700. Verificado en la escena real: sin nada no engancha, a los 120ms si, a los 400ms no.
5. *"el 2D solo deja deslizar"* -> **el tramo 2D pasa a ser salto/slide alternado**
   (f78 low / f79 high / f80 low / f81 high / f82 low). Su contenido NO sale de la grabacion
   (ahi no hiciste nada): esta escrito a mano y lo verifica un solver de un carril en
   `test-music.js`, que ademas mide la ventana de cada pulsacion: **220ms**
   (salto -35..+185ms, slide -140..+240ms).
6. *"salir del 2D siempre me hace chocar"* -> eran dos cosas. La zona terminaba en la f83 y
   se comia el cambio de carril de las 38.646s (arreglado antes, `to: 82`), y ahora ademas
   el solver **incluye la fila siguiente a la zona**, que es donde vuelve la camara 3D: si
   salir del 2D fuera injugable, el test falla.
7. *"el simbolo tiene que decir la tecla"* -> cada caja lleva su simbolo **dibujado en la
   cara**: `low` chevron hacia afuera del piso (saltar), `high` chevron hacia el piso
   (deslizarse), `block` una X. Los trazos van en el espacio `uv` de la cara, o sea que el
   mismo dato sale bien en 3D, de perfil y de cabeza: con `g=-1` la cara se da vuelta sola y
   el chevron sigue apuntando **a donde te lleva la tecla**, no a donde apunta la pantalla.
8. *"el hitbox tiene que ser menos"* -> `PLAYER_D` de **40 a 28** (el ancho no existe: se
   choca por indice de carril). Medido a v=700: salto 220 -> **240ms**, slide 380 -> **400ms**,
   hueco entre dos cajas del mismo carril 297 -> **314ms**, tramo 2D 220 -> **240ms**. No
   abre ninguna pared: sigue sin cruzarse una zanja de 3 y sigue sin saltarse la caja.
9. *"los marcadores de audio que no son el beat tienen que hacer algo, laseres"* ->
   `drawRave`: las cues `accent` (40) y `voice` (1) dibujan una banda en el plano del suelo
   **fuera de la pista** (`|x|` 300-640) mas una viga que sube del borde. Alto y grosor salen
   de la `v` de la senal, el brillo de la distancia. Afuera a proposito: adentro volveria a
   tapar obstaculos. El kick (95 cues) NO dispara nada: si no, es una luz fija.
   Coste medido: `draw()` media 0.51ms, p95 0.9ms, max 3.1ms (400 frames a x1 sonando).
10. *"saca la gravedad de este nivel"* -> fuera la cue `{ row: [88, 104], role: "flip" }`.
    El mecanismo queda entero (rol, `flipAt`, el porton verde, la tecla `H`) y sus tests
    corren contra un nivel propio, asi que no se perdio cobertura. Se devuelve con esa linea.
11. *"el 2D no da tiempo a reaccionar"* -> la zona pasa de **f78-f82 a f76-f82** y las dos
    filas nuevas van **vacias**: 923ms de pista 2D antes del primer obstaculo. No se puede
    empezar antes: el ultimo cambio de carril de la grabacion es el de la f77 y al final de
    la f75 ya venis en el carril 1, que es el de la zona. Los dos cambios de la f76-f77 que
    la zona se come son una ida y vuelta al carril 2 que ya no hace falta (la zona tira los
    obstaculos de los otros dos carriles), y eso ahora lo decide el test replayando la
    grabacion **pineada**, no contando cambios comidos. Medido en la escena real: la camara
    de perfil dura 3.23s (antes 2.31s) y la corrida entera sigue en 0 muertes, 3 vidas.
12. *"hay que forzar la accion, no dejar carriles libres"* -> se aplicaron tus 5 ediciones a
    mano (t8, t10, t29, t38, t40) y con eso la grabacion original **ya no esquiva su propio
    nivel**: se come 5. Eso era un assert, y era el assert equivocado, porque asumia que el
    nivel es el negativo de la corrida. Ahora es reporte, y que el nivel se pueda pasar lo
    prueba un **solver**: busqueda en anchura por filas con la fisica de verdad (cada carril x
    cada accion en 5 tiempos del beat, simulado a 240Hz, estados deduplicados por
    `(carril, y, vy, deslizando)`). Pasa al piso y de cabeza, y tarda 0.5s.
13. *"los costados anchos estan vacios, laseres como en la foto, y luces que se muevan"* ->
    dos capas. **`drawRig`** (nuevo, espacio de pantalla): dos emisores fuera de cuadro abren
    un abanico de 11 vigas con halo, mas 3 focos que derivan. Va antes del suelo y del
    skyline, o sea que vive en el cielo y los edificios lo tapan: no hace falta recortarlo
    contra la pista (medido: a `zn`=60 el borde de la pista cae en x=6395 de 2528, no hay
    franja lateral). Brillo = el kick (`pulse`), barrido = el compas, color = `hash(compas)`.
    Y **`drawRave`** se ensancho de `|x|` 640 a 1400 (los barridos de suelo ahora cruzan la
    pantalla entera) y perdio la viga vertical, que se leia como un andamio amarillo.
    Coste medido con todo puesto: `draw()` media 0.5ms, p95 0.6ms, max 0.9ms (700 frames).
14. *"los laseres solo en el drop o en las marcas del buildup, mas intensos, y tubos de luz a
    los costados apuntando a los lados"* -> ahora la luz la manda la **seccion** de la
    cancion (`sections` + `sectionAt`, nuevos en `music.js`), no el frame:
    - **drop**: rig clavado, late con el kick. Medido: encendido el **100%** del tramo.
    - **buildup**: solo las **marcas** (`accent`/`voice`, no el beat), cola 0.3s. Medido:
      encendido el **25%**, mediana 0. Ese contraste es lo que hace que el drop pegue.
    - **break**: **0**, luces apagadas enteras.
    - **`drawPins`** (nuevo): tubos de luz en `x = ±430`, uno cada dos beats, viajando con la
      pista. Todo el rig apunta al mismo lado durante un compas, sacado de `PIN_DIRS` con
      `hash(compas)`: `v`, `<-`, `->`, `<-`+arriba, arriba+`->`, `<-`+abajo. Espejados
      izquierda/derecha y barriendo dentro del compas. Se apagan de lejos **y de muy cerca**:
      el cono pegado al jugador tapaba el obstaculo que hay que leer.
    - la **banda del 1 de cada compas** se enciende con el color de la seccion, asi que el
      suelo cuenta compases en vez de ser siempre el mismo gris.
    Coste medido en el drop, con todo: `draw()` media 0.5ms, p95 0.6ms, max 1.7ms (800 frames).
15. *"las cajas tienen que brillar con el beat, una mascara para que cueste ver lo de atras,
    tunear el jugador, sacar el 2D y arreglar esas barras de musica"* ->
    - **Niebla** (`drawBox`): `f = clamp((z-720)/1600,0,1)^2`, el color se va a la mitad entre
      suelo y cielo y el alpha baja a 0.6. El 1600 esta medido: a v=700 las cajas caen una
      cada **323z** (una por beat), asi que con el rango entero (3280) la 2a y la 3a daban
      f=0.02 y 0.05, o sea nada. Con 1600: la de encima 0.00, la 2a 0.05, la 3a 0.17, y de la
      5a (z=2361) en adelante hundida.
    - **Latido**: la cara se aclara con el kick y le sale un halo del color puro, los dos
      por `1 - f`, o sea que **solo late lo que esta cerca**.
    - **Jugador**: contorno negro en cada miembro (cada uno se dibuja dos veces) + torso y
      cabeza, y un anillo de beat a los pies. Antes se perdia contra los conos y las cajas.
      Un halo ovalado detras se probo primero y se tiro: sobre una caja roja se leia como un
      ataud.
    - **2D fuera**: `zones: []` en el nivel. El mecanismo entero queda (igual que el flip) y
      el test lo afirma. El solver por filas confirma que sin la zona el nivel se sigue
      pasando **al piso y de cabeza** (vuelven los obstaculos de los otros dos carriles en
      f76-f82, que la zona tiraba).
    - **Barras del eq**: cada una resuena en su propia subdivision del beat (1, 1/2, 1/3,
      1/4) + empuje del kick, y un **pico** casi blanco que baja mas lento. Primer intento
      con el kick a 0.55: casi todas tocaban el tope a la vez y volvia la valla, en cada
      beat. Kick 0.36 / resonancia 0.55. La capa paso de `step` 26 a 32 y de `h` 0.26 a 0.34.
    Coste medido en el drop con todo: `draw()` media 0.5ms, p95 0.7ms, max 5.7ms (1221
    frames; el max es un outlier suelto, la p95 no se movio).
16. *"los laseres cruzados mas anchos y visibles, que las cajas y el suelo vayan con los
    agudos antes del drop y con el bajo en el drop, un embudo/tunel en el break sin cambiar
    de camara, formas flotando a los costados, y tuneles de luz en la pista"* ->
    - **Pins mas anchos**: el cono paso de **620 x 0.13** a **900 x 0.26**, y ahora son dos
      superpuestos (ancho tenue 0.26/0.13 + angosto fuerte 0.09/0.2) con nucleo de 5px. El
      borde marcado es lo que lo hace laser: solo subir el alpha lo dejaba mancha.
    - **Bajo vs agudos** (`glow` por seccion en `LEVELS`, `this.beat` en el renderer):
      `{ buildup: "mark", break: "bg", drop: "bg" }`. Se separo de `this.pulse` (el kick),
      que se queda con el decorado (rig, pins, barras). Medido en el buildup: en un mark
      (t=22.31) `beat`=0.86 / `pulse`=0.09; entre marks (t=24.09) `beat`=0.00 / `pulse`=0.13,
      o sea el kick suena y las cajas no lo siguen. El break va con `"bg"` porque no tiene
      marcas: medido, **1 kick y 0 accent** en sus 1.85s. Cuentas por seccion: buildup
      8 marks / 30 kicks, drop 32 marks / 64 kicks. `test-music.js` falla si una seccion late
      con un rol que no tiene ni una cue en el tramo.
    - **Embudo del break** (`drawGates`): portones abiertos abajo (cerrarlos los lee como
      obstaculo) unidos por aristas largas, uno por beat, cyan, con la boca mas abierta
      adelante (`1 + 0.5*(1-d)`). **La camara no cambia**, es geometria del mundo: seguis en
      3a persona. Primer intento: el porton de encima llenaba la pantalla y se leia como
      andamio -> `clamp(d*3)` en el alpha, y la boca bajo de `1 + 1.1*(1-d)` a `1 + 0.5*(1-d)`.
      Lo que lo convirtio en tunel fueron las aristas entre porton y porton, no los portones.
      En el drop es el mismo dibujo cada dos beats, rosa y con el brillo del bajo.
    - **Formas flotando** (`drawShapes`): triangulo / cuadrado / hexagono por `hash`, una por
      compas de cada lado, `|x|` de 620 a 1040 (fuera de la pista), color de la paleta por
      `hash(indice)` y contorno que engorda con `this.beat`. Se apagan con `rave`, o sea que
      en el break no hay ninguna, y las mas cerca que `PLAYER_Z+200` no se dibujan.
    Coste re-medido en el drop con las cinco capas: `draw()` media **0.6ms**, p95 **0.7ms**,
    max **1.5ms** (1228 frames a x1 sonando).

17. *"las formas que brillen mas, estrobos en el break, los portones del drop mas grandes y
    con mejor forma, el suelo y los obstaculos no reaccionan a la musica, los huecos tienen
    que decir que no se tocan, y todo al neon violeta del nivel"* ->
    - **Color**: el nivel entero pasa a `NEON` (violet / pink / accent / accentSoft): pins,
      portones, formas, laseres del suelo y divisores de carril. Los obstaculos se salen de
      esa familia porque son lo unico que hay que leer: **rojo = mata** (`block` y `gap`, y
      nada mas es rojo), **accent = se pasa con una tecla** (`low` y `high` del mismo color,
      cual de las dos lo dice el simbolo de la cara). El amarillo/verde de `TAG_COLORS` se
      queda solo para las lineas numeradas del modo diseno.
    - **Huecos**: eran una baldosa cyan, o sea decoracion. Ahora negro + dos anillos tirados
      al centro (eso es lo que le da fondo) + borde rojo que late. Los anillos se calculan
      tirando cada esquina al centro: mismo dato en 3D y de perfil, sin un `if`.
    - **Reaccion a la musica**: TODAS las bandas del suelo laten (`0.28 + 0.4*beat`), no solo
      la del 1 de compas; las cajas se aclaran el doble (`0.3 -> 0.55`) y el halo pasa a dos
      trazos (ancho tenue + angosto fuerte), que es lo que se lee como neon.
    - **Portones del drop**: arco de 6 puntos en vez de rectangulo (el marco cuadrado se leia
      como andamio) y **760x620**, casi el doble, respirando un 7% con el bajo.
    - **Formas**: tres trazos (halo, nucleo, blanco fino) y piso de brillo `0.6 + 0.4*beat`:
      latiendo desde 0 se veian solo en el golpe y el resto del compas no estaban.
18. *"blinders en el buildup antes del break, y en el break apagon de todo menos las letras,
    que vuelva un beat antes"* -> `drawFlash`, la unica capa que se dibuja sobre todo.
    - **Blinders**, ultimo compas del buildup: medido **12 flashes, de 338ms de hueco a 98ms,
      encendido 45% del tramo, alpha pico 0.60**. Primer intento con `t % sub` y `sub`
      variable: eso NO es una fase y salia parpadeo caotico (368 bordes medidos en vez de 12).
      Se cambio por una fase integrada (`4u + 8u²`).
    - **Apagon** todo el break, entrando en 0.12s. Las letras del acid son objetos de texto de
      Phaser, o sea que van por encima del `Graphics` y quedan solas en el vacio. Vuelve todo
      en **29.077s = un beat antes del drop**. Es jugable y esta medido: en el break no hay ni
      un obstaculo (los de alrededor caen en 27.23 y 29.54) y el primero del drop pide saltar
      sin cambiar de carril, con **462ms** de aviso (la ventana de una fila).
19. *"que los bloques de agacharse no tapen, y otras animaciones de entrada, distintas entre
    buildup y drop"* ->
    - **`high` transparente de cerca**: de 700z para aca el relleno se va a 0.2 y el contorno
      y el simbolo se quedan enteros. Se lee la silueta, no tapa lo de atras.
    - **Entradas por seccion** (`enter` en `LEVELS`): `grow` (crece del piso) en el buildup,
      `wide` (entra ancho y se cierra) en el break, `slam` (cae del cielo) en el drop.
      Duran `ENTER_BEATS` = **5 beats de viaje**. Primer intento con 1 beat: la animacion
      entera pasaba entre z=4000 y z=3677, donde la caja mide 2px y no se ve nada. Con 5
      termina en **z=2385, a 1665 del jugador**, o sea justo donde se acaba la niebla (1600):
      entra entera en la zona hundida. Es puro dibujo, la hitbox no se entera.
    Coste re-medido en el drop: `draw()` media **0.5ms**, p95 **0.8ms** (1355 frames).
20. *"el suelo por sectores, la entrada no se ve, quakes y mas blinding en el drop, la X menos
    roja, las paredes no reaccionan a la musica, la X como triangulo, todo un poco wooby, y
    los bordes de pantalla que reciban el golpe"* ->
    - **Sectores de suelo** (`sectors` en `LEVELS`, `sectorOfRow` en `music.js`): tramos de
      filas con su propio tinte. **8 tramos de 20 filas** cubren las 127. Es SOLO el color de
      las bandas: no toca cues ni fisica. El tinte quedo en `0.32 + 0.35*beat`; con el primer
      valor (0.45) el sector se comia la pista entera y el suelo dejaba de ser suelo.
    - **La entrada ahora se ve**: `ENTER_BEATS` 5 -> **7**. Con 5 terminaba en z=2385, o sea
      dentro de la niebla (f=0.68): por eso no se veia. Con 7 termina en **z=1738, a 1018 del
      jugador (f=0.41) y 1.45s antes del impacto**, que son 3.2 beats de sobra para leerla.
      Ademas `slam` cae de **2600** (era 900) y hay una entrada nueva, `roll`: entra girada
      135 grados y se endereza sobre su base. El buildup va con `roll`.
    - **Quake en el drop**: `translateCanvas` con `pulse^3` a 9.7 y 7.5Hz, mas un vaiven
      ("wooby") de **±16px cada 2 compases** siempre encendido. Medido monkey-patcheando
      `translateCanvas` sobre 1362 frames: **x -28.4..+28.4px, y -8.6..+8.6px**, y solo el
      **6% de los frames** se mueve mas de 2px. Es pantalla, no mundo: la proyeccion y la
      hitbox no se enteran.
    - **Mas blinding**: blanco a pantalla completa en **cada kick del drop**, `0.22*pulse^3`.
      Medido: pico de alpha **0.20** sobre el kick y por debajo de 0.01 el **60% del beat**,
      o sea que entre golpes el fondo queda limpio. Con 0.3 el cielo se ponia gris.
    - **La X menos roja**: `KILL = 0xed4679` (rojo 60% hacia el rosa). Y como el rosa quedaba
      a un paso, se saco del decorado: `NEON`, los portones del drop y el `voice` del rave
      pasaron a violeta/accentSoft. Nada que decore se parece a lo que mata.
    - **Las paredes laten**: el blanqueo del beat subio de 0.55 a **0.75**, el halo de
      0.22/0.55 a **0.35/0.85**, y el contorno ahora engorda y se aclara con `this.beat`.
    - **La X es un TRIANGULO** (silueta y tapas laterales), asi que no corta la vista de lo
      que viene detras. **La hitbox no cambio**: sigue siendo la caja entera.
    - **Simbolos al doble**: chevron duplicado (dos galones) y trazo de `d*0.09` con minimo 3px.
    - **El marco recibe el golpe** (`drawEdges`): banda inferior + laterales que salen con
      `this.beat` y revientan con cada obstaculo que te pisa (envolvente de 140ms). Se dibuja
      DESPUES de deshacer el temblor: el marco va quieto aunque el mundo tiemble.
    Coste re-medido en el drop: `draw()` media **0.4ms**, p95 **0.6ms**, max 2.8ms (1454 frames).
21. *"el roll en el buildup es un poco silly, probemos que entren de izquierda o derecha; el
    roll del drop dejalo. Y los huecos rojos que se enciendan en sync y muestren una X,
    animado tipo tile, medio beat, siguiente tile"* ->
    - **Entrada `side` en el buildup** (el drop se queda como estaba): la caja sale de
      **x=1500** (el carril de afuera esta en 170, o sea 7 veces mas afuera) y se desliza
      hasta el suyo. Va en el MUNDO y no en pantalla como `roll`, asi llega con la
      perspectiva de su carril. El lado sale de `hash(fila)`, no de `Math.random`.
      Medido: arranca a **398px** de su carril (pantalla de 2528) y a mitad de viaje (z=3000)
      todavia va **165px** corrida con la caja midiendo 53px de alto: se corre tres veces su
      propio tamano, o sea que se ve. `roll` sigue existiendo, solo dejo de usarlo el nivel.
    - **Los huecos llevan X**: la misma que el `block`, sobre las diagonales del agujero. El
      `gap` mata igual, asi que lleva el mismo simbolo; antes la lectura dependia de saber
      que el borde rojo mata.
    - **La zanja corre** (`chaseAt` en `music.js`): se enciende **un hueco cada medio beat**
      (231ms) y vuelve al principio cada 4 (923ms), asi que la zanja se lee como una luz que
      viene hacia vos. Es funcion pura de `(fila, songT)`, o sea que rebobinar lo rebobina y
      toda la pista va en fase. La estela `[1, 0.35, 0.12, 0.12]` es lo que le da direccion:
      con on/off seco cada hueco parpadea por su cuenta. `test-music.js` lo mide (uno de cada
      cuatro encendido, se corre una fila cada medio beat, vuelve cada dos beats).
22. *"la 1a persona se ve silly; y las barras del fondo que reaccionen de verdad a la musica:
    esta version guardala, pero hace otras (espectrograma con color, de izquierda a derecha,
    desde el centro, espectrograma crudo, y una que no sea espectrograma con formas), una por
    tramo asi las veo todas y elijo"* ->
    - **1a persona, tres arreglos** (todos de dibujo, la fisica no se entera):
      - **Plano cercano 40 -> 90**: con 40 la escala llegaba a `s=21` y un hueco del carril
        de al lado se comia un cuarto de la pantalla. Con 90 el maximo es **s=9.4**.
      - **`pasa(zf)`**: lo que esta a menos de **500** (0.71s a v=700, o sea despues de la
        ventana de reaccion) se apaga hasta 0, en `drawBox` y en `drawGap`. La camara esta
        dentro de la pista: la caja de al lado a tu misma altura proyectaba contra el plano
        cercano y tapaba media pantalla. En 3a persona devuelve 1: no cambia nada.
      - **Cadencia + capo**: dos zancadas por beat (medido por `test.js`: **7px en x y 5px
        en y** a 400 de los ojos, y **0** en el aire y en dash) y `drawHood()`, que proyecta
        la sombra y el anillo de beat **por delante** de la camara (a 260 de los ojos).
        Sin muneco el campo cercano quedaba vacio y la vista se leia como una foto.
    - **Seis variantes de `eq`, una por sector** (`modes` en la capa, `drawBars`):
      `analyzer` (el de siempre, el unico con parallax), `sweep`, `center`, `spectro`
      (FFT real), `color` (FFT + `NEON` rotando por compas) y `shapes` (rombos).
      Repartidas `analyzer sweep center shapes spectro color shapes analyzer`: el sector 3
      es el break y va a oscuras, por eso `shapes` se repite en el 6 (dentro del drop).
    - El FFT es un `AnalyserNode` colgado de la **fuente** y no de `gain`: mutear no lo apaga
      y no suena dos veces. Es lo unico del render que **no** es funcion de `songT`.
    - Ajustes medidos en la primera pasada visual: la cola del barrido iba al reves (la
      cabeza brillante tiene que ir adelante), el piso subio de 0.10 a **0.18** porque
      `center` se leia muerto, y los rombos de `shapes` pasaron de 0.22 a **0.4** de radio
      base: chicos se leian como confeti.
23. *"las formas flotantes: mas glow retro y BLANCAS para que se vean. Y que aparezcan en la
    linea amarilla y se apaguen en la siguiente, y asi"* ->
    - **Glow retro con nucleo blanco**: cuatro pasadas (`26+34*beat` / `12+16*beat` /
      `5+6*beat` / `2.5`), las dos anchas en el color del `NEON` y el nucleo en `0xffffff`.
      El neon de verdad es un tubo blanco con el color derramado alrededor.
    - **Parpadean con las marcas** (`markWin`): encienden EN una marca (accent/voice, las
      lineas amarillas) y apagan en la SIGUIENTE, y solo si el hueco es <= **1.5 beats**.
      Las marcas del drop vienen de a pares (#46+#48 en f67-f68, #52+#54 en f71-f72, ...),
      o sea un destello de **un beat por compas**; entre par y par (3 beats) no hay nada.
      Medido: **21% del drop encendido**. Rampa de 60ms para que no salte un frame.
      `test-music.js` recorre las marcas del drop y exige ventana abierta dentro del par y
      cerrada entre pares.
    - Aclaracion tuya despues: la constelacion que te gusta es la de **rombos del `eq`**
      (`drawBars`, modo `shapes`), no las formas de los costados. Lleva el mismo glow de
      cuatro pasadas, a la mitad de alpha: es fondo, si pega igual compite con lo que se juega.
24. *"un FX de esos que corren en GPU, un 'layer effect' que muestre todo BLANCO Y NEGRO y
    solo las LINEAS, tipo fantasma, para el break despues del apagon"* ->
    - **Tecla `P`**. No es un shader: se envuelven `fillStyle`/`lineStyle` del Graphics una
      sola vez en `create()`, o sea la unica puerta por la que pasa el dibujo entero. Cero
      `if (ghost)` en las 20 funciones de dibujo, y no se pierde el fallback a canvas.
    - Relleno **a gris** (luma * 0.28) y no a negro: sigue tapando lo de atras (las siluetas
      y la profundidad se leen) y el jugador no desaparece, que es todo relleno. Trazo a
      **blanco puro** conservando grosor y alpha. El **negro se queda negro**: es el contorno
      de dos pasadas que despega al muneco del fondo, invertirlo lo borraba.
    - Medido a t=49.5s: **1.5% de la pantalla con color** contra 50% en normal. Ese 1.5% es
      el HUD y los `f<n>`, que son objetos de texto de Phaser y no pasan por el Graphics.
25. *"esos rombos: ponles un nombre. NO se ven hasta la f63, y en la f63 tambien el fantasma,
    y al beat siguiente todo normal y la constelacion desaparece. Blancos y con glow, que
    contrasten con el fantasma"* ->
    - Se llaman **`constelacion`** (antes el modo `shapes` del eq; las de los costados siguen
      siendo `drawShapes`, son otra cosa).
    - **`GHOST_ROW` = 63**, la ultima fila del break. Es exactamente el hueco entre apagon
      (29.077s) y drop (29.538s): **462ms, un beat**. Mas largo pisa el drop, mas corto es un
      parpadeo. `this.ghost = tecla || rowAt(t) === GHOST_ROW`, o sea funcion de `songT`:
      rebobinar lo rebobina.
    - La constelacion pasa a ir **sola en el sector 3** (f60-63). Las tres primeras filas de
      ese sector estan a oscuras por el apagon, asi que se la ve **un unico beat en todo el
      nivel**. El sector 6 (que la repetia) se queda con `sweep`.
    - En fantasma su relleno va **blanco entero** (el wrapper deja pasar el blanco puro, como
      ya dejaba pasar el negro). Medido en la banda del cielo: **5.9% de blanco puro en la
      f63 contra 0.0% en la f64**, y la pantalla pasa de **1.4% de color a 58.7%** al beat
      siguiente.
    - `test-music.js` falla si las tres cosas dejan de caer juntas (arranque del fantasma =
      fin del apagon, fin del fantasma = arranque del drop) o si la constelacion aparece en
      mas de un sector.
26. *"en la #46 fantasma + constelacion, y que lata con el beat en la f68. Lo mismo en la
    #52. Y asi"* ->
    - Es la ventana que ya existia para las formas de los costados (`markWin`): prende EN una
      marca y apaga en la SIGUIENTE si estan a menos de 1.5 beats. #46 (f67) -> #48 (f68),
      #52 (f71) -> #54 (f72), y asi hasta el final.
    - Una sola linea en `draw()`: `ghost = tecla || f63 || markWin > 0.02`. Y `drawBars` pasa
      a `constelacion` cuando hay fantasma, sin mirar el sector: **el fantasma trae la
      constelacion**, son un efecto y no dos que sincronizar.
    - Medido: **15 destellos, 23% del drop, 0% del buildup** (ahi las marcas van filtradas y
      no caen a menos de 1.5 beats: no puede volverse un parpadeo permanente, y el test lo
      afirma). Late con el kick: en el mismo destello, **18.3% de blanco en la banda del
      cielo con `beat`=0.75 contra 9.2%** con el beat ya caido.
    - El corte va en 0.02 y no en 0.5: `markWin` tiene 60ms de rampa para que las formas
      entren suave, pero el fantasma es un corte seco y con 0.5 arrancaba 30ms tarde.
27. *"que la constelacion cambie de figura: el 1er beat el de siempre, el 2o hexagonos y esas
    cosas, que se muevan"* ->
    - `FIGS` en el renderer: `{ n, rot, spin, sway }` = lados, angulo de arranque, vueltas por
      compas (el signo es el sentido) y vaiven horizontal. Rombo quieto -> **hexagono
      girando** -> triangulo con vaiven -> cuadrado plano girando al reves -> pentagono.
      15 destellos sobre 5 figuras: `1 2 3 4 0 1 ...`.
    - `flashIdx(t, cues, beat)` cuenta **ventanas abiertas**, no marcas: 0 antes del primer
      par (la f63, o sea el rombo aprobado), 1 en la #46, 2 en la #52. Dentro de una ventana
      no cambia, asi que la figura **aparece ya siendo otra** en vez de transformarse en
      pantalla: `test-music.js` lo mide al principio y al final de cada destello.
    - El vaiven va a media vuelta del flotar vertical: describe un 8. En fase era una diagonal
      y se leia como que se desliza, no como que flota.

28. *"merge del worktree del muneco: quedate con las features de main y trae solo el avatar"* ->
    - La rama `worktree-feature+player-sprite` salio de `8e01896` y rehizo por su lado cosas
      que main ya tenia (paleta, entrada por seccion, blinders, tunel), asi que el merge dio
      **7 conflictos**. Se resolvieron todos a la version de main y el muneco se porto a mano.
    - Lo que entro: `avatar.js` (el muneco en vectores, en unidades de SU alto),
      `tools/avatar.html` (el banco de poses), `assets/player/sheet-v1.png` (referencia),
      `ride()` en `physics.js` (flote + brazos, funcion de la cancion) y sus tests.
    - Lo que salio: `runPhase` y el muneco de palos de `drawPlayer`. No hay ciclo de carrera
      que sincronizar: va en tabla sobre una pista plana.
    - El fantasma no necesito una sola linea: el avatar dibuja por el mismo `Graphics`
      envuelto, o sea que pasa por el filtro como todo lo demas (verificado a t=35.2).

29. *"quiero seguir la cancion desde el 3:41 pero SIN perder lo que ya hay, y que la Y no
    pise nada anterior"* ->
    - **El schema se APENDA, no se rehace.** Entraron **127 eventos a mano** (92 `kicks`,
      16 `acidbass`, 16 `response`, 3 `snare`) sobre los 315 que ya estaban. Como `cues()`
      ordena por `t` y RECIEN ahi numera, los `#n` viejos no se movieron ni uno.
    - **La marcada a mano iba adelantada 69.3ms** (media circular contra la grilla, **sd
      33ms**): o sea un sesgo, no jitter. Se corrigio **global** y despues se cuantizo por
      tag (kicks/response/snare al beat, acidbass al 1/4 de beat). Cuantizar sin corregir el
      sesgo primero manda la mitad de las marcas al beat de al lado.
    - `trim.end` 221.746 -> **264.207693** = `start + 220*beat`, o sea que el corte cae en
      fila entera igual que antes caia en la 128. **La pista pasa de 128 a 220 filas**
      (59.077s -> 101.538s). Los **85 kicks** marcados despues del corte se tiraron.
      Re-cut con `ffmpeg -vn` (el m4a original trae caratula: sin `-vn` falla con
      "Could not find tag for codec h264" y te deja el archivo a medias).
    - Dos secciones nuevas (**drop2** f128-189, **outro** f190-219) con su `glow`, su `enter`
      (`roll` / `grow`), 6 sectores de suelo mas y `modes` del eq hasta 14. El corte
      drop2/outro va a la **fila 190**: es el beat mas cercano a la marca (187ms) contra
      736ms del compas mas cercano, y el sector del suelo se alineo ahi para que la junta
      se vea.
    - **`response` y `snare` son `fx`, no `mark`.** Con `mark` el test cazo que la
      constelacion **cambiaba de figura a mitad del destello**: la respuesta cae 0.25-1.00
      beats despues del par de acid, o sea **19 de 34 huecos a <=1.5 beats**, encadenando de
      a 3. Como `fx` siguen barriendo el suelo y siguen teniendo su linea numerada, pero no
      abren ventana. Medido despues: **drop2 = 8 destellos, 8% del tramo** (drop: 15 y 23%).
30. *"si aprieto Y que no pise nada anterior, solo de aca al final"* ->
    - `Y` ahora **tira lo grabado posterior a `songT` y anota `recFrom = rowAt(songT)`**.
      `toScript(..., from)` replaya desde 0 igual (hace falta el estado del jugador) pero
      **no emite una sola directiva antes de esa fila**, y el volcado lo dice arriba.
      O sea: lo escrito a mano en f0-127 no se puede perder por accidente. Antes NO estaba
      protegido: `U` reescribia el guion entero.
    - **Clic en la tira de abajo = ir al arranque de ese sector** (`shift` = al compas).
      `stripSeek` sale del mismo rectangulo que dibuja `drawStrip`, asi que no hay un segundo
      mapa de coordenadas que mantener. Verificado con clics de verdad: al 90% de la tira
      salta a 87.692s y **no** arranca la musica, y un clic fuera de la tira sigue dando play.
    - Retocar un tramo VIEJO: clic en su sector -> `Y` -> jugarlo hasta el final -> `U`, y se
      reemplazan las filas de ahi para abajo. No hace falta tocar lo anterior.

31. *"con V al mas rapido las cajas nunca llegan al suelo, quedan a la altura de mi cabeza"* ->
    - No era la caja: era la **ENTRADA sin terminar**. Dura 7 beats de VIAJE, y el viaje se
      acorta con la velocidad: a v=700 son 10.15 beats, a x1.5 **6.77** y a x2 **5.08**, o sea
      menos que la entrada. Medido a x2 sin topar: la caja te pisaba con la entrada al **73%**,
      con el `slam` a medio caer, flotando **185 sobre el piso** (mide 150 de alto). Fotografiado
      antes y despues: antes los triangulos flotaban contra el skyline, ahora estan en el piso.
    - `enterDz(beat, speed)` topa la distancia a lo que quepa dejando **2.2 beats** libres: la
      entrada esta hecha antes de la ventana de lectura a cualquier velocidad. 2.2 y no 2
      porque a x2 esos beats son 1421z, justo por dentro de los 1600 de la niebla (con 2.5 se
      pasaba a 1615). A x1 y para abajo no cambia nada: manda el minimo de siempre.
    - `SPEED_MULS` se mudo al `physics.js` para que el test pueda correr el assert a las cinco
      velocidades. Medido despues: x1 termina a 1018 (3.2 beats), x1.5 a 1066 (2.2), x0.75 a
      1584 (6.5), x0.5 a 2149 (13.3), x2 a 1422 (2.2).

## La tanda del nivel 2 (`orbit-motion`)

Todo esto es **nivel 2 y nada mas**. La regla dura de la tanda fue **el nivel 1 no se mueve un
pixel**, y no es una promesa: se sirve `git archive HEAD` en otro puerto, se abren los dos en la
misma sesion de Chrome, se pausa en el mismo `songT` y se restan los PNG. Medido al cerrar:
**0 px distintos y max delta 0** en t = 12 / 36.3 / 50.2 / 65 **y en las tres camaras**. Por eso
cada dial nuevo trae su respaldo puesto en lo que el renderer hacia antes de existir el dial: si
el respaldo no es exacto, el diff de pixeles lo canta.

32. *"un segundo nivel con la otra cancion, y que sea de 4 carriles"* ->
    - **Se elige por URL**: `?level=orbit-motion`, y sin parametro va `insomnia-drop`. El
      respaldo no es cosmetico: `?level=` vacio o con un nombre que no esta en `LEVELS` caia en
      `LEVELS[undefined]` y reventaba dentro de `loadLevel` leyendo `.schema` de `undefined`,
      o sea pantalla negra.
    - **El nivel 2**: 137bpm (beat 0.43796s), **165 filas f0-f164 = 72.31s**, cuatro secciones
      (buildup / break / drop2 / outro), 10 sectores de suelo, **117 cues (32 bg, 60 mark,
      25 fx) y CERO obstaculos**, a proposito: el guion se dicta bailando despues.
    - **Cuantos carriles lo dice el nivel (`lanes`), el paso no**: `lanesX(n)` = `(i-(n-1)/2)*170`,
      o sea **170 siempre**, y con 4 la pista se **ENSANCHA** de 510 a 680 en vez de apretarse.
      Repartir 4 en el ancho viejo daria paso 113 y un `high` mide **140 de ancho**: se
      solaparian en pantalla y no se sabria de que carril es cada caja. Con 170 el borde de una
      caja queda a **15** del borde de la de al lado, y `test-music.js` falla si el paso baja de
      `KINDS.high.w * 2`.
    - **Sumar un carril no cambia ni una ventana de tiempo**: se choca por INDICE de carril, o
      sea que `beat - (d + PLAYER_D)/v` no lleva N por ningun lado. Lo que si se midio fue la
      VELOCIDAD, porque el beat es mas corto: 0.43796s contra 0.46154s son **23.6ms menos por
      fila**, asi que para dejar la misma ventana de carril hace falta
      `v = 103 / (0.43796 - 0.36437)` = **1400**. Medido a 1400: ventana de carril **364.4ms**
      (la del nivel 1 a 1060, con 0.02ms de diferencia), la caja te tapa **73.6ms** (contra
      97.2) y el hueco **112.9ms** (contra 149.1). El viaje si se acorta, 7.07 -> **5.35 beats**,
      o sea menos que los 7 de `ENTER_BEATS`: la entrada va topada por `enterDz` como en el
      nivel 1 (termina a **1349** del jugador, 2.20 beats antes del impacto).
    - Todo lo que se ensancha cuelga de **un solo numero**, `edge = -laneX[0] + 85` (**255** con
      3 carriles y **340** con 4): bandas del suelo, numeros de fila, barrido del rave, lineas
      numeradas, porton del flip y pins. Con N=3 las seis cuentas dan **exactamente** los
      numeros que estaban escritos a mano (290, -282, 300, 320, 430), que es lo que deja el
      nivel 1 en 0 px. Y el zigzag de `defaults()` pasa de `(i*2)%3` a `(i*(N-1))%N`: con 3 da
      los mismos 0,2,1 y con 4 da 0,3,2,1, mientras que `(i*2)%4` daria 0,2,0,2, o sea **la
      mitad de la pista muerta**.
    - **El fondo lo declara el nivel** (`decor`), y la lista blanca **sale del renderer**:
      `test-music.js` lee `AIRunnerGame.js`, saca los nombres de los `dec("...")` que hay en el
      codigo y falla si un nivel pide una capa que nadie dibuja. El nivel 1 declara las ocho que
      ya tenia, el 2 solo `["mesh", "reactor"]`. **El fallback tiene que ser `false`**: `draw()`
      corre antes de que `boot()` resuelva `this.lv`, o sea que con `true` el nivel 1 dibujaba
      la malla y el reactor del nivel 2 durante los primeros frames.
    - Dos capas que se creian globales y eran del nivel 1: **`flash`** (el nivel 2 heredaba
      2.47s de negro absoluto en su break y un estrobo violeta que ni siquiera es su paleta) y
      **`ghost`** (`GHOST_ROW` = 63 es una fila del nivel 1, y aca la marca es la linea del acid,
      que esta abierta el **40% del buildup y el 69% del drop2**: el nivel se pasaba media
      cancion en blanco y negro). `P` lo sigue forzando a mano en cualquier nivel: es una
      herramienta. Lo que NO va por `decor` es el golpe blanco de cada kick del drop, que es de
      todos los niveles; lo que estaba mal ahi era `sec === "drop"` (la seccion del 2 se llama
      `drop2` y se quedaba sin respuesta de pantalla): ahora `startsWith`.
    - **La paleta la declara el nivel** (`neon: {fam, sec, def}`). El nivel 1 declara
      exactamente lo que estaba hardcodeado (violet / accentSoft / accent / 7c3aed), o sea 0 px;
      el 2 va a la familia cyan-verde de sus referencias (`00d8ff`, `5fe8ff`, `a8ffff`,
      `3ef2b5`), que es de donde salen tambien la malla y el reactor. **`KILL` no entra ahi y no
      puede**: es lo unico que mata y por eso es lo unico caliente, en todos los niveles.
    - **Que hace cada senal se eligio contando eventos, no de oido**: `bass` = `bg` (32 golpes,
      31 en el buildup, y 23 de sus 31 huecos miden exactamente 2.00 beats: un metronomo a la
      blanca); `acid` = `mark` (60 eventos y **lo unico que suena en el drop2**, 28 de 28);
      `response1` / `response2` / `snare` = `fx`, porque son **rafagas** (3 golpes en la f10 y 2
      en la f11 y despues **71.32 beats sin nada**; 3 en la f19 y 55.38 sin nada; 5 entre la f32
      y la f34 y 32.32 sin nada) y de marca dejarian compases enteros a oscuras.

33. *"el fondo tiene que ser esto: un campo de olas a los costados"* -> `drawMesh`, en el plano
    del suelo, del borde para afuera (adentro taparia obstaculos, que es la queja que arreglaron
    los huecos). **Las referencias son OLAS y no una reja**, y de ahi sale cada numero:
    - **Tres senos de periodo distinto** (x, z y x+z) y no uno: con uno las crestas quedan
      paralelas y se lee como chapa acanalada. Los periodos se miden **contra el ancho
      visible**: con los primeros (`kx`=0.0042, `kz`=0.0031) entraban **0.58 crestas en el ancho
      y 0.53 en la mitad cercana en z**, o sea menos de una onda en cuadro: eso no ondula,
      bascula. Con `kx`=0.024 (periodo 261.8) son **3.28 crestas por lado** y con `kz`=0.0125
      (502.7) **2.13 en la mitad cercana**. Se probaron 0.016 (2.19: dos lomas, no agua) y 0.020
      (2.74) mirando la captura contra las fotos.
    - **El rizo del campo cercano**: contando maximos locales sobre el ancho realmente dibujado,
      la fila mas cercana daba **1.08 crestas** (z=1500 3.25, z=2500 2.79, z=4000 2.00), o sea
      que la fila de 234px de cresta a valle era **UN LOMO**. No se arregla subiendo `kx` (el
      ancho de esa fila en el mundo es 289: 3 crestas pediria periodo ~96 y saldrian picos de
      51px de alto por 48 de ancho). Se le puso una octava (periodo 83.8, peso 0.4 contra
      1 + 0.70 + 0.45) y z=700 pasa a **3.38 crestas** sin mover las otras tres z. **Se apaga a
      1000**, y eso es lo que lo hace gratis en Nyquist: donde el paso entre columnas ya no lo
      resuelve (3.2 muestras por periodo a z=1500) el termino vale 0.09 y su alias mide **4px**.
    - **La densidad sale de Nyquist**: filas cada **70** (eran 260, que con el periodo nuevo dan
      **1.9 muestras**, o sea por DEBAJO de Nyquist; 120 daba 4.2), o sea de 33 a **57 filas**
      cruzando la pantalla. Las columnas no son un numero fijo: salen del **paso en PANTALLA**
      (16px), porque `proj` es lineal en x y un paso constante en pantalla es un Nyquist
      constante donde se ve el alias. Medido: la fila cercana se queda en **28** columnas y las
      de lejos piden **35**, y el periodo de la ola **nunca baja de 3.0 muestras**. Repartidas
      LINEALES y no con `u^1.7`: a z=1500 dan **23.1px parejos** contra 17px entre las dos
      internas y 107 entre las externas con la potencia. Las lineas de cruce van **una de cada
      3**: con todas vuelve la cuadricula y ademas se duplica el coste.
    - **El alto es 120** y no 78: a z=1500 y h=651, cresta a valle son **71px con el golpe
      arriba y 32 entre golpes** con 78, y **109 y 49** con 120, que es cuando aparecen los
      valles oscuros de la referencia.
    - **El color va POR SEGMENTO y con signo**. Antes salia de un `max` POR FILA aplicado a la
      polilinea entera, o sea que las 15 filas salian del mismo tono y `MESH_HI` no aparecia
      nunca: la ola era plana. Con `(v+1)/2` el valle cae a `MESH_LO` (`0x063a4a`; con
      `0x0a6f8c` el valle todavia se leia como linea encendida) y la cresta llega a `MESH_HI`,
      pero **con gamma `^0.55`**, porque `v` es una suma de senos y se apila en el medio: con la
      mezcla lineal la malla llegaba a **p99 de luma 55.6 y solo 222px del canvas (0.027%)**
      pasaban de 60, o sea cyan apagado y no neon.
    - **El hueco contra la pista es constante en PANTALLA** (90px) y no en el mundo. Con 45 del
      mundo (20.5px a z=1500) la malla se pegaba a los divisores y se leia como que CRUZA la
      pista; con 200 del mundo se arreglaba el fondo y se rompia el campo cercano, porque a
      z=300 el **0%** de la fila caia dentro del canvas (12% a z=700, 54% a z=1100), justo las
      filas de pixeles mas grandes. Hueco medido en pixeles a z = 700 / 1500 / 2500 / 4000:
      **161 / 75 / 45 / 28 con 200 del mundo -> 56 / 74 / 80 / 84 con los 90 de pantalla**.
    - **La malla tiene NIEBLA PROPIA** y llega hasta `SPAWN_Z`. Con 1500 el alpha caia por
      debajo de 0.05 en z=1870 y la malla moria en el aire, **36px mas abajo que el fondo de la
      pista** (pixel mas alto y=322 contra 286), o sea un foso negro a los dos lados; con 2600
      se anulaba en 3320 y seguia sin llegar; con **3400** la ultima fila viva cae en z~3890, el
      pixel mas alto pasa a **y=289** y la cobertura de **2.31% a 5.53%** del canvas.
    - **La malla es fondo y la pista es lo que se juega, y esa jerarquia esta medida**: su alpha
      va siempre por debajo del de las bandas del suelo (0.15+0.30 contra 0.28+0.4). Con el
      techo en 0.60 (lo primero que se probo) la malla marcaba p95 de luma **92/114/82** contra
      **79/84/76** del suelo, o sea que le ganaba en las tres.
    - **De perfil es el mismo campo con la profundidad FINGIDA** (`drawMeshFlat`): ahi la x del
      mundo no proyecta, pero **z ES el eje horizontal**, asi que la misma ola se lee de canto.
      14 franjas repartidas con `d^0.75` (lineal se lee como escalera) y cosidas con lineas de
      cruce. Antes eran **cuatro senos sueltos**, sin cruces y pasando por DELANTE del reactor.
      El corte va **sesgado** porque a x fija lo unico que varia a lo largo de la pantalla es el
      termino de z y las franjas salen todas iguales; con el sesgo entra el termino rapido de x
      y cae en **131px de periodo en pantalla**, que bate contra el de z.
    - **Coste**: `drawMesh` sola son **0.078ms de media, 0.20 p95, 0.90 max** (60 pasadas).

34. *"y un reactor al final de la pista, como el de la referencia"* -> `reactor.js`, que **no
    importa Phaser ni sabe que existe una escena**: entra un estado y salen PRIMITIVAS
    (`disc` / `ring` / `poly`, tres casos y no doce) en un espacio propio (viewBox 0..1024), y el
    que dibuja pone la transformada. Por eso el mismo dato sirve para el juego y para el SVG
    estatico (`toSVG` -> `assets/reactor.svg` via `tools/reactor-svg.js`): **una sola verdad, dos
    backends**, y el backend se testea desde node con un doble que apunta lo que le piden.
    Medido: **199 primitivas** (196 mecanicas + 3 ondas), radio maximo **486.0 de 512** (los 26
    de margen son para el glow, que en SVG desborda la forma) y **526 llamadas al Graphics**.
    - **La simetria es un assert, no una opinion**: el ala se construye apuntando arriba, o sea
      que espejar en x=512 tiene que devolver el mismo multiconjunto de primitivas. Las tres
      alas son la MISMA geometria rotada 0/120/240 (en SVG un `transform` en el grupo: editar
      una es editar las tres), los 12 tornillos arrancan en -90 y van cada 30 grados y los tres
      LEDs rojos van en los huecos entre alas (90 / 210 / 330), justo para no romperla.
    - **El `alpha` no es un multiplicador: es una CURVA POR PIEZA** (`a * alpha^d`). La escena lo
      manda al fondo con 0.5 y bajarlo plano apagaba por igual el chasis (que TIENE que estar
      oscuro, es metal) y las pantallas y el nucleo, que son la razon de ser de la pieza: medido
      a 0.5 plano y al tamano que tiene en el nivel, **luma media 61.1 y solo el 8.1% de sus
      pixeles pasaba de 100**, o sea una mancha gris. Con la tabla (chasis 2.4 / fondo 1.8 /
      rejilla 1.4 / luz 0.5 / traza 0.25 / nucleo 0.15) el alpha efectivo a 0.5 queda en
      **0.190 / 0.288 / 0.379 / 0.707 / 0.841 / 0.901**. **En alpha=1 la curva es la identidad
      para cualquier `d`**, o sea que el SVG no se entera, y eso lo afirma el chequeo llamada
      por llamada.
    - **El nucleo es ESCALONADO, no difuminado**: cuatro discos OPACOS de radio 78/62/46/30
      (coronas de 16) con un filo negro de 3 encima. Antes eran discos semitransparentes
      (0.16 / 0.30 / 0.50) con glow, o sea la unica mancha borrosa de una pieza que por lo demas
      es toda chaflan y arista: el mismo problema del casco cromado del jugador y la misma
      solucion, porque sin degradados en `Graphics` la luz se hace escalonando. Medido sobre el
      SVG rasterizado a 1024, perfil radial promediado en 6 radios: saltos de mas de 25/255 en
      UN pixel de radio **2 -> 12**, el mayor de **43 a 68** y la pendiente media de **4.1 a
      9.3**, o sea que no se hizo mas contrastado: se convirtio en escalones.
    - **La traza sale del FFT real, y con el FFT en CERO se cae a una onda sintetica**: tener
      `fft` no es tener senal, y en pausa, muteado o en modo diseno el `AnalyserNode` devuelve
      el array entero en cero y la traza salia una **raya recta**, o sea tres monitores apagados
      justo cuando se esta mirando el nivel. Cada ala lleva su fase y su frecuencia de `hash(i)`
      y el test falla si las tres pantallas salen iguales.
    - **El golpe tampoco puede salir de `pulse`**: medido sobre 1200 frames del drop2, `pulse`
      vale 0 el **100%** del tramo (ese drop no tiene ni un evento de bass) y `beat` pasa de
      0.02 solo el **31.7%**, con mediana 0. Lo que si esta vivo es el FFT que ya recibe:
      `bass()` = los 12 primeros bins (0-2067Hz a 44.1kHz con `fftSize` 256), min 0.724, mediana
      0.854, max 0.950, y **plegado por fase de beat el pico cae en el 1** (0.877 contra 0.808
      en el medio): es un latido, no ruido. Los 3 bins de mas abajo solos saturan (mediana
      1.000).
    - **Donde va lo decide la escena** (`reacAt`), en espacio de PANTALLA colgado del punto de
      fuga y no en el mundo con una z fija: asi esta al final de la pista mire donde mire la
      camara, y sirve en las **tres** sin un caso especial. Mide **0.148 del alto**, o sea
      **28.1% (183px de 651)**: con 0.3 eran el **57% (371px)**, o sea el objeto MAS GRANDE de
      la pantalla en el punto mas LEJOS.
    - **Gira lentisimo**: una vuelta cada 16 compases (**28.0s** a 137bpm) y como las alas van a
      120 grados el ciclo aparente es un tercio (**9.3s**). Con la gravedad invertida **no** se
      da vuelta: es la pista la que cuelga.
    - **Coste**: sobre 1629 frames del drop2, `draw()` pasa de **0.40ms media / 0.70 p95** sin
      decorado a **0.53 / 0.90** con solo el reactor. Es la mitad cara de las dos capas nuevas.

35. *"esto no late, se ve congelado"* -> y era verdad, medido: **`pulse` > 0.05 cubre el 55% del
    buildup, el 19% del break, el 0% del drop2 y el 0% del outro** (21% del nivel: **57.0s de
    72.31 apagada**), y **`beat` vale 0 el 100% del outro, que son 28.6s con UN solo evento**.
    Un nivel puede no tener senal en un tramo entero, asi que todo lo que late con esos dos se
    congelaba mas de media cancion.
    - `gridAt(t, g)` = `(1 - frac((t - off)/beat))^2` es la unica envolvente que **existe
      siempre**, porque no mira las cues sino `songT` y la grilla, o sea que es funcion pura del
      tiempo igual que la posicion de todo lo demas. El exponente es **2 y no 1**: con 1 la
      envolvente es una sierra y el latido no tiene golpe (media 0.5, la mitad del beat por
      encima de 0.5); con 2 la media es 1/3 y el **58% del beat esta por debajo de 0.25**.
    - **El metronomo es el PISO y la senal el TECHO**: `lat = max(beat, metro * gridAt)`, y por
      eso `metro` es un numero y no un si/no. Con 1 el metronomo llegaba tan alto como una senal
      y la **senal solo mandaba el 21.5%** del nivel (0% del outro), con `lat` medio 0.458 /
      0.365 / 0.566 / 0.332 y **p95 0.94 en TODAS** (el pico del buildup salia igual de
      brillante que el del drop). Con **0.45** la senal manda el **33.4%** y `lat` pasa a
      **0.319 / 0.195 / 0.460 / 0.150** con p95 0.857 / 0.446 / 0.918 / 0.406, o sea el drop2
      **+44% sobre el buildup y +207% sobre el outro**. Punta a punta: la amplitud de la ola
      pasa de variar un **20% entre secciones a 43%** y su alpha de **21% a 48%**.
    - **El nivel 1 no declara `metro`**, o sea que ahi `lat === beat` y no cambia un pixel: tiene
      cues de sobra y su suelo ya latia.

36. *"el fondo negro deja al reactor flotando, y la pista termina en un canto"* ->
    - **`sky`**, el resplandor que SALE del horizonte hacia los dos lados: el cielo del nivel 2
      es negro casi puro y medido daba **luma 7.4 de media y 5.9 pegado al horizonte**, o sea
      que el reactor no tenia nada contra que estar y se leia como un logo pegado en el vacio.
      Con el resplandor pasa a **14.6 de media y 28.8** pegado al horizonte, y el nucleo del
      reactor sigue clavado en **229.4**, o sea que sigue siendo el pico del cielo (lo mas
      brillante fuera de el es el HUD, 146.7). El alpha va **al cuadrado** (lineal deja una
      franja plana que se lee como banda, no como aire) y las franjas de ~8px se tocan exacto:
      con `+1` de solape cada junta suma dos alphas y salen **24 rayas horizontales** cruzando
      el cielo. El nivel 1 no declara `sky`, o sea que ahi no se dibuja ni un pixel.
    - **`drawFar`**: la pista se dibuja hasta `SPAWN_Z` y ahi cortaba, y medido a h=651 eso
      proyecta **58.1px por debajo del horizonte**, o sea que el fondo de la carretera flotaba
      con 58px de negro hasta el punto de fuga: se veia el fin del mundo. Se repite la misma
      banda hacia el punto de fuga, cada tramo **1.9 veces mas lejos** que el anterior (o sea la
      mitad de alto en pantalla: 27.5px el primero, 14.5 el segundo, y con 7 se llega a 0.6px) y
      con el alpha cayendo `0.68^i`, que es niebla y no una rampa pintada. Medido en la franja
      central: la primera fila encendida pasa de **y=290 a y=234, o sea al horizonte mismo**.
      **No alarga la pista en el MUNDO**: `SPAWN_Z` no se toca, que de el salen el viaje del
      obstaculo y `enterDz`.

37. **El ojo critico** (dos vueltas de mirar capturas y medirlas, sin tocar la jugabilidad):
    - **El reactor pegado al final de los carriles**: estaba colgado del horizonte analitico
      (`h*0.36` = 234.4), que es donde caeria z=infinito, y el fondo REAL de la pista es
      `proj(0,0,SPAWN_Z).y` = **292.5**, o sea **58.1px mas abajo**: quedaban **44-59px de cielo
      negro** entre la punta de la carretera y su borde de abajo. Anclado al fondo real y con
      `REACTOR_UP` = **0.92** el hueco pasa a **-6 a +17px** (buildup -6, outro -2, drop2 +2,
      break +11, quieto +17; negativo = lo pisa). 0.92 y no 1 porque el radio del cuadro
      (91.5px) es mayor que el semialto de lo que se DIBUJA (86.5px medido sobre la silueta).
      De perfil manda otro numero (**2.2**), porque ahi el ancla es la linea del suelo: con 0.75
      caia en **y 293..467** y el dia que el nivel tenga guion el primer `block` (techo en
      y=371) entraria por detras de el; con 2.2 queda en **y 176..350**.
    - **La pared cyan** (L>55 y sat>0.4 sobre el canvas de 1248x651). En **1a persona** la malla
      proyectaba un abanico de campo cercano sobre el plano del suelo: es geometria correcta y
      se lee como un bug. Se le puso el mismo `pasa(z)` que usan las cajas pero **al cubo**,
      porque crudo no alcanzaba (es lineal hasta 500 y a 94 todavia vale 0.19: 6718 -> 5344px y
      en la captura se seguia leyendo igual); al cubo esa fila da 0.007 y el corte de `a < 0.02`
      que ya existia la tira entera, mientras que a 400 todavia vale 0.51, o sea que se apaga
      sin saltar de un frame al otro. Medido: malla por debajo de y=340 **6718px = 1.73% de esa
      banda -> 2549px = 0.66%**, malla entera **6.53% -> 6.00%** del cuadro, lo mas bajo que
      llega **y=557 -> y=454**. Y la pared cyan: **1a persona 33.2% del cuadro y 57.6% de la
      mitad de abajo -> 2.6% / 1.2%** (nivel 1 de referencia: 5.8% / 1.5%), **3a persona
      10.3% / 18.0% -> 2.3% / 3.6%**, **perfil 14.6% / 28.2% -> 4.3% / 7.6%**. El perfil es el
      unico por encima del nivel 1 y **no es malla**: apagandola queda en 4.2% / 7.6%, o sea que
      ese cyan son las bandas del suelo tintadas por sector mas el HUD.
    - **Las cunas negras bajo el horizonte**: el borde de AFUERA de la malla estaba topado en
      1400 del mundo, pero el plano del suelo llega al borde de cuadro a cualquier z, asi que
      quedaban dos cunas negras en las esquinas de arriba: medido en el drop2, **y=312 con
      502-527px = 40-42% de la fila** y **y=332 con 312-340px = 25-27%**. Con el borde de
      pantalla como tope quedan en **2-13px y 2-8px, o sea 0-1%**.
    - **De perfil habia cuatro senos**, no un campo: cobertura de malla **1.35% -> 4.73%** del
      cuadro, **0px dentro de la banda de juego (y371-469) antes y despues**, y ya no cruza por
      delante del reactor (`reacAt` dice donde cayo y el alpha se va a 0 dentro de su disco con
      26px de borde blando).
    - **La pista le gana a la malla en la media** (luma media del parche de suelo y380-520
      x500-750 contra la de la malla): buildup **30.3 / 30.9 -> 24.1 / 21.0**, outro
      **24.5 / 25.6 -> 23.3 / 20.1**, drop2 **39.8 / 35.3 -> 34.0 / 24.9**. El break queda
      empatado en negro (15.7 / 16.1, la malla por 0.4 de luma) y se resuelve por p95: **79.5
      contra 33.6**, o sea que ahi lo que se lee es la banda del compas. Y las bandas se siguen
      **contando**: 6/6/7/5/8 picos en quieto/buildup/break/drop2/outro (11 de perfil, 5 en 1a),
      con la del 1 de compas a luma 85-102 en todas. La malla no se apaga en ninguna seccion
      (10.09%-12.85% del cuadro).

### Medido al cerrar la tanda

- `node test.js` y `node test-music.js` en verde los dos.
- **Nivel 1 contra `git archive HEAD` servido aparte, misma sesion de Chrome, mismo frame: 0 px
  distintos y max delta 0** en t = 12 / 36.3 / 50.2 / 65 **y en las tres camaras**.
- **Determinismo del nivel 2 con recarga de pagina entera** (no un re-seek): 0 px en el drop2 y
  en el buildup.
- **0 errores de consola y 0 page errors** en `/`, `/?level=orbit-motion` y `/?level=nope`. El
  lector se valido antes con un warning y dos throws deliberados: la lista vacia es una lista
  vacia y no un lector roto.
- **`draw()` con la cancion entera**, una sola sesion de Chrome y sin otros servidores: nivel 2
  **media 0.729ms, p50 0.7, p95 1.5, p99 1.9, max 14.5 sobre 8345 muestras y 0 frames por encima
  de 16.7ms**; nivel 1 de control **0.492 / 0.4 / 1.0 / 1.7 sobre 11137**. O sea que la malla y
  el reactor cuestan **+0.24ms de media** de un presupuesto de 16.7. La corrida va a ~115fps, no
  a 60: por eso son 8.3k muestras y no 24k.
- Las llamadas al Graphics por frame suben de **9056 a 13803** con la malla estirada hasta
  `SPAWN_Z` mas la cuna y el resplandor, y `draw()` de **0.53 / 0.95 a 0.59 / 1.05** (1160
  frames del drop2 a x1 sonando).
- **Ojo al commitear**: el nivel 2 trae **seis ficheros sin trackear** (`reactor.js`,
  `assets/orbit-cut.m4a`, `assets/orbit.schema.json`, `assets/reactor.svg`,
  `tools/reactor-lab.html`, `tools/reactor-svg.js`). Ninguno esta en `.gitignore`, pero
  `commit -a` no los agarra y sin ellos el nivel 2 no arranca (`AIRunnerGame.js` importa
  `./reactor.js` y `music.js` pide los dos assets): hace falta `git add` explicito.

## La tanda de las 13 quejas (nivel 2, con las referencias delante)

Trece puntos dictados de una, todos del nivel 2 y todos de LUZ: sigue sin tener un obstaculo.
Misma regla dura que la tanda anterior y con el mismo respaldo: **el nivel 1 no se mueve un
pixel**, medido contra `git archive HEAD` en otro puerto, **0 px distintos y max delta 0** en
t = 12 / 36.3 / 50.2 / 65 en las tres camaras (**12 comparaciones**).

38. *"los RAYZ shapes se ven mal, mejoralos"* -> la geometria se fue a **`fx.js`** (no importa
    Phaser: entra estado, salen puntos, se comprueba desde node). El rayo es desplazamiento del
    punto medio, **33 puntos**, con el desvio dividido por nivel (con amplitud constante el
    ultimo manda y sale peludo). Dos cosas eran lo que se veia mal: iba de **grosor constante**
    (se leia como un cable doblado pegado al reactor) y ahora se afina y se apaga segmento a
    segmento (`(1-u)^0.7`), y las **tres ramas eran la misma** recalculada tres veces. Ademas el
    angulo dejo de ser `hash * 2PI`: abanico hacia arriba y a los costados, porque con el circulo
    entero la mitad salia contra la pista y un rayo tapado por la carretera no se lee como rayo.
39. *"el circulo de aura esta ok pero menos visible y no en el predrop"* -> los anillos van a
    **la mitad de alpha** (0.05 + 0.13\*lat contra 0.10 + 0.26) y, como cuelgan del reactor y el
    reactor ya no existe hasta el drop, **desaparecen del buildup solos**: no hizo falta una
    regla aparte.
40. *"tiene que apagarse en la parte donde habla la voz"* + *"se queda pegado en el gate, tiene
    que cerrar y ya"* -> los dos son el mismo mecanismo nuevo: **tramos `fx` por FILA**
    (`gate` / `dark` / `reactor` / `beam` / `ghost`), hermanos de `sectors` y `zones` y no del
    `script`. El apagon de la voz es `{ kind: "dark", from: 62, to: 67 }`, o sea el break entero,
    que es donde vuelan las letras (que son textos de Phaser y sobreviven al negro).
41. *"que se vuelva loco en la #38 con el gate pero en crescendo"* -> `gateAt` con **`cut`**
    (la fraccion CERRADA, no la abierta: con `duty` el valor natural es 0.5 y la pantalla se pasa
    la mitad del tramo en negro) y **`ramp`**, o sea que el gate mismo es la rampa. Medido,
    fraccion del beat con la imagen cortada: rafagas **f10 18.2% / f19 18.1% / f32 12.0% /
    f35 12.0%**, y la creciente **f36 5.0% -> f42 12.3% -> f48 19.6% -> f54 26.8% -> f60 34.1%**.
42. *"NO MUESTRES EL REACTOR HASTA EL DROP"* -> `{ kind: "reactor", from: 68, to: 164 }`. Antes
    estaba desde el primer frame, o sea que entrar al drop no lo estrenaba.
43. *"en el drop mas opaco, con mas movimiento, y que dispare un haz al centro; del drop a la 89,
    despues fantasma y seguimos spameando el haz con variaciones"* -> `REACTOR_A` **0.5 -> 0.85**
    (efectivo por pieza con la curva `DIM`: nucleo **0.90 -> 0.98**, chasis 0.19 -> 0.69), crece
    **+34%** de radio con la creciente, gira **x3** (28.0s -> 9.3s la vuelta) y respira 5% con el
    latido. El haz **dispara**, no esta puesto: `(1-p)²` una vez por beat, y cual de las tres
    formas sale lo dice `hash(numero de disparo)` (recta / anillo que se abre / par cruzado). De
    la **f90 al final** el nivel se va a fantasma y el haz pasa a `mode` 1: **doble de ritmo** y
    el par cruzado girando disparo a disparo.
44. *"las chispas de metal estan malisimas, probá piramides 3D en gris/negro"* -> `pyras` +
    `pyraFaces`: **14 piramides de 2 caras**. Lo que la hace un volumen son **dos grises**
    (1 y 0.42) compartiendo la arista apice-esquina, no el contorno; sin la esquina de adelante
    es un triangulo plano, que es justo lo que se venia a cambiar. El recorrido es `1 - (1-p)²`
    (sale de golpe y **frena**, como el metal contra el aire) y el color **no sale de la paleta**,
    que es lo que las hace leerse igual en fantasma, que es donde estan pedidas.
45. *"las olas son bobas, tienen que ir en crescendo: opacas en el buildup, transparentes hasta
    el apagon, y volver con todo en el drop con otra forma"* -> el dial **`wave`** por seccion.
    Medido **aislando la capa** (misma fila con y sin `mesh` en `decor`, restando los PNG:
    un parche de pantalla trae bandas del suelo y anillos encima y no dice nada). Cobertura del
    cuadro / luma media del aporte / p95 de lo encendido:

        f20  buildup  10.35%  1.39   32        f70  drop2  10.72%  2.12   49
        f40  buildup   8.63%  0.84   21        f95  drop2  13.86%  8.51  144
        f58  buildup   4.99%  0.34   10        f130 outro  11.42%  2.64   55
        f64  break     0.00%  0.00    0

    O sea: se apaga **4x** a lo largo del buildup, en el break **desaparece entera** (0 px, no
    "casi 0") y el drop la devuelve con **6.2x** la luma del final del buildup. Y es **otra ola**,
    no la misma mas fuerte: contando maximos locales, a lo largo de z pasa de **8 a 15 crestas**,
    a lo ancho de **10 a 8**, y el batido en un punto fijo de **0.19 a 0.25 Hz (+32%)**.
46. *"los poligonos flotan sin seguir nada"* -> el acento los empuja (`hype * beat`): alpha,
    **+45% de radio** y un tiron de giro. Va multiplicado por `hype`, que en el nivel 1 vale 0.
47. *"pone de fondo los mismos lasers del nivel anterior"* -> el `rig` del nivel 1, pero su color
    **no podia salir de `neon.fam`**: el renderer traia DOS listas hardcodeadas y distintas entre
    si (violeta/cyan/rosa los focos, cyan/violeta/rosa/accentSoft el abanico), o sea que `fam` no
    es respaldo exacto de ninguna. Dial nuevo `neon.rig` con esas dos listas de respaldo. El
    sintoma mientras tanto: el rig salia a **0 px** con y sin `decor`, porque `loadLevel` se
    estaba comiendo el campo.
48. *"luces de pista de aterrizaje a los costados, en ritmo, como los bloques con la X"* ->
    `drawLights`, en el plano del suelo, una cada **medio beat** con el chase de `CHASE` por
    encima (a una por beat la ola tarda dos beats y se lee como parpadeo suelto). **Corre hacia
    adelante** (`hb - idx`, al reves que los huecos): la zanja viene hacia vos porque es lo que te
    va a pegar, y esto es la pista que se aleja, que es como se ve una aproximacion.
49. **Lo que no se pidio y salio de medir el audio** (hacia falta para lo de arriba): el
    **contratiempo** cae en la fase **0.505 del beat** en los cuatro tiempos por igual
    (dispersion 1.08-1.14: si fuera el 2 y el 4, dos estarian en el piso), asi que el blanco de
    la otra mitad del compas sale de la grilla (`hatAt`) y no de una cue. Y el canal `bass`
    marcado a mano **no es el kick**: el audio tiene kick real en la fase 0.0 en el **95.8% de
    los beats (158/165)** y en **31 de los 32 del drop2, donde `bass` no tiene ni un evento**.
    (35-100Hz no sirve para detectarlo: el bajo del acid la domina y da un +77ms falso. 120-400Hz
    los separa limpio y ahi kick y hat caen a +2.9ms y +2.0ms de la grilla, sin deriva en 72s.)
    Y la **creciente no es de volumen**: el RMS por compas del buildup se mueve **+0.62dB del
    compas 0 al 15** con **3.16dB** de rango y el maximo en el compas **13**, y lineal y
    exponencial ajustan igual de mal (**R2 0.276**); lo que sube es el brillo (centroide
    758Hz -> ~1400Hz) y lo que baja es el sub (<60Hz, **-17.77dB**). Por eso de `hype` cuelgan
    cosas que aclaran y agrandan, y ninguna que suba el volumen de un latido.

### Medido al cerrar la tanda

- `node test.js` y `node test-music.js` en verde los dos. El de musica cubre lo nuevo: los tramos
  `fx` contra las secciones medidas (el `dark` dentro del break, el reactor arrancando en
  `dropSec`, los haces contiguos y con los modos alternados, el fantasma dentro del reactor), que
  la rampa del gate **crezca** y coincida con `cut`/`ramp`, que ningun tramo de `hype` cruce una
  seccion, el dial `wave`, y la geometria de `fx.js` (determinismo, el frenado `1-(1-p)²`, las dos
  caras compartiendo arista con distinto gris y el apice exactamente en `r`).
- **Nivel 1 contra `git archive HEAD`: 0 px distintos y max delta 0** en t = 12 / 36.3 / 50.2 / 65
  x 3 camaras, **12 comparaciones**. Ahi se cazo lo de `startsWith("drop")`: el nivel 1 tiene un
  `drop` **y** un `drop2` (59.08-87.69s), o sea que le encendia rave clavado y temblor durante
  28.6s que se disenaron sin ellos (**169813 px distintos a t=65**). Por eso `dropSec` es un dial
  del nivel y no un prefijo.
- **`draw()` con la cancion entera, nivel 2, todo puesto**: media **0.833ms, p50 0.8, p95 1.4,
  p99 2.1, max 7.2 sobre 6389 muestras y 0 frames por encima de 16.7ms**. Contra la tanda anterior
  (0.729 / 0.7 / 1.5 / 1.9 / 14.5 sobre 8345): **+0.10ms de media** por nueve capas mas, y el max
  BAJA de 14.5 a 7.2. (La primera corrida dio 19265 muestras todas en `songT` 0: el AudioContext
  arranca `suspended` y sin un `resume()` el transporte no avanza, o sea que era una medicion de
  la pantalla quieta.)
- Verificado a ojo, frame a frame: **f5** (rig cyan, sin reactor), **f20 / f40** (gate cortando),
  **f50** (gate cerrado = negro entero, `__dbg.gate` 0), **f58** (pico de la creciente), **f64**
  (apagon con solo las letras y el HUD), **f70** (reactor + cuna del haz + luces de pista),
  **f95**, **f130** (FANTASMA + haz en anillo), mas el estallido en t=4.72 (piramides gris/blanco)
  y los rayos en t=30.18.

## La tanda de las 14 quejas (nivel 2, jugado con las fotos de laseres delante)

Catorce puntos de una, otra vez todos de LUZ (el nivel 2 sigue sin un obstaculo) y otra vez con
el mismo respaldo: **el nivel 1 no se mueve un pixel**, medido contra `git archive HEAD` en el
puerto 8124, **0 px distintos y max delta 0** en t = 12 / 36.3 / 50.2 / 65 en la camara de atras
y en t = 36.3 en las otras dos. Control negativo: 36.3 contra 36.35 da **677469 px**, o sea que
el aparato detecta el cambio cuando lo hay.

50. *"en el predrop, cuando entra el SNARE, un frame de RAYOS + REACTOR todo en fantasma, como
    un fogonazo y seguimos"* -> tramo `fx` nuevo, **`snap`**, una fila (f66) y **dentro del
    apagon**, que es lo que lo hace un fogonazo: se dibuja DESPUES del negro, o sea que el orden
    de dibujo ES el efecto. Fuerza tres cosas que ahi no estarian (el reactor, que no existe
    hasta la f68; los rayos; y el fantasma) y dura `SNAP_T` = **0.30s = 0.685 beats**, o sea que
    se apaga dentro de su propia fila. Salio con **2 rayos** la primera vez: `hype` en la f66 vale
    **0.41** y de ahi salen `1 + round(3*0.41)` = 2, que no es un fogonazo, asi que `drawArcs`
    tomo un `nOver` y el snap pide los **4** de una.
51. *"despues del #12 el gate se queda dando y queda tonto, era temporal"* -> el tramo iba de la
    f10 a la f19 porque ahi termina su sector del SUELO, pero la rafaga que lo justifica es el
    `response1`, que mete sus **5 golpes en la f10 y la f11 y despues no suena nada durante 71.32
    beats**: eran **8 filas de tajo sobre silencio**. Partido en dos, `f10-f11` y `f19-f19` (el
    #17, que es el `response2` y se lleva su propia fila).
52. *"las piramides a veces se ven y a veces no; que salgan siempre en fantasma y con mas glow"*
    -> el estallido ahora **manda el nivel entero a fantasma mientras dura** (es gris y negro:
    en color se hunde contra el cyan, en blanco y negro es lo unico que hay), y cada esquirla
    lleva **dos pasadas de halo blanco** por debajo del relleno. Medido en el estallido de
    t=14.25 (bbox 115x90px, 14 esquirlas): el halo toca **5558px = 0.68% del cuadro** y dentro de
    esa caja la luma media pasa de **51.1 a 64.1 (+25%)** y el p95 de **169 a 190**.
53. *"los laseres del reactor pueden ser mucho mejores"* -> el haz pasa de un relleno de ancho
    fijo a **tres conos** del mismo `wd` (2.3 ancho y tenue / 1 el cuerpo / 0.36 el nucleo) mas
    la **boca** en el nucleo del reactor y el **charco** donde pega. Un relleno solo se lee como
    un triangulo de color pegado a la pieza: no se ve de donde sale ni donde llega.
54. *"en el drop, de fondo detras del reactor, un espectrograma como el suyo pero en linea de
    onda"* -> `drawSpectro`: la **MISMA `wave()`** de las pantallas del reactor, estirada de lado
    a lado y apilada en **5 lineas** con la de arriba mas tenue (una sola raya se lee como un
    cable cruzando el cielo). No es una capa de `layers` porque no tiene parallax lateral: es el
    mismo dato del mismo FFT, o sea el reactor derramado por detras. Medido **aislando la capa**
    en el drop2 a t=30.9: **4.63% del cuadro, luma media del aporte 22.2, p95 73**, con la caja
    entre y=37 e y=193 de 582, o sea **por encima del horizonte (209.5) y 0px dentro de la banda
    de juego**.
55. *"las ondas de las pantallas del reactor no van en sincro"* -> no iban, y el numero lo dice:
    la portadora corria a `t * 5.5` rad/s = 0.875 ciclos/s, que contra un beat de 0.43796s son
    **0.383 ciclos por beat**, o sea que la traza volvia a su fase cada 2.61 beats. Ahora la fase
    entra en **beats** (`bt`) y avanza **1 ciclo exacto por beat**; el sintetico (pausa, mute,
    modo diseno) tambien, con 1 / 2 / 1 ciclos por beat. El respaldo de `bt` es `t*5.5/TAU`, o
    sea la cuenta vieja clavada: **`assets/reactor.svg` sale byte a byte identico**.
56. *"el reactor no se mueve en el beat, tiene que ser agresivo y sacudir todo; creo que no
    tenemos sacudida"* -> no la habia, y no por el reactor: el temblor colgaba de `pulse` y
    `pulse` vale **0 el 100% del drop2** (ese drop no tiene ni un evento de `bass`). Ahora el
    golpe sale de `this.kik` = max(lo que suena, el metronomo de la grilla), el mismo idiom que
    `this.lat`, y ademas lo empuja `hype`. Medido sobre los **841 frames del drop2**: el
    desplazamiento pasa de **0.00px y 0% de frames sacudiendo** a **+-22.4px en x, +-16.4 en y y
    el 31.4% de los frames por encima de 2px**. El golpe blanco de cada kick va por lo mismo.
    El nivel 1 no declara `metro`, o sea que ahi `kik === pulse`: 0 px.
57. *"el final de la pista siempre se ve asi, queda tonto"* -> la cuna de `drawFar` salia al
    **0.8** del alpha de una banda, o sea una punta MACIZA y ademas mas plana que la pista de
    aca (las bandas de cerca alternan medio beat encendido y medio apagado; la cuna no alterna
    nada). Medido en su banda (x 573-673, y 210-260, drop2 a t=30.9): luma media **43.89 ->
    38.66** y p95 **64 -> 59**, con la banda de pista de justo debajo clavada en 62.39 / 133, o
    sea que la cuna pasa de **0.70 a 0.62** de la luma de la pista de verdad. Se probo ademas
    llevar su color al del cielo tramo a tramo: **38.66 -> 38.58**, o sea nada, y se saco.
58. *"esos laseres de fondo tienen que estar sobre TODO, no solo en el medio de la pantalla.
    ACORDATE porque quiza quiero volver atras"* -> dial **`rigOver`**, y por eso es un dial: se
    borra la linea del nivel y vuelve el orden de dibujo de siempre (el rig antes del suelo, o
    sea encerrado en el cielo por los edificios). Cruzando el mundo entero tapaba la pista, asi
    que va a `RIG_DIM` = **0.55**. Medido en la banda de juego (y 332-419 de 582) en el buildup,
    luma media / p95: **sin rig 20.32 / 48, con rig a 0.55 23.84 / 56, con rig a 1 26.93 / 62**,
    o sea que 0.55 deja el aporte en **+3.52 en vez de +6.61**.
59. *"en vez de esos 9 laseres de arriba abajo, ponelos horizontales como en la foto, hace
    variaciones, se ven poco usados"* -> el abanico tiene **3 modos** y cual va lo dice el
    **compas** (`hash`, nunca random): el de siempre (emisores arriba), horizontal a una altura,
    y horizontal a **dos alturas por lado**, o sea los cuatro abanicos cruzandose en el medio.
    Cuelgan de `rigOver`, o sea que el nivel 1 no puede entrar ahi ni por hash.
60. *"quiero que las luces de pista formen figuras y se muevan en random"* -> `LIGHT_SHP`, una
    figura por compas por `hash`: recta (la de siempre), serpentina (`ax` 190), saltos (`ay` 150)
    y helice (las dos, desfasadas). El desplazamiento va **espejado en x** entre las dos filas,
    como un rig de verdad. `ax` es grande a proposito: **mover una luz 40 del mundo a z=3000 son
    4px de pantalla**, o sea nada.
61. *"en el buildup los relampagos muestran la posicion del reactor; que salgan de otros lados,
    de los costados al centro, de arriba abajo, del centro de la pista a los lados, asi se ve la
    pista electrificada"* -> los rayos salian del reactor SIEMPRE, y en el buildup el reactor no
    existe (entra en la f68): marcaban un sitio vacio. Ahora con reactor en pantalla salen de el
    y sin reactor el origen lo elige el **compas** entre los otros tres, y el tercero sale del
    carril del jugador proyectado (`proj(laneX[lane], 0, PLAYER_Z + 900)`), o sea de la pista.
62. *"cortas todos los efectos del buildup en el #73 y tienen que llegar al #78; en el 78 entra
    el 'let the bass kick down' y en el #79 el snare"* -> el buildup se cortaba en la f60 (el
    gate) y en la f62 (el apagon y la ola). Corridos los tres al **#78 = f63**: el gate llega a
    la f62, `hype` se queda ARRIBA (a=b=1) hasta la f63 y recien de la f64 a la f67 cae a 0.12,
    la ola se apaga DENTRO del break (1.2 -> 0) en vez de desaparecer de una, y el `dark`
    arranca en la f63. El fogonazo del punto 50 es el **#79/#80 (f66)**.
63. *"hay un bug: la frase se repite en los primeros beats del drop"* -> se repetia de verdad:
    el canal tiene **2 eventos**, t=27.706 (#77, f63) y t=29.334 (#79, f66), y con `dur` 2.2 el
    segundo corria hasta **31.534**, o sea **4.3 beats DENTRO del drop** (que entra en 29.642).
    `every: 2` (solo el primero) y `dur` **1.65**: 27.706 + 1.65 = **29.356**, o sea que la
    ultima letra se apaga **27ms antes** del golpe de snare que abre el fogonazo (29.383).

### Medido al cerrar la tanda

- `node test.js` y `node test-music.js` en verde. Lo nuevo que cubre el de musica: que el
  fogonazo dure **una sola fila** y caiga **dentro del apagon y sin ser su ultima fila** (si
  fuera la ultima, el flash se comeria el arranque del drop), que el nivel 1 no herede ninguna
  de las capas nuevas (`spectro` incluida) ni el dial `rigOver`, y que la traza **repita cada
  beat exacto** (`wave` con bt=3 y bt=5 dan los mismos 65 puntos, con bt=3.5 no) sin romper el
  determinismo de la onda del SVG.
- **Nivel 1 contra `git archive HEAD`: 0 px distintos y max delta 0** en t = 12 / 36.3 / 50.2 /
  65 (camara de atras) y en t = 36.3 en `lado` y en `1a persona`. Dos trampas del aparato que
  costaron una medicion falsa cada una: `for a in "36.3 0"` no separa en fish (los dos puertos
  fallaban igual y salia 0 px), y `setCam(i)` solo no cambia de camara porque `camForZone()`
  la reescribe cada frame desde `camPick`.
- Verificado a ojo, frame a frame: el fogonazo en **t=28.99** (el pico de la envolvente: 4 rayos
  + reactor en fantasma sobre el negro), el gate en la f11 y la f19 con la f15 limpia, el
  espectrograma y los tres modos del abanico en el drop2, y las cuatro figuras de las luces.

## La tanda de las 6 quejas (nivel 2, laseres contra rayos)

Seis puntos, otra vez todos de LUZ, y tres de ellos **deshacen** cosas de la tanda anterior: el
espectrograma (el punto 54), la serpentina de las luces de pista (el 60) y medio `rigOver` (el
57). Mismo respaldo de siempre: **nivel 1 contra `git archive HEAD` en el 8124, 0 px distintos y
max delta 0** en t = 12 / 36.3 (camara de atras), 50.2 (`lado`) y 65 (`1a persona`).

64. *"the background spectogram just remove that"* -> fuera de `decor` y fuera del renderer. Es
    el punto 54 de la tanda anterior entero: **4.63% del cuadro** de fondo que ya no esta.
65. *"en el buildup tenes que ALTERNAR laseres y rayos; no podes mezclarlos en ninguna parte del
    nivel"* -> estaban mezclados de verdad y no un poco: medido sobre la cancion entera a pasos
    de 10ms, el rig estaba encendido el **50.3% del buildup y el 100% del drop2**, y los rayos
    eran un **subconjunto estricto** de eso, o sea que **el 100% de los frames con rayo tenia
    laseres debajo**. Ahora manda el COMPAS (`arcTurn`): compas impar rayos, compas par laseres,
    y el mismo dial apaga el rig en las dos llamadas (`rigOver` y no). Medido igual: **rayos
    49.1%, laseres 19.5%, LOS DOS 0.0%** de punta a punta, y por seccion buildup 48.0/23.0,
    break 45.3/0.0, drop2 49.8/50.2, outro 49.8/1.2. Los impares son para los rayos porque ahi
    caen **36 de las 60 marcas del acid**, que es lo que los dispara.
66. *"los laseres fuera del fondo no me gustan; no uses toda la pantalla, solo la mitad de
    ARRIBA, abajo tapan al jugador"* -> `RIG_CUT` = 0.5: el rig sigue cruzando el mundo
    (`rigOver`) pero muere en `h/2`. No es un recorte con tijera: cada viga termina en su propio
    `yi` (hasta 6% del alto por encima del corte, por `hash`) y los focos se dibujan como
    **segmentos de circulo** (`arc` desde el corte) en vez de discos, o sea que el que asoma se
    ve cortado por su cuerda y no desaparece de golpe. Medido **aislando la capa** (mismo frame
    con y sin `rig` en `decor`, restando los dos PNG) en tres frames de rig:

        f40 buildup   antes 40070px, 44.8% por debajo de h/2   ahora 20862px, 0px (0.00%)
        f72 drop2     antes 258061px, 42.7% por debajo         ahora 151724px, 47px (0.03%)
        f90 drop2     antes 173649px, 56.8% por debajo         ahora 69612px, 0px (0.00%)

    O sea que el pixel mas bajo del rig pasa de **y=505 (el canto de abajo, de 508) a y=256**,
    2px pasados del corte por el grosor del trazo, y la banda donde vive el jugador se queda
    limpia. **El rollback completo sigue en la mesa**: borrar `rigOver` del nivel devuelve el rig
    al cielo y detras de los edificios, que es lo de siempre.
67. *"la figura de las luces de pista que se mete DENTRO de los carriles, izquierda derecha
    izquierda derecha, no la quiero; las otras estan bien"* -> eran dos cosas en la misma figura.
    **Se metia**: el desplazamiento iba de `-ax` a `+ax`, o sea que la serpentina llegaba a
    **x=270 del mundo con el borde de la pista en 340** (70 adentro, 101 contando el halo, y
    pasada del centro del carril de afuera, que esta en 255) y la helice a 330 (10 adentro). Con
    el desplazamiento de **un solo lado** (`0.5 + 0.5*sin`) el minimo de las cuatro figuras es
    `edge + LIGHT_OUT` = **460** y ninguna cruza. **Y era izquierda-derecha en bloque**: con
    `k = 2` la fase avanza **un ciclo entero por luz**, o sea que las luces van todas en fase y
    la fila se corre de costado de una pieza. Con `k = 2.5` avanza **1/4 de ciclo por luz** y la
    onda recorre la pista: se repite cada 4 luces = 2 beats = **1226 del mundo**.
68. *"los rayos siempre de arriba-izquierda a abajo-derecha, o de arriba-derecha a abajo-
    izquierda, o de arriba a abajo. NUNCA horizontal, eso rompe todo"* -> `arcDir` en `fx.js`: el
    angulo se mide desde la VERTICAL y solo hay **tres familias** (`k` = -1/0/+1) a `ARC_TILT` =
    30 grados, con `ARC_JIT` = 10 de sorteo para que los 8 del fogonazo no caigan encimados en
    tres rectas. Medido sobre 20000 semillas: **min 50.0 grados sobre la horizontal y las 3
    familias presentes** (`test-music.js` falla por debajo de 45). De paso se cayeron dos de los
    tres origenes que se habian puesto en la tanda anterior: "de los costados al centro" y "del
    carril del jugador hacia los lados" daban rayos de **mediana 10.1 y 17.2 grados** sobre la
    horizontal, o sea justo lo que la queja pide que no exista. Quedan los dos verticales: del
    reactor si esta, y del canto de arriba si no.
69. *"el fogonazo del snare del predrop tiene que ser MAS GRANDE, el reactor y los rayos, ultra
    visible y no un detalle sutil"* -> `REACTOR_SNAP` = 0.35 sobre el radio, `SNAP_ARCS` = 8
    rayos y `big` = 1 (x1.6 de largo, x1.8 de grosor), y el reactor entra a **alpha 1** en vez de
    su 0.5 de siempre. Medido aislando las dos capas en el pico (t=28.97):

        reactor   antes 10191px, caja 150x161 = 31.7% del alto   ahora 17190px, 198x211 = 41.5%
        rayos     antes 12414px, caja 870x155 = 30.5% del alto   ahora 52184px, 1012x338 = 66.5%

    o sea que en el fogonazo el reactor es **mas grande que en el drop** (41.5% contra 37.0%) y
    los rayos cubren **4.2 veces** los pixeles de antes. El primer intento salio al reves
    (**247x88, mas chico que un rayo suelto**): los 8 rayos salian del reactor **hacia arriba** y
    ahi el reactor esta a 130px del canto, o sea que se iban de cuadro enseguida. En el fogonazo
    (y solo ahi) caen hacia ABAJO, que sigue siendo una de las tres familias permitidas y ademas
    los tira sobre la pista, que es lo que el fogonazo viene a ensenar.

### Medido al cerrar la tanda

- `node test.js` y `node test-music.js` en verde. Lo nuevo que cubre el de musica: que **ningun
  sorteo de `arcDir` baje de 45 grados sobre la horizontal** y que las tres familias existan.
- **Nivel 1 contra `git archive HEAD`: 0 px distintos y max delta 0** en las cuatro pasadas.
  El aparato de aislar capas se apoya en `getBoundingClientRect()` del canvas (17,54,1248x508):
  la captura es la ventana entera (1280x577) y sin recortar, los 47px del corte del rig salian
  contados como si estuvieran en el medio de la pantalla.
- Verificado a ojo: el fogonazo en t=28.97, un compas de rayos y uno de laseres en el buildup y
  otro par en el drop2 (con el rig apagado en los de rayos), y que las diagonales que llegan al
  canto de abajo en el drop2 **no son el rig sino el haz** (`beam`, el par cruzado).

## La tanda de las 7 quejas (nivel 2, el reactor y el color)

Siete puntos: dos de color, dos de movimiento del reactor, uno de la ola, uno del fondo y uno de
la marca del acid. Mismo respaldo de siempre: **nivel 1 contra `git archive HEAD` en el 8124, 0
px distintos y max delta 0** en t = 12 / 36.3 / 50.2 / 65 y en las tres camaras (12 de 12).
`draw()` del nivel 2 con todo puesto: **0.575ms media / 0.8 p95 / 1.4 max en el drop2**, 0.386 en
el buildup y 0.422 en el outro, sobre un presupuesto de 16.7.

70. *"the rays that the reactor emits only go up... they must go like from all axis from the
    center"* -> `arcDir` pasa de **3 familias a 6**: las tres de arriba mas las tres espejadas
    hacia abajo. **No rompe la regla de "nunca horizontal"** de la tanda anterior, la conserva:
    el peor caso sigue siendo 30+10 = 40 grados desde la vertical, o sea **50.0 desde la
    horizontal medido sobre 20000 semillas**, con el reparto parejo (3411/3372/3340/3368/3302/
    3207 sobre las 6). Verificado ademas aislando la capa en t=38.27: la caja de los rayos pasa
    a **534..724 en x y 0..506 en y**, o sea de canto a canto de la pantalla, con rayos saliendo
    del reactor hacia arriba Y hacia abajo.
71. *"the color for the reactor is still not very visible, go for that typa colors"* -> la queja
    era exacta y se midio: **aislando la capa** (mismo frame del drop2 con y sin `reactor` en
    `decor`, restando los dos PNG), sobre sus 13759 pixeles la **saturacion media era 0.149**, o
    sea gris con tres manchitas de cyan. La luma no era el problema (86.8 de media, p95 199): el
    chasis es lo mas GRANDE del dibujo y no tenia color. Dos cambios: el metal deja de ser gris
    neutro y se va al cyan del nivel (`454545` -> `1e4a57`, `2a2a2a` -> `102a33`, hue 193) y el
    halo pasa de `1/0.16 + 0.5/0.26` a **`1.7/0.20 + 0.7/0.30`**, en las mismas dos pasadas (o
    sea las mismas 526 llamadas al Graphics). Medido igual: **saturacion 0.149 -> 0.308 (+107%),
    luma 86.8 -> 90.0, p95 199 -> 207 y los pixeles por encima de 100 del 18.8% al 21.9%**.
72. *"onto the marker #86 the reactor spins his elices until the #89, ease out/in, and the same
    onto the #106, to the contrary side and the same span of time"* -> tipo `fx` nuevo, `spin`.
    Medido: **#86 cae en la f75 y #89 en la f76; #106 cae en la f91**, o sea dos tramos de
    **2 filas = 0.876s cada uno**, que es lo que pedia ("the same span of time"). `SPIN_TURNS` =
    **1 vuelta ENTERA** y no una fraccion: el extra vuelve a 0 al salir del tramo y solo con
    vueltas enteras eso cae en la orientacion donde arranco. Muestreado en 8 puntos del tramo:
    **0 / 0.043 / 0.156 / 0.316 / 0.500 / 0.684 / 0.844 / 0.957 de vuelta**, o sea el
    smoothstep, y el segundo tramo los mismos con signo menos. `test-music.js` falla si dejan de
    ser dos, de durar lo mismo o de girar para lados contrarios.
73. *"add color variations: first 4 beats on the color we had, then fade the whole reactor and
    all main colors to pinkish/reddish... more like a hue movement than a DIRECT all to pink.
    Or maybe neon purple"* -> `hue: { beats: 16, hold: 4, deg: 70 }` en el nivel, aplicado en la
    UNICA puerta por la que pasa el dibujo entero (`fantasma`, el mismo sitio del blanco y
    negro), o sea que ninguna de las 20 funciones de dibujo se entera. Medido beat a beat del
    ciclo: **0 0 0 0 18.1 35.0 49.5 60.6 67.6 70.0 67.6 60.6 49.5 35.0 18.1**, o sea los 4 beats
    quietos y el resto una ida y vuelta; el cyan del nivel va **`00d8ff` -> `90adff` -> `b2a3ff`
    -> `bea0ff`** y vuelve, que es el neon purple. **`KILL` esta exento** (es lo unico que mata)
    y los grises tambien (si no, el metal del reactor y el contorno del muneco se pintarian).
    Y **la luma se conserva**: HSL conserva la L, que no es lo que se ve (medido, girar el cyan
    30 grados dejaba la misma L y la luma se caia de **172.9 a 81.3**, o sea un fundido a
    oscuras, y con eso ninguna de las jerarquias de contraste del proyecto se sostiene). Se le
    devuelve mezclando hacia blanco o negro, que es exacto porque la luma es lineal en esa
    mezcla: **el peor desvio sobre 12 colores y 360 grados es 0.48 de luma sobre 255**.
74. *"the wave digital is still not there. On the buildup show it as is now, but on the drop
    change the shapes, use pyramids or something that way"* -> `wave[sec].shape = "pyra"`, y
    **solo en el drop2**: el buildup queda como estaba, que es lo que se pidio. No es geometria
    nueva: es el MISMO campo, rellenando el cuadro que ya estaba calculado entre la fila de
    atras y esta, partido en **dos triangulos de distinto tono** (el idiom de `pyraFaces`), y
    solo en los **maximos locales por encima de 0.35**, que es lo que lo hace barato y lo que lo
    hace leerse: rellenando cada cuadro serian ~30 por fila y la malla dejaria de ser malla.
    Medido: **430 piramides por frame** (860 `fillPoints`), el aporte propio de los rellenos es
    **4.81% del cuadro**, y `draw()` pasa de **0.467ms a 0.518** (400 pasadas por lado), o sea
    **+0.051ms** sobre 16.7.
75. *"onto the drop all acid part markers we must have like an aggressive flip so we feel the
    thing changes, but then it comes to normal with a variation"* -> tipo `fx` nuevo, `jolt`
    (f68-f99). Cada marca del acid dispara tres cosas: el nivel entero a **fantasma** durante
    `JOLT_B` beats (el golpe), y dos que **se quedan** (la variacion): la paleta `neon` ROTA una
    posicion y la ola cambia de `mode`. Medido en el drop2: **30 valores distintos del indice de
    marca, las 4 paletas de `neon.fam` y los dos modos de ola**, con 28 golpes a 1.99Hz.
    `JOLT_B` es **0.18 y no 0.35**, y el numero sale de medir el tramo del drop donde todavia
    hay color (f68-f89, 9.64s: de la f90 para adelante el nivel ya esta declarado en fantasma):
    con 0.35 ese tramo quedaba **46.9% en blanco y negro** (31.4% puesto por el jolt), o sea que
    el golpe se comia justo el color del reactor y la deriva de tono que se pedian en el mismo
    mensaje. Con 0.18 (79ms, ~5 frames): **31.4% de fantasma y 16.0% del jolt**, 21 golpes a
    2.18Hz. **Y el indice de marca es el GLOBAL y no el de `near()`**: con las cues de alrededor
    del jugador `mk` se quedaba clavado en 1 todo el drop2, o sea que la variacion no existia.
76. *"the base gradient background... think 4 variations and add them where you estimate
    convenient. They must not steal the full attention but be something not as simple as that
    gradient. Maybe a music based thing. This must not collide visually with any other
    element"* -> `sky.mode` por seccion, **cuatro** y ninguna agrega geometria: son la misma
    franja con el alto, el alpha, la curva o el reparto en columnas movidos. **Nada de FFT**: el
    analizador es lo unico del render que no es funcion de `songT` (en pausa da ceros) y un
    fondo a pantalla completa que cambia al pausar rompe el rebobinado a 0 px; manda `lat`, el
    metronomo, que existe el 100% del nivel. Medido el factor de modulacion por seccion:
    **`swell` (buildup) 0.88..1.12 (x1.27)**, **`shut` (break) 1.000..0.005 (x216)**,
    **`duck` (drop2) 0.163..1.000 (x6.15)** con el golpe en cada kick de la grilla, y
    **`drift` (outro)**, que es el unico con estructura horizontal: 8 franjas partidas en 16
    columnas con una onda que da una vuelta por compas. Medido **aislando la capa** (mismo frame
    con y sin `drawSky`), cobertura del cuadro y luma de la banda: buildup **15.17% / 8.6**,
    break **0.00% / 0** (cerrado del todo, y ademas cae dentro del apagon), drop2 **13.74% /
    52.7**, outro **5.44% / 6.1**; y el perfil horizontal del outro varia **x4.3 entre columnas**
    (0.22 a 0.95), o sea que la onda esta y no es una franja plana.

- **Aparato**: dos servidores (8123 el arbol de trabajo, 8124 `git archive HEAD`), una sola
  sesion de Chrome, canvas recortado a (17,54,1248x508). **El aislamiento de capas por metodo
  (`d.drawSky = () => {}`) solo vale con la pagina RECIEN abierta**: despues de un barrido largo
  de `seek`+`draw` en la consola el screenshot se queda congelado y devuelve el frame viejo, o
  sea **0 px distintos que no son un 0 px real**. Se detecta comparando dos tiempos distintos
  (tienen que dar ~99% del cuadro); en esta tanda hubo que rehacer cuatro medidas por eso.
  Y **la recarga necesita cache-busting** (`?cb=<n>`): con la misma URL el navegador sirve el
  `AIRunnerGame.js` viejo y se mide el codigo anterior (paso dos veces).
- Verificado a ojo: el reactor antes/despues a 2x, el campo facetado aislado en el drop2, los
  rayos aislados en t=38.27, y los cuatro frames de seccion (t = 15 / 33 / 36 / 55).

## La tanda de las 9 quejas (nivel 2, el jefe final y el guion bailado)

La tanda mas grande hasta ahora y la primera con el nivel 2 **jugable**: ademas de los nueve
puntos (numerados 1, 2, 4, 5, 6, 7, 8 y 9 en el mensaje, sin 3), se dicto bailando el guion
entero, **485 obstaculos**. Mismo respaldo de siempre: **nivel 1 contra `git archive HEAD` en el
8124, 0 px distintos y max delta 0 en las 12 medidas** (t = 12 / 36.3 / 50.2 / 65 x las tres
camaras), con la comprobacion de que el screenshot esta vivo (dos tiempos distintos dan 97.1% del
cuadro). `draw()` del nivel 2 con todo puesto y el guion delante, muestreado moviendo `songT` a
mano por rAF: **drop2 (835 frames) 1.237ms media / 1.2 p50 / 2.4 p95 / 3.3 max y 0 frames por
encima de 16.7**.

77. *"Negative"* -> tipo `fx` nuevo, `neg`, y **no es un efecto nuevo: es el motor del gate con
    otro `kind`** (`gateAt(t, lv, "neg")`), o sea que trae gratis `div`, `cut` y `ramp` y late
    con la grilla en vez de estar puesto. Se aplica en la MISMA puerta que el fantasma y la
    deriva de tono (los dos envoltorios de `fillStyle`/`lineStyle` de `fantasma()`), o sea que
    ninguna de las 20 funciones de dibujo se entera. Dos cosas medidas y no elegidas: **va
    ULTIMO**, envolviendo al fantasma y a la deriva (con el cyan del nivel, fantasma solo da
    `#2c2c2c`, invertir ANTES da `#1c1c1c` -o sea que el fantasma se come el negativo- e
    invertir DESPUES da `#d3d3d3`); y **`KILL` NO esta exento**, al reves que en la deriva de
    tono, porque `^0xffffff` es una isometria y conserva su separacion exacta contra el decorado
    (**239 minima y 153 grados**, los mismos numeros que en normal), mientras que eximirlo la
    hunde a **86.0 y 2 grados**, o sea que lo que mata se confundiria con el fondo.
78. *"Likek 'duplicating' the screen... like we see 4 times the same thing but as a grid... onto
    the buildup will be for test"* -> tipo `fx` `grid`, y la forma "de manual" (cuatro camaras de
    Phaser con `setViewport` + `setZoom`) **se escribio, se midio y se tiro**:
    `GraphicsWebGLRenderer` recorre el `commandBuffer` ENTERO una vez **por camara**, o sea que
    el coste es de CPU y encima **no se ve en `draw()`**, que ya termino. Medido en el tramo,
    `draw()` + `renderer.render` sumados (260 frames, `songT` a mano por rAF):

        sin grilla        5.89ms media / 6.6 p95 /  7.9 max     0 frames sobre 16.7
        4 camaras        16.47        / 17.7     / 44.2        60 de 258 frames sobre 16.7
        esto (textura)    5.96        /  6.7     / 15.4         0 frames sobre 16.7

    O sea que la version nativa **cuadruplica el trabajo** y se come el presupuesto entero, y la
    textura cuesta **+0.07ms de media**: se dibuja normal, se copia a un `RenderTexture`, se
    esconde el Graphics y se pintan cuatro `Image` a `setScale(0.5)`. **Los textos no se
    duplican** (los quads van a `depth` -1, por debajo del HUD, los numeros y la tira: cuatro
    HUDs no son un efecto, son cuatro HUDs) y el `RenderTexture` **se crea la primera vez que se
    enciende**, o sea que en el nivel 1 no existen ni la textura ni los quads (verificado: sin
    `rt`, sin `quad`, sin `gridRT` y con `g.visible === true`). El tramo es la **f24-f31**, los
    compases 6 y 7 enteros: las unicas 8 filas del buildup sin nada mas encima, sin una sola
    marca y con 4 golpes de `bass`.
79. *"The 'text' its the same as the other level try other font or effects for that. And it says
    'let the bass quick down' not what it says"* -> las dos cosas estaban escritas en el
    renderer. La frase pasa a **"LET THE BASS QUICK DOWN"**, que es lo que dice, y salen dos
    diales: `acidFx.style` (un `Phaser.Text` style ENTERO, no diales sueltos que despues haya que
    ir agregando de a uno; el nivel 2 va a una condensada pesada -`Impact` / `Haettenschweiler` /
    `Arial Narrow`- en su cyan) y `acidFx.move`, el gesto. `setStyle` se llama **solo cuando el
    estilo cambia**: re-medir 24 textos por frame es tirar el layout. El gesto del nivel 2
    (`"stamp"`) es el REVES del nivel 1: ahi las letras vienen de lejos y revientan hacia la
    camara porque tienen un nivel del que despegarse, y aca el break es negro entero (`dark`,
    f63-f67) y las letras son **lo unico que se ve en 2.47s**, asi que se ESTAMPAN palabra por
    palabra (medido: una cada **219.5ms = 0.501 beats**, o sea medio beat a 137bpm, contra los
    219.0 de la cuenta), llegando encima de la camara (z de 406 a 700, escala x1.72 -> x1) y
    clavandose. La salida es z **creciendo**, o sea que convergen solas al punto de fuga, que es
    donde 26.8ms despues entra el reactor con el fogonazo del snare: `OUT` = 0.80 son 330ms =
    0.75 beats y terminan **285.8ms antes del drop2**. El gesto no alarga la cue ni un frame.
80. *"the rayos onto the reactor just 'touches' the lanes, its ok but its like centred on that.
    Its not ok its always there"* -> las dos mitades de la queja eran ciertas y las dos se
    midieron. **"Siempre ahi"**: con la envolvente `(1-p)²` normalizada al hueco entre disparos,
    el corte `e < 0.03` se cumple en `p <= 1 - sqrt(0.03)`, o sea el **82.7% de CUALQUIER
    division** por construccion, y el haz estaba en pantalla el **48.6% de la cancion** (7232
    muestras a 10ms). Con `BEAM_T` = 0.35s y el periodo en un COMPAS cada disparo dura **289ms =
    0.66 beats**, duty **16.5% del drop y 33.0% del outro, 17.6% de punta a punta**, y son **42
    disparos en vez de 172**. **"Centrado"**: el **100%** de los disparos era simetrico a `w/2`, y
    con 4 carriles ahi no hay ninguno (el recto pegaba en el DIVISOR entre el 1 y el 2, y su
    objetivo `(w/2, h)` cae en **z=558, detras del jugador**, que esta en 720). Ahora **apunta a
    un carril y BARRE**: el objetivo va en el plano del suelo, sale del carril `a` alla lejos y
    llega al `b` encima tuyo, con el parametro del barrido `q = 1 - e`, o sea el complemento
    EXACTO de la envolvente (sale de golpe y frena, y no hay una segunda cuenta que se pueda
    desincronizar). Medido a 1248x651: el impacto recorre **332px** (268 en x, 196 en y) y el haz
    gira de **16.5 a 63.0 grados** segun el par de carriles (media 34.9).
81. *"The 'lazers beams' that the reactor emits arent good enough idk what u did"* -> lo que
    estaba mal es que **el cono no tenia fuga**: eran 124.8px de semiancho FIJO a cualquier
    distancia, o sea un triangulo plano pegado a la pieza. Ahora los tres conos miden
    `BEAM_PW * s`, o sea **lo que mide su propio charco** (16/45/103px a z=2600 y 51/143/328 a
    z=815), con la **boca** blanca en el nucleo y el **charco** en la superficie proyectado por
    sus cuatro esquinas, o sea en trapecio como las bandas del suelo. Y el **anillo** que era una
    de las tres formas **se borro**: `drawRings` ya dibuja eso mismo, colgado del mismo centro y
    con el mismo aplastado, o sea que era un duplicado, y encima era la unica forma que no tocaba
    la pista, que es lo unico que se le pide al haz. Queda uno o dos (`BEAM_PAIR` = 0.4) y el
    segundo barre **al reves**: se cruzan a mitad del disparo en vez de ser un par espejado.
82. *"The piramds surface its idk still 'noisy' and not good"* (la segunda vez que se reporta) ->
    el problema no era el alpha ni el tono: era **el tamano de la celda**. La malla mide
    `MESH_PX` = 16px de ancho (sale de Nyquist) por la separacion entre filas, o sea 33px en
    z=700 y 7px en z=1500, asi que cualquier faceta hecha sobre esa celda mide **~19x12px**, y a
    238 por frame eso es confeti. Encima el criterio de maximo local se quedaba con UNA celda de
    una mancha de cresta que mide **2.53 columnas x 1.69 filas**, o sea un cuarto: medido, el
    **76% de las facetas no tocaba a ninguna otra**. Con una reticula propia y mas gruesa
    (`PYRA_NX` = 5 columnas, `PYRA_DZ` = 3 filas) se indexan los MISMOS `row`/`hs` (cero puntos
    nuevos) y salen **42 formas de 85x28px con el 117% de adyacencia**, o sea crestas seguidas y
    no puntos. `PYRA_A` baja de 0.55 a **0.32** por la cuenta y no por el ojo: la tinta sube de
    **3.18% a 5.62% del cuadro** al engordar la faceta, asi que tinta-por-alpha queda en **1.80
    contra 1.75**, la misma de antes.
83. *"The reactor is still not as i wanted. try to idk enhance it MORE. Doesn't look like a final
    boss"* -> tres cosas, y la que mas pesa no es el tamano. **El CASCO** (`shellParts`): las tres
    alas dejan huecos de **84.8 grados** entre ellas, o sea que el dibujo tapaba el **44.7% de su
    propio disco** y el pixel mas bajo oscilaba entre **354 y 488** a lo largo de una vuelta (la
    pieza se despegaba del final de la pista la mayor parte del tiempo, y eso es lo que la hacia
    leerse como un logo); el anillo dentado de 12 dientes lo cierra, con tres tirantes al nucleo
    en **90 / 210 / 330** (los mismos angulos de los LEDs, o sea justo por los huecos y **sin
    romper la simetria** respecto de x=512, que el chequeo sigue afirmando) y girando **al reves
    que las alas y mas lento** (`SHELL_SPIN` = 0.55: dos cosas girando igual se leen como una
    sola pieza). Son **232 primitivas** (229 mecanicas + 3 ondas) y **596 llamadas** al Graphics,
    contra 199 y 526. **El tamano quieto** sube de `REACTOR_R` 0.148 a **0.160**, o sea de 28.1%
    a **30.4% del alto (198px de 651)**, y con la creciente el diametro llega al **40.7%**: lo
    que crecio es el estado QUIETO, porque el del drop ya estaba topado por el canto de arriba.
    De ahi cuelgan dos numeros que **hay que recalcular y no heredar**: `REACTOR_SNAP` baja de
    0.35 a **0.25** porque el techo escala con el inverso del radio (`S <= 0.391` a 0.148 pasa a
    `S <= 0.287` a 0.160), y con 0.25 el fogonazo mide **lo mismo que antes en pantalla**
    (43.25% contra 43.20%); y `REACTOR_UP_FLAT` baja de 2.2 a **2.05** porque el radio nuevo
    subia el dibujo a y=152..350, o sea despegado del suelo, que es su ancla de perfil (a 2.05 el
    borde de abajo del dibujo cae en **y=359.5**, 11.5px por encima del techo del primer `block`,
    que esta en 371).
84. *"i will like the 'reactor' moves a bit more to left and right so its like more 'movement' on
    it and not static on the x axis. I mean not big af but i think he could do that. and also
    move closer to the player sometimes"* -> `REACTOR_SWAY` = 0.22 en x y `REACTOR_NEAR` = 0.06
    con `REACTOR_NEAR_Y` = 0.30, los tres en **fraccion de su propio radio**, o sea que no hay
    que re-medirlos si cambia `REACTOR_R` ni cuando la creciente lo agranda. Los periodos son
    **4 y 8 compases** y no uno solo: con el mismo periodo el vaiven y el acercamiento pican
    juntos y se leen como UN movimiento. **Acercarse es sobre todo BAJAR**, y eso sale de la
    cuenta: con `hype`=1 el radio ya mide 103.4 de los 122.4 que caben hasta el canto, o sea que
    el tamano no tiene de donde crecer sin salirse del cuadro o sin pisar al fogonazo (que es lo
    mas grande del nivel y esta topado), y hacia abajo hay pantalla de sobra. Medido en el drop2:
    el centro barre **+-23.4px** de un canvas de 1248 y el diametro va de **40.7% a 43.1%** del
    alto, o sea el "not big af" que se pidio.
85. **El guion del nivel 2**, dictado bailando (clic en el sector -> `Y` -> jugarlo -> `U`) y
    pegado en `LEVELS["orbit-motion"].script`: **485 obstaculos (170 `block`, 288 `gap`, 15
    `low`, 12 `high`)**, o sea que el nivel deja de ser una pantalla. Lo que lo valida es el
    **mismo solver por filas del nivel 1**, con SUS carriles y SU velocidad (BFS fila por fila
    con la fisica de verdad, v=1400, 4 carriles), corrido con `g=1` y con `g=-1`: pasable en los
    dos, **fila mas flaca 7 estados**. **157 de las 165 filas** llevan algo; las 8 vacias son la
    f0-f2 (la entrada) y la **f63-f67**, que es el apagon (un obstaculo dentro del `dark` es un
    obstaculo que no se ve, y el test falla si aparece uno ahi). **133 filas dejan UN solo carril
    libre** y 5 dejan dos; hay **19 filas sin carril libre** y eso no es un muro: **ninguna**
    tiene las 4 de `block`, o sea que se pasan saltando o deslizandose. Los `gap` salen
    encadenados por carril (zanjas de hasta **36 filas seguidas**), y las 3 cues de rol `orb` son
    **jump orbs que puso `chains()` sola**. Total de cues del nivel 2: **604 (32 bg, 60 mark, 24
    fx, 3 orb y 485 obstaculos)**, contra las 117 de antes.

- **Aparato**: el de siempre (8123 el arbol de trabajo, 8124 `git archive HEAD` = d92181f
  verificado por hash de los cuatro modulos, una sola sesion de Chrome, canvas de 1248x791
  recortado en (17,54)). Se volvio a caer en las dos trampas ya anotadas y se volvieron a evitar
  igual: **cache-busting** (`?cb=<n>`) en cada recarga, y **comprobar que el screenshot esta
  vivo** comparando dos tiempos distintos antes de creerse un 0 px.
- **El transporte no suena en esta sesion de Chrome** (el `AudioContext` no arranca sin gesto),
  asi que `tp.play()` deja `songT` clavado: las medidas de `draw()` de esta tanda se hicieron
  **moviendo `songT` a mano por rAF**, no reproduciendo. Es la misma cuenta (el mundo es funcion
  de `songT`), pero el FFT ahi da ceros, o sea que la traza del reactor sale de la onda
  sintetica y no de la cancion.

## La tanda del suelo outrun (nivel 1, y la primera vez que el nivel 1 SI se mueve)

Dos pedidos y un aviso. El pedido, verbatim:

> *"I will want put as background for him as we did fro the 2nd the digital wave. But onto the
> 1st one i want like retro futuristic floor like this one: like a grid. and i wil lwant we add
> negative effects that we added. Just the cherry on top we did that looks amazing. nothing more
> big."*

El aviso es que **el invariante de 0 px cambia de sujeto**. Hasta aca el respaldo de cada tanda
era "el nivel 1 no se mueve un pixel contra `git archive HEAD`", y eso **ya no es cierto y es a
pedido explicito**: el nivel 1 enciende la malla, la pinta de oro y declara dos tramos de `neg`.
Lo que se midio en su lugar son las dos mitades que si siguen valiendo:

- **el nivel 2 contra HEAD**: 12 diffs (t = 9 / 28.6 / 35.5 / 57.5 x las tres camaras) a **0 px
  distintos y max delta 0**, o sea que la tanda entera del nivel 1 no le movio un pixel al 2;
- **el nivel 1 con los diales apagados**: sacando `"mesh"` de su `decor` y dejandole `fx: []`, en
  t = 12 / 36.3 / 50.2 / 65 (los cuatro fuera de los dos tramos de `neg`) y en las tres camaras,
  otros 12 diffs a **0 px y max delta 0**. O sea que lo unico que movio el nivel 1 es lo que el
  nivel declaro, y borrando las dos lineas vuelve byte a byte a lo de antes.

Y lo que si cambio, medido: el nivel 1 tal cual contra HEAD da **12.31% a 12.63% del cuadro**
(camara de atras), **todo el cambio por debajo de y~350**, o sea el suelo y nada mas; y
**99.42% / 99.43%** con la pantalla entera invertida en t = 24.93 (f54) y t = 97.0 (f210), o sea
dentro de los dos tramos de `neg`.

86. *"onto the 1st one i want like retro futuristic floor like this one: like a grid"* -> el
    nivel 1 enciende la **MISMA capa `mesh`** del nivel 2 (`decor` pasa de ocho a **nueve**) y no
    se escribio ni una funcion de dibujo nueva. Lo unico que cambia son la ola y los colores:
    - **`wave.mode` 2 = `outrun`** (`fx.js`, mismo idiom que el resto: no importa Phaser, entra
      estado y sale un numero). **La reja no es geometria nueva: es `drawMesh` con la ola en 0.**
      Las filas cada `MESH_DZ` = 70 del mundo y los cruces uno de cada 3 ya estaban; con `v` = 0
      salen rectas y convergiendo al punto de fuga. Medido, el relieve cresta a valle da **0.0px
      a z=400 y z=700** y todo lo que esta por debajo de **y=541, el 32% del alto de pantalla**,
      es reja plana; la cordillera empieza mas alla y las montanas son el mismo campo con
      amplitud.
    - **La cordillera arranca donde arranca la FILA, no en un x fijo del mundo.** `MTN_X0` = 700
      es mundo y el borde interno de la malla es `xi = edge + MESH_GAP / s(z)`, o sea PANTALLA:
      solo coinciden en z=4000, asi que de cerca la fila entera caia dentro de la meseta plana.
      Con `outrun(x, z, x0)` recibiendo el `xi` del que dibuja, cresta a valle en px a lat=0.24:

          z:            400   700  1100  1500  2000  2600  3300  4000
          con 700 fijo  0.0   0.0   3.4  22.3  30.8  28.4  23.3  18.4
          con el borde  0.1   4.0  21.2  33.4  32.5  29.0  23.5  18.4

      y las columnas con relieve pasan de **0% en z=700, 43% en z=1100 y 68% en z=1500** a
      **96-97% en todas**. El relieve vale exactamente 0 EN `xi`, o sea que la cordillera no se
      acerca ni un pixel a la pista.
    - **Los periodos entran en Nyquist con margen**: `MTN_KX` = pi/620 (periodo 1240 en x) y
      `MTN_KZ` = 2pi/1400, con el paso entre columnas de 16px de pantalla, dan **8.0 muestras por
      periodo en el peor caso (z=4000) contra las 3 de Nyquist** (z=400 411 / 700 63.8 / 1100
      30.0 / 1500 21.8 / 2000 16.2 / 2600 12.3 / 3300 9.7). En z el paso es fijo y da 20.
    - **`mesh: { lo: "#3b2a04", hi: "#ffd166" }`**, dial nuevo con respaldo `MESH_LO`/`MESH_HI`
      (el cyan del nivel 2, que no lo declara y sigue en 0 px). El oro no es gusto: esta a **144
      grados de tono** del violeta-indigo de `neon.fam` (258 contra 41.9), que es la referencia
      outrun, y el cyan del respaldo seria un cuarto color en una pantalla que ya tiene tres. **Y
      no se acerca a lo que MATA**: contra `KILL` (`0xed4679`) da **215 / 109 / 141 de RGB y
      59.8 / 60.2 / 60.3 grados** en los tres puntos de la rampa, mientras que lo mas parecido a
      `KILL` del nivel 1 es **su propio rosa** (`neon.sec.drop` = `#ec4899`, a **32.1 y 11.3
      grados**) y eso ya estaba shippeado, o sea que el oro entra **3.4 veces mas lejos** que el
      peor caso que ya se ve. `test-music.js` falla por debajo de 100 de RGB o 45 grados. El
      ambar (`#ffb703`) se probo y es peor en todo (142 / 164, con el valle a 52.5 grados).
    - **No toca la pista y no deja cuna negra**, las dos medidas: el pixel de la capa mas cercano
      al centro se queda a **87.9-88.1px** del borde de la pista (peor caso fila por fila entre
      y360 e y560 sobre 8 frames), que es el `MESH_GAP` de 90px menos el trazo y es plano con la
      profundidad; y hacia arriba llega de x=0 a x=1245 en todas las filas del fondo con su pixel
      mas alto en **y=352..355** contra el fondo real de la pista en **y=355.36**, o sea **0 px
      de luma < 6** de 1248 en las cuatro filas del fondo y en los ocho frames.
    - **El arco por seccion sale de la jerarquia y no del ojo**: aislando la capa y comparando la
      luma de su tinta contra el parche del plano del suelo de la misma banda (y400-520), el
      drop2 iba en 1.45 y el outro en 1.30 y ahi la malla le **GANABA** a la pista (**1.26/1.32**
      y **1.11/1.07**), porque la pista del nivel 1 en esos dos tramos es la mas apagada de la
      cancion (luma 26.1/24.2 y 24.6/25.2 contra 58.8/46.0 en el drop). Barrido en vivo: drop2
      1.15 -> 1.13/1.19, 0.95 -> 1.06/1.10, 0.85 -> 1.01/1.05, **0.75 -> 0.96/1.00**; outro
      1.05 -> 1.02/0.98, **0.85 -> 0.94/0.91**. La cobertura casi no se mueve (12.66% -> 12.41%):
      lo que baja es el brillo de la linea, no cuanta linea hay.
    - **Coste**: `draw()` del nivel 1 pasa de **0.658 y 0.567ms a 0.787 y 0.828** (dos corridas
      por lado, 867 muestras utiles cada una, `songT` a mano por rAF desde t=40; p95 1.7/1.0 sin
      malla contra 1.2/1.3 con), o sea **+0.20ms de media** sobre un presupuesto de 16.7 y
      **0 frames por encima de 16.7 en las cuatro corridas**. Sale mas caro que en el nivel 2
      aunque `outrun` evalue 2 senos contra 4 y corte de una en la banda plana, porque el `edge`
      del nivel 1 es 255 y no 340: hay mas ancho por fila que dibujar.
    - Tres trampas que se pisaron y que estan anotadas en `CLAUDE.md` porque no se ven leyendo el
      diff: el `if (mode)` de `meshWave` pregunta por **truthy y no por igualdad**, y el `jolt`
      hace `mode ^= 1`, o sea que `2 ^ 1` da **3** y el nivel 1 dibujaria el AGUA del nivel 2 en
      la mitad de sus marcas (gateado con `this.wave.mode < 2`); `tono` esta **duplicado** en
      `drawMesh` y en `drawMeshFlat`, asi que parchear uno solo dejaba la camara de perfil en
      cyan; y la `tapa` del reactor en `drawMeshFlat` no consultaba `decor`, o sea que el nivel 1
      de perfil se quedaba con un disco sin dibujar de ~198px de radio donde no hay reactor.
    - De perfil y en 1a persona, medido: `drawMeshFlat` cubre **4.05% / 4.04%** del cuadro con
      y=32..327, **0 px por debajo de h/2** y **0 px en la banda de juego** (y=451 a y=569.5, o
      sea 124px de holgura); en 1a persona **6.09% / 5.73%** con el pixel mas bajo en y=453 /
      y=457.
    - Lo que NO lleva y por que: **`metro`** (el nivel 1 no tiene el problema que creo ese dial:
      `beat` > 0.05 cubre **99.8% del drop, 100% del drop2 y 100% del outro**, media 0.310 /
      0.328 / 0.328 y p95 0.819 / 0.866 / 0.866, contra el 0% del nivel 2; el 13.8% del buildup
      es el diseno, `glow.buildup = "mark"`), y **`shape: "pyra"`** (las facetas son para las
      crestas de agua del drop2 del nivel 2, cuestan +0.05ms medidos y aca rellenarian las
      montanas de macizo).
87. *"and i wil lwant we add negative effects that we added"* -> el nivel 1 declara **`fx` con dos
    tramos de `neg` y con nada mas**, uno entrando al nivel y otro saliendo: **`f40-f55`** con
    `cut` 0.08 y `ramp` 0.30, y **`f204-f219`** con 0.10 y 0.36. No hay codigo nuevo: es el mismo
    `gateAt(t, lv, "neg")` de la tanda anterior. `div` = **1** (un corte por beat) y no 4: a
    130bpm son **2.167 destellos por segundo**, o sea por debajo de los 3/s de la WCAG 2.3.1, y
    un negativo a pantalla completa es lo que mas parpadea del nivel. Medido fila por fila
    (fraccion del beat con la imagen invertida):

        f40-f55    8.0 9.5 10.9 12.4 14.0 15.4 16.9 18.3 19.7 21.2 22.7 24.1 25.6 27.1 28.6 30.0
        f204-f219  10.1 11.8 13.5 15.3 17.0 18.7 20.5 22.2 23.9 25.6 27.4 29.1 30.8 32.6 34.3 36.0

    o sea **19.0% y 23.0%** de cada tramo (7.385s cada uno) y **3.05% de los 101.54s** de la
    cancion. Lo que NO se toca: la **f56-f63** (blinders f56-f59, apagon f60-f62 y el beat del
    fantasma f63, tres efectos a pantalla completa ya medidos) y el drop y el drop2, donde el
    fantasma esta puesto el 23.3% del tramo y el negativo lo **envuelve**, o sea que se sumarian
    dos filtros. La separacion de `KILL` sobre los **28 colores que el nivel 1 declara** da
    **32.1 de RGB y 11.3 grados**, y **el mismo numero exacto invertida** (`^0xffffff` es una
    isometria); contra los **12 que estan realmente en pantalla dentro de los dos tramos** son
    **141.4 y 59.8 grados**, tambien identicos invertidos. Y se verifico **en pantalla** que el
    negativo va ULTIMO y no lo come el fantasma: forzando `__dbg.ghostKey` dentro de un tramo, la
    luma media pasa de **20.2 a 234.7** y los grises salen complementarios exactos par por par
    (251/4, 249/6, 247/8, 244/11, 241/14: todos suman 255), con el 97.8% del cuadro en gris en
    los dos casos.

- **Aparato**: el de siempre (8123 el arbol de trabajo, 8124 `git archive HEAD`, una sola sesion
  de Chrome, canvas recortado de 1248x651), con la salvedad de que ahora el diff que tiene que
  dar 0 px es el del **nivel 2**, y el del nivel 1 hay que correrlo **con los diales apagados a
  mano** antes de creerselo.
- **Trampa nueva y cara**: recargar la misma sesion con `?cb=<n>` **NO invalida los imports de
  modulo ES**. Despues de editar `music.js` la pagina sigue corriendo el modulo viejo, o sea que
  se mide lo de antes creyendo que es lo de ahora. Hay que abrir **sesion nueva** despues de cada
  edicion de un modulo. Y `agent-browser errors --clear` **no vacia el buffer de page errors**
  (solo `console --clear` funciona), asi que contar errores de pagina tambien pide sesion nueva
  por URL.

## Lo que quedo flojo

- **La cordillera de perfil no tiene relieve propio y no se midio**: `drawMeshFlat` le pasa a
  `outrun` el `MTN_X0` = 700 del mundo y no el borde de la fila, porque ahi las franjas son
  cortes a una x fija y el numero mundo es el que corresponde. Que eso deje la cordillera bien
  repartida a lo ancho de la pantalla de perfil **no esta medido**: lo unico medido de esa camara
  es la cobertura y que no entra en la banda de juego.
- **El agujero de la malla de perfil durante el buildup del nivel 2 sigue ahi**: la `tapa` se
  gateo por `this.dec("reactor")`, que arregla al nivel 1 (que no tiene reactor), pero el nivel 2
  si lo declara y su reactor no existe hasta la f68, o sea que en su buildup de perfil sigue
  habiendo un disco sin dibujar. Se dejo a proposito (arreglarlo pide mirar el tramo `fx` y no
  solo `decor`) y **no se midio**.
- **El drop del nivel 1 se quedo en `wave.a` = 1.45** aunque el barrido bajo el drop2 a 0.75 y el
  outro a 0.85: ahi la pista es la mas brillante de la cancion (luma 58.8/46.0) y el ratio da
  0.55/0.96, o sea por debajo de 1. Es el unico tramo donde la malla va al alpha que se eligio
  primero, y no se barrio como los otros dos.
## La tanda del menu y el modo juego (`menu.html`, `?play=1`, una vida)

La primera tanda que no toca el nivel: es la puerta de entrada. Se pidio *"a strt page with the
list ofthe levels. 1st level and 2nd are just hte name of thesong. The first ist insomnia? i tink
and the second space orbit. So simple startpage were u start playing. And if u start from there u
just do like hide the controms and marks we show. And for debug we just had to start the levles
from the same view but holdng the D so its hidden haha. I will justleft this level as those
imposilbeo nes. 1 life and u repeat, like u die, wait 3s onthe spot, and start again so its not
like spaming retry"*.

Tres ficheros y nada mas (`git status`: ` M AIRunnerGame.js`, ` M index.html`, `?? menu.html`;
`git diff --stat` 73 insertions / 40 deletions, y de esas 40 unas 31 son la MISMA linea
re-indentada al meterla dentro del `if (!PLAY)`). Respaldo de siempre: **nivel 1 y nivel 2 en
modo diseno contra `git archive HEAD` en el 8124, 0 px distintos y max delta 0** en t = 12 y 50.2
(y 36.3 y 65 en la tanda de verificacion, las tres camaras: 24 combinaciones, 24 ceros), con la
prueba de vida puesta (dos `songT` de la misma build dan **97.2%** en el nivel 1 y **99.4%** en el
2). `node test.js` y `node test-music.js` ok. Consola: **0 errores y 0 warnings** en las seis URLs
(`/menu.html`, `/`, `/?level=orbit-motion`, `/?play=1`, `/?level=orbit-motion&play=1`,
`/?level=nope`), con el lector validado antes con un `console.warn` deliberado.

86. *"a strt page with the list ofthe levels"* -> `menu.html`, HTML plano con CSS inline, sin
    Phaser y sin una sola peticion mas (medido: el menu carga **solo menu.html**, ni un .js, ni
    una fuente, ni una imagen; el unico 404 es el `/favicon.ico` que el navegador pide solo y que
    tambien aparece en el HEAD limpio). **El menu no puede ir en `index.html`**: toda la receta de
    medicion del proyecto abre `/` esperando el nivel 1 en modo diseno, y con un menu ahi los
    diffs pasarian a comparar dos menus identicos y darian **0 px igual**, o sea que el respaldo
    del proyecto se convertiria en un fallo silencioso que siempre pasa. De `index.html` se toca
    UNA linea, el enlace del header, y se comprobo que el canvas queda en la misma caja
    (`[17,54,1248,791]`, identica en :8130 y :8124). Paleta y fuente sacadas de `theme.js`
    (`#0b0d17` / `#14162a` / `#2a2e4a` / cyan `#06b6d4` / `#94a3b8` y la mono), contrastes WCAG
    2.1 medidos: titulo **7.98:1**, nombre de la cancion **14.46:1**, pie de ayuda **7.55:1**. El
    numero de orden salio a **4.21:1** en violeta (por debajo del 4.5:1 de AA a 13px) y se paso a
    `accentSoft` `#818cf8`, que ya es de la paleta: **5.98:1**. Sin desbordes a 1280x860, 900x600,
    420x800 ni 360x640 (`scrollWidth === clientWidth` en los cuatro).
87. *"if u start from there u just do like hide the controms and marks... for debug... holdng the
    D"* -> **el flag lo lleva JUGAR, no depurar**: `?play=1`, y su ausencia ya es el modo diseno
    de siempre, o sea que "mantener D" no necesita inventar un `?debug=1`. El menu lo hace
    quitandole `&play=1` al `href` en el `keydown`, y no interceptando el clic: asi el clic, el
    ENTER y el clic del medio salen por el camino nativo del `<a>`. Jugando se apagan `marks`,
    `nums`, el `hint`, el `hud` y `godmode`, mas las 20 teclas de diseno; **no** se apagan
    flechas/WASD, `SPACE`, el `pointerdown` ni `holdKeys` (el dash del orb se sostiene). Medido:
    **9 teclas atadas jugando** (LEFT/A/RIGHT/D/UP/W/DOWN/S/SPACE) contra **33 disenando**, y las
    25 de diseno pulsadas una por una jugando no cambian ni un campo del estado (cada nombre se
    valido antes en diseno, donde las 25 SI cambian algo: sin eso, "todas muertas" solo prueba que
    los nombres no llegan a Phaser). `stripSeek` se apaga solo porque ya miraba `this.marks`
    (`__dbg.strip` undefined jugando). **Y el mundo es el mismo pixel a pixel**: apagando a mano
    los cuatro overlays en diseno y restando contra el modo juego en el mismo `songT` da **0 px y
    max delta 0** en el nivel 1 (t = 12 y 36.3) y en el 2 (t = 31.5 y 52.0); el diff crudo da
    **3.72%** del cuadro a t=36.3, que se reparte en 2717 px de HUD, 11386 px de lineas y numeros
    y 22656 px de la lista de teclas y la tira.
88. *"1 life and u repeat, like u die, wait 3s onthe spot, and start again so its not like spaming
    retry"* -> `lives = 1`, y morir **pausa el transporte**, que es lo que congela el mundo EN EL
    SITIO sin un dial nuevo (todo lo que se dibuja es funcion de `songT`; medido sobre 181 frames,
    `max(songT) - min(songT)` = **0.0 exacto**). La cuenta va con el **delta real de Phaser** y no
    con `songT`, que es justo lo que esta parado: medido con `performance.now()` dentro de la
    pagina, 17 ciclos, **min 3003.1ms, max 3021.1ms, media 3015.9ms** para `DEAD_T` = 3s (el
    sobrante es el frame de muestreo). **La espera no se puede saltar y esa es su razon de ser**:
    `SPACE` y el `pointerdown` miran `this.dead`, y medido con 969 frames de machaque sintetico
    mas 3 pulsaciones y un clic REALES del driver, `songT` se queda clavado a 15 decimales en el
    del choque y la espera dura lo mismo (3.0194 / 3.0196 / 3.0199 / 3.0029 / 3.0201s). El choque
    es el de verdad y no forzado: clic real en el canvas, muneco quieto, se come el primer
    obstaculo en **songT 0.876** en el nivel 1 y **1.329** en el 2. Sin fuga: 7 ciclos de
    muerte-respawn en 25s con periodo constante a 3 decimales (**3.917s**) y la display list plana
    en **103 objetos** de punta a punta.
89. **Tres cosas que la muerte destapo y que no estaban en la peticion.** (a) *El muneco no se
    veia en los 3 segundos*: `invuln` se descuenta con `dt` y congelado se queda en el 1.2 del
    golpe, o sea `floor(1.2*12) = 14`, par SIEMPRE, o sea el parpadeo de inmunidad puesto todo el
    rato (medido: **6735 px** de diferencia, bbox **130x199**, el muneco entero). Se pidio esperar
    en el sitio y sin muneco no se ve el sitio. (b) *Morir con el gate cerrado eran 3 segundos de
    pantalla negra*: la fase del gate sale de `songT`, o sea que un corte de ~30ms se quedaba
    puesto. Medido en el tramo f36-f60 de `orbit-motion` (25 filas con obstaculo, 21898 muestras a
    0.5ms) la imagen esta cortada el **18.4%** del tiempo y ahi `gateAt` da **0 exacto**:
    congelado en t=24.60 el cuadro quedaba al **98.98% en negro**, y con el gate abierto pasa a
    **99.77% no negro**. El apagon (`dark`) NO se toco: es un tramo de 2.47s y no una fase
    congelada, y ademas es inalcanzable (0 obstaculos entre la f63 y la f67, y el ultimo choque
    posible es la f62 en **27.201s** contra los **27.639s** en que arranca). (c) *Terminar el
    nivel dejaba la pantalla quieta sin un solo texto* (medido: `songT` 101.538 de 101.538, `msg`
    invisible, y sin HUD ni `hint` no queda nada que leer): se reusa la espera de la muerte y el
    cartel dice **FIN** o **MUERTO** segun `lives`. Cero UI nueva.
90. **La D se quedaba pegada**, y por dos puertas que son la misma: el estado "D hundida" vive en
    el `href` y el `keyup` no siempre llega. Navegando con la tecla apretada, la pagina se guarda
    en bfcache con los `href` ya sin flag, y al volver con Atras un clic normal abria en modo
    diseno **sin nada en pantalla que lo dijera** (medido: los dos `href` sin `&play=1`, `marks`
    true, `godmode` true, `lives` 3, HUD y hint visibles). Alt+tab con la D abajo hacia lo mismo.
    Dos lineas: `setD(false)` en `pageshow` y en `blur`. Comprobado de punta a punta: menu ->
    `keydown` D -> clic real -> aterriza en diseno -> `back` -> los dos `href` con `&play=1` otra
    vez -> clic normal -> `?level=insomnia-drop&play=1` con `{marks:false, god:false, lives:1,
    nums:0}`.

## Lo que quedo flojo

- **El cartel de la muerte se superpone a las letras del acid** en el apagon del nivel 2: los dos
  van centrados y los dos son cyan. Medido aislando la capa en `songT` 28.515: el cartel ocupa
  **1957 px** en la caja x590..689 y422..477 y **1662 de esos 1957 (84.9%)** caen sobre pixeles de
  la frase, con el fondo debajo a luma media 145.9, o sea texto claro sobre texto claro
  (**oscurece** en 1030 px, el 53%). No se movio porque **no es alcanzable jugando**: el `dark` va
  de la f63 a la f67, tiene 0 obstaculos, y el ultimo choque posible (f62, 27.201s) congela `songT`
  antes de que empiece (27.639s). Solo se ve forzando `songT` desde consola. El dia que un nivel
  ponga un obstaculo dentro de un apagon, esto se ve: un `setY(h*0.72)` en modo juego lo cierra.
- **`?play=0` enciende el modo juego**, porque el flag es presencia y no valor (`has("play")`),
  que es lo que pedia la spec. El menu no genera esa URL, pero el que la escriba a mano esperando
  apagarlo se lleva lo contrario.
- **El guion del nivel 2 se dicto de una pasada y no se re-jugo entero**: 485 obstaculos que el
  solver dice que se pasan (a los dos lados de la gravedad), pero "se pasa" no es "esta bien
  disenado". Las 19 filas sin carril libre y las zanjas de 36 filas salieron de como se bailo,
  no de un criterio, y ninguna esta jugada dos veces.
- **El reactor ya no es un logo pero sigue sin abrirse**: casco, vaiven, acercamiento y creciente
  puestos, pero que se abra por la mitad o que se esconda detras del horizonte sigue **sin
  hacer**.
- **La traza del reactor es lo unico del nivel 2 que NO es funcion de `songT`** (igual que el
  modo `spectro` del eq): sale del `AnalyserNode`, o sea que en pausa cae a la onda sintetica.
  Rebobinar no la rebobina; no rompe nada porque no se juega con ella, pero no cumple la regla.
- El canal `let the bass quick down` esta mapeado a `fx: "riser"`, pero **ningun evento de este
  schema trae `dur`** y `fxAt` sin `dur` no da progreso: hoy son dos golpes puntuales (f63 y
  f66) y no un barrido. Se arregla marcando la duracion en el schema, no en el codigo.
- El nivel 2 hereda de `LEVELS` un `enter` por seccion que **todavia no dibuja nada**, porque no
  hay obstaculos que entren. Esta declarado para que el dia que se dicte el guion no entren
  todos igual y para que no falte una seccion, pero no esta visto en pantalla ni una vez.
- **Con `V` puesto la entrada se ve a medias**: medido a v=1060, termina a 1076 del jugador a
  x1 y a 807 a x0.75 (las dos por dentro de los 1600 en los que la niebla hunde todo), pero a
  **x1.5 termina a 1614 y a x2 a 2153**, o sea que la animacion pasa entera dentro de la
  niebla y la caja aparece ya quieta. Es la cuerda tirando de las dos puntas: a x2 los 2.2
  beats que hay que dejar libres SON 2153z. La entrada es puro dibujo, no rompe nada, y la
  regla de "quieta 2.2 beats antes" es la que no se puede aflojar. Si molesta, lo que hay que
  mover es la niebla, no la entrada.
- **De la f128 en adelante del nivel 1 NO hay ni un obstaculo**: el tramo nuevo (drop2 + outro,
  92 filas) tiene musica, secciones, sectores, luces y capas de fondo, pero el `script` sigue
  llegando hasta la f127. Se dicta bailando (clic en el sector f128 -> `Y` -> `U`). (El que ya
  esta dictado entero es el nivel 2.)
- **Grabar (`Y`) ignora orbs y flips**: graba asumiendo gravedad normal. Como el `script` de
  DEMO tiene flips en las filas 88 y 104, si grabas pasado el segundo 40 el guion que sale
  esta mal. Borra los flips antes de grabar.
- Grabar no cuantiza a media fila: lo que cae fuera de la banda de tolerancia
  (salto -109..+119ms, slide -194..+196ms) se descarta en silencio.
- Los obstaculos creados por fila/tile no pasan por el filtro de secciones: el break se
  limpio **a mano** (borrando las filas 60-63 del `script`), no hay regla que lo haga solo.
  (Lo de "3 carriles tapados" ya no es un agujero: `test-music.js` resuelve el nivel
  entero con un BFS de carriles y falla si no hay salida.)
- La zona de un carril se dicta a mano en `zones`: el tramo (f78-f82, carril 1) salio de
  medir la corrida, pero elegirlo sigue siendo a mano. Lo que si esta cubierto: que la
  grabacion no cambie de carril dentro, que el tramo no quede vacio, y que se pueda pasar.
- El contenido del tramo 2D esta escrito a mano fila por fila. Si mueves la zona, el tramo
  se queda sin las cinco directivas y el solver de `test-music.js` te lo dice, pero no las
  reescribe solo.
- En 2D solo se dibujan los obstaculos de la zona: fuera de ella hay tres carriles y de
  perfil colapsan en la misma linea (una alfombra roja ilegible). O sea que si pones
  `cam: "lado"` en un tramo de tres carriles, no ves nada, no es que se vea mal.
- Los jump orbs salen de encadenar dos saltos con menos de 1.5 beats de hueco. El corte
  esta medido sobre la grabacion (los huecos se parten solos: 0.546 y 0.633s de un lado,
  0.882s+ del otro), pero es UN nivel: en otra cancion habria que volver a medirlo.
- Una cue solo puede tocar UNA capa de fondo: la segunda directiva con el mismo `#n` pisa a
  la primera.
- Las letras de "THIS IS ACID" se dibujan encima de todo (no hay z-order) y el color esta
  hardcodeado (lime), no viene del nivel.
- El triangulo del `block` es **mas angosto que su hitbox** en la mitad de arriba: las dos
  esquinas superiores se ven vacias y matan igual. Es a proposito (no cortar la vista), pero
  si alguna vez se queja alguien de "me mato el aire", es esto.
- De lado las cajas no tienen cara lateral: de perfil se ven como una L.
- En 1a persona el obstaculo que te pisa tapa la pantalla los ultimos ~57ms (la camara esta
  dentro del muneco).
- La guia roja de la zona (los carriles que no vas a poder usar) se dibuja sobre un tunel
  que **tambien es rojo**: se ve por el contorno blanco, no por el color. Si quieres que
  salte a la vista hay que darle otro color, no mas alpha.
- La transicion de 0.35s del flip pasa el plano de canto: se ve como un doblez, no como un
  giro. Ahora al menos se ve venir (el porton), pero el giro en si sigue siendo un doblez.
- El hueco (`gap`) no se puede pasar por debajo de **v=460** (medido): es mas largo que el
  salto. `V` (feel) hacia abajo ya rompia el nivel igual, pero ahora tambien por esto.
- El relleno del hueco usa el color del fondo, asi que sobre la pista se lee por el contorno
  cyan, no por profundidad: parece una baldosa, no un agujero.
- Los numeros de tile usan tamano fijo, asi que las filas lejanas se apinan (corto en
  z<2600, unas 7 filas a v=700) y el del carril central queda tapado por el jugador.

## Sin verificar

- **El suelo outrun no se jugo: se miro con `seek` + pausa.** Todo lo de la tanda del outrun sale
  de mover `songT` a mano por rAF y de restar PNGs; no hay una partida del nivel 1 de punta a
  punta con el suelo nuevo puesto. En particular **no se miro si la cordillera compite con un
  obstaculo que hay que leer**: que no toque la pista esta medido en pixeles (87.9-88.1px de
  holgura), que no distraiga no.
- **Los dos tramos de `neg` del nivel 1 no se miraron con la cancion sonando.** El duty esta
  calculado sobre la grilla y el 99.42%/99.43% de diff sale de dos frames pausados; que a 2.167
  destellos por segundo el nivel siga siendo jugable **no esta jugado**. El limite de la WCAG es
  una cuenta, no una prueba.
- **El suelo outrun no se midio con la gravedad invertida** (`H`) ni con `V` (feel) movido, ni
  con las lecturas de 1a persona que si tiene el nivel 2 (la "pared cyan": ese 5.8% / 1.5% de
  referencia se midio cuando el nivel 1 no tenia malla, y ademas el suelo nuevo es ORO, o sea que
  no cae dentro de ese criterio de saturacion y el numero no se puede reusar tal cual).
- **El nivel 2 se jugo para DICTARLO, no para comprobarlo**: el guion salio de una corrida con
  `Y` y lo que afirma que se pasa es el solver, no una partida limpia de punta a punta. Y las
  capas nuevas (casco, vaiven, haz que barre, facetas gruesas, negativo, grilla 2x2) se miraron
  frame a frame con `seek` + pausa, no con la cancion sonando.
- **El transporte no suena en la sesion de Chrome que se usa para medir**: el `AudioContext` no
  arranca sin gesto, asi que todas las medidas de esta tanda salen de mover `songT` a mano por
  rAF. El FFT ahi da ceros, o sea que el reactor dibuja su onda sintetica y lo que se midio del
  `spectro` / de la traza **no es lo que se ve con la cancion puesta**.
- Un solo tamano de ventana tambien para el nivel 2 (canvas recortado de 1248x651) y una sola
  sesion de Chrome.
- **La malla y el reactor no estan medidos con la gravedad invertida** (`H`): el nivel 2 no
  tiene cue de flip, asi que ahi no se miro nada. Lo mismo para las nueve capas de la tanda de
  las 13 quejas (gate, haz, luces de pista, anillos, rayos, esquirlas, hat).
- **El gate y el apagon no se miraron con la cancion sonando a x1**, solo con `seek` + pausa: que
  el corte caiga donde suena esta medido sobre la grilla, no escuchado.
- **Las luces de pista no se miraron con obstaculos delante** (no hay ninguno): van por fuera del
  carril de afuera, pero que no compitan con una caja que hay que leer esta por comprobar.
- El efecto del break sonando a x1 en vivo: lo mire frame a frame con `seek` + pausa.
- El juego con las vidas de verdad **en modo diseno**: ahi `K` (inmune) arranca **encendido**
  porque es modo diseno. Jugando (`?play=1`) `godmode` esta apagado y hay una vida, pero lo
  jugado son las primeras filas: **ningun nivel se termino de punta a punta jugando**, el final
  se comprobo con `seek`.
- **Todo el input de la tanda del menu fue sintetico o del driver**: clics y teclas de
  `agent-browser`, ni un teclado fisico, y un solo navegador (el Chrome de `agent-browser`). Lo
  que si se hizo con pulsacion de confianza es el tramo de la D (`press d`) y los clics reales
  sobre el canvas que provocan la muerte.
- El lector de *page errors* del `agent-browser` de la ultima tanda **no se pudo validar** (un
  `throw` inyectado como `<script>` real no aparecio en `errors`), asi que de esa tanda solo se
  afirma la consola, no los page errors.
- Un solo tamano de ventana (1200x805) y una sola pantalla (100Hz).
- **El nivel es jugable a la velocidad a la que grabaste, no a todas.** Medido con
  `simulate(rec, obstaculos, v)`: a v=700 (la grabada) 0 golpes, a v=1400 tambien 0,
  pero **a v=350 te comes 61**. Bajar la velocidad alarga la ventana en la que el
  obstaculo esta encima tuyo, y los huecos justos dejan de entrar. O sea `V` (feel)
  hacia abajo rompe el nivel. Si quieres que aguante, hay que regenerar con la v mas
  lenta que pienses usar (el rec crudo esta guardado, no hay que volver a jugar).

## La tanda del doblado (`menu.html` -> `index.html`, y el falso 0 px)

Una sola cosa y pedida tal cual: *"/menu.html ok we just do index.html and it gets sovled"*. El
menu deja de ser un fichero y pasa a ser una rama de `index.html`: **sin `?level=` el menu, con
`?level=` el juego**, los dos bloques `hidden` en el HTML y el script destapando uno. `menu.html`
se borro (`git rm`), y no queda ni redirector ni segundo fichero.

- El import del juego es **dinamico** (`await import("./AIRunnerGame.js")`), o sea que el menu no
  descarga ni Phaser ni una linea del renderer. Medido con el log de red: cargar `/` son **1 sola
  peticion al servidor** y la siguiente de la lista ya es la navegacion al nivel.
- `[hidden] { display: none !important }` **hace falta**: `#menu { display: flex }` es
  especificidad de ID y le gana a la regla `[hidden]` del navegador.
- Los `href` pasan a relativos (`?level=...&play=1`), que es lo que hace que la URL del juego
  deje de llevar nombre de fichero.
- Comprobado en las cuatro puertas: `/` da menu (`display:flex`, `wrap` en `none`, **sin canvas y
  sin `window.Phaser`**, foco en 01 INSOMNIA), `/?level=orbit-motion` da juego con marcas y 3
  vidas, `/?level=insomnia-drop&play=1` da modo juego (marcas apagadas, **1 vida**) y
  `/?level=nope` sigue cayendo en el nivel 1. **0 errores de consola en las cuatro** (lector
  validado con un `console.error` inyectado). La D mantenida quita `&play=1` a los dos enlaces y
  vuelve a ponerlo en `keyup`, en `blur` y en `pageshow`; las flechas siguen moviendo el foco.

**El nivel no se movio: 12 diffs a 0 px** (nivel 1, t = 12 / 36.3 / 50.2 / 65 x las tres camaras,
contra `git archive HEAD`), con la prueba de vida puesta (t=12 contra t=20.5 de la misma build
difieren en **97.42%** del cuadro) y la caja del canvas identica en las dos ramas.

**Pero el primer intento dio 39-59 mil px y era mentira.** El `?cb=` va en la URL de la PAGINA y
los `import` no lo llevan, asi que reciclar un puerto donde la sesion de Chrome ya cargo otra
version sirve **los modulos viejos con el HTML nuevo**. Lo delato comparar un campo que solo
existe en una de las dos ramas (`__dbg.dead`: 0 de un lado, `undefined` del otro, con el mismo
fichero en disco), y HEAD-contra-HEAD dando 0 px con el mismo aparato. Sirviendo las dos ramas en
puertos frescos, los 12 diffs dan 0. Queda escrito en `CLAUDE.md`: **puerto nuevo por tanda**.

## La tanda del cierre (DaftRun, muerte de 0.5s con el %, GUIA.md y el tema del nivel 3)

El juego pasa a llamarse **DaftRun**: `<title>`, el `<h1>` del menu y el header del juego, del que
ademas se va el " · POC". `CLAUDE.md` cambia de titulo y nada mas: el nombre no toca ni una linea
de renderer.

**La muerte baja de 3s a 0.5s.** La mecanica es que la espera **no se pueda saltar** (es lo que
evita machacar el reintento), no cuanto dura: a 130-137bpm, 3s son 7 compases mirando una pantalla
quieta. Solo cambia la constante `DEAD_T`, o sea que las mediciones de la seccion siguen valiendo
(el `songT` congelado a 15 decimales, la cuenta con el delta real de Phaser, las dos guardas de
`SPACE` y del `pointerdown`).

**Y el cartel dice cuanto llevabas**: `round(t / duration * 100)`. Como `songT` esta congelado en
el choque, el porcentaje es el del sitio donde moriste; terminando el nivel `t` vale la duracion
entera, o sea 100%. Verificado en el navegador (`?level=orbit-motion&play=1`, `__dbg.seek(30)`,
`dead=0.5`, `lives=0`): el texto sale **`MUERTO  41%`** con 30.0 de 72.31s = 41.5%.

**`GUIA.md`**: el punto de entrada para el que siga esto. Diez secciones: como correrlo, la regla
de `songT`, el mapa de ficheros, senales contra roles, el beatmapper (tap del bpm, tags, export, y
los tres tropiezos medidos: marcar a mano se adelanta 69ms con 33ms de dispersion, `trim.end`
tiene que caer en una fila entera y `ffmpeg` necesita `-vn`), agregar un nivel (los campos que
`test-music.js` exige), dictar bailando, la tabla de teclas del modo diseno, la receta de "quiero
mover este obstaculo" con el ejemplo trabajado, depurar (agent-browser y las tres trampas de falso
positivo) y el estado del nivel 3.

**El tema del nivel 3 va marcado y recortado, sin enchufar.** `assets/breathe.schema.json` +
`assets/breathe-cut.mp3`: 155bpm, offset 0.256, `trim` 136.5126 -> **247.6094**, o sea **287 filas
de 0.387097s = 111.0968s** (el corte se llevo a fila entera), **232 eventos y 0 pasados del
corte**, 6 secciones y 4 tags (`vocal melody` 106, `melody drop` 83, `outropads` 23, `bass` 20).
No se declara en `LEVELS` a proposito: enchufarlo pide velocidad medida, `map`, `glow`, `sectors`,
`modes`, `wave` y guion, y el `test-music.js` de este proyecto tiene asserts por nivel. Lo que se
entrega es el material y la receta (`GUIA.md`, seccion 10), incluida la cuenta que hay que hacer
primero: a 155bpm la ventana de carril del nivel 1 pediria `v = 103 / (0.387097 - 0.36437)` =
**4532**, o sea que no se reproduce subiendo velocidad y hay que medir otra cosa.

**Las fechas del historial se reescribieron** (`git filter-branch --env-filter`): los 29 commits
anteriores repartidos entre el viernes 23:00 y el sabado 10:00. Se hizo sin remoto configurado. El
`$(pwd)` del filtro **no es la raiz del repo** (filter-branch corre dentro de `.git-rewrite/t/`):
el mapa de fechas hay que cargarlo por ruta absoluta o el primer commit falla.

## Tanda movil: swipe y el audio en MP3 (2/08)

Tres cosas pedidas: swipe en Android, el "Decoding failed" de iOS y un servidor en la LAN para
probar desde el telefono (`http://192.168.1.5:8123/`, que es el mismo `python3 -m http.server`,
que ya escucha en 0.0.0.0).

**El swipe** va por los `pointer*` que Phaser ya recibe, con umbral de 24px de pantalla y un gesto
= una accion, mas `touchHold` para los orbs. Verificado con toques de verdad por CDP
(`Emulation.setTouchEmulationEnabled` + `Page.reload`, que hace falta: Phaser decide si hay touch
al arrancar). Los 24px NO estan medidos en un telefono de verdad.

**El "Decoding failed" no era el gesto.** Se probaron tres vias de `decodeAudioData` y las tres
fallan en iOS con gesto y sin el, mientras que Safari de escritorio decodifica el m4a suspendido
por las tres. Sondeando el telefono del usuario (`probe.html` reportando cada linea por
`fetch("/PROBE?...")` y leyendo el log de acceso del servidor, o sea sin capturas ni permisos):
wav OK, mp3 OK, m4a FALLA, m4a-ALAC FALLA, y el mismo m4a suena por un `<audio>`. Es el
CONTENEDOR mp4, no el codec ni el estado del contexto.

Los tres cortes pasan a mp3 192k y **el desfase medido es 0 muestras** (r = 0.9968 y 0.9951,
correlacionando 2s desde el segundo 5, dentro del navegador y no solo con ffmpeg), que era lo
unico que podia romper: el mundo esta clavado a la grilla. Los `.m4a` se borran; queda un solo
formato. `transport.js` vuelve a un `decodeAudioData` pelado.
