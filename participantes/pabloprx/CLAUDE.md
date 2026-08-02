# DaftRun - reglas del proyecto

## Stack
- Phaser via CDN como modulo ES. **Sin npm, sin node_modules, sin bundler.**
  El build de CDN no tiene default export: `import * as Phaser from "...phaser.esm.js"`.
  Al portar a `gamejam-2026/participantes/ejemplos` cambiar a `import Phaser from "phaser"`.
- Se sirve con `python3 -m http.server 8123` desde la raiz.
- `index.html` es lo unico: **sin `?level=` es el menu** (HTML plano, sin Phaser, sin cargar
  una sola linea del juego) y **con `?level=` es el juego**, que **arranca en modo diseno**:
  el modo juego lo pide `?play=1` (ver abajo).
- El juego expone `createAIRunnerGame(parent)` para encajar en el registry del repo base.
- Los tests son ficheros `node test*.js` con `assert`. Sin frameworks.

## Hay mas de un nivel, y cual se carga lo dice la URL
`?level=orbit-motion` sobre la misma pagina; `?level=insomnia-drop` es el nivel 1. **Sin
parametro ya no arranca ningun nivel: es el menu** (ver abajo), asi que la receta de medicion
del nivel 1 abre `/?level=insomnia-drop` y no `/`.

El respaldo de dentro del juego sigue entero y no es cosmetico: un nombre que no esta en `LEVELS` caia en
`LEVELS[undefined]` y reventaba dentro de `loadLevel` (leer `.schema` de `undefined`), o sea
pantalla negra. Por eso `const LEVEL = LEVELS[LEVEL_Q] ? LEVEL_Q : "insomnia-drop"`.

Todo lo que separa un nivel de otro se declara en `LEVELS` y nada en el renderer: ademas de lo
que ya habia (`speed`, `layers`, `glow`, `enter`, `sectors`, `zones`, `script`) ahora van
**`lanes`** (cuantos carriles), **`decor`** (que capas de fondo se encienden), **`neon`** (la
paleta), **`mesh`** (los dos colores de la malla), **`sky`** (el resplandor del horizonte) y
**`metro`** (el metronomo de la grilla). El renderer lee, no elige.

**EL INVARIANTE DE 0 PX PROTEGE AL NIVEL 2 Y AL NIVEL 1 CON LOS DIALES APAGADOS, no al nivel 1
tal cual.** Hasta la tanda del suelo outrun aca decia "el nivel 1 no se mueve un pixel"; **eso ya
no es cierto y es a pedido explicito del usuario**: el nivel 1 enciende `mesh` en su `decor`, lo
pinta de oro (`mesh: { lo, hi }`) y declara dos tramos de `neg`, o sea que **cambia de imagen a
proposito**. Lo que sigue midiendose igual, sirviendo `git archive HEAD` en otro puerto, abriendo
los dos en la misma sesion de Chrome, pausando en el mismo `songT` y restando los dos PNG:

- **el nivel 2 contra HEAD**: 12 diffs (t = 9 / 28.6 / 35.5 / 57.5 x las tres camaras) a **0 px
  distintos y max delta 0**;
- **el nivel 1 con los diales apagados**: sacando `"mesh"` de su `decor` y dejandole `fx: []`, en
  t = 12 / 36.3 / 50.2 / 65 (los cuatro fuera de los dos tramos de `neg`) x las tres camaras,
  otros 12 diffs a **0 px y max delta 0**.

Esa segunda medida es la que sigue afirmando lo de siempre: que cada dial nuevo trae su respaldo
puesto en lo que el renderer hacia antes de existir el dial (ver `decor`, `neon` y `mesh`), o sea
que **el diff entero es dial y no renderer**. Y lo que el nivel 1 SI movio esta medido y cae donde
tiene que caer: contra HEAD, camara de atras, **12.31% a 12.63% del cuadro** en t = 12 / 20.5 /
36.3 / 65 / 95.2 con **todo el cambio por debajo de y~350**, que es el plano del suelo (max delta
34 a 88), y **99.42% / 99.43% con la pantalla entera invertida** en t = 24.93 (f54) y t = 97.0
(f210), o sea dentro de los dos tramos de `neg`.

**El `?cb=` de la pagina NO busta los modulos, y eso ya dio un falso positivo.** Los `import` de
`AIRunnerGame.js` y de los otros 9 ficheros van sin cache buster, asi que reusar un PUERTO donde
la sesion de Chrome ya cargo otra version sirve los modulos VIEJOS con el HTML nuevo. Medido: el
diff del doblado de `index.html` salio a **39-59 mil px** en las tres camaras con el HEAD servido
en un puerto reciclado, y a **0 px en los 12** sirviendo las dos ramas en puertos frescos. La
delata en un segundo comparar un campo que solo existe en una de las dos ramas (`__dbg.dead` daba
0 de un lado y `undefined` del otro con el mismo fichero en disco). Regla: **puerto nuevo por
tanda de medicion**, y el HEAD vs HEAD (que tiene que dar 0 px) es la otra mitad de la prueba de
vida.

El nivel 2 es **`orbit-motion`**: 137bpm (beat 0.43796s), **165 filas f0-f164 = 72.31s**, cuatro
secciones (buildup / break / drop2 / outro), 10 sectores de suelo, `speed` 1400, **4 carriles**,
`decor` = `mesh`, `reactor`, `rings`, `hat`, `gate`, `arcs`, `burst`, `rave`, `shapes`, `rig`,
`lights` (mas el dial `rigOver`; `beam`, `dark`, `snap`, `ghost`, `spin`, `jolt`, `neg` y `grid`
son tramos `fx`) y **485 obstaculos** dictados bailando con `Y`/`U` (ver abajo).
`test-music.js` afirma la grilla, que las secciones sean contiguas y no
anidadas, que los sectores cubran f0-f164 sin agujeros y que el `decor` exista.

**Que hace cada senal se sigue eligiendo por nivel** (`map`), y en el 2 se eligio contando
eventos, no de oido: `bass` es el pulso (32 golpes, 31 de ellos en el buildup, y 23 de sus 31
huecos miden exactamente 2.00 beats, o sea un metronomo a la blanca) y va de `bg`; `acid` es la
linea y es **lo unico que suena en el drop2** (28 de 28), asi que va de `mark`; `response1`,
`response2` y `snare` son **rafagas** (3 golpes en la f10 y 2 en la f11 y despues **71.32 beats
sin nada**; 3 en la f19 y despues 55.38; 5 entre la f32 y la f34 y despues 32.32), o sea que de
marca dejarian el nivel a oscuras compases enteros: van de `fx`, que barre y deja la linea
numerada para dictar. Con el guion puesto son **604 cues: 32 bg, 60 mark, 24 fx, 3 orb y 485
obstaculos** (170 `block`, 288 `gap`, 15 `low`, 12 `high`).

**Lo que cuesta el nivel 2**, medido con una sola sesion de Chrome y
la cancion entera: `draw()` del nivel 2 da **media 0.729ms, p50 0.7, p95 1.5, p99 1.9, max 14.5
sobre 8345 muestras y 0 frames por encima de 16.7ms**, contra **0.492 / 0.4 / 1.0 / 1.7 sobre
11137** del nivel 1 de antes del suelo outrun, o sea que la malla y el reactor cuestan **+0.24ms
de media** de un presupuesto de 16.7. (El nivel 1 con su malla encendida se midio aparte: **+0.20ms
de media y 0 frames por encima de 16.7 sobre 867 muestras**, ver el suelo outrun.) Y es determinista de verdad y no solo estable dentro de una sesion:
recargando la pagina entera y volviendo al mismo `songT`, el PNG sale a **0 px** en el drop2 y
en el buildup. Consola: **0 errores y 0 page errors** en `/`, `/?level=orbit-motion` y
`/?level=nope` (el lector se valido antes con un warning y dos throws deliberados, o sea que la
lista vacia es una lista vacia y no un lector roto).

## Cuantos carriles los dice el NIVEL; el paso, no
`lanes` en `LEVELS` -> `lanesX(n)` en `physics.js`: `(i - (n-1)/2) * 170`. El paso es **170
siempre** y con mas carriles **la pista se ENSANCHA**, no se aprieta:

    lanesX(3) = [-170, 0, 170]          pista 510   (el nivel 1, identico a lo de siempre)
    lanesX(4) = [-255, -85, 85, 255]    pista 680

No es estetica: un `high` mide `w=70`, o sea **140 de ancho**, asi que meter 4 carriles en el
ancho viejo (paso 113) los solaparia en pantalla y no se sabria a que carril pertenece cada
caja. Medido con paso 170: el borde de una caja de 140 queda a **15** del borde de la de al
lado. `test-music.js` falla si el paso baja de `KINDS.high.w * 2`.

**La colision es por INDICE de carril, no por pixel** (`hits()` compara `lane`), asi que sumar
un carril **no cambia ni una ventana de tiempo**: el hueco libre de un carril sigue siendo
`beat - (d + PLAYER_D)/v` y ahi no aparece N por ningun lado. Lo unico que cambia es que hay una
salida mas. Lo que si se midio para el nivel 2 es la VELOCIDAD, porque su beat es mas corto:
137bpm son 0.43796s de fila contra los 0.46154s del nivel 1, o sea **23.6ms menos**. Para dejar
la misma ventana de carril hace falta `v = 103 / (0.43796 - 0.36437)` = 1400, y medido a 1400 la
ventana de carril da **364.4ms** (la del nivel 1 a 1060, con 0.02ms de diferencia), la caja te
tapa **73.6ms** (contra 97.2) y el hueco **112.9ms** (contra 149.1). El viaje si se acorta,
7.07 -> **5.35 beats**, o sea menos que los 7 de `ENTER_BEATS`: la entrada va topada por
`enterDz` como en el nivel 1 (medido: termina a 1349 del jugador, 2.20 beats antes del impacto).

Todo lo que se ensancha cuelga de **un solo numero**, `edge = -laneX[0] + 85` (medio paso por
fuera del carril de afuera; medido: **255** con 3 carriles y **340** con 4). De ahi salen las
bandas del suelo (`edge+35`), los numeros de fila (`edge+27`), el barrido del rave y las lineas
numeradas (`edge+45`), el porton del flip (`edge+65`) y los pins (`edge+175`), y los divisores
de carril son `lanesX(N+1)`, o sea los BORDES: 4 lineas con 3 carriles (los `[-255,-85,85,255]`
de siempre) y 5 con 4 carriles, con la del medio apareciendo sola. Con N=3 las seis cuentas dan
exactamente los numeros que estaban escritos a mano (290, -282, 300, 320, 430), que es lo que
deja el nivel 1 en 0 px.

`tileOf` / `rowOfTile` / `laneOfTile` llevan N (`tile = fila * N + carril`), con default 3 para
que la numeracion del nivel 1 no se mueva. Y el zigzag por defecto de `defaults()` pasa de
`(i*2)%3` a `(i*(N-1))%N`: con 3 da los mismos 0,2,1 y con 4 da 0,3,2,1. `(i*2)%4` da 0,2,0,2,
o sea la mitad de la pista muerta.

## El fondo lo declara el nivel (`decor`)
`decor` es la lista de capas encendidas y el renderer pregunta `this.dec("rig")`. No es una
feature nueva: es la lista de lo que el `draw()` YA dibujaba, sacada tal cual, para que un nivel
pueda apagarla. El nivel 1 declaraba las ocho que tenia (`rig`, `pins`, `gates`, `shapes`,
`rave`, `bars`, `flash`, `ghost`); ahora son **nueve**, porque se le agrego **`mesh`** para el
suelo outrun (ver abajo). Esa novena no es "una capa que ya dibujaba y se saco tal cual" como las
ocho: es la capa del nivel 2 ENCENDIDA en el 1, o sea la unica entrada de `decor` que cambia la
imagen de un nivel a proposito, y por eso el respaldo se comprueba al reves (sacando la palabra el
nivel 1 vuelve a HEAD a 0 px, medido). Su `draw()` ya preguntaba `if (this.dec("mesh"))
this.drawMesh();`, o sea que encenderla es una palabra en la lista y ni una linea de renderer.

**La lista blanca sale del renderer, no se escribe a mano**: `test-music.js` lee
`AIRunnerGame.js` y saca los nombres de los `dec("...")` que hay en el codigo, asi que un nivel
no puede pedir una capa que nadie dibuja ni aunque se agregue una capa nueva y se olvide el test.

**El fallback tiene que ser `false`, no `true`.** `draw()` corre antes de que `boot()` resuelva
`this.lv`, o sea que los primeros frames no tienen nivel: con `true` el nivel 1 dibujaba la
malla y el reactor del nivel 2 durante esos frames. El respaldo seguro de "que capas enciende
este nivel" es ninguna.

Dos capas que se creian globales y resultaron ser del nivel 1:

- **`flash`** (el apagon del break y los blinders): el nivel 2 los heredaba sin pedirlos, o sea
  2.47s de negro absoluto en su break y un estrobo **violeta**, que encima no es su paleta. Su
  break es lo que prepara SU drop, no todos los breaks del mundo.
- **`ghost`** (el fantasma y la constelacion): `GHOST_ROW` = 63 es una fila del nivel 1 y su
  ventana de marcas esta medida sobre SUS marcas. En el nivel 2 la marca es la linea del acid,
  que esta abierta el **40% del buildup y el 69% del drop2**: el nivel se pasaba mas de media
  cancion en blanco y negro y su paleta cyan no se veia nunca. `P` lo sigue forzando a mano en
  cualquier nivel: es una herramienta, no una capa del nivel.

Lo que NO va por `decor` es el golpe blanco de cada kick del drop: eso es de todos los niveles.
Lo que si estaba mal ahi era el nombre de la seccion (`sec === "drop"`, y la del nivel 2 se
llama `drop2`, o sea que su drop se quedaba sin respuesta de pantalla): ahora `startsWith`.

## La paleta la declara el nivel (`neon`, `sky`); el `KILL` no
`neon: { fam, sec, def }`. `fam` son los cuatro colores de los que sacan color los divisores de
carril, los pins, las formas, los portones, el `eq` en modo `color` y el traje del muneco; `sec`
es el color del marco y de las bandas del suelo **por seccion**, con `def` de respaldo. El nivel
1 declara exactamente lo que estaba hardcodeado en el renderer (violet / accentSoft / accent /
7c3aed, y drop rosa / break accentSoft / resto violeta), o sea 0 px de diferencia; el nivel 2 va
a la familia cyan-verde de sus referencias (`00d8ff`, `5fe8ff`, `a8ffff`, `3ef2b5`), que es de
donde salen tambien la malla y el reactor. Antes pintaba su marco y su suelo de violeta, que no
tiene nada que ver con su fondo.

**`KILL` no entra ahi y no puede**: es lo unico que mata y por eso es lo unico caliente, en
todos los niveles. Un nivel que pudiera elegir el color de lo que mata podria elegir el de su
propio decorado, que es justo la regla que se escribio arriba.

**Y la paleta DERIVA de tono** (`hue: { beats, hold, deg }` -> `hueAt` + `rotHue`). Se pidio "una
deriva de tono, no un cambio directo a rosa": el nivel 2 se queda `hold` = **4 beats** en su
color y despues gira hasta `deg` = **70 grados** y vuelve, un ciclo cada `beats` = **16** (4
compases). Medido beat a beat: **0 0 0 0 18.1 35.0 49.5 60.6 67.6 70.0 67.6 60.6 49.5 35.0 18.1**,
y el cyan del nivel va `00d8ff` -> `90adff` -> `b2a3ff` -> **`bea0ff`** (el neon purple) y vuelve.

Se aplica en la UNICA puerta por la que pasa el dibujo entero, la misma que el blanco y negro
(`fantasma`, los `fillStyle`/`lineStyle` envueltos una vez en `create()`), o sea que ninguna de
las 20 funciones de dibujo se entera y no hay un solo `if (hue)` desperdigado. El resultado va
**memoizado por color**, con el memo vaciandose cuando cambian los grados: son ~50 colores
distintos por frame contra 13803 llamadas al Graphics.

- **`KILL` esta exento**, por lo de arriba: lo que mata no puede cambiar de color.
- **Los grises tambien** (`rotHue` los devuelve tal cual): si no, el metal del reactor y el
  contorno negro del muneco se pintarian de color en cada deriva.
- **Y la LUMA se conserva.** HSL conserva la L, que no es la luminosidad que se ve: el verde y el
  azul pesan 0.7152 y 0.0722, o sea que girar el cyan 30 grados dejaba la misma L y la luma se
  caia de **172.9 a 81.3**, que no es una deriva de tono sino un fundido a oscuras, y ademas
  TODAS las mediciones de contraste del proyecto (malla contra suelo, rig contra banda de juego,
  reactor contra cielo) estan hechas en luma. Se le devuelve **mezclando hacia el blanco o hacia
  el negro**, que es exacto porque la luma es lineal en esa mezcla; escalar los tres canales no
  sirve porque el cyan ya tiene un canal en 255 y no hay hacia donde subir (medido, escalando el
  peor desvio EMPEORA a 152.3). Medido sobre 12 colores del nivel y 360 grados: **el peor desvio
  es 0.48 de luma sobre 255**, y `test-music.js` falla por encima de 1. El precio es que un tono
  oscuro a la luma del cyan sale palido, que es exactamente lo que es un neon claro.

**`sky: { col, a, up, down, mode }`** es el resplandor que SALE del horizonte hacia los dos lados
(`drawSky`), y ademas es lo que enciende la cuna de `drawFar`. El nivel 1 no lo declara, o sea
que ahi no se dibuja ni un pixel. Existe porque el cielo del nivel 2 es negro casi puro
(`bg` = `#03060a`) y medido daba **luma 7.4 de media y 5.9 pegado al horizonte**: el reactor no
tenia nada contra que estar y se leia como un logo pegado en el vacio. Con el resplandor pasa a
**14.6 de media y 28.8** pegado al horizonte, y el nucleo del reactor sigue clavado en **229.4**,
o sea que sigue siendo el pico del cielo (lo mas brillante fuera del reactor es el HUD, 146.7).
`up`/`down` son fraccion del alto de pantalla y `up` es el triple: arriba es cielo y abajo esta
la pista, que tiene que seguir ganandole al fondo. El alpha va **al cuadrado** (lineal deja una
franja de color plano que se lee como una banda, no como aire) y las franjas de ~8px se tocan
exactamente: con `+1` de solape cada junta suma dos alphas y salen 24 rayas horizontales
cruzando el cielo, que es lo que se venia a arreglar.

**`mode` es CUATRO variantes por seccion**, y ninguna agrega geometria: son la misma franja con
el alto, el alpha, la curva o el reparto en columnas movidos, o sea el mismo numero de
`fillRect` (salvo `drift`, que parte 8 franjas en 16 columnas). Se pidieron porque el degradado
"es demasiado simple" y hace falta algo que se mueva con la musica **sin robar la atencion**.
**Nada de FFT**: el analizador es lo unico del render que no es funcion de `songT` (en pausa da
ceros), y un fondo a pantalla completa que cambia al pausar rompe el rebobinado a 0 px. Manda
`lat`, el metronomo, que esta vivo el 100% del nivel. Y el numero de franjas sale del alto SIN
modular: si cambiara con el latido, el redondeo haria parpadear las juntas.

    swell (buildup)  el exponente de la caida respira con el latido    x1.27 (0.88..1.12)
    shut  (break)    se cierra hasta CERO a lo largo de la seccion     x216  (1.000..0.005)
    duck  (drop2)    se AGACHA en cada kick de la grilla (`kik²`)      x6.15 (0.163..1.000)
    drift (outro)    columnas con una onda, una vuelta por compas      x4.3 entre columnas

Medido **aislando la capa** (mismo frame con y sin `drawSky`, restando los dos PNG), cobertura
del cuadro y luma: buildup **15.17% / 8.6**, break **0.00% / 0** (cerrado del todo, y ademas cae
dentro del apagon), drop2 **13.74% / 52.7**, outro **5.44% / 6.1**. `drift` parte SOLO las 8
franjas pegadas al horizonte: mas arriba el alpha ya cayo (a la 8a de 20 vale 0.36 del tope) y
partirlas seria coste sin imagen; y son **16 columnas** porque con 8 cada una mide 84px de un
cuadro de 1248 y la onda se lee como bloques, y con 32 el ancho de columna (42px) baja del de la
ola de la malla y compiten.

**Y el horizonte deja de ser un canto** (`drawFar`): la pista se dibuja hasta `SPAWN_Z` y ahi
cortaba. Medido a h=651, `SPAWN_Z` proyecta **58.1px por debajo del horizonte**, o sea que el
fondo de la carretera flotaba con 58px de negro entre el y el punto de fuga: se veia el fin del
mundo. `drawFar` repite la misma banda hacia el punto de fuga, cada tramo **1.9 veces mas lejos**
que el anterior (o sea la mitad de alto en pantalla: 27.5px el primero, 14.5 el segundo, y con 7
se llega a 0.6px) y con el alpha cayendo `0.68^i`, que es niebla y no una rampa pintada. Medido
en la franja central: la primera fila encendida pasa de **y=290 a y=234, o sea al horizonte
mismo**. **No alarga la pista en el MUNDO**: `SPAWN_Z` no se toca, que de el salen el viaje del
obstaculo y `enterDz`. De perfil no se dibuja: ahi la x del mundo no proyecta y no hay punto de
fuga que rellenar.

**Y la cuna se DISUELVE, no es una punta pintada.** Se reporto que "el final de la pista siempre
se ve asi": salia al **0.8** del alpha de una banda, o sea maciza, y ademas mas plana que la
pista de aca (las bandas de cerca alternan medio beat encendido y medio apagado; la cuna no
alterna nada). A **0.42** y medido en su banda: luma media **43.89 -> 38.66** y p95 **64 -> 59**,
con la banda de pista de justo debajo clavada en 62.39 / 133, o sea que la cuna pasa de **0.70 a
0.62** de la luma de la pista de verdad y deja de competir con ella. Se probo ademas llevarle el
color al del cielo tramo a tramo: **38.66 -> 38.58**, o sea nada, y se saco.

## Musica
- El schema maestro (`assets/*.schema.json`) exporta **senales**, no niveles:
  canales (`kick`, `accent`, `voice`) con `t`, `v` (intensidad 0-1) y `dur` opcional.
- **Que hace cada senal se hardcodea por nivel en `music.js` (LEVELS).**
  Nada de sistema "construi tus guidelines -> cargalo como nivel": eso es semanas y esto es una jam.
  Mitad y mitad: la senal la da el schema, el rol lo elige el codigo del nivel.
- El BPM se marca a mano (tap) en el beatmapper. `tools/analyze.py` solo se usa para
  cuadrar la grilla y los patrones contra el audio real, nunca para inventar la estructura.
- Los tiempos del schema son **absolutos del track original**; `music.js` les resta `trim.start`.

## Alargar el nivel: se APENDA al schema, no se rehace
Como los tiempos son absolutos y `cues()` numera **despues** de ordenar por `t`, agregar
eventos al final no mueve ni un `#n` de los que ya estan, o sea que el guion escrito a mano
sigue apuntando a lo mismo. La receta (hecha una vez, el 30/07, f128 -> f219):

1. En el beatmapper se marca **solo el tramo nuevo** (arrancar donde termina el corte viejo) y
   se exporta. Lo unico intocable del schema viejo es `trim.start`, el `bpm` y el `offset`:
   la grilla tiene que seguir siendo la misma o se renumeran todas las filas.
2. Se **mide el desfasaje** de las marcas nuevas contra esa grilla (media circular de la
   fraccion de beat) y se corrige de una: medido, marcar a mano se adelanta **69ms** con una
   dispersion de 33ms, o sea que es un sesgo constante y no ruido. Corregido, se cuantiza cada
   tag a **su** subdivision (kicks / response / snare a la negra, acidbass a la semicorchea:
   medido, deja restos de 22-25ms contra los 72-144ms de cuantizar todo a la negra).
3. `trim.end` se lleva a una **fila entera** (`trim.start + filas*beat`): el corte viejo caia
   exacto en la f128 y el nuevo en la f220. El audio se re-corta con `ffmpeg -ss/-t` en el
   mismo sitio (`-vn`: el m4a trae caratula y sin eso no escribe nada).
4. Las secciones nuevas se pegan a la anterior (contiguas, sin hueco: el test lo exige) y se
   les da `glow`, `enter`, `sectors` y un `mode` de eq por sector.
5. Los eventos marcados **pasados del corte** se tiran (fueron 85 kicks) y se dice cuantos.

**Los obstaculos viejos no se tocan**: no salen de las senales, salen del `script`. Una tanda
nueva de senales solo trae luz (`bg`/`mark`/`fx`); los obstaculos del tramo nuevo se dictan
despues, bailando (ver `Y`/`U` mas abajo).

## El mundo es funcion del tiempo de la cancion
Regla dura: nada de estado acumulado en el runner. La posicion de todo sale de `songT`
(`transport.js` -> `pos()`, anclado a `AudioContext.currentTime`). Por eso pausa, camara lenta
y **rebobinado** salen gratis. Nada de `Math.random()` ni `Date.now()` en el nivel: si el mundo
no es determinista, rebobinar da otro nivel y no se puede disenar.

La regla es del MUNDO, no de la corrida: `invuln`, `dash` y la cuenta atras de la muerte
(`dead`, ver el modo juego abajo) son estado del jugador y van con el delta real de Phaser. La
prueba de que eso no se cuela en el mundo es que el mundo dibujado sale identico pixel a pixel en
los dos modos (medido: 0 px).

- `zOf(cue, t, speed)`: el **centro** del obstaculo pisa al jugador exactamente en `cue.t`.
  Por eso aparece `leadOf(speed)` segundos antes y hace el viaje. Cambiar la velocidad
  cambia el viaje, nunca la hora de llegada.
- La velocidad `V` es solo feel: no desincroniza nada.

## Modo diseno (asi se dictan los niveles)
Cada senal se dibuja como una linea numerada sobre la pista: eso es lo que se referencia
("la #34 al fondo", "de la #12 a la #40 todo cajas"). Se traduce a `LEVELS[...].script`
en `music.js` y a ningun otro lado. El `#n` es estable: apagar una cue no renumera el resto.

**Todo esto es el modo diseno, o sea `index.html` SIN `?play`**: las teclas de abajo (menos
`SPACE`) se atan dentro de un `if (!PLAY)` y jugando no existen. La lista se muestra en pantalla
(`this.hint`), asi que jugando tampoco se ve.

Teclas: `SPACE` play/pausa · `1-5` x1/.5/.25/.1/.05 (jugador **y** musica) · `,`/`.` ∓compas
(`shift` = beat) · `L` loop de 8 compases · `G` ir a #cue (o `f78` = fila) · `HOME` inicio ·
`M` marcas · `T` numeros de fila/tile (al lado del `f<n>` va lo que pide cada carril:
`#` caja, `_` hueco, `^` saltar, `v` agachar, `o` orb, `O` jump orb, `x` carril muerto) ·
`J` capas de fondo (todas / solo base / solo detalle) · `P` fantasma (blanco y negro, solo lineas) ·
`C` camara (atras / lado / 1a persona) · `H` invertir gravedad (a mano, para probar) ·
`Y` grabar gameplay (desde donde estas hasta el final) · `U` exportar lo grabado como guion ·
`K` inmune · `X` mute · `V` feel · `-`/`+` sync fino (outputLatency no siempre acierta).
**Clic en la tira de abajo** = ir al arranque de ese sector (`shift` = al compas).

## El menu VIVE EN `index.html`, y el flag lo lleva JUGAR (`?play=1`), no depurar
Se pidio una pagina de inicio con la lista de niveles, que entrando por ahi se escondan las
marcas y los controles, y que el debug entre "from the same view but holding the D".

**Un solo fichero y una sola rama: sin `?level=` el menu, con `?level=` el juego.** Nacio como
`menu.html` aparte y se doblo a pedido ("we just do index.html and it gets sovled"), porque un
segundo fichero deja la URL del juego con nombre de fichero y un redirector deja `/` sin arrancar
igual, mas un salto. Los dos bloques van `hidden` en el HTML y el script destapa uno: el import
del juego es **dinamico** (`await import`), o sea que **el menu no descarga ni Phaser ni una
linea del renderer**.

**Lo que eso rompia y hay que tener puesto**: la receta de medicion del proyecto abria `/`
esperando el nivel 1 en modo diseno y restaba PNGs contra `git archive` servido en otro puerto.
Con el menu ahi esos diffs compararian dos menus identicos y darian **0 px igual**, o sea un
fallo silencioso que siempre pasa. Por eso **la receta del nivel 1 abre `/?level=insomnia-drop`**
y la prueba de vida (dos `songT` distintos tienen que diferir en >90% del cuadro) deja de ser
opcional: es lo unico que separa "no se movio" de "no se dibujo".

**`[hidden] { display: none !important }` es obligatorio y no es paranoia**: `#menu { display:
flex }` es especificidad de ID y le gana a la regla `[hidden] { display: none }` del navegador,
o sea que sin esa linea el menu se dibujaria encima del juego siempre.

**El flag lo lleva jugar y no depurar**: `PLAY = ...has("play")`, o sea que la AUSENCIA del
parametro ya es el modo diseno de siempre y "mantener D" no necesita inventar un `?debug=1`. El
menu lo hace quitandole `&play=1` al `href` en el `keydown` de la D, y no interceptando el clic:
asi el clic, el ENTER del teclado y el clic del medio salen todos por el camino nativo del `<a>`
y no hay un segundo handler que mantener sincronizado. **Se suelta en `blur` y se rearma en
`pageshow`** porque el `keyup` no siempre llega: navegando con la tecla apretada la pagina se
guarda en bfcache con los `href` ya sin flag, y al volver con Atras un clic normal abria en
diseno (medido antes del arreglo: los dos `href` sin `&play=1`, `marks` true, `godmode` true, 3
vidas, y nada en pantalla que lo dijera). Alt+tab con la D abajo era la misma fuga.

`PLAY` es presencia y no valor, o sea que **`?play=0` tambien enciende el modo juego**. El menu
no genera esa URL nunca; queda escrito para que no sorprenda al que la escriba a mano.

Que apaga el modo juego y nada mas que eso: `marks` (las lineas numeradas de cue y la tira de
abajo), `nums` (los numeros de fila/tile), el `hint` (la lista de teclas), el `hud` y `godmode`,
o sea que chocar cuenta. Y las **20 teclas de diseno**, en un solo `if (!PLAY)`. Lo que NO se
apaga: flechas/WASD, `SPACE`, el `pointerdown` que desbloquea el audio y **`holdKeys`**, que se
declara FUERA del `if` a proposito: el dash del orb se sostiene manteniendo `↑`/`W` y sin eso no
hay orbs jugando. `stripSeek` no hace falta tocarlo, ya comprueba `this.marks` (medido: jugando
`__dbg.strip` es `undefined`, o sea que `drawStrip` no llega a correr).

**El mundo es el MISMO pixel a pixel en los dos modos**, y eso es lo que dice que el flag no toca
el renderer: apagando a mano los cuatro overlays en modo diseno y restando contra el modo juego
en el mismo `songT` da **0 px distintos y max delta 0** en el nivel 1 (t = 12 y 36.3) y en el 2
(t = 31.5 y 52.0). El diff crudo, con los overlays puestos, da **3.72%** del cuadro en el nivel 1
a t=36.3: 2717 px del HUD, 11386 px de lineas y numeros dentro de la banda del mundo y 22656 px
de la lista de teclas y la tira. Teclas atadas: **9 jugando** (LEFT/A/RIGHT/D/UP/W/DOWN/S/SPACE)
contra **33 disenando**, y las 25 de diseno pulsadas una por una jugando no cambian ni un campo
del estado. Cada nombre de tecla se valido antes en diseno, donde las 25 SI cambian algo: sin esa
validacion previa, "todas muertas" no prueba nada, prueba que los nombres no llegan a Phaser.

## Morir: una vida, congelado EN EL SITIO, medio segundo que no se puede saltar, y el %
Se pidio literal "1 life and u repeat, like u die, wait 3s on the spot, and start again so its
not like spaming retry". Las tres partes son la mecanica y ninguna es cosmetica.

**La espera bajo a `DEAD_T` = 0.5s a pedido, y la mecanica no cambia**: lo que evita machacar
el reintento es que la espera **no se pueda saltar** (las dos guardas de `SPACE` y del
`pointerdown` siguen igual), no que sea larga. A 3s el corte era de 7 compases a 130-137bpm
mirando una pantalla quieta. Lo medido abajo (la cuenta va con el delta REAL de Phaser y no con
`songT`, que esta congelado) sigue valiendo tal cual: lo unico que cambio es la constante.

**Y el cartel dice el %**: `round(t / duration * 100)` con `t` congelado en el choque, o sea el
punto de la cancion donde moriste (medido a `songT` 30.0 de 72.31 en el nivel 2: **41%**).
Terminando el nivel `t` es la duracion entera, o sea 100%. Es el mismo `this.msg` de siempre:
cero UI nueva.

- **Congelar es PAUSAR EL TRANSPORTE**, no un dial nuevo: todo lo que se dibuja es funcion de
  `songT`, asi que parar `songT` para el mundo entero en el sitio, y `draw()` se sigue llamando
  desde `update`. Medido sobre 181 frames de una muerte: `max(songT) - min(songT)` = **0.0
  exacto**.
- **La cuenta va con el delta REAL de Phaser** (`update(time, delta)`) y no puede salir de
  `songT`, que es justo lo que esta parado. Medido con `performance.now()` dentro de la pagina,
  17 ciclos: **min 3003.1ms, max 3021.1ms, media 3015.9ms** para `DEAD_T` = 3s; el sobrante es la
  cuantizacion del muestreo (rAF a 60Hz son 16.7ms y la cuenta cruza el cero a mitad de frame).
- **No se puede saltar, y esa es su razon de ser**: `SPACE` y el `pointerdown` miran `this.dead`
  antes de tocar el transporte, que si no soltaban el audio sobre el mundo congelado. Medido: 969
  frames de machaque de SPACE/ENTER/R/flechas y clics sinteticos, mas 3 pulsaciones y un clic
  REALES del driver, dejan `songT` clavado a 15 decimales en el del choque y la espera dura lo
  mismo (3.0194 / 3.0196 / 3.0199 / 3.0029 / 3.0201s). En diseno `dead` vale 0 siempre, o sea que
  las dos guardas no cambian nada. Las flechas siguen atadas y mueven `lane` durante la espera,
  pero `seek(0)` llama a `resetRun()` al terminar: medido, el respawn sale identico.
- **El cartel es `this.msg`**, el mismo texto centrado que ya decia "cargando", y por ser un texto
  de Phaser va por encima del `Graphics`: se lee dentro del apagon del break igual que las letras
  del acid (medido: indice 102 de la display list contra 75 del acid). Ahi se le superpone, pero
  **morir dentro del apagon no es alcanzable jugando**: el `dark` es f63-f67, arranca en 27.639s,
  tiene **0 obstaculos**, y el ultimo choque posible es la f62 en 27.201s, que es donde queda
  congelado `songT`.
- **Muerto se ve el muneco, y hubo que forzarlo**: `invuln` se descuenta con `dt`, o sea que con
  el mundo congelado se queda clavado en el 1.2 del golpe y `floor(1.2*12) = 14` es par SIEMPRE,
  con lo que el parpadeo de inmunidad tapaba al muneco los 3 segundos enteros (medido antes del
  arreglo: **6735 px** de diferencia, bbox de **130x199**, o sea el muneco entero). Se pidio
  esperar EN EL SITIO y sin muneco no se ve el sitio: `drawPlayer` se salta el parpadeo si
  `dead`.
- **Muerto el GATE se abre**, por lo mismo: su fase sale de `songT` y un corte que dura ~30ms se
  quedaba puesto 3 segundos. Medido en el tramo f36-f60 de `orbit-motion` (25 filas con
  obstaculo, 21898 muestras a 0.5ms) la imagen esta cortada el **18.4%** del tiempo, y ahi
  `gateAt` da **0 exacto**: congelado en t=24.60 el cuadro quedaba al **98.98% en negro** con el
  cartel como unica cosa visible, y con el gate abierto pasa a **99.77% no negro**. El apagon
  (`dark`) NO se toca: no es una fase congelada a destiempo sino un tramo de 2.47s, y ademas es
  inalcanzable.
- **Terminar el nivel reusa la misma espera**: `tick()` pausa solo al llegar al final y sin HUD ni
  `hint` no queda un solo texto que lo diga (medido: `msg` invisible y la pantalla quieta en
  `songT` 101.538 de 101.538). Con `PLAY`, quedarse sin transporte a `duration - 1e-2` pone
  `dead = DEAD_T`, y el cartel dice **FIN** o **MUERTO** segun `lives`, que morir deja en 0. Cero
  UI nueva.

Sin `PLAY` nada de esto existe: `lives` sigue siendo 3, `godmode` esta puesto y no se muere nunca.

## Camaras (`cams.js`, tecla `C`)
Cambiar de camara **no cambia el mundo**: cambia la proyeccion y nada mas. Cada camara es
`{ id, body, zn, frame(w,h), proj(x,y,z) }` con `this` = la escena; `setCam` re-ata
`this.proj`/`this.frame`, asi que todo el dibujo (que ya pasaba por `proj`) sale del sitio
nuevo sin duplicar codigo. `zn` = z minimo dibujable (en 1a persona lo de atras no se pinta)
y `body` = si se dibuja el muneco.

- **atras**: la de siempre, perspectiva desde `CAM_Y`.
- **lado**: geometry dash de verdad: ortografica **plana** (`flat: true`). z es el eje
  horizontal (entran por la derecha), y la x del mundo **no proyecta**: los tres carriles
  colapsan en la misma linea. Por eso `flat` tambien apaga los divisores de carril, hace que
  las bandas del suelo crucen la pantalla, y que `drawBox` dibuje la cara `(z, y)` en vez de
  `(x, y)`. Las capas de fondo se anclan a `bgY` (mas arriba que el suelo) o las cajas se
  pierden contra el skyline. Con gravedad invertida la camara **no gira**: el mundo cuelga.
- **1a persona**: la camara es el jugador (su carril y su altura de ojos). Agachado los ojos
  bajan a `SLIDE_H` (medido: `camY` 79.2 -> 39.6): desde dentro no hay otra forma de saber
  si estas deslizando. Misma hitbox y mismas teclas; no se dibuja el muneco ni la linea de
  impacto (esta a los pies). Tres cosas la hacen leible y las tres son solo dibujo:
  - **plano cercano a 90 y no a 40**: con 40 el factor de escala llegaba a `s = 21`
    (`fov/40`, `fov = h*1.05`) y un hueco del carril de al lado se comia un cuarto de la
    pantalla como una mancha plana. Con 90 el maximo es **s = 9.4**.
  - **`pasa(zf)`**: lo que esta a menos de **500** (0.71s a v=700, o sea ya despues de la
    ventana de reaccion) se va apagando hasta 0. La camara esta DENTRO de la pista: la caja
    del carril de al lado a tu misma altura proyecta contra el plano cercano y tapa media
    pantalla. Es geometria correcta y se lee como un bug. Lo usan `drawBox` y `drawGap`;
    en 3a persona devuelve 1 y no cambia nada.
  - **cadencia y capo**: la camara tiene dos zancadas por beat (`bobY` 4 arriba/abajo,
    `bobX` 7px de balanceo en PANTALLA, medido por `test.js`: 7px en x y 5px en y a 400 de
    los ojos), y se apagan en el aire y en dash. Sin ellas la vista va sobre rieles y no se
    percibe que corres. `drawHood()` pone la sombra y el anillo de beat **por delante** de
    la camara (a 260 de los ojos): sin muneco el campo cercano queda vacio y la vista se lee
    como una foto de la pista.

## Huecos en el suelo (`kind: "gap"`)
Un `gap` es un agujero en el suelo de UN carril, no una pared: se dibuja **en el plano del
suelo**, asi que no tapa nada de lo que viene detras. Se pasa saltandolo o yendo por otro
carril; de pie y agachado mata igual. Fisicamente es una caja DEBAJO del piso
(`{ y0: -400, y1: 1 }`), o sea que `hits()` lo resuelve sola y con gravedad invertida se
espeja como todo lo demas.

- Los 123 del nivel salen de **vaciar el interior de las paredes de 5+ cajas seguidas**. Una
  zanja de 3 filas no se cruza (salto = 454ms de aire, fila = 462ms), asi que la pared sigue
  cerrada: la dificultad no baja, solo deja de tapar la pantalla. `test.js` mide hasta
  cuantos huecos seguidos se cruzan (2) y `test-music.js` falla si queda una zanja de <3.
- Debajo de **v=460** el hueco es mas largo que el salto y no hay forma de pasarlo (medido).
  El nivel corre a 700.
- **Lleva la misma X que el `block`**, dibujada sobre las diagonales del propio agujero: el
  `gap` mata igual, asi que lleva el mismo simbolo. Sin ella habia que saber que el borde
  rojo mata, o sea que la lectura dependia del color. Debajo de 26px de diagonal no se
  dibuja, igual que los glifos de las cajas.
- **La zanja corre**: `chaseAt(fila, songT, beat)` en `music.js` enciende **un hueco cada
  medio beat** (231ms a 130bpm) y vuelve al principio cada 4 (923ms), asi que una zanja se
  lee como una luz que viene hacia vos. Es funcion pura de `(fila, songT)`: no hay estado,
  toda la pista va en la misma fase y rebobinar lo rebobina. La estela (`[1, 0.35, 0.12,
  0.12]`) es lo que le da DIRECCION: con on/off seco cada hueco parpadea por su cuenta y no
  se ve para donde corre. El chase manda sobre la X y sobre el grosor y el brillo del borde.

## El tamano de la caja es la ventana de cambio de carril
`block` = `{ y1: 150, w: 45, d: 75 }`. La `d` no es estetica: con las cajas a una por beat el
hueco libre de un carril es `beat - (d + PLAYER_D)/v`. Con `d=130` daban **217ms**, por debajo
del tiempo de reaccion: cambiar de carril rapido era imposible. Con `d=75` son **297ms**.
El alto de 200 bajo a 150 para ver la pista por encima; el salto llega a `y=111.6`, o sea que
la caja **sigue sin poder saltarse** (`test.js` lo asegura a las cinco velocidades).

El otro lado de la misma cuenta es `PLAYER_D` = **el hitbox del jugador** (el ancho no existe:
se choca por indice de carril). Bajo de 40 a **28**: medido a v=700, salto 220 -> **240ms**,
slide 380 -> **400ms**, carril 297 -> **314ms**. No abre ninguna pared: `test.js` sigue midiendo
que una zanja de 3 huecos no se cruza y que la caja no se salta.

**La velocidad del nivel es 1060** (era 700; los numeros de arriba son a 700, que es donde se
midieron). Correr mas **no afloja nada**: la fila sigue durando un beat (las filas son TIEMPO,
no distancia) y lo unico que se acorta es el rato que el obstaculo esta encima tuyo, o sea que
las ventanas se ABREN. Medido a 1060: carril 314 -> **364ms**, la caja te tapa 147 -> **97ms**,
el hueco 226 -> **149ms**. Lo que si se acorta es el VIAJE, 10.15 -> **6.70 beats**, y de ahi
sale que la entrada tenga que ir topada (ver `enterDz`). El solver de `test-music.js` resuelve
el nivel a la velocidad del nivel, o sea que si algun dia se sube tanto que deje de haber
salida, el test lo dice.

## El color dice si MATA, la FORMA y el simbolo dicen la tecla
El nivel entero es violeta: pins, portones, formas, bandas del suelo, laseres del piso y
divisores de carril salen todos de `NEON` (violet / accentSoft / accent / 7c3aed). Los
obstaculos se salen de esa familia a proposito, que es lo unico que hay que leer:

- **`KILL` = te mata**, y nada mas lleva ese color: `block` (el triangulo con X) y `gap`.
  Es `0xed4679`, o sea el rojo puro corrido un 60% hacia el rosa: sigue siendo lo unico
  caliente de la pantalla pero ya vive en la gama del nivel. El rojo `ef4444` se salia.
  Por eso el rosa se fue de `NEON`, de los portones del drop y de `drawRave`: a un paso del
  `KILL`, el decorado no puede parecerse a lo que mata.
- **accent = se pasa con una tecla**: `low` y `high` van del MISMO color. Cual de las dos
  teclas lo dice el simbolo de la cara, no el color (ver abajo).

**La pared que mata es un TRIANGULO** (`sil` en `drawBox`): base en el piso, punta arriba.
Las esquinas de arriba eran justo lo que tapaba la pista de atras, y una punta se lee como
"por aca no" mejor que un muro. **La hitbox no cambia**: sigue siendo la caja entera de
`KINDS` y se choca por indice de carril, no por pixel, asi que el carril sigue cerrado de
punta a punta (`test.js` mide igual que no se salta). En 3D la tapa plana se cambia por dos
aguas hasta la punta; de perfil (`flat`) el triangulo sale del mismo `cara` sin un `if` mas.

El hueco se leia como una baldosa cyan, o sea como decoracion: ahora es negro con dos anillos
tirados hacia el centro (eso es lo que le da fondo; sin ellos es una mancha plana) y borde
`KILL` que late. Los anillos se calculan tirando cada esquina al centro, asi que salen igual
en 3D y de perfil sin un solo `if`.

**El `high` se transparenta de cerca**: cuelga a la altura de la cabeza y encima tuyo tapaba
la pista entera. De 700z para aca el RELLENO se va a 0.2, pero el contorno y el simbolo se
quedan enteros: la silueta se sigue leyendo, la pared deja de tapar lo que viene detras.

## El simbolo dice la tecla (`GLYPH_UV`)
El color no dice que hacer: rojo, naranja y violeta son tres colores, no tres verbos. Cada caja
lleva el simbolo **dibujado en su cara**: `low` chevron **hacia afuera del piso** (saltar),
`high` chevron **hacia el piso** (deslizarse), `block` una **X** (no se pasa).

Los trazos van en el espacio `uv` de la cara (`u` = ancho, `v = 0` en el lado `y1` de la caja) y
se interpolan bilinealmente entre sus cuatro esquinas ya proyectadas. Por eso el mismo dato sirve
en 3D, de perfil y de cabeza sin un solo `if`: con `g=-1` la cara se da vuelta sola y el chevron
sigue apuntando **al mismo lado del mundo**, o sea a donde te lleva la tecla, no a donde apunta la
pantalla. Debajo de 26px de diagonal no se dibuja: de lejos es una mancha.

Los chevrones son **dobles** y van de `u` 0.3 a 0.7 (antes uno solo de 0.38 a 0.62): con el
halo de la caja latiendo, un chevron chico se perdia. El trazo es `d*0.09` de grueso (era
0.07) y su alpha sube con el beat. La **X del `block` vive en la mitad de abajo** (`v` 0.55 a
0.94) porque ahi la cara es un triangulo y arriba no hay ancho donde dibujarla.

## Rave: cuanta luz hay lo decide la SECCION
`loadLevel` devuelve `sections` (`{label, start, end}`, ya con `trim.start` restado) y
`sectionAt(t, secs)` dice en cual estas. De ahi sale `this.rave`, que es el unico dial de las
tres capas de luz (`drawRig`, `drawPins`, la banda del compas):

- **drop**: clavado en 0.62 y late con el kick. Medido: encendido el **100%** del tramo.
- **buildup**: solo las **MARCAS** (`accent`/`voice`, rol `mark`, NO el kick), con cola de
  0.3s. Medido: encendido el **25%** del tramo, mediana 0. Por eso el drop se siente.
- **break**: **0**. Las luces se apagan enteras (`drawRig` y `drawPins` cortan de una).

`pulseAt(t, cues, tau, role)` es la envolvente: `role="bg"` es el kick, `role="mark"` las
senales de audio. Lo mide `test-music.js` (secciones contiguas, arrancan en 0, terminan en
el drop).

## Que late con que tambien lo decide la SECCION (`glow` en `LEVELS`)
Dos latidos distintos, no uno:

- **`this.pulse`** = el kick, siempre. Es el **decorado**: `drawRig`, `drawPins`, las barras
  del fondo. Late aunque el bajo todavia no sea el protagonista.
- **`this.beat`** = lo que se **juega**: cajas, banda del 1 de compas, portones, formas,
  anillo del jugador. Sale de `LEVELS[...].glow`, que dice **por seccion** con que rol late:

      glow: { buildup: "mark", break: "bg", drop: "bg" }

  `"mark"` = accent/voice (los agudos), `"bg"` = el kick (el bajo). Antes del drop la pista
  va con los agudos, o sea que **el bajo no aparece hasta que entra de verdad**; en el drop
  todo pasa al kick. Medido: en un mark del buildup (t=22.31) `beat`=0.86 y `pulse`=0.09;
  entre marks (t=24.09) `beat`=0.00 y `pulse`=0.13, o sea que el kick sigue sonando y las
  cajas no lo siguen.
  El break va con `"bg"` porque no tiene marcas (medido: 1 kick y 0 accent en sus 1.85s),
  asi que ahi casi nada late, que es justo lo que se quiere.

`test-music.js` falla si una seccion no tiene `glow` o si su rol no tiene ni una cue en el
tramo (o sea: nada que late con algo que no suena).

## Como ENTRA el obstaculo tambien lo decide la SECCION (`enter` en `LEVELS`)
`enter: { buildup: "side", break: "wide", drop: "slam" }`:

- **`side`**: sale de **1500 en x** (o sea 7 veces mas afuera que el carril de afuera, que
  esta en 170) y se **desliza** hasta el suyo. El lado sale de `hash(fila)`, nunca de
  `Math.random()`: rebobinar la trae del mismo lado. Va en el MUNDO y no en pantalla (al
  reves que `roll`), asi la caja llega con la perspectiva de su carril y no aterriza corrida.
  Medido: arranca a **398px** de su carril (pantalla de 2528) y a mitad de viaje (z=3000)
  todavia se corre **165px** con la caja midiendo 53px de alto, o sea tres veces su propio
  tamano. En la camara de perfil la x no proyecta: ahi es solo el alpha.
- **`slam`**: cae de **2600** de altura y se clava. Con 900 el viaje entraba dentro de la
  propia caja y se leia como un temblor, no como una caida.
- **`roll`**: entra girada 135 grados y se endereza **sobre su base**. El giro va en espacio
  de PANTALLA y no en el mundo (rotar una caja en 3D es reproyectarla entera; girar sus
  esquinas ya proyectadas son dos senos) y el pivote es la base, asi que nunca se despega
  del carril.
- `grow` sale del piso creciendo, `wide` entra ancho y se cierra, `fade` es solo alpha.
  Todas suben de alpha ademas, si no aparecen de la nada.

Es puro dibujo: la hitbox sale de `KINDS` y no se entera. `enterOf(z, dz)` en `music.js` da
0 recien salido y 1 con la animacion hecha, y dura `ENTER_BEATS` = **7 beats de viaje**.
Ni 1 ni 5: con 1 beat (323z a v=700) la animacion pasaba entre z=4000 y z=3677, donde la caja
mide 2px; con 5 terminaba en z=2385 con la niebla en **f=0.68**, o sea hundida, que es
exactamente el "no veo el fadein" que se reporto. Con 7 termina en **z=1739, a 1019 del
jugador** (niebla f=0.41, ya legible) y todavia **1.45s = 3.2 beats antes del impacto**, o
sea que la caja esta quieta mucho antes de la ventana de reaccion (1 beat).
`test-music.js` mide las dos puntas de esa cuerda: falla si la entrada termina a menos de
2 beats del impacto (deformaria lo que estas leyendo) o a mas de 1600 del jugador (se
hundiria en la niebla y no se veria).

**Pero 7 beats de viaje solo entran si el viaje dura mas que eso, y `V` (feel) lo acorta**:
a v=700 el viaje son 10.15 beats, a x1.5 son 6.77 y a **x2 son 5.08**, o sea menos que la
entrada. Sin topar, a x2 la caja te pisaba con la entrada al **73%**: un `slam` a medio caer,
flotando **185 sobre el piso** (mide 150 de alto). Eso es el "las cajas nunca llegan al suelo"
que se reporto. Por eso la distancia sale de `enterDz(beat, speed)` y no de una multiplicacion
suelta: se topa a lo que quepa dejando `ENTER_END_BEATS` = **2.2** beats libres, o sea que la
entrada esta HECHA antes de la ventana de lectura **a cualquier velocidad**. 2.2 y no 2 porque
a x2 esos 2.2 beats son 1421z, o sea justo por dentro de los 1600 donde la niebla hunde todo
(con 2.5 se pasaba: 1615). A x1 y para abajo el tope no toca nada: manda el minimo, que sigue
siendo los 7 beats. `test-music.js` corre el assert a las cinco velocidades de `SPEED_MULS`
(que por eso vive en `physics.js` y no en el renderer: hay que medirlo desde node).

## Blinders y apagon: el break se prepara a oscuras (`drawFlash`)
La unica capa que se dibuja SOBRE todo lo demas. Dos efectos, los dos anuncian el drop:

- **Blinders**, el ultimo compas del buildup: estrobo violeta-blanco a pantalla completa que
  ACELERA. Medido: **12 flashes en el compas, de 338ms de hueco al principio a 98ms al final,
  encendido el 45% del tramo, alpha pico 0.60**. La fase va INTEGRADA (`4u + 8u²`), no
  `t % sub`: con `sub` variable `t % sub` no es una fase y sale parpadeo caotico (368 bordes
  medidos en el primer intento en vez de 12).
- **Apagon**, todo el break: negro entero, fondo incluido, entrando en 0.12s (de golpe se lee
  como un bug de render). Las letras del acid son objetos de **texto** de Phaser, o sea que
  van por encima del `Graphics` y quedan flotando solas en el vacio. Se levanta **un beat
  antes del drop** (29.077s). Es jugable y esta medido: en el break NO hay ni un obstaculo
  (los de alrededor caen en 27.23 y en 29.54) y el primero del drop pide saltar sin cambiar
  de carril, con 462ms de aviso = la ventana de reaccion de una fila.
  El HUD, los numeros de fila y la tira de diseno son textos tambien, asi que sobreviven al
  apagon: son herramientas, no el juego.
- **Blanco en CADA kick, todo el drop**: `0.22 * pulse³` a pantalla completa. El cubo es lo
  que lo hace un golpe: medido a v=700, el alpha pica en **0.20 sobre el kick y esta por
  debajo de 0.01 el 60% del beat**, o sea que entre golpes la pantalla queda limpia. Con 0.3
  de tope el cielo se ponia gris y la niebla se comia el fondo: 0.22 pega y deja leer.

## Fantasma: blanco y negro y solo las lineas (tecla `P`, `fantasma()`)
Un filtro en la UNICA puerta por la que pasa el dibujo entero: se envuelven `fillStyle` y
`lineStyle` del Graphics **una vez**, en `create()`. Por eso ninguna de las 20 funciones de
dibujo se entera y no hay un solo `if (ghost)` desperdigado. Un `PostFXPipeline` de WebGL
daria lo mismo a cambio de escribir un shader y de perder el fallback a canvas.

- **relleno -> gris** (la luma del color al 28%), no negro seco: el relleno sigue tapando lo
  que hay detras, o sea que las siluetas y el orden de profundidad se leen. A negro el
  jugador desaparecia: es todo relleno (torso y cabeza).
- **trazo -> blanco puro**, conservando grosor y alpha: eso es lo que deja el contorno de
  todo (obstaculos, portones, rig, formas, constelacion) flotando en el vacio.
- **el negro se queda negro**: es el contorno que ya despegaba al muneco y a sus miembros del
  fondo (dos pasadas, la primera negra y mas gruesa). Invertirlo lo borraba.
- **el blanco puro se queda blanco**: el unico que lo usa de relleno es la `constelacion`,
  que es justo lo que tiene que quedar macizo cuando todo lo demas es gris al 28%.
- Medido a t=49.5s: **1.5% de la pantalla con color** contra **50% en normal**. Ese 1.5% es
  el HUD y los numeros de fila, que son objetos de **texto** de Phaser y no pasan por el
  Graphics: son herramientas, igual que en el apagon.

## El beat del fantasma: la f63 (`GHOST_ROW`) y despues cada MARCA (`constelacion`)
El fantasma no es solo una tecla: **lo usa el nivel**, y es funcion de `songT` como todo lo
demas. `P` sigue forzandolo a mano para poder mirarlo en cualquier lado.

    this.ghost = this.ghostKey || rowAt(t) === GHOST_ROW || markWin(t, cues, beat) > 0.02

**El fantasma TRAE la constelacion**: `drawBars` dibuja `constelacion` siempre que `ghost`
este puesto, sin mirar el sector. Son un solo efecto y no dos que hay que sincronizar.

Esa fila es **exactamente el hueco entre el apagon y el drop**: el apagon se levanta en
29.077s y el drop entra en 29.538s, o sea **462ms = un beat**, y `test-music.js` falla si las
tres cosas dejan de caer juntas. Una fila y no medio compas: mas largo pisa el drop, mas corto
es un parpadeo.

Ahi (y en ningun otro lado del nivel) aparece la **`constelacion`**: los rombos del `eq`, que
antes se llamaban `shapes` y estaban repetidos en el sector 6. Ahora van **solas en el sector
3** (f60-63), y como las tres primeras filas de ese sector estan en negro por el apagon, se
las ve solo en el beat del fantasma. `test-music.js` exige que sea UN solo sector y que
`GHOST_ROW` caiga dentro.

- En fantasma el relleno de los rombos va **blanco entero** (no gris): medido en la banda del
  cielo, **5.9% de blanco puro en la f63 contra 0.0% en la f64**. Ese es el contraste: sale
  del negro, un beat de linea blanca con la constelacion maciza, y al beat siguiente entra el
  drop en color.

**Y despues, con cada MARCA**: la misma ventana que enciende las formas de los costados
(`markWin`: prende EN una marca y apaga en la siguiente si estan a menos de 1.5 beats). En el
drop las marcas van de a pares, asi que sale un destello de un beat por compas: de la **#46 a
la #48** (f67-f68), de la **#52 a la #54** (f71-f72), y asi. Medido: **15 destellos y 23% en
el drop, 8 y 8% en el drop2 (23 y 13% de punta a punta), 0% del buildup** (ahi las marcas van
filtradas y nunca caen a menos de 1.5 beats, o sea que esto no puede convertirse en un
parpadeo permanente; `test-music.js` lo afirma).
El drop2 da la mitad de destellos por segundo que el drop porque su `response` es `fx` y no
`mark`: si abriera ventana, encadenaria 3 marcas y la figura cambiaria A MITAD del destello
(medido: 19 de 34 huecos a <=1.5 beats).

La constelacion **late**: el radio de la figura es `0.4 + 0.45*hash` por `0.8 + 0.45*beat`, y
en el drop `beat` es el kick. Medido dentro del mismo destello: **18.3% de blanco en la banda
del cielo con `beat`=0.75 contra 9.2% con el beat ya caido**.

**Y cada destello trae OTRA FIGURA** (`FIGS` en el renderer, `flashIdx` en `music.js`):
`{ n, rot, spin, sway }` = lados, angulo de arranque, vueltas por compas (el signo es el
sentido) y vaiven horizontal. El orden es rombo quieto (el de siempre, el que se ve en la
f63) -> **hexagono girando** -> triangulo con vaiven -> cuadrado plano girando al reves ->
pentagono, y vuelve a empezar: 23 destellos sobre 5 figuras.

- `flashIdx` cuenta **ventanas abiertas**, no marcas: da 0 antes del primer par (o sea la
  f63), 1 en el destello de la #46, y asi. Dentro de una ventana **no cambia** (la marca que
  la cierra no abre otra: entre par y par hay 3 beats), o sea que la figura no se transforma
  a mitad del destello, aparece ya siendo otra. `test-music.js` mide las dos cosas.
- El vaiven horizontal va a **media vuelta** del vertical: asi la figura describe un 8 y se
  lee como que flota. En fase seria una diagonal, que se lee como que se desliza.

## El suelo se corta en SECTORES (`sectors` en `LEVELS`)
`{ from, to, color }`, `from`/`to` en **filas** y las dos incluidas, igual que las zonas. Cada
tramo tinta sus bandas del piso, y como una banda es una fila, el corte se ve como una junta
en el suelo: la pista dice en que parte del tema estas con mas resolucion que las tres
secciones, sin mirar el HUD. `sectorOfRow(row, sectors)` en `music.js`.

Es **solo color**: no toca cues, ni fisica, ni hitbox, ni el `#n` de nada. El tinte es
`0.32 + 0.35*beat` sobre `surfaceLight`: con 0.45 de base (lo primero que se probo) el sector
se comia la pista entera y el suelo dejaba de ser suelo. Fuera de todo sector manda el color
de la SECCION, como antes. `test-music.js` exige que sean contiguos, que arranquen en la fila
0 y que lleguen a la ultima: un agujero devuelve el suelo al color de la seccion en medio de
la pista y se lee como un bug.

El nivel va cortado cada 20 filas (5 compases): 8 tramos para 128 filas.

## Wooby y quake: se mueve la PANTALLA, no el mundo (`translateCanvas`)
Un `translateCanvas` alrededor de todo el dibujo del mundo, y el inverso antes del marco y de
los flashes. **No toca la proyeccion ni la fisica**: se choca exactamente igual que con la
pantalla quieta, y como sale de `songT` y del kick, rebobinar lo rebobina.

- **wooby**: vaiven lento de 2 compases (3.69s), siempre, **+-16px** en x.
- **quake**: solo en el DROP y solo con el kick (`pulse³`, o sea que entre golpes es 0),
  **9.7Hz en x y 7.5Hz en y**. El cubo es lo que lo hace un golpe y no un mareo.

Medido sobre 1362 frames del drop: el desplazamiento total va de **-28.4 a +28.4px en x y de
-8.6 a +8.6 en y**, y solo el **6% de los frames sacude mas de 2px**, o sea que es un golpe
por kick y no un temblor constante.

**Pero el golpe del suelo no puede salir de `pulse`** (`this.kik`). Medido sobre el drop2 de
`orbit-motion`, `pulse` vale **0 el 100% del tramo** (ese drop no tiene ni un evento de `bass`),
o sea que el temblor estaba apagado justo en el drop: eso es el "el reactor no se mueve en el
beat y no hay sacudida" que se reporto. El kick si esta ahi, en la GRILLA: medido sobre el
audio, hay un kick real en la fase 0.0 en el **95.8% de los beats (158/165)** y en **31 de los
32 del drop2**. Asi que `this.kik = metro ? max(pulse, gridAt(t, lv)) : pulse`, el mismo idiom
que `this.lat`, y ademas la creciente lo empuja (`kik³ * (1 + hype)`). Medido sobre los **841
frames del drop2**: el desplazamiento pasa de **0.00px y 0% de frames sacudiendo** a **+-22.4px
en x, +-16.4 en y y el 31.4% por encima de 2px**. De `kik` cuelga tambien el golpe blanco de
cada kick. **El nivel 1 no declara `metro`**, o sea que ahi `kik === pulse` y no cambia un pixel.

Los dos rectangulos de base (cielo y suelo) van **60px pasados de cada lado**: con el temblor
puesto, uno del tamano exacto de la pantalla deja una franja sin pintar en el borde.

## El marco de la pantalla recibe los golpes (`drawEdges`)
Bandas en los bordes (abajo el doble de gruesa que a los lados: es donde esta el jugador y
por donde entra todo), en espacio de PANTALLA y por encima del mundo. Reaccionan a dos cosas
distintas:

- **el beat** (`this.beat * 0.5`), siempre y tenue;
- **el impacto** (`imp`): el obstaculo que te esta pasando por encima, +-140ms de su hora de
  llegada. Ademas blanquea el color, asi que el borde "recibe" la caja.

Dos pasadas (banda ancha tenue + filo fuerte), como los halos: un solo relleno grueso se lee
como marco de ventana. Va DESPUES de deshacer el temblor, o sea que el marco no tiembla: si
temblara seria un borde suelto, no el borde de la pantalla.

## Rave: suelo (`drawRave`) + cielo (`drawRig`) + costados (`drawPins`)
Tres capas distintas, las tres funcion de `songT`, ninguna toca la jugabilidad.

- **`drawRave`, en el mundo**: las senales de audio que **no** son el kick (`accent`, `voice`)
  barren el plano del suelo **fuera de la pista** (`|x|` de 300 a 1400, o sea de punta a punta
  de la pantalla) con el filo de afuera marcado. Fuera de la pista a proposito: adentro
  taparian obstaculos, que es la queja que arreglaron los huecos. El grosor sale de `v` y el
  brillo de la distancia al jugador, asi que revienta cuando la senal pasa. La `z` sale de
  `songT`: rebobinar los rebobina. En la camara de perfil no se dibuja.
  Tenia ademas una viga vertical en el borde: se saco, se leia como un andamio amarillo
  cruzando el cielo, y el cielo es del rig.
- **`drawRig`, en pantalla**: dos emisores fuera de cuadro que abren un abanico de 11 vigas
  (halo + nucleo) mas tres focos que derivan. Es espacio de **pantalla**, no del mundo: no
  depende de la camara. Se dibuja **antes del suelo y del skyline**, o sea que solo se ve en
  el cielo y los edificios lo tapan; por eso no hace falta recortarlo contra la pista (medido:
  a `zn`=60 el borde de la pista proyecta en x=6395 de una pantalla de 2528, no hay franja
  lateral que recortar). El brillo es el kick (`pulse`), el abanico barre con el compas y el
  color lo elige el compas via `hash(nro de compas)`, nunca `Math.random()`. El abanico
  **abre y cierra** cada dos compases y cada viga se dobla por su cuenta: no es un peine.
- **`drawPins`, en el mundo**: tubos de luz a los costados de la pista (`x = ±430`, `y = 200`),
  uno cada dos beats. Viajan con la pista (su `z` sale de `songT`), asi que rebobinar los
  rebobina. **Todo el rig apunta al mismo lado durante un compas**, sacado de `PIN_DIRS` con
  `hash(nro de compas)`: `v` al piso, `<-` y `->` cruzando, y las dos diagonales de arriba.
  Izquierda y derecha van espejados, como un rig de verdad, y barren dentro del compas.
  Se apagan de lejos **y de muy cerca**: el cono pegado al jugador es enorme en pantalla y
  lavaria justo el obstaculo que tenes que leer.
  El cono era de **620 de largo x 0.13 de apertura**: cruzaban la pista como hilos y de lejos
  no se veian. Ahora **900 x 0.26**, y son **dos** conos superpuestos (uno ancho y tenue,
  0.26/0.13, y otro angosto y fuerte, 0.09/0.2) mas un nucleo de 5px: el borde marcado es lo
  que hace que se lea como laser y no como mancha.
- **`drawGates(sec)`, en el mundo**: portones abiertos (U invertida, sin cerrar abajo: un
  marco cerrado se lee como obstaculo) con aristas largas entre porton y porton, o sea un
  tunel. Solo en break y drop, y **no cambia la camara**: es geometria del mundo, seguis en
  3a persona.
  Son un **arco de 6 puntos**, no un rectangulo: el marco cuadrado se leia como andamio, los
  hombros a media altura son lo que lo hace un porton. Dos trazos (halo ancho + nucleo): uno
  solo grueso se lee como tuberia.
  - **break**: uno por beat, tenue y con la **boca mas abierta adelante** (`1 + 0.5*(1-d)`):
    ese es el embudo. El de encima tuyo se apaga (`clamp(d*3)`): un porton ocupando la
    pantalla entera se lee como andamio, no como tunel.
  - **drop**: uno cada dos beats, rosa, **760x620** (casi el doble del break) y respirando un
    7% con el bajo; el brillo sale de `this.beat`.
- **`drawShapes()`, en el mundo**: poligonos (triangulo / cuadrado / hexagono, por `hash`)
  flotando **a los costados** (`|x|` de 620 a 1040), uno por compas de cada lado, con color
  de `NEON` elegido por `hash(indice)`. Se apagan con `rave`, o sea que en el break no hay
  ninguna. Los mas cercanos que `PLAYER_Z + 200` no se dibujan: pegados a la camara son manchas.
  El brillo tiene piso (`0.6 + 0.4*beat`, antes `0.45 + 0.55`): latiendo desde 0 se veian
  solo en el golpe y el resto del compas no estaban.
  - **El nucleo es BLANCO**: cuatro pasadas de `26+34*beat` a `2.5` de grosor, las dos anchas
    en el color y el nucleo en `0xffffff`. Un neon de verdad es un tubo blanco con el color
    derramado alrededor; con el contorno del color se hundian contra el skyline.
  - **No estan siempre: parpadean con las MARCAS** (`markWin` en `music.js`). Se encienden EN
    una marca (las lineas amarillas: accent/voice) y se apagan en la SIGUIENTE, y solo si esas
    dos estan a menos de **1.5 beats**. En el drop las marcas vienen de a pares (una por compas
    + su respuesta un beat despues), asi que sale **un destello de un beat por compas** y entre
    par y par (3 beats) no hay ninguna. Medido: encendidas el **21% del drop**. Funcion pura de
    `songT`, con 60ms de rampa para que no salte un frame. `test-music.js` lo mide par por par.

Ademas **todas** las bandas del suelo laten (`0.28 + 0.4*beat`): el piso era lo unico de la
pista que no se movia con la musica. La del **1 de cada compas** va encendida entera, asi que
se siguen contando compases mirando el suelo. El color de las bandas ya no sale de la seccion
sino del SECTOR (ver arriba); la seccion es el respaldo cuando la fila no cae en ninguno.

Medido con todo puesto (capas, marco, temblor, triangulos), en el drop: `draw()` **0.4ms
media, 0.6ms p95, 2.8ms max** (1454 frames a x1 sonando).

## Niebla y latido: la caja dice a que distancia esta y en que beat estas
Dos terminos por caja en `drawBox`, los dos gratis (no tocan la fisica ni la hitbox).

- **Niebla**: `f = clamp((z - PLAYER_Z) / 1600, 0, 1)^2`, y con eso el color se va a
  `this.fog` (la mitad entre suelo y cielo: una caja lejana toca los dos) y el alpha baja
  hasta 0.6. El 1600 esta medido, no elegido: a v=700 las cajas caen una cada **323z** (una
  por beat), asi que con el rango entero (`SPAWN_Z - PLAYER_Z` = 3280) la 2a y la 3a daban
  f=0.02 y 0.05, o sea nada. Con 1600 la que tenes encima y la siguiente siguen limpias
  (0.00 / 0.05), la 3a empieza a irse (0.17) y de la 5a (z=2361) en adelante esta hundida.
  Para eso esta: que una pared del fondo no compita con la que tenes que leer ahora.
- **Latido**: la cara se aclara con `this.beat` (el rol que dice `glow`, no siempre el kick)
  y se le agrega un halo del color puro en dos pasadas (`5 + 26*gl` tenue y `2 + 10*gl`
  fuerte), y ademas el **contorno tambien engorda y aclara** con el beat
  (`2 + 3*gl` a `0.35 + 0.5*gl` de alpha). Se reporto que la pared no reaccionaba a la
  musica: el halo iba a la mitad de alpha y el contorno era fijo, o sea que de lejos la caja
  era un dibujo quieto. Los dos van multiplicados por `1 - f`, o sea que **la niebla se come
  el brillo**: solo late lo que esta cerca, y el fondo no titila.

El jugador va al reves de la niebla: es lo mas cerca que hay, asi que cada pieza lleva
**contorno negro** engordado (ver `avatar.js`, abajo) y un anillo de beat a los pies. Con el
rave prendido se perdia contra los conos y las cajas.

## El jugador es vectorial y vive aparte (`avatar.js` + `tools/avatar.html`)
El muneco no sabe que hay un nivel: `pose(estado)` devuelve **piezas en unidades de su alto**
(1 = la cabeza, 0 = los pies) y `drawAvatar(g, piezas, P, u)` las pinta, donde `P` mete la
perspectiva. Por eso el mismo codigo corre en las tres camaras y en el **banco**
(`tools/avatar.html`), que muestra las 8 poses en fila sin el nivel encima. El banco es donde
se toca la pose: `python3 -m http.server 8123` -> `/tools/avatar.html`, `SPACE` para/sigue,
`__lab.set({zoom: 2.6})` desde consola.

Vectores y no el sprite del sheet: sus 4 dibujos de carrera se diferencian **8-12% de
silueta** (medido sobre las mascaras alfa), o sea que no son un ciclo. Aca la pose es
**continua**: no hay frame rate que alcanzar, hay funcion. El sheet
(`assets/player/sheet-v1.png`) queda como referencia de color y forma.

- **Tres pasadas** por pieza: contorno negro engordado `0.016`, color, y **sombra** (la misma
  forma metida hacia abajo y adentro, negro al 22%). Sin degradados en `Graphics` eso es lo
  unico que da volumen, y va en pasadas separadas para que la sombra de una pieza no manche
  a la de al lado ni el contorno tape a la vecina.
- **No camina: va en tabla.** Es la solucion de Subway Surfers (el hoverboard) y de Jetpack
  Joyride (la mochila): de espaldas una caminata son dos palos que suben y bajan, y a 100px
  de alto nadie lee una rodilla. Se probaron las dos (ciclo de 4 dibujos del sheet, y despues
  piernas vectoriales con rodilla y pie girando) y las dos se leian como que resbala.
  Parado sobre algo el problema desaparece: las piernas son una pose fija que **respira**, y
  el movimiento lo hacen la tabla, el bote y la estela, que si se leen.
- **La tabla apunta hacia adelante, no cruzada.** De espaldas un snowboard se ve casi de
  canto: corto, angosto y con la cola por debajo de los pies. Para eso hay un pseudo-3D
  DENTRO del muneco (`p3(x, y, d)`): lo que se aleja se dibuja mas chico y mas arriba,
  igual que la pista. `RISE` es la altura de la camara; con 0.115 la tabla desaparecia de
  canto, con 0.22 se le ve la panza, que es como se ve desde `CAM_Y`.
- Los **pies van uno delante del otro** sobre la tabla, no al lado: del de adelante se ve
  poco, y esta mas arriba y mas chico. Eso es lo que lo hace leer como snowboard y no como
  equilibrista.
- **Girar es girar la tabla** (`yaw`, hasta 0.6 rad), no inclinar la pantalla: sale de lo que
  le falta a `x` para llegar al carril, o sea que la orientacion ES el cambio de carril, y
  cada direccion tiene la suya. Derecho la tabla mide 0.30 de ancho y girando 0.69 (medido);
  a la pantalla le queda solo 0.10 rad de inclinacion.
- La tabla va **pegada a los pies**: en el aire sube con el. Suelta en el suelo se lee como
  que la perdiste (`test.js` lo asegura). El resplandor de abajo es lo que la hace flotar:
  sin el es una tabla apoyada.
- **Deslizar es un derrape**: la tabla se **cruza** y sale hacia adelante, el cuerpo se tira
  atras y abajo, las piernas se estiran hacia ella y la mano de adentro va al piso. Cruzada
  es la unica forma de que se VEA (apuntando hacia adelante y lejos se esconde detras del
  cuerpo), y ademas es lo que hace uno de verdad para frenar. Agachandose sin mas parecia
  que te sentabas.
- **El traje reacciona a la musica**: las piezas marcadas `neon` (cinturon, rayas de las
  mangas, filo de la visera y los dos filos de la tabla) toman el color que manda el **compas**
  (`hash(nro de compas)` sobre `NEON`, el mismo truco que el rig) y su alpha late con
  `this.beat`. El resto del muneco no cambia de color a proposito: si cambiara todo no se
  leeria ninguna pieza.
- **De adorno, solo la sombra**: elipses negras pegadas al piso detras del muneco. Hubo una
  cola de particulas y un halo alrededor, y **los dos se sacaron**: en una pantalla que ya
  esta llena de luz (rig, pins, portones, formas, laseres) mas luz encima del muneco lo
  esconde en vez de marcarlo. Lo que lo ata al suelo es la sombra, no el brillo.
- **El bamboleo sale de lo que HACES, no de avanzar**: cambiar de carril, saltar o comerte una
  caja disparan un tirón (`wobT`) que se apaga solo (seno por exponencial, ~0.45s). El golpe
  sacude 3 veces mas que un cambio de carril. Yendo derecho el muneco esta quieto.
  El tirón inclina el **cuerpo sobre los pies**: la tabla se queda plana, que es lo que pasa
  de verdad.
- **Trucos en el aire** (`TRICKS`): `heli` (la tabla da una vuelta entera bajo los pies),
  `flip` (gira sobre su eje largo: al pasar por el canto desaparece, y eso ES el flip) y
  `grab` (no gira, la mano de abajo va a buscar el canto). Cual toca sale de
  `hash(cuando saltaste)` y el avance del truco sale de `vy` (`JUMP_V` al despegar,
  `-JUMP_V` al caer): **no hay ni un contador**, asi que rebobinar repite el mismo truco.
  Es solo dibujo, la hitbox no se entera.
- La tabla mide **0.40** de media largo y no 0.52: una de verdad mide casi lo que el que la
  lleva, pero cruzada llena media pantalla y en el `heli` se comia al muneco.
- El **casco** es cromado de una pieza (daft punk). Lo que lo hace metal sin degradados es el
  escalonado de tres grises, el brillo blanco **descentrado** (centrado se lee como plastico)
  y la visera dando la vuelta a la nuca con el filo cyan.
- El **eq de la mochila** late con la musica de verdad: una subdivision del beat por barra
  mas el empuje del kick, igual que las del fondo.
- **Lo que se dibuja es lo que se choca**: `test.js` mide la pose y falla si de pie no mide 1,
  si agachado sobresale de `SLIDE_H` (medido: 1.00 y 0.52 contra una hitbox de 0.50), si la
  tabla no despega al saltar, o si girando no se abre (es lo que delata que se dibujo plana,
  sin perspectiva).
- Medido con las 39 piezas x 3 pasadas: `draw()` **0.6ms media, 1.1 p95** (1061 frames).

## No hay bote: la pista es plana y la tabla flota (`ride`)
El muneco **no camina**, asi que no hay pisadas, y sin pisadas no hay bote. El sube y baja de
una carrera sobre una superficie lisa es exactamente lo que se ve mal. Lo que quedo:

- **Flote** de `HOVER` = 1.2 unidades de mundo (**1.8px** de recorrido total medido en
  pantalla a v=700), un ciclo por compas. Es para que no parezca una estatua, no para que
  rebote. Antes habia un bote de 5 (7.4px, dos veces por beat) y un vaiven lateral de 1.4:
  los dos eran del muneco que corria.
- **Cero vaiven lateral y cero inclinacion por vaiven.** La unica inclinacion de pantalla que
  queda es la del giro (0.10 rad), y la lleva el cambio de carril.
- **Los brazos son lo unico que se mueve solo**, asi que se mueven de verdad: hacen
  equilibrio y **contrapesan el giro** (al cruzar de carril el de afuera sube y el de adentro
  baja). Van a **2/3 de la frecuencia del flote** a proposito: si los dos laten igual se lee
  como juguete a cuerda, y `test.js` falla si van iguales.
- Los dos salen de `ride(t, beat)`, o sea de la cancion, como todo lo demas del mundo: el
  muneco respira con la musica sin marcar un paso que no existe.

Aca vivian `runAnim` (ciclo de carrera clavado al beat, 2 apoyos por beat) y `stepsFor`
(cadencia por velocidad). Se fueron con las piernas: no hay paso que sincronizar.

## Zonas: tramos con otras reglas (`zones` en `LEVELS`)
**El nivel DEMO ya no tiene zona.** El tramo 2D (f76-f82, carril 1, `cam: "lado"`) se saco:
de perfil el nivel se lee como otro juego y este ya pide bastante. El mecanismo sigue entero
(igual que el flip): lo unico que se saco es la zona del nivel, y `test-music.js` lo afirma
(`assert.deepEqual(lv.zones, [])`). Para devolverla, al nivel: `zones: [{ from: 76, to: 82,
lane: 1, cam: "lado" }]`, y el solver por filas vuelve a pinear el carril dentro de ella.

`{ from, to, lane, cam }`, `from`/`to` en **filas**, las dos incluidas.

    zones: [ { from: 76, to: 82, lane: 1, cam: "lado" } ]

- `lane`: el tramo es de UN carril. `cues()` **tira** los obstaculos y orbs de los otros dos,
  el jugador queda pegado a ese carril (`move()` no hace nada dentro) y los otros dos se
  pintan de rojo en el suelo desde lejos, para saber a cual moverte ANTES de entrar.
- `cam`: la camara del tramo. Al salir vuelve a la que tenias con `C` (`camPick`).
- **Un tramo con `cam: "lado"` TIENE que ser de un carril.** En esa proyeccion dos cajas de
  carriles distintos se dibujan una encima de la otra. Por eso en 2D solo se dibujan los
  obstaculos de la zona: fuera de ella hay tres carriles y de perfil son una mancha.
- Los bordes salen de la grabacion, no de la vista. Cuando la zona empieza **ya tenes que
  estar en su carril** (dentro no se puede cambiar, o sea que no hay forma de entrar), y
  **tiene que soltarte una fila ANTES del proximo cambio de carril** (paso con `to: 83`: el
  cambio de las 38.643s se perdia y morias a los 38.65s). Comerse un cambio no es fatal en si:
  los de la f76-f77 son una ida y vuelta al carril 2 que la zona vuelve innecesaria, porque
  tira los obstaculos de los otros dos carriles. Fatal es que el comido hiciera falta despues,
  asi que `test-music.js` no cuenta cambios comidos: replaya la grabacion **pineada** (sin los
  cambios de dentro de la zona) contra el resto del nivel y exige 0 golpes.
- Las dos primeras filas de la zona (f76, f77) van **vacias** a proposito: 923ms para leer el
  plano nuevo. Cambiar de camara y tener que saltar en el mismo beat no es dificultad, es no ver.
- El **contenido** de la zona se escribe a mano, no sale de la grabacion: donde grabaste no
  hiciste nada, y un tramo 2D vacio no es un tramo. El de ahora alterna
  f78 low / f79 high / f80 low / f81 high / f82 low: salto, slide, salto, slide, salto.
  Que se pueda pasar no es a ojo: `test-music.js` lo resuelve con un solver de un carril
  (incluida la fila siguiente, donde vuelve el 3D) y mide la ventana de cada pulsacion
  (240ms).
- `zoneOfRow(row, lv)` / `zoneAt(t, lv)` en `music.js`. `zoneAt` quiere la grilla + `zones`,
  o sea lo que devuelve `loadLevel`, no el objeto crudo de `LEVELS`.

## Que el nivel se pueda pasar lo prueba un solver, no la grabacion
El nivel arranco siendo el negativo exacto de la corrida grabada, o sea que la grabacion lo
esquivaba por construccion. **Ya no**: se edita a mano fila por fila y la gracia de esas
ediciones es justamente **sacar carriles libres para forzar la accion**. Asi que el assert de
"la grabacion esquiva su propio nivel" se bajo a reporte (dice cuantos se come, ahora 5) y en su
lugar `test-music.js` corre una **busqueda en anchura por filas con la fisica de verdad**: en
cada fila prueba cada carril (el cambio es instantaneo, se choca por indice) y cada accion en una
grilla de 5 tiempos dentro del beat, simula a 240Hz y tira lo que choca. Los estados se deduplican
por `(carril, y, vy, deslizando)` redondeados: por eso 127 filas no explotan y el test entero
tarda 0.5s. Corre con `g=1` y con `g=-1`.

## Orbs y gravedad invertida (roles `orb` y `flip`)
Dos roles mas, mapeables desde `LEVELS` igual que `obstacle` (por canal en `map`, por `#n`
con `role2`, o por fila/tile en el `script`):

    { row: 70, lane: 1, role: "orb" }    // orb: llega al jugador en el tiempo de la fila
    { row: 88, role: "flip" }            // desde aca se corre por el techo

- **orb** (`kind: "orb"`, amarillo): no choca, se agarra. Solo engancha si venis
  **manteniendo** `↑`/`W` (como el dash orb de geometry dash). Da `DASH_T` = 1.2s de dash
  sostenido: te sube a `DASH_Y` = 150, sin gravedad, y **atraviesa los obstaculos**.
  Soltar lo corta al instante y caes.
- **jump orb** (`kind: "orbj"`, rosa con flecha): el mismo role `orb`, otro `kind`. Tambien
  hay que venir manteniendo, y te da el salto **en el aire**. Lo pone `chains()` en
  `record.js` donde encadenaste dos saltos con menos de `CHAIN` = 1.5 beats de hueco (medido
  sobre la grabacion: los huecos se parten solos en 0.63s / 0.88s). Donde va un orb NO va
  obstaculo: esa celda es tuya. Rosa y no rojo a proposito: el rojo mata.
- **Que hay que MANTENER se dice, no se deduce**: al orb que viene entrando se le pone el
  cartel `MANTENER ↑` encima (pasa a `↑ OK` en verde cuando ya lo estas manteniendo) y el
  anillo se rellena mientras mantengas.
- **Colchon del orb** (`ORB_GRACE` = 150ms): si lo pasaste sin mantener queda anotado en
  `orbMiss`, y `jump()` lo cobra hasta 150ms despues. La ventana cruda del orb son 157ms a
  v=700: sin colchon hay que adivinarla. 150ms es lo que se midio de retraso humano en la
  grabacion (los saltos caian entre -109 y +119ms de su fila).
- **flip**: `gravedad(t) = -1^(cues de flip <= t)` (`flipAt` en `music.js`), o sea funcion
  pura de `songT`: rebobinar antes de la cue te devuelve al piso. El mundo se espeja en
  `y=0` (el jugador y las cajas van con el signo) y la camara cruza el plano en 0.35s
  (`camY = CAM_Y*cos(roll)`), asi que la pista pasa a ser techo. El tiempo de aire es el
  mismo en las dos gravedades: es el mismo `stepPlayer`, con signo.
- El flip **se ve venir**: la cue se dibuja como un porton verde de lado a lado que llega
  desde el spawn (`leadOf(speed)` antes, 4.7s a v=700), con chevrones **espejados en el plano
  del suelo** (apuntando a un solo lado se leen como "agachate", que es otra tecla), y el HUD
  muestra `⟲ GRAVEDAD <n>s` en los ultimos 3 segundos.
- **El nivel DEMO no tiene flip.** El mecanismo sigue entero (rol, `flipAt`, el porton, la
  tecla `H`, sus tests con un nivel propio); lo que se saco es la cue del nivel: de cabeza no
  se lee que tecla es cual y este nivel ya pide bastante. Para devolverlo, al `script`:
  `{ row: [88, 104], role: "flip" }`.

## Fondo: color base + capas de detalle
La capa `bars` (el `eq`) es un **analizador**, no una valla: cada barra resuena en su propia
subdivision del beat (1, 1/2, 1/3 o 1/4 de negra, elegida por `hash(i)`) y encima el kick las
empuja a todas. Antes era una altura fija por hash multiplicada por el mismo `pulse`, o sea
que subian y bajaban EN BLOQUE. El kick pesa 0.36 y la resonancia 0.55 a proposito: con 0.55
en el kick casi todas llegaban al tope a la vez y volvia la valla, ahora en cada beat. El
**pico** (3px, casi blanco) se despega de la barra y baja mas lento, como el peak hold de un
analizador de verdad: es lo unico brillante del fondo.

El fondo es el color (`bg`, `bgAt`) mas las capas declaradas en `LEVELS[...].layers`,
no en el renderer: `{ id, kind: stars|skyline|bars, k, step, h, color }`. `k` es el parallax
sobre la distancia recorrida (`songT * speed`), asi que el fondo tambien es funcion del tiempo;
las siluetas salen de `hash(i)`, nunca de `Math.random()`. El guion las toca por `#n`:

    { at: 34, layer: "eq", tint: "#ec4899", over: 1 }   // tinta la capa en 1s
    { at: 40, layer: "far", vis: false }                // la apaga

Una cue toca UNA capa (la segunda directiva sobre la misma `#n` pisa a la primera).

## El `eq` tiene VARIANTES y cual va lo decide el SECTOR (`modes`, `drawBars`)
`modes` es un nombre por sector del suelo (8 sectores, ver arriba), asi que **una corrida
entera las muestra todas** y se elige mirandolas, no describiendolas. Ninguna toca la
jugabilidad: es la capa mas de atras del fondo.

- **`analyzer`**: el de siempre (resonancia por barra + peak hold). Es el unico con
  **parallax**: su identidad viaja con la pista. Las demas van pegadas a la PANTALLA, porque
  un analizador que se desplaza de costado deja de leerse como analizador.
- **`sweep`**: el golpe CRUZA de izquierda a derecha, una pasada por compas.
- **`center`**: sale del CENTRO a los dos lados, uno por beat.
- **`spectro`**: FFT **REAL** del audio que esta sonando.
- **`color`**: el mismo FFT, cada banda con su color de `NEON`, rotando con el compas.
- **`constelacion`**: no es analizador: rombos que flotan y laten. Va SOLA en el sector del
  break, o sea que se la ve un unico beat en todo el nivel (ver el fantasma, arriba).

Detalles medidos, no elegidos:
- La **cola** del barrido es `exp(-((p - u + 1) % 1) * 3.5)`: la cabeza brillante va
  ADELANTE y la estela queda del lado por el que ya paso. Al reves no se lee la direccion.
- El piso es **0.18** y el kick **0.34**: con 0.10/0.25 lo que no esta barriendo se leia
  como apagado y `center` parecia muerto.
- El bin del FFT sale de `u^1.7`, no lineal: lineal apila todo el grave en el borde izquierdo
  y las tres cuartas partes derechas quedan planas.
- El sector 3 es el **break** y va en negro (apagon) menos su ultima fila: por eso ahi va la
  `constelacion` y no un analizador, que no se llegaria a leer en un beat.

El FFT es un `AnalyserNode` (`transport.js`, `spectrum()`) colgado de la **FUENTE** y no de
`gain`: mutear (`X`) no apaga el espectro, y no va a `destination`, o sea que no suena dos
veces. Es **lo unico del render que NO es funcion de `songT`**: en pausa da todo ceros.

`test-music.js` exige un modo por sector y que todos existan en `drawBars`.

## Un nivel puede no tener senal: el METRONOMO DE LA GRILLA (`gridAt`, `metro`)
`this.beat` y `this.pulse` salen de las cues, o sea que **se apagan cuando la cancion no marca
nada**, y eso no es hipotetico: medido sobre `orbit-motion`, `pulse` > 0.05 cubre el 55% del
buildup, el 19% del break, el **0% del drop2** y el **0% del outro** (21% del nivel: **57.0s de
72.31 apagada**), y `beat` vale 0 el **100% del outro**, que son **28.6s con UN solo evento**.
Todo lo que late con esos dos se congelaba mas de media cancion: la malla se veia igual en el
buildup, en el drop2 y en el outro.

`gridAt(t, g)` = `(1 - frac((t - off)/beat))^2` es la unica envolvente que existe SIEMPRE,
porque no mira las cues sino `songT` y la grilla, o sea que es funcion pura del tiempo igual que
la posicion de todo lo demas. El exponente es **2 y no 1**: con 1 la envolvente es una sierra y
el latido no tiene golpe (media 0.5, y la mitad del beat por encima de 0.5); con 2 la media es
1/3 y el **58% del beat esta por debajo de 0.25**, o sea que pega y suelta como un kick.

    this.lat = metro ? Math.max(this.beat, metro * gridAt(t, lv)) : this.beat

**El metronomo es el PISO y la senal el TECHO**, y por eso `metro` es un numero y no un si/no:
vale **0.45**. Con 1 el metronomo llegaba tan alto como una senal, o sea que la SENAL solo
mandaba el **21.5%** del nivel (0% del outro) y el otro 78.5% era metronomo puro; medido, `lat`
medio daba 0.458 buildup / 0.365 break / 0.566 drop2 / 0.332 outro con **p95 0.94 en todas**
(el pico del buildup salia igual de brillante que el del drop). Topado a 0.45 la senal manda el
**33.4%** y `lat` pasa a **0.319 / 0.195 / 0.460 / 0.150** con p95 0.857 / 0.446 / 0.918 /
0.406, o sea el drop2 **+44% sobre el buildup y +207% sobre el outro**. Consecuencia medida
punta a punta: la amplitud de la ola pasa de variar un 20% entre secciones a **43%** y su alpha
de 21% a **48%**.

De `lat` cuelgan la amplitud de la ola (`0.40 + 0.70*lat`), su alpha (`0.15 + 0.30*lat`), las
bandas del suelo (`0.28 + 0.4*lat`) y la cuna del fondo. **El nivel 1 no declara `metro`**, o
sea que ahi `lat === beat` y no cambia un pixel: tiene cues de sobra y su suelo ya latia.

## El campo de olas de los costados (`drawMesh`)
Una malla de alambre en el **plano del suelo**, a los dos lados de la pista y espejada, del
borde (`edge`) para afuera: adentro taparia obstaculos, que es la queja que arreglaron los
huecos. Es la capa mas de atras del decorado del mundo y es funcion pura de `songT` (las filas
se desplazan con la pista, mismo idiom que las bandas del suelo).

**Las referencias son OLAS, no una reja**, y de ahi sale cada numero:

- **Tres senos de periodo distinto** (en x, en z y en x+z) y no uno: con uno solo las crestas
  quedan paralelas y se lee como chapa acanalada. El de x+z es de periodo largo
  (`2π/0.0017` = **3696**, o sea 4 veces el ancho visible) y su unico trabajo es romper la
  regularidad de los otros dos, que solos dan un damero.
- **Los periodos se miden contra el ancho VISIBLE**, no se eligen. Con `kx=0.0042` (periodo
  1496) y `kz=0.0031` (periodo 2027) entraban **0.58 crestas en el ancho y 0.53 en la mitad
  cercana en z**: menos de una onda entera en cuadro, o sea que eso no ondula, **bascula**. Con
  `kx=0.024` (periodo 261.8) son **3.28 crestas por lado** y con `kz=0.0125` (periodo 502.7)
  **2.13 en la mitad cercana** (4.26 en toda la profundidad). Se probaron 0.016 (2.19 crestas:
  dos lomas, no agua) y 0.020 (2.74) mirando la captura contra las fotos, y gano 0.024.
- **El rizo del campo cercano** (`MESH_KR`, periodo 83.8, peso 0.4 contra 1 + 0.70 + 0.45).
  Medido contando maximos locales sobre el ancho realmente dibujado, con solo los tres senos:
  z=700 daba **1.08 crestas** (z=1500 3.25, z=2500 2.79, z=4000 2.00), o sea que la fila mas
  cercana, la que mide 234px de cresta a valle, era UN LOMO. No se arregla subiendo `kx`: el
  ancho de esa fila en el mundo es 289, asi que meterle 3 crestas pide periodo ~96 y la ola
  saldria de 51px de alto por 48 de ancho, o sea picos. Con la octava puesta z=700 pasa a
  **3.38 crestas** y las otras tres z no se mueven. Y **se apaga con la distancia**
  (`MESH_RIP_Z` = 1000): eso es lo que lo hace gratis en Nyquist, porque donde el paso entre
  columnas ya no lo resuelve (3.2 muestras por periodo a z=1500) el termino vale 0.09 y su
  alias mide **4px**. Corre **contra** el tiempo mientras el oleaje se aleja: ese cruce es lo
  que lo separa del fondo en vez de arrastrarlo.
- **La densidad sale de Nyquist**, no del gusto. Filas cada **70** (eran 260, que con el periodo
  nuevo dan 1.9 muestras, o sea por DEBAJO de Nyquist; y 120 daba 4.2): de 33 a **57 filas**
  cruzando la pantalla, que son las crestas, que es lo que la referencia tiene largo y seguido.
  Columnas: el minimo es 28, pero el numero de verdad sale del **paso en PANTALLA** (16px) y no
  es fijo, porque `proj` es lineal en x y un paso constante en pantalla es un Nyquist constante
  en pantalla, que es donde se ve el alias. Medido: la fila cercana se queda en **28** y las de
  lejos, que cruzan la pantalla entera, piden **35**, y el periodo de la ola nunca baja de
  **3.0 muestras**. Las columnas van repartidas LINEALES y no con `u^1.7`: medido a z=1500,
  **23.1px entre columnas, todas iguales**, contra 17px entre las dos internas y 107 entre las
  dos externas con la potencia. Las lineas de CRUCE van **una de cada 3**: con todas vuelve la
  cuadricula y ademas se duplica el coste.
- **El alto es 120** y no 78: medido a z=1500 y h=651, cresta a valle son `2*amp*fov/z` px, o
  sea **71px con el kick arriba y 32 entre golpes** con 78, y **109 y 49** con 120, que es
  cuando aparecen los valles oscuros de la referencia.

**El color va POR SEGMENTO y con signo.** Antes salia de un `max` POR FILA aplicado a la
polilinea entera, o sea que las 15 filas salian del mismo tono y `MESH_HI` no aparecia nunca: la
ola no tenia crestas encendidas ni valles oscuros, era plana. Con `(v+1)/2` el valle llega de
verdad a `MESH_LO` (`0x063a4a`, bien apagado: con `0x0a6f8c` el valle todavia se leia como linea
encendida) y la cresta a `MESH_HI` (`0x5fffd0`)... pero **con gamma `^0.55`**, porque `v` es una
suma de senos y su distribucion se apila en el medio: medido con la mezcla lineal, la malla
llegaba a **p99 de luma 55.6** y solo **222px del canvas (0.027%)** pasaban de 60, o sea cyan
apagado y no neon. El alpha tambien sale de la altura (cresta 1.35 veces el de la fila, valle
0.5, o sea **2.7 a 1**; antes 0.55..1.30 = 2.4 a 1, poco relieve de lejos), y el techo de 1.5
que se probo daba mas relieve pero subia el p95 de la malla por encima del suelo.

**Y las dos puntas de esa rampa las declara el NIVEL** (`mesh: { lo, hi }` en `LEVELS`, resuelto
en `loadLevel` con `hex2n` igual que `neon` y `sky`). Se lee en las **dos** copias de `tono` que
hay (la de `drawMesh`, que ademas mezcla la niebla, y la de `drawMeshFlat`, que no): parchear una
sola dejaba la camara de perfil en cyan. RESPALDO: `this.lv?.mesh?.lo ?? MESH_LO` y `?? MESH_HI`,
o sea las constantes tal cual, y **el nivel 2 no lo declara**, o sea 0 px. El nivel 1 va a
`#3b2a04` -> `#ffd166` (ver el suelo outrun). **No se puede pintar la reja de un color y las
montanas de otro**: `tono` ata la ALTURA al color y la reja plana esta en `v` = 0, o sea en
`u = 0.5^0.55 = 0.683` de la rampa, que es el color del MEDIO y no un tercer color. Una rampa de
dos puntas no tiene donde meter dos familias.

**El hueco contra la pista es constante en PANTALLA, no en el mundo** (`MESH_GAP` = 90px, o sea
`xi = edge + 90/s(z)`). Con 45 del mundo (20.5px a z=1500) la malla se pegaba a los divisores y
se leia como que CRUZA la pista; con 200 del mundo se arreglaba el fondo y se rompia el campo
cercano, porque 200 del mundo son `200*s` px y a z=300 el **0%** de la fila caia dentro del
canvas (12% a z=700, 54% a z=1100), justo las filas de pixeles mas grandes. Medido, hueco en
pixeles entre el borde de la pista y la primera columna:

    z:            700    1500    2500    4000
    antes (200):  161px   75px    45px    28px
    ahora  (90):   56px   74px    80px    84px

Lo que queda de variacion es la pista, que se angosta con la distancia; el hueco propio de la
malla es plano. Y el borde de AFUERA es **el de la pantalla**, no un tope del mundo: con el tope
en 1400 salian **dos cunas negras** en las esquinas de arriba, medido en el drop2 a y=312
**527px = el 42% de la fila** y a y=332 **328px = 26%**, porque el plano del suelo llega al borde
de cuadro a cualquier z y la malla moria antes. Corregido, esas dos filas quedan en **2-13px y
2-8px, o sea 0-1%**.

**La malla tiene NIEBLA PROPIA** (`MESH_FOG` = 3400) y llega hasta `SPAWN_Z`. Con 1500 el alpha
caia por debajo de 0.05 en z=1870 y la malla moria en el aire, **36px mas abajo que el fondo de
la pista** (pixel mas alto y=322 contra 286), o sea un foso negro a los dos lados; con 2600 se
anulaba en z=3320 y seguia sin llegar. Con 3400 la ultima fila viva cae en z~3890 y el pixel mas
alto pasa a **y=289**, y la cobertura de **2.31% a 5.53%** del canvas. Su alpha va siempre por
DEBAJO del de las bandas del suelo (0.15+0.30 contra 0.28+0.4): la malla es fondo y la pista es
lo que se juega, y esa jerarquia esta medida, no supuesta. Luma media del parche de suelo contra
la de la malla: buildup **24.1 / 21.0**, outro **23.3 / 20.1**, drop2 **34.0 / 24.9** (antes
30.3/30.9, 24.5/25.6 y 39.8/35.3, o sea que la malla le ganaba en dos de las tres). El break
queda empatado en negro (15.7 / 16.1) y se resuelve por p95: **79.5 contra 33.6**, o sea que ahi
lo que se lee es la banda del compas. Con el techo del alpha en 0.60 (lo primero que se probo) la
malla marcaba p95 de luma 92/114/82 contra 79/84/76 del suelo, o sea que le pasaba en las tres.

**En 1a persona se apaga lo que tenes ENCIMA**, con el mismo `pasa(z)` que usan las cajas, pero
**al cubo**: la camara esta dentro de la pista, o sea que la fila mas cercana (a 4 del plano
cercano, s=7.3) proyecta a pantalla entera y sus columnas convergen en un abanico que se derrama
sobre el plano del suelo. Es geometria correcta y se lee como un bug. Crudo no alcanzaba (`pasa`
es lineal hasta 500 y a 94 todavia vale 0.19: medido, 6718 -> 5344px y en la captura se sigue
leyendo igual); al cubo esa fila da 0.007 y el corte de `a < 0.02` que ya existe la tira entera,
mientras que a 400 todavia vale 0.51, o sea que se apaga sin saltar de un frame al otro. Medido:
la malla por debajo de y=340 pasa de **6718px = 1.73% de esa banda a 2549px = 0.66%**, la malla
entera de 6.53% a **6.00%** del cuadro y lo mas bajo que llega de y=557 a **y=454**. La "pared
cyan" de esa camara (L>55 y sat>0.4 sobre el canvas) pasa de **33.2% del cuadro y 57.6% de la
mitad de abajo a 2.6% y 1.2%**, con el nivel 1 de referencia en 5.8% / 1.5%. (Esa referencia se
midio cuando el nivel 1 todavia no encendia la malla; su suelo outrun es ORO, o sea que no cae
dentro de ese criterio de cyan y el numero no se puede reusar tal cual. La medida equivalente para
el nivel 1 con malla es la de 1a persona del suelo outrun: 6.09% / 5.73% del cuadro y lo mas bajo
en y=453.)

**De perfil es el mismo campo, con la profundidad FINGIDA** (`drawMeshFlat`): ahi la x del mundo
no proyecta, asi que la malla entera se dibujaria una fila encima de otra, pero **z ES el eje
horizontal** y la misma ola se lee de canto. Son 14 franjas, cada una un corte de la ola a otra
x del mundo, repartidas en altura con `d^0.75` (lineal se lee como escalera, no como plano en
fuga) y con lineas de cruce, que es lo que las cose en una malla. Antes eran **cuatro senos
sueltos**, sin cruces, con alpha fijo por curva y pasando por DELANTE del reactor. El corte va
**sesgado** (`skew` 1.0) porque a x fija el unico termino que varia a lo largo de la pantalla es
el de z y las franjas salen todas con la misma forma, o sea rayas paralelas; con el sesgo el
termino rapido de x entra en el barrido y cae en **131px de periodo en pantalla**, que bate
contra el de z. Medido: cobertura **1.35% -> 4.73%** del cuadro y **0px dentro de la banda de
juego (y371-469)** antes y despues, o sea que no puede taparte un obstaculo el dia que el nivel
tenga guion. Y el reactor la **TAPA**: `reacAt` dice donde cayo y el alpha se va a 0 dentro de su
disco con 26px de borde blando, **pero solo si el nivel declara `"reactor"` en `decor`**. `reacAt`
es geometria de pantalla y no mira el `decor`, o sea que sin ese gate el nivel 1 con la malla
encendida y la camara de perfil tendria un disco de **~198px de radio sin dibujar** donde estaria
un reactor que no existe. Al nivel 2 no lo mueve: declara `"reactor"` siempre. (El nivel 2 tiene
el mismo agujero en su buildup, cuando el tramo `fx` apaga el reactor pero `decor` lo sigue
declarando. **No se arregla**: moverlo le mueve pixeles y no es esto.)

**Y el `mode` que le llega va ACOTADO**: `this.wave.mode === 2 ? 2 : 0`, no `this.wave.mode`
pelado. Antes la llamada era de tres argumentos, o sea modo 0 fijo; pasarlo crudo le moveria los
pixeles de perfil al nivel 2, que usa modo 1 en su drop2 y su outro. Lo unico que tiene que
atravesar es la cordillera del nivel 1.

Medido de perfil con el suelo outrun puesto (misma isolacion, drop2 y buildup): la capa cubre
**4.05% / 4.04%** del cuadro, vive entre y=32 e y=327, y pone **0 px por debajo de h/2 y 0 px en
la banda de juego** (que de perfil va de y=451 a y=569.5), o sea 124px de holgura contra la caja
mas alta. En 1a persona **6.09% / 5.73%**, con lo mas bajo en y=453 / y=457, el mismo
comportamiento que ya dejo medido el `pasa(z)^3` en el nivel 2 (y=454).

**Coste medido**: `drawMesh` sola son **0.078ms de media, 0.20 p95, 0.90 max** (60 pasadas).
Con la malla estirada hasta `SPAWN_Z` mas la cuna y el resplandor, las llamadas al Graphics
suben de 9056 a 13803 por frame y `draw()` entero de **0.53ms media / 0.95 p95 a 0.59 / 1.05**
(1160 frames del drop2 a x1 sonando): 0.06ms sobre un presupuesto de 16.7.
En el **nivel 1**, encender la capa entera cuesta **+0.20ms de media** (`draw()` con malla 0.787
y 0.828 de media, sin malla 0.658 y 0.567; p95 1.2/1.3 contra 1.7/1.0; dos corridas por lado, 867
muestras utiles cada una, moviendo `songT` a mano por rAF desde t=40) y **0 frames por encima de
16.7ms en las cuatro corridas**. Es mas caro que en el nivel 2 aunque `outrun` evalue 2 senos
contra 4 y salga por `return 0` en la franja plana: lo que sube es el numero de muestras, porque
el `edge` del nivel 1 es 255 y no 340, o sea que hay mas ancho que dibujar por fila.

## El reactor: geometria como DATOS, dos backends (`reactor.js`)
Una helice de tres palas al fondo de la pista, donde cada pala es una pantalla de osciloscopio y
el centro es la fuente. **`reactor.js` no importa Phaser ni sabe que existe una escena**: entra
un estado y salen PRIMITIVAS (`disc` / `ring` / `poly`, tres casos y no doce) en un espacio
propio (viewBox 0..1024, centro en 512,512), y el que dibuja pone la transformada. Por eso el
mismo dato sirve para el juego (`drawReactor`, sobre un Phaser Graphics) y para el SVG estatico
(`toSVG`, que escribe `assets/reactor.svg` desde `tools/reactor-svg.js`): **una sola verdad, dos
backends**. Como no importa Phaser, el backend de dibujo se testea desde node con un doble que
apunta lo que le piden, y eso corre en `test-music.js`. El banco para mirarlo suelto es
`tools/reactor-lab.html`.

Medido: **199 primitivas** (196 mecanicas + 3 ondas), radio maximo **486.0 de 512** (los 26 de
margen son para el glow, que en SVG desborda la forma) y **526 llamadas al Graphics** por frame.
Sobre 1629 frames del drop2, `draw()` pasa de 0.40ms media / 0.70 p95 sin decorado a
**0.53 / 0.90 con solo el reactor**: es la mitad cara de las dos capas nuevas.

- **El metal NO es gris neutro, y eso era lo que hacia que la pieza no se leyera.** Se reporto
  dos veces que "el color del reactor sigue sin verse", y medido **aislando la capa** (mismo
  frame del drop2 con y sin `reactor` en `decor`, restando los dos PNG) la queja era exacta:
  sobre sus 13759 pixeles la **saturacion media era 0.149**, o sea gris con tres manchitas de
  cyan. La luma no era el problema (86.8 de media, p95 199): el chasis es lo mas GRANDE del
  dibujo y no tenia color. `metal` y `metalDark` se van al cyan del nivel (`454545` -> `1e4a57`,
  `2a2a2a` -> `102a33`, hue 193) y **oscuros a proposito**: en la referencia el cuerpo es casi
  negro y lo unico que brilla son las trazas. El halo pasa de `1/0.16 + 0.5/0.26` a
  **`1.7/0.20 + 0.7/0.30`**, en las MISMAS dos pasadas, o sea las mismas **526 llamadas al
  Graphics por frame**: lo unico que cambia son el ancho y el alpha. Medido igual: **saturacion
  0.149 -> 0.308 (+107%), luma 86.8 -> 90.0, p95 199 -> 207** y los pixeles por encima de 100 del
  18.8% al 21.9%. `assets/reactor.svg` se regenera con `node tools/reactor-svg.js`.
- **El dibujo es SIMETRICO respecto del eje vertical y eso es un assert, no una opinion.** El ala
  se construye apuntando arriba, asi que espejar en x=512 tiene que devolver el mismo
  multiconjunto de primitivas (el ala 1 cae sobre si misma y las otras dos se intercambian). Los
  tornillos del nucleo arrancan en -90 y van cada 30 grados, y los tres LEDs rojos van en los
  huecos entre alas (90 / 210 / 330), justo para no romperla. Las tres alas son la MISMA
  geometria rotada 0/120/240: en SVG es un `transform` en el grupo, o sea que editar una es
  editar las tres, y el chequeo compara los cuerpos linea por linea.
- **El `alpha` no es un multiplicador: es una CURVA POR PIEZA** (`DIM`, `a * alpha^d`). La escena
  lo manda al fondo con `alpha` = 0.5 y bajarlo plano apagaba por igual el chasis (que tiene que
  estar oscuro, es metal) y las pantallas y el nucleo, que son la razon de ser de la pieza:
  medido a 0.5 plano y al tamano que tiene en el nivel, **luma media 61.1 y solo el 8.1% de sus
  pixeles pasaba de 100**, o sea una mancha gris. Con la tabla (chasis 2.4 / fondo 1.8 / rejilla
  1.4 / luz 0.5 / traza 0.25 / nucleo 0.15) el alpha efectivo a 0.5 queda en **0.190 / 0.288 /
  0.379 / 0.707 / 0.841 / 0.901**. **En alpha=1 la curva es la identidad para cualquier `d`**
  (`1^d = 1`), o sea que el SVG estatico no se entera, y eso lo afirma el chequeo llamada por
  llamada.
- **El nucleo es ESCALONADO, no difuminado**: cuatro discos OPACOS de radio 78/62/46/30 (coronas
  de 16) con un filo negro de 3 encima que marca donde termina cada uno. Antes eran discos
  semitransparentes (0.16 / 0.30 / 0.50) con glow, o sea la unica mancha borrosa de una pieza que
  por lo demas es toda chaflan y arista. Es el mismo problema que resuelve el casco cromado del
  jugador y de la misma manera: sin degradados en `Graphics`, la luz se hace escalonando. Medido
  sobre el SVG rasterizado a 1024, perfil radial promediado en 6 radios: saltos de mas de 25/255
  en UN pixel de radio, **2 -> 12**, el salto mas grande de **43 a 68** y la pendiente media de
  **4.1 a 9.3**, o sea que no se hizo mas contrastado: se convirtio en escalones. El brillo va
  ARRIBA y es un ARCO de 110 grados, no un disco centrado (centrado se lee como plastico, y un
  disco suelto arriba se lee como un LED mas de los tres que ya hay), y lo unico que respira es
  el halo del punto central, que va de 8 a 34 con el golpe.
- **La traza sale del FFT real, y cuando el FFT esta en CERO se cae a una onda sintetica.** Tener
  `fft` no es tener senal: en pausa, con el transporte muteado o en modo diseno el `AnalyserNode`
  devuelve el array entero en cero y la traza salia una **raya recta**, o sea tres monitores
  apagados justo cuando se esta mirando el nivel. Se mira una vez si hay energia y si no la hay
  se usa la suma de tres senos, que es la misma que dibuja el SVG estatico: el reactor nunca esta
  muerto. Cada ala lleva su fase y su frecuencia de `hash(i)`, o sea que las tres pantallas
  muestran cosas distintas y siempre las mismas, y `test-music.js` falla si salen iguales.
- **Y su fase va en BEATS, no en segundos** (`bt`). Se reporto que las ondas de las pantallas no
  van en sincro, y no iban: la portadora corria a `t * 5.5` rad/s = 0.875 ciclos/s, que contra un
  beat de 0.43796s son **0.383 ciclos por beat**, o sea que la traza volvia a su fase cada 2.61
  beats y el resto del tiempo deslizaba. Con `bt` (beats desde el `off` de la grilla) avanza **1
  ciclo exacto por beat**, y el sintetico de pausa/mute tambien (1 / 2 / 1 ciclos por beat, todos
  enteros). El respaldo de `bt` es `t*5.5/TAU`, o sea la cuenta vieja clavada: el SVG estatico no
  pasa `bt` y sale **byte a byte identico**. `test-music.js` lo afirma comparando los 65 puntos
  con bt=3 contra bt=5 (iguales) y contra bt=3.5 (distintos).
- **El golpe tampoco puede salir de `pulse`**: medido sobre 1200 frames del drop2 de
  `orbit-motion`, `pulse` vale 0 el **100%** del tramo (ese drop no tiene ni un evento de bass) y
  `beat` pasa de 0.02 solo el **31.7%**, con mediana 0, o sea que el jefe estaria congelado justo
  donde mas se lo mira. Lo que si esta vivo siempre que suene algo es el FFT que ya recibe:
  `bass()` es la energia de los 12 primeros bins (0-2067Hz a 44.1kHz con `fftSize` 256), y medido
  en ese mismo tramo da min 0.724, mediana 0.854, max 0.950, y **plegado por fase de beat el pico
  cae en el 1** (0.877 arriba contra 0.808 en el medio): es un latido, no ruido. De ahi salen el
  piso 0.72 y el recorrido 0.23. Los 3 bins de mas abajo solos no sirven: saturan (mediana
  1.000). Sin fft da 0 y el golpe vuelve a ser `pulse`, o sea que el SVG sigue siendo el de
  siempre.

**Donde va lo decide la escena, no `reactor.js`** (`reacAt` / `drawReactor` en el renderer), y va
en espacio de PANTALLA colgado del punto de fuga, no en el mundo con una z fija: la gracia es que
este siempre al final de la pista mire donde mire la camara, y por eso `P` es una semejanza, que
es lo que `drawReactor` asume para medir radios y grosores.

- **Mide `REACTOR_R` = 0.160 del alto**, o sea **30.4% (198px de 651)**. Con 0.3 eran el **57%**
  (371px): el objeto MAS GRANDE de la pantalla estaba en el punto mas LEJOS; con 0.148 (lo de
  antes de pedir "jefe final") **28.1%**. Lo que subio es el estado QUIETO: el del drop ya
  estaba topado por el canto de arriba (ver `REACTOR_SNAP`).
- **El ancla es el fondo REAL de la pista y no el horizonte analitico.** `h*0.36` = 234.4 (donde
  caeria z=infinito) esta **58.1px por encima** de donde la pista de verdad muere, que es
  `proj(0,0,SPAWN_Z).y` = **292.5**: colgado del horizonte quedaban **44-59px de cielo negro**
  entre la punta de la carretera y su borde de abajo, o sea un logo flotando y no el jefe al
  final de la recta. Con el ancla nueva y `REACTOR_UP` = **0.92** el hueco medido pasa a
  **-6 a +17px** (buildup -6, outro -2, drop2 +2, break +11, quieto +17; negativo = la pisa).
  0.92 y no 1 porque el radio del cuadro (91.5px) es mayor que el semialto de lo que se DIBUJA
  (86.5px medido sobre la silueta): lo que tiene que tocar la pista es el borde del dibujo.
- **Sirve en las TRES camaras sin un caso especial**, porque es espacio de pantalla: en 1a persona
  el horizonte es el mismo y queda entero por encima de el (con el 57% de antes habia que
  apagarlo; con 28% no), y de perfil, donde antes cortaba y dejaba el nivel 2 en un vacio negro,
  se cuelga de `h*0.72`. Ahi manda `REACTOR_UP_FLAT` = **2.05** y no 0.92, porque el ancla es la
  linea del suelo: con 0.75 el reactor caia en **y 293..467** y el guion del nivel 2 (su primer
  `block` tiene el techo en y=371) entraria por detras de el. Con 2.2 quedaba en **y 176..350**;
  al crecer el radio un 8% (0.148 -> 0.160) el mismo 2.2 lo subia a 152..350, o sea despegado del
  suelo, que es su ancla de perfil. Con **2.05** el borde de abajo del DIBUJO (0.945 del radio del
  cuadro, medido sobre la silueta) cae en **y=359.5**, 11.5px por encima de los 371.
- **Gira lentisimo**: una vuelta cada 16 compases (**28.0s** a 137bpm), y como las alas van a 120
  grados el ciclo aparente es un tercio (**9.3s**). Con la gravedad invertida **no** se da vuelta:
  es la pista la que cuelga, y un reactor de cabeza en el punto de fuga se leeria como que la
  pantalla se rompio. **Y en los tramos `spin` da un TIRON** de una vuelta entera con ease
  in/out, uno para cada lado (ver `fx`).
- **No existe hasta el DROP, y ahi entra opaco, crece y acelera.** Estaba puesto desde el primer
  frame, o sea que el jefe del fondo se veia entero durante todo el buildup y entrar al drop no
  lo estrenaba. Ahora es un tramo `fx` (`{ kind: "reactor", from: 68, to: 164 }`) y lo que se
  mueve va colgado de `hype`: `REACTOR_A` **0.5 -> 0.85** (efectivo por pieza, con la curva `DIM`:
  chasis 0.69 / fondo 0.75 / rejilla 0.80 / luz 0.92 / traza 0.96 / nucleo 0.98, contra 0.19 /
  0.29 / 0.38 / 0.71 / 0.84 / 0.90), `REACTOR_GROW` **0.34** (de 0.160 a 0.214 del alto, o sea
  30.4% -> 40.7% de diametro) y el giro **x3** en el pico (28.0s -> 9.3s de vuelta) mas 0.12 rad
  de tiron con el latido. Todo dentro de `reacAt`, que es de donde salen tambien los anillos, los
  rayos y el haz: dos copias de la cuenta se separan el dia que el reactor se mueva, y se mueve.
- **Y se mueve: `REACTOR_SWAY` = 0.22 de su radio en x y `REACTOR_NEAR` = 0.06 mas
  `REACTOR_NEAR_Y` = 0.30 de acercamiento.** Se pidio que no este clavado en x y que a veces se
  acerque. Los dos van en **fraccion de su propio radio**, o sea que no hay que re-medirlos si
  cambia `REACTOR_R` ni cuando la creciente lo agranda, y los periodos son **4 y 8 compases** y no
  uno solo: con el mismo periodo el vaiven y el acercamiento pican juntos y se leen como UN
  movimiento. **Acercarse es sobre todo BAJAR**: con `hype`=1 el radio ya mide 103.4 de los 122.4
  que caben hasta el canto, o sea que el tamano no tiene de donde crecer sin salirse del cuadro o
  sin pisar al fogonazo, que es lo mas grande del nivel y esta topado; hacia abajo hay pantalla de
  sobra y el borde se mete 0.275 radios por debajo del final de la pista, muy por encima de la
  banda de juego. Medido en el drop2: el centro barre **+-23.4px** de un canvas de 1248 y el
  diametro va de **40.7% a 43.1%** del alto.
- **El CASCO cierra el disco** (`shellParts` en `reactor.js`): anillo dentado de 12 dientes mas
  tres tirantes al nucleo. Las tres alas dejan huecos de **84.8 grados** entre ellas, o sea que el
  dibujo tapaba el **44.7% de su propio disco** y el pixel mas bajo oscilaba entre **354 y 488** a
  lo largo de una vuelta: la pieza se despegaba del final de la pista la mayor parte del tiempo, y
  eso es lo que la hacia leerse como un logo. Los tirantes van en **90 / 210 / 330**, los mismos
  angulos de los LEDs, o sea justo por los huecos y **sin romper la simetria** respecto de x=512,
  que el chequeo sigue afirmando. Y **gira al reves que las alas y mas lento** (`SHELL_SPIN` =
  0.55): dos cosas girando igual se leen como una sola pieza. Con el casco son **232 primitivas**
  (229 mecanicas + 3 ondas) y **596 llamadas** al Graphics por frame.

## La CRECIENTE es por FILAS y va aparte del latido (`hype`, `hypeAt`)
Lo unico del render que no es un latido sino un **arco de varios compases**. `hype` es una lista
de tramos de filas con de donde sale y a donde llega (`{from, to, a, b}`); fuera de un tramo se
queda en el `b` del ultimo que paso, o sea que "sube y despues se queda arriba" es un tramo y no
dos. El nivel 1 no la declara: vale 0 y no cambia un pixel.

**La creciente NO es de volumen y eso esta medido.** El RMS por compas del buildup de
`orbit-motion` se mueve **+0.62dB del compas 0 al 15**, con **3.16dB** entre su minimo y su
maximo, y el maximo cae en el compas **13, no en el 15**; una rampa lineal y una exponencial
ajustan igual de mal (**R2 0.276** las dos). Lo que si sube monotono es el BRILLO y lo que baja
es el GRAVE: el sub (<60Hz) va de 0.0578 a 0.0075 (**-17.77dB**) y el centroide espectral de
758Hz a ~1400Hz. Por eso de `hype` cuelgan cosas que ACLARAN y AGRANDAN (el tamano y el giro del
reactor, la apertura de los anillos, cuantos rayos salen, el empujon de las formas) y ninguna que
suba el volumen de un latido.

Los tramos del nivel 2 siguen a las secciones MEDIDAS (buildup f0-f61, break f62-f67, drop2
f68-f99, outro f100-f164; la seccion se mira a mitad de beat) y `test-music.js` falla si un tramo
cruza una seccion. El break **cae a 0.12** a proposito: es donde habla el cantante y vuelan las
letras, y con el decorado arriba no se lee ninguna. El drop2 entra de golpe en 1 con un tramo de
UNA fila: un drop no es una rampa, es un corte.

**Pero no cae al entrar el break, sino con la FRASE.** Se reporto que "todos los efectos del
buildup se paran en el #73 y tienen que llegar al #78": la seccion empieza a mitad de la f62 y la
frase entra en la **f63**, asi que la creciente se queda arriba (a=b=1) hasta la f63 y recien de
la f64 a la f67 cae a 0.12. Lo mismo hacen las otras tres cosas que cortaban antes de tiempo: el
gate llega a la f62 (era f60), el `dark` arranca en la f63 (era f62) y la ola se apaga DENTRO del
break (1.2 -> 0) en vez de desaparecer de una. La seccion dice donde SUENA otra cosa; donde se
apaga la luz lo dice el evento.

## Tramos de efecto por fila (`fx` en `LEVELS`, `fxOfRow`)
Hermanos de `sectors` y `zones`, y **no** del `script`: en el `script` un `row`/`tile` CREA un
obstaculo y un `at`/`from`/`to` direcciona cues `#n`, y ninguna de las dos cosas es "de la f10 a
la f19 la imagen se corta". Diez tipos, todos por fila.

**Ya no es una lista solo del nivel 2**: el nivel 1 declara `fx` con dos tramos de `neg` y con
nada mas, y eso es un assert (`test-music.js` falla si al nivel 1 se le cuela un tramo que no sea
`neg`). Declarar la lista no enciende nada de lo demas: el unico sitio que mira la lista entera es
`this.reac = !this.lv?.fx ? 1 : ...` y `loadLevel` ya devolvia `fx: []`, o sea que el nivel 1 ya
tomaba esa rama antes de declararla; todos los demas `fxo(...)` buscan por `kind` y no encuentran
el suyo.

- **`gate`**: la imagen se corta a tiempo (ver abajo).
- **`dark`**: negro entero, el mismo apagon que el `flash` del nivel 1 pero declarado por fila en
  vez de por seccion. En el nivel 2 es el break, de la **f63** (no la f62: los efectos del
  buildup llegan hasta el primer "let the bass", ver `hype`) a la f67.
- **`snap`** (el fogonazo del snare): una FILA sola y **dentro del `dark`**, y se dibuja DESPUES
  del negro, o sea que el orden de dibujo ES el efecto. Fuerza tres cosas que ahi no estarian:
  el reactor (que no existe hasta el drop), los rayos y el fantasma. Dura `SNAP_T` = **0.30s =
  0.685 beats** con envolvente `(1-p)²` desde el arranque de su fila, o sea que se apaga dentro
  de su propia fila y no toca el drop; `test-music.js` falla si dura mas de una fila, si cae
  fuera de un `dark` o si es su ULTIMA fila (ahi el flash se comeria el arranque del drop).
  Cuantos rayos salen va **forzado** (`nOver`) y no por `hype`: en la f66 `hype` vale 0.41, o sea
  `1 + round(3*0.41)` = **2 rayos**, y un fogonazo de dos rayos no es un fogonazo.
  **Y es lo mas GRANDE del nivel, no un detalle**: `SNAP_ARCS` = **8** rayos con `big` = 1 (x1.6
  de largo, x1.8 de grosor), `REACTOR_SNAP` = **0.25** sobre el radio y el reactor a **alpha 1**
  en vez de su 0.5 de siempre. Medido aislando las dos capas en el pico (t=28.97): el reactor
  pasa de **10191px y 31.7% del alto de pantalla a 17190px y 41.5%**, o sea **mas grande que en
  el drop** (37.0%), y los rayos de **12414px / 30.5% a 52184px / 66.5%**, o sea x4.2 en pixeles.
  **El 0.25 es 0.35 re-medido cuando `REACTOR_R` subio de 0.148 a 0.160**, y no un recorte: el
  techo para que el borde de arriba no se salga del canto escala con el radio, o sea que el 0.35
  de entonces pasa a `S <= 0.287` y se saldria del cuadro. En pantalla el fogonazo mide LO MISMO
  (`1.898*0.160*1.1394*1.25` = **43.25%** contra `1.898*0.148*1.1394*1.35` = 43.20%).
  **En el fogonazo los rayos caen hacia ABAJO** aunque salgan del reactor: hacia arriba el
  reactor esta a 130px del canto y los 8 se iban de cuadro enseguida (medido: caja de **247x88**,
  mas chica que la del rayo suelto de antes). Abajo tienen la pantalla entera, sigue siendo una
  de las tres familias de `arcDir` y ademas les da la pista para caer encima.
- **`reactor`**: fuera del tramo el reactor no se dibuja. Sin `fx` declarado esta siempre puesto,
  o sea que el nivel 1 no se entera.
- **`beam`**: el haz que sale del nucleo (`mode` 0 recto, 1 el del final).
- **`ghost`**: el nivel entero en blanco y negro, sin depender de `GHOST_ROW` ni de las marcas.
- **`spin`** (el tiron de las helices): el reactor da `SPIN_TURNS` vueltas dentro del tramo con
  ease in/out (`p²(3-2p)`, o sea smoothstep) y `dir` dice para que lado. **Vueltas ENTERAS y no
  una fraccion**: el extra vuelve a 0 al salir del tramo y solo con vueltas enteras eso cae
  exactamente en la orientacion donde arranco (con media vuelta habria un salto). Se pidieron dos
  tramos, del mismo largo y girando para lados contrarios: son la **f75-f76** (el `#86`->`#89`) y
  la **f91-f92** (el `#106`), o sea **2 filas = 0.876s** cada uno, y `test-music.js` falla si
  dejan de ser dos, de durar lo mismo o de girar para el mismo lado. Medido en 8 puntos del
  tramo: 0 / 0.043 / 0.156 / 0.316 / 0.500 / 0.684 / 0.844 / 0.957 de vuelta.
- **`jolt`** (la sacudida de cada marca del acid): tres cosas por marca, y solo UNA es el golpe.
  El golpe es el nivel entero a **fantasma** durante `JOLT_B` beats con envolvente lineal; lo que
  **se queda** (o sea la variacion que se pidio) es que la paleta `neon` ROTA una posicion y que
  la ola cambia de `mode`. Medido en el drop2: 30 indices de marca distintos, las **4 paletas** de
  `neon.fam` y **los dos modos** de ola, con 28 golpes a 1.99Hz.
  **`JOLT_B` = 0.18 y no 0.35**, y sale de medir el tramo del drop donde todavia hay color
  (f68-f89, 9.64s: de la f90 para adelante el nivel ya esta declarado en `ghost`): con 0.35
  (153ms) ese tramo quedaba **46.9% en blanco y negro** (31.4% puesto por el jolt) parpadeando a
  2.08Hz, o sea que el golpe se comia justo el color del reactor y la deriva de tono. Con 0.18
  (79ms, ~5 frames a 60fps) son **31.4% de fantasma y 16.0% del jolt**.
  **El indice de marca tiene que ser el GLOBAL** (`this.lv.cues`) y no el de `near()`: con las
  cues de alrededor del jugador `mk` se quedaba clavado en 1 durante todo el drop2, o sea que la
  rotacion de paleta no existia.
  **Y el cambio de `mode` es un XOR, o sea que solo esta definido sobre el par 0/1**: con el modo
  2 (la cordillera outrun) `2 ^ 1` da **3**, y el `if (mode)` de `meshWave` pregunta por verdadero
  y no por igualdad, o sea que el nivel 1 dibujaria el AGUA del nivel 2 en la mitad de sus marcas.
  Por eso va gateado: `if (this.mk & 1 && this.wave.mode < 2)`. El nivel 2 solo declara modos 0 y
  1, o sea que ahi la condicion nueva es siempre verdadera y no cambia un pixel. Gatearlo por "el
  nivel declara `jolt`" no sirve: el problema no es quien lo dispara sino sobre que par esta
  definido el xor.

- **`neg`** (el negativo): la imagen entera invertida, y es **el MISMO motor que el gate con otro
  `kind`** (`gateAt(t, lv, "neg")`), o sea que trae gratis `div`, `cut` y `ramp` y late con la
  grilla en vez de estar puesto. Se aplica en la **misma puerta** que el fantasma y la deriva de
  tono (`fantasma()`, los dos envoltorios de `fillStyle`/`lineStyle`), o sea que ninguna de las
  20 funciones de dibujo se entera. Dos cosas que no son elegibles:
  - **va ULTIMO, envolviendo al fantasma y a la deriva**. Medido con el cyan del nivel: fantasma
    solo da `#2c2c2c`, invirtiendo ANTES da `#1c1c1c` (o sea que el fantasma se come el
    negativo) e invirtiendo DESPUES da `#d3d3d3`. Y rotar el tono de un color ya invertido lo
    manda a otra familia, o sea que la deriva medida deja de ser esa. Verificado **en pantalla** y
    no solo en la cuenta: forzando el fantasma (`__dbg.ghostKey`) dentro de un tramo `neg` del
    nivel 1, la luma media pasa de **20.2 a 234.7** y los grises salen complementarios exactos par
    por par (251/4, 249/6, 247/8, 244/11, 241/14: todos suman 255), con el 97.8% del cuadro en
    gris en los dos casos.
  - **`KILL` NO esta exento**, al reves que en la deriva de tono: `^0xffffff` es una isometria,
    asi que invertirlo conserva su separacion exacta contra el decorado (**239 minima, 153
    grados**, los mismos numeros que en normal); eximirlo la hunde a **86.0 y 2 grados**, o sea
    que lo que mata se confundiria con el fondo.
  - **Y no es solo del nivel 2: el nivel 1 declara DOS tramos** (`music.js`), uno entrando al
    nivel y otro saliendo: `f40-f55` con `cut` 0.08 y `ramp` 0.30, y `f204-f219` con 0.10 y 0.36.
    `div` = **1** (un corte por beat) y no 4: a 130bpm son **2.167 destellos por segundo**, o sea
    por debajo de los 3/s de la WCAG 2.3.1, y un negativo a pantalla completa es lo que mas
    parpadea del nivel. Medido fila por fila (fraccion del beat con la imagen invertida):

        f40-f55    8.0 9.5 10.9 12.4 14.0 15.4 16.9 18.3 19.7 21.2 22.7 24.1 25.6 27.1 28.6 30.0
        f204-f219  10.1 11.8 13.5 15.3 17.0 18.7 20.5 22.2 23.9 25.6 27.4 29.1 30.8 32.6 34.3 36.0

    o sea **19.0% y 23.0%** de cada tramo (7.385s cada uno) y **3.05% de los 101.54s** de la
    cancion. Lo que NO se toca: la **f56-f63** (los blinders f56-f59, el apagon f60-f62 y el beat
    del fantasma f63, tres efectos a pantalla completa ya medidos) y el drop y el drop2, donde el
    fantasma esta puesto el 23.3% del tramo y el negativo lo **envuelve**, o sea que se sumarian
    dos filtros.
    La separacion de `KILL` medida sobre los **28 colores que el nivel 1 declara** (bg, malla,
    `neon`, capas y sectores) da **32.1 de RGB y 11.3 grados**, y **el mismo numero exacto
    invertida**, que es lo de la isometria de arriba. Contra los **12 que estan realmente en
    pantalla dentro de los dos tramos** (ahi no hay `neon.sec` ni los otros 13 sectores) son
    **141.4 y 59.8 grados**, tambien identicos invertidos.
- **`grid`** (la pantalla por cuatro): el cuadro dibujado, copiado a una **rejilla 2x2**. Ver
  `setGrid` abajo.

**`decor` y `fx` no son lo mismo y por eso `dark`/`snap`/`beam`/`ghost` no van en `decor`**: `decor` dice
que puede encenderse en todo el nivel y `fx` **cuando**. El reactor si esta en las dos listas
porque el tramo solo lo apaga.

### El GATE: `cut` es lo CERRADO, y `ramp` es la creciente
`gateAt(t, lv)` da 1 abierto y `floor` cerrado, con la fase sacada de la grilla y no de un
contador: rebobinar lo rebobina y toda la pantalla va en la misma fase. `div` son los cortes por
beat (4 = semicorcheas) y **`cut` es la fraccion de cada corte que esta CERRADA**, no abierta. El
sentido importa: con `duty` (lo abierto) el valor natural es 0.5 y la pantalla se pasa la MITAD
del tramo en negro, o sea que no se lee como un tajo sino como un apagon intermitente; con `cut`
el valor natural es chico y lo que se ve es un corte sobre una imagen que esta.

`ramp` es el `cut` al final del tramo, o sea que **el gate mismo hace la creciente**. Medido
(fraccion del beat con la imagen cortada, fila por fila):

    rafaga #7  f10  18.2%     rafaga #30-#35  f32  12.0%
    rafaga #9  f19  18.1%                     f35  12.0%
    creciente  f36 5.0% -> f42 12.3% -> f48 19.6% -> f54 26.8% -> f60 34.1%

Los dos tramos cortos salen de donde el schema ya tenia una **rafaga** marcada (el `response1` de
la f10 y el `snare` de la f32-f34): el gate es el tramo, la rafaga es el aviso. El del snare va al
doble de rapido y **no cierra del todo** (`floor` 0.08): son 5 golpes en 3 filas y a negro seco se
lee como que se cuelga el juego.

Se dibuja como un negro POR ENCIMA de todo y no apagando el Graphics: apagarlo se llevaria el
marco y el HUD, y lo que tiene que parpadear es la imagen, no el juego. Los textos (HUD, filas,
tira) sobreviven al gate y al apagon igual: son herramientas. Jugando (`?play=1`) esos tres no
existen y el unico texto que queda es el cartel de la muerte, que sobrevive por lo mismo; y
**muerto el gate se abre**, porque su fase sale de `songT` y `songT` esta congelado (ver la
seccion de la muerte).

### La PANTALLA POR CUATRO es una TEXTURA, no cuatro camaras (`grid`, `setGrid`)
El cuadro entero repetido en una rejilla 2x2. La forma "de manual" en Phaser son cuatro camaras
con `setViewport` + `setZoom`, se escribio, se midio y **se tiro**: `GraphicsWebGLRenderer`
recorre el `commandBuffer` ENTERO una vez **por camara**, o sea que el coste es de CPU y encima
**no se ve en `draw()`**, que ya termino. Medido en el tramo de la grilla (260 frames, `draw()` +
`renderer.render` sumados, moviendo `songT` a mano por rAF):

    sin grilla        5.89ms media / 6.6 p95 /  7.9 max     0 frames sobre 16.7
    4 camaras        16.47        / 17.7     / 44.2        60 de 258 frames sobre 16.7
    esto (textura)    5.96        /  6.7     / 15.4         0 frames sobre 16.7

O sea: la version nativa **cuadruplica el trabajo** y se come el presupuesto entero; la textura
cuesta **+0.07ms de media** porque el Graphics se recorre UNA vez y las otras tres copias son un
blit. Se dibuja normal, se copia a un `RenderTexture`, se esconde el Graphics y se pintan cuatro
`Image` de esa textura a `setScale(0.5)`.

- **Los TEXTOS no se duplican y eso es a proposito**: se copia solo `this.g`, y los cuatro quads
  van a `depth` -1, o sea por debajo del HUD, de los numeros de fila y de la tira. Cuatro HUDs no
  son un efecto, son cuatro HUDs. Es la misma regla del apagon y del gate: los textos son
  herramientas.
- **`rt.draw(g)` ignora `visible`** (`DynamicTexture.batchGameObject` llama a `renderWebGL`
  derecho), asi que esconder el Graphics **antes** de copiarlo no rompe la copia: por eso el
  orden que hay es el que hay.
- **El `RenderTexture` se crea la PRIMERA vez que se enciende**, no en `create()`: el nivel 1 no
  declara el tramo, o sea que ahi no existen ni la textura ni los cuatro quads (verificado: sin
  `rt`, sin `quad`, sin la textura `gridRT` y con `g.visible === true`).
- **El tamano se rehace cada frame** con la `w`/`h` de las que sale todo el resto del dibujo, en
  vez de colgarse de un `resize`: redimensionar ya esta contemplado y no queda un segundo sitio
  que se pueda desincronizar.
- El tramo del nivel 2 es la **f24-f31**, o sea los compases 6 y 7 enteros (8 filas = 3.504s):
  son las unicas 8 filas del buildup sin nada mas declarado encima, no tienen ni una marca (las 4
  de la f20-f31 son la entrada del acid) y solo 4 golpes de `bass`. `test-music.js` afirma que el
  **nivel 1 no lo puede declarar** (ahi no se crea ni una camara de mas) y que el tramo **no cae
  dentro del apagon ni cruza de seccion**.

## El CONTRATIEMPO sale de la GRILLA, no de una cue (`hatAt`, `HAT_K`)
`hatAt` es `gridAt` medio beat corrido, o sea que pica en `off + (n + 0.5) * beat`. De ahi sale el
blanco a pantalla completa de la otra mitad del compas (`drawHat`, `HAT_A` = 0.14 y no 0.22 como
el del kick: cae el doble de veces y al mismo alpha el cielo se queda gris).

**Que el hat esta ahi esta medido, no supuesto**: el transitorio agudo de `orbit-motion` cae en la
fase **0.505 del beat** y lo hace en los CUATRO tiempos por igual (dispersion entre ellos
1.08-1.14: si fuera el 2 y el 4, dos de los cuatro tendrian que estar en el piso y ninguno lo
esta). Es la corchea fuerte de una grilla de semicorcheas, cuyas otras subdivisiones miden
0.26-0.52 de su amplitud.

**Y el `bass` marcado a mano NO es el kick.** El audio tiene un kick real en la fase 0.0 en el
**95.8% de todos los beats (158/165)** y en **31 de los 32 beats del drop2, donde `bass` no tiene
ni un evento**: el golpe del suelo tiene que salir de la grilla y no de una senal que ahi no
existe. (La banda de 35-100Hz no sirve para detectarlo: el bajo sostenido del acid la domina y da
un +77ms falso. 120-400Hz los separa limpio, y ahi el kick cae +2.9ms y el hat +2.0ms contra `off`
sin deriva en 72s, o sea que no hay sesgo que corregir.)

El exponente por defecto es **4 y no 2**: `gridAt` es una sierra, o sea que medio beat despues de
su pico todavia vale (1/2)^k. Con k=2 eso es 0.25, y por el alpha del blanco da 0.035 puesto en
pantalla el beat entero, o sea un velo permanente en vez de un golpe; con k=4 el piso queda en
0.0088, por debajo del corte de 0.01 del renderer. El hat **se corta en el break**: ahi vuelan las
letras y un estrobo encima no deja leer ninguna.

## Laseres y rayos NUNCA juntos: manda el COMPAS (`arcTurn`)
Regla dura del nivel entero, no del buildup: el rig (`drawRig`) y los rayos (`drawArcs`) **no
pueden estar en pantalla a la vez en ninguna parte**. Estaban mezclados y no un poco: medido
sobre la cancion entera a pasos de 10ms, el rig estaba encendido el **50.3% del buildup y el
100% del drop2**, y los rayos eran un **subconjunto estricto** de eso, o sea que **el 100% de
los frames con rayo tenia laseres debajo** y el relampago se leia como una viga mas del abanico.

`arcTurn` = el numero de COMPAS es impar (y el nivel declara `arcs`). Compas impar rayos, compas
par laseres, y el mismo dial apaga el rig en sus DOS llamadas (la de antes del suelo y la de
`rigOver`): con una sola, el nivel 1 y el 2 se comportarian distinto. Es funcion pura de `songT`
y de la grilla, como todo: rebobinar devuelve el mismo compas. Medido con el dial puesto:
**rayos 49.1%, laseres 19.5%, LOS DOS 0.0%** de punta a punta, y por seccion buildup 48.0/23.0,
break 45.3/0.0, drop2 49.8/50.2, outro 49.8/1.2.

Los IMPARES son para los rayos y no al reves porque ahi caen **36 de las 60 marcas del acid**,
que es lo que los dispara (`mark²`): en los pares el rayo saldria la mitad de veces.

El fogonazo del snare (`snap`) es la excepcion y no hace falta que la pida: cae dentro del
`dark`, donde el rig no se dibuja de todas formas.

## La geometria de los efectos vive aparte (`fx.js`)
Mismo idiom que `reactor.js`, un escalon mas abajo: **no importa Phaser y no sabe que hay una
escena**. Entra estado, salen PUNTOS en un espacio 0..1, y el que dibuja pone la transformada; por
eso se comprueba desde node (determinismo, cantidad, que no se salga de su caja) y por eso el
mismo rayo sirve saliendo del reactor o pegado al suelo. Aca no hay backend SVG, o sea que no
hacen falta primitivas y alcanza con los puntos.

- **`bolt(seed, lv, jag)`**: desplazamiento del punto medio, `lv` veces. Con lv=5 son **33
  puntos**. El desplazamiento se **divide** por el nivel (`jag/(l+1)`): con amplitud constante el
  ultimo nivel manda y el rayo sale peludo, o sea ruido alrededor de una recta.
- **`arcDir(seed, dn, all)`**: el rayo **NUNCA es horizontal**. La pista es una fuga vertical, o sea
  que lo unico horizontal de la pantalla es el horizonte, y una descarga paralela a el se lee
  como una grieta en el render. El angulo se mide desde la VERTICAL y solo hay **tres familias**
  (`k` = -1 / 0 / +1): arriba-izquierda, arriba y arriba-derecha, que son exactamente las tres
  direcciones pedidas. `ARC_TILT` = **30 grados** desde la vertical y `ARC_JIT` = **10** de
  sorteo, que no es cosmetico: con las tres familias secas los 8 rayos del fogonazo caen
  encimados en tres rectas. El peor caso es 30+10 = 40 desde la vertical, o sea **50 grados sobre
  la horizontal**, y medido sobre 20000 semillas el minimo real es **50.0** con las 3 familias
  presentes; `test-music.js` falla por debajo de 45. `dn` es solo de que punta se dibuja la misma
  recta: -1 sube (desde el reactor), +1 baja (desde el canto de arriba, o el fogonazo).
  **`all` = las SEIS familias**, o sea las tres de arriba MAS las tres espejadas hacia abajo. Se
  reporto que los rayos del reactor "solo van hacia arriba" y que tienen que salir "desde todos
  los ejes desde el centro": un nucleo de plasma irradia en redondo, no en abanico. **Espejar no
  rompe la regla de arriba, la CONSERVA**: el peor caso sigue siendo 40 desde la vertical, o sea
  **50.0 desde la horizontal medido sobre 20000 semillas**, con el reparto parejo entre las seis
  (3411/3372/3340/3368/3302/3207) y el rayo yendo para abajo en vez de para arriba. Seis y no un
  angulo libre porque un sorteo continuo pasa por el horizontal, que es justo lo prohibido.
  Lo pide el rayo del reactor (`arcs`); el del canto de arriba y el del fogonazo siguen con las
  tres, que ya salen de una punta fija.
- **`forks(seed, n)`**: las ramas, cada una su propio `bolt`. Son lo que separa una descarga de un
  cable doblado, y cada una lleva SU geometria: recalcular la misma semilla para las tres dibujaba
  tres veces la misma rama.
- **`pyras` + `pyraFaces`**: las piramides del estallido. El recorrido es **`1 - (1-p)^2`** y no
  `p` (sale de golpe y FRENA, que es lo que hace un trozo de metal contra el aire; lineal se lee
  como que flotan), la `y` va aplastada 0.62 con caida, y son **14 y no 22** porque una piramide
  con dos caras ocupa mas que un rombo plano y con 22 el estallido se lee como confeti.
  Lo que la hace un volumen son **dos caras con distinto gris** (1 y 0.42) compartiendo la arista
  `apice - esquina de adelante`, no el contorno: sin esa esquina esto es un triangulo plano.

## Las capas del nivel 2 (`rings`, `arcs`, `burst`, `beam`, `lights`, `hat`, `gate`, `rig`)
Todas por `decor`, o sea que el nivel las enciende y el renderer no elige. Ninguna toca la fisica.

**Aca vivia `spectro`** (la `wave()` del reactor estirada de lado a lado por detras, 5 lineas
apiladas, medida en **4.63% del cuadro**). Se saco entera a pedido: el fondo del drop2 ya tiene
malla, anillos y el reactor, y una onda mas cruzando el cielo es ruido. `drawSpectro` no queda
comentado ni apagado por dial: se borro. El FFT que la alimentaba sigue en las pantallas del
reactor, que es de donde salio.

- **`rings`** (resonancia metalica): salen del punto de fuga hacia afuera y su parallax es
  **radial** (`songT * speed * RINGS_K`), por eso no pueden ser una capa de `layers`: esas se
  desplazan de costado y un anillo desplazado deja de ser concentrico. Se cuelgan del centro del
  REACTOR y no de la pantalla (la resonancia sale de la pieza que la produce, y crecen con el sin
  una segunda cuenta), van aplastados en y (0.62: circulos perfectos se leen como un blanco de
  tiro pegado a la lente) y se apagan dentro del reactor y en el borde del cuadro. Se reporto que
  se ven de mas: su alpha esta **a la mitad** (0.05 + 0.13\*lat contra 0.10 + 0.26) y ademas ya no
  aparecen en el buildup, porque cuelgan de un reactor que no existe hasta el drop.
- **`arcs`** (rayos electricos): salen del reactor con `mark²` y no con `markWin`, porque la
  ventana del acid esta abierta el 40% del buildup y el 69% del drop2, o sea que de ventana los
  rayos estarian puestos media cancion. Al cuadrado es el ATAQUE. Cuantos salen lo dice `hype` (1
  al principio, `1 + ARC_N` en el pico) y la semilla es el numero de BEAT, no el frame: un rayo
  nuevo por frame es ruido blanco. Y **se afina y se
  apaga hacia la punta** segmento a segmento (`(1-u)^0.7`): con las pasadas de ancho fijo se leia
  como un cable pegado al reactor, que es lo que se reporto.
  **De donde salen no siempre es el reactor**, porque el reactor no siempre esta: en el buildup
  entra recien en la f68, o sea que los rayos marcaban un sitio vacio. Con reactor en pantalla
  salen de el hacia ARRIBA; sin reactor caen desde el canto de arriba. Son las **dos unicas**
  puntas posibles, porque la direccion ya no es libre (ver `arcDir`, abajo): los otros dos
  origenes que hubo (de los costados al centro, y del carril del jugador hacia los lados) daban
  rayos de **mediana 10.1 y 17.2 grados sobre la horizontal**, o sea justo lo prohibido.
- **`burst`** (esquirlas): estalla en las cues de rol `fx`, o sea justo en las **rafagas** que no
  pueden llevar la luz del nivel. Dura `BURST_T` = 0.55s y el sitio sale de `hash(c.t)`. El color
  **no sale de la paleta**: son gris y negro (metal).
  Se reporto que "a veces se ven y a veces no", y eran dos cosas: gris y negro sobre una pantalla
  llena de cyan no se despegan de nada, asi que el estallido **manda el nivel entero a fantasma
  mientras dura** (en blanco y negro el metal es lo unico que hay); y cada esquirla lleva **dos
  pasadas de halo blanco** por debajo del relleno. Medido en el estallido de t=14.25 (bbox
  115x90px, 14 esquirlas): el halo toca **5558px = 0.68% del cuadro** y dentro de esa caja la
  luma media pasa de **51.1 a 64.1 (+25%)** y el p95 de **169 a 190**, o sea que enfoca sin
  repintar la pantalla.
- **`beam`** (el haz del nucleo): es lo unico que conecta al jefe del fondo con la pista.
  **Dispara y no esta puesto, y eso hay que medirlo en SEGUNDOS**: con la envolvente `(1-p)²`
  normalizada al hueco entre disparos, el corte `e < 0.03` se cumple en `p <= 1 - sqrt(0.03)`, o
  sea el **82.7% de CUALQUIER division** por construccion, y el haz estaba en pantalla el
  **48.6% de la cancion** (7232 muestras a 10ms). Con `BEAM_T` = 0.35s y el periodo en un COMPAS
  (dos beats en el `mode` 1) cada disparo dura **289ms = 0.66 beats**, duty **16.5% del drop y
  33.0% del outro**, **17.6% de punta a punta**, y son 42 disparos en vez de 172.
  **APUNTA A UN CARRIL y BARRE**, no al centro: el objetivo va en el PLANO DEL SUELO (mismo idiom
  que las bandas de la pista), sale del carril `a` alla lejos y llega al `b` encima tuyo, con el
  parametro del barrido `q = 1 - e`, o sea el complemento EXACTO de la envolvente: sale de golpe
  y frena, y no hay una segunda cuenta que se pueda desincronizar. Antes el **100%** de los
  disparos era simetrico a `w/2`, y con 4 carriles ahi no hay ninguno: el recto pegaba en el
  DIVISOR entre el 1 y el 2, y su objetivo `(w/2, h)` cae en **z=558, detras del jugador**
  (`PLAYER_Z` = 720). Medido a 1248x651: el impacto recorre **332px** (268 en x, 196 en y) y el
  haz gira de **16.5 a 63.0 grados** segun el par de carriles (media 34.9).
  Cada disparo son **tres conos** de `BEAM_PW * s` (2.3 ancho y tenue / 1 el cuerpo / 0.36 el
  nucleo), o sea que el cono mide **lo que mide su propio charco** (16/45/103px a z=2600,
  51/143/328 a z=815; antes eran 124.8px de semiancho fijo a cualquier distancia, o sea un
  triangulo plano sin fuga pegado a la pieza), mas la **boca** blanca en el nucleo y el **charco**
  en la superficie, proyectado por sus cuatro esquinas, o sea en trapecio como las bandas.
  El **anillo** que era una de las tres formas **se fue**: `drawRings` ya dibuja eso mismo,
  colgado del mismo centro y con el mismo aplastado, o sea que era un duplicado, y encima era la
  unica forma que no tocaba la pista, que es lo unico que se le pide al haz. Queda uno o dos
  (`BEAM_PAIR` = 0.4) y el segundo barre **al reves**: se cruzan en la mitad del disparo en vez
  de ser un par espejado.
- **`lights`** (luces de pista de aterrizaje): en el plano del suelo, por fuera del carril de
  afuera (`edge + 120`) y por dentro de la malla. Es la misma idea que la X de los huecos del
  nivel 1: una luz cada **medio beat** con el chase de `CHASE` por encima, o sea una ola y no
  cuatro lamparas parpadeando por su cuenta (el paso es medio beat porque el chase cicla cada 4:
  a una por beat la ola tarda dos beats y se lee como parpadeo suelto). **Corre hacia adelante**
  (`hb - idx`, al reves que los huecos): la zanja viene hacia vos porque es lo que te va a pegar,
  y esto es la pista que se aleja, que es como se ve una aproximacion desde la cabina. De perfil
  no se dibuja: ahi la x del mundo no proyecta y las dos filas se pisan.
  **La fila dibuja una FIGURA y no una recta** (`LIGHT_SHP`, una por compas por `hash`): recta (la
  de siempre, o sea que una de cada cuatro se ve como estaba), ola, saltos y helice. El
  desplazamiento va **espejado en x** entre las dos filas, como un rig de verdad, y `ax` es grande
  a proposito: **mover una luz 40 del mundo a z=3000 son 4px de pantalla**, o sea nada.
  **Y el desplazamiento en x es SOLO HACIA AFUERA** (`0.5 + 0.5*sin`, o sea 0..ax y no -ax..+ax).
  Se reporto que la figura que se mete "dentro de los carriles" no sirve, y medida se metia: la
  serpentina llegaba a **x=270 del mundo con el borde de la pista en 340** (70 adentro, 101
  contando el halo, y pasada del centro del carril de afuera, que esta en 255) y la helice a 330
  (10 adentro). De un solo lado el minimo de las cuatro figuras es `edge + LIGHT_OUT` = **460** y
  ninguna cruza. No es la misma figura recortada: la fila **abre y cierra hacia el descampado**,
  que es lo que hace una pista de aterrizaje de verdad.
  **Y `k` no puede ser entero**: la fase avanza `idx * k * 0.5` ciclos por luz, asi que con `k=2`
  avanza **un ciclo entero** y las luces van todas en fase, o sea que la fila se corre de costado
  **en bloque** (el "izquierda derecha izquierda derecha" que se reporto). Con `k=2.5` avanza 1/4
  de ciclo y la onda CORRE a lo largo de la pista: se repite cada 4 luces = 2 beats = **1226 del
  mundo**.
- **`rig`**: el abanico del nivel 1, con **color por nivel** (ver abajo) y, si el nivel declara
  **`rigOver`**, cruzando el MUNDO ENTERO en vez del cielo. Se reporto que los laseres del fondo
  se veian solo en la franja de arriba, y era el orden de dibujo: el rig va antes del suelo, o sea
  que los edificios y la pista lo tapan. Con `rigOver` se dibuja al final, ya deshecho el temblor,
  y por eso va a `RIG_DIM` = **0.55** de alpha. Medido en la BANDA DE JUEGO (y 332-419 de 582),
  luma media / p95: **sin rig 20.32 / 48, con rig a 0.55 23.84 / 56, con rig a 1 26.93 / 62**, o
  sea que 0.55 deja el aporte del rig en **+3.52 en vez de +6.61**.
  De `rigOver` cuelgan tambien las **VARIANTES del abanico**, y cual va lo dice el compas: el de
  siempre (emisores arriba, fuera de cuadro), **horizontal a una altura** y **horizontal a dos
  alturas por lado** (los cuatro abanicos cruzandose en el medio), que es lo de las fotos de
  referencia. Es UN dial y su respaldo es **false**: borrar la linea del nivel devuelve el orden
  de dibujo de siempre y con el solo el abanico de arriba, que es lo que deja el nivel 1 en 0 px
  (y `test-music.js` falla si el nivel 1 lo declara).
  **Con `rigOver` el rig muere en la MITAD DE ARRIBA** (`RIG_CUT` = 0.5). Se reporto que abajo
  tapa al jugador, y tapaba: medido **aislando la capa** (mismo frame con y sin `rig` en `decor`,
  restando los dos PNG), el **44.8% del buildup, el 42.7% y el 56.8% del drop2** de los pixeles
  del rig caian por debajo de `h/2` y el mas bajo llegaba a **y=505 de 508**, o sea al canto de
  abajo. Con el corte: **0px / 47px / 0px** y el mas bajo pasa a **y=256**, 2px por el grosor del
  trazo. No es una tijera: cada viga termina en su propio `yi` (hasta 6% del alto por encima del
  corte, por `hash`) y los focos se dibujan como **segmentos de circulo** (`arc` desde la cuerda)
  en vez de discos, o sea que el que asoma se ve cortado y no desaparece de golpe.
- Y las **formas** (`shapes`) dejaron de flotar sin seguir nada: el acento las empuja
  (`pop = hype * beat`) en alpha, radio (+45%) y giro. Va multiplicado por `hype`, que en el nivel
  1 vale 0: ahi no se mueve un pixel.

## La ola por SECCION (`wave` en `LEVELS`)
Se reporto que la malla "no se ve reactiva": su alpha solo dependia del latido, o sea la misma
agua de punta a punta del nivel. `wave` es por seccion: `a` al empezarla, `to` al terminarla
(rampa lineal dentro de la seccion) y `mode` que forma usa `meshWave`. El respaldo es `a`=1 y
`mode`=0, que es lo que el renderer hacia antes del dial. El nivel 1 lo declara ahora tambien,
con `mode` 2 (la cordillera outrun, ver abajo) y **las cinco secciones puestas**: la que falte
cae en el respaldo, o sea en el AGUA del nivel 2, y la cordillera se convertiria en olas cyan a
mitad de la cancion.

Medido **aislando la malla** (misma fila con y sin `mesh` en `decor`, restando los dos PNG: eso es
el aporte de la capa y nada mas, porque un parche de pantalla trae bandas del suelo y anillos
encima). Cobertura del cuadro / luma media del aporte / p95 de lo encendido:

    f20  buildup   a=0.95   10.35%   1.39    32
    f40  buildup   a=0.57    8.63%   0.84    21
    f58  buildup   a=0.22    4.99%   0.34    10
    f64  break     a=0       0.00%   0.00     0     <- desaparece entera
    f70  drop2     a=1.35   10.72%   2.12    49
    f95  drop2     a=1.35   13.86%   8.51   144
    f130 outro     a=0.85   11.42%   2.64    55

O sea: el buildup entra opaco y se apaga **4x** hacia el apagon, el break la borra (0 px, no "casi
0") y el drop la devuelve con **6.2x** la luma del final del buildup.

**Y es OTRA ola, no la misma mas fuerte** (`mode` 1: el doble de crestas en z, el termino cruzado
en `x - z` en vez de `x + z` y la deriva al reves). Medido contando maximos locales sobre el
campo: a lo largo de z (300..4000) pasa de **8 a 15 crestas**, a lo ancho (+-1400) de **10 a 8**,
y el batido en un punto fijo de **0.19 a 0.25 Hz (+32%)**. La ola larga y ancha del buildup se
convierte en aros apretados que bajan por la pista.

**Y en el drop las crestas se FACETAN** (`shape: "pyra"`, solo ahi: se pidio que el buildup se
quede como esta). No es geometria nueva ni otra capa: es el MISMO campo, rellenando el cuadro que
`drawMesh` ya tiene calculado entre la fila de atras y esta, partido en **dos triangulos** que
comparten la diagonal `prev[k-1] -> row[k]`. Ese es el idiom de `pyraFaces` (dos caras que se
tocan, y lo que las hace leer como volumen es que van con distinto TONO, no el contorno),
aplicado al terreno en vez de a una esquirla, o sea que no hace falta ni un punto nuevo.

- Solo por encima de `PYRA_THR` = **0.6** de altura de ola, y eso es lo que la hace barata y lo
  que la hace leerse: rellenando cada cuadro la malla dejaria de ser malla (seria un plano
  opaco); en las crestas quedan los picos macizos con los valles todavia de alambre, que es un
  terreno low-poly.
- **LA FACETA VIVE EN UNA RETICULA MAS GRUESA QUE EL ALAMBRE** (`PYRA_NX` = 5 columnas,
  `PYRA_DZ` = 3 filas), y no es gusto: se reporto **dos veces** que la superficie es "ruidosa".
  La celda de la malla mide `MESH_PX` = 16px de ancho (sale de Nyquist) por la separacion entre
  filas, o sea 33px en z=700 y 7px en z=1500, asi que cualquier faceta hecha sobre esa celda mide
  **~19x12px**, y a 238 por frame eso es confeti. Encima el criterio de maximo local se quedaba
  con UNA celda de una mancha de cresta que mide **2.53 columnas x 1.69 filas**, o sea un cuarto:
  medido, el **76% de las facetas no tocaba a ninguna otra**. Con el paso grueso se indexan los
  MISMOS `row`/`hs` (cero puntos nuevos) y salen **42 formas de 85x28px** con el **117% de
  adyacencia**, o sea crestas seguidas y no puntos.
- La cara de sombra va al tono del **VALLE** de la misma rampa (`tono(-1)`, o sea `MESH_LO` con
  su niebla) y no al mismo tono con menos alpha: sobre un cielo negro dos caras del mismo color
  suman lo mismo y el pico se lee plano.
- El alpha del relleno va a `PYRA_A` = **0.32** del de la linea (era 0.55 con la reticula fina):
  un relleno tapa y la malla es fondo, o sea que tiene que seguir por debajo de las bandas del
  suelo. El numero sale de la cuenta, no del ojo: la tinta sube de **3.18% a 5.62% del cuadro**
  al engordar la faceta, asi que tinta-por-alpha queda en **1.80 contra 1.75**, o sea la misma.
- Medido con la reticula fina: **430 piramides por frame** (860 `fillPoints`), aporte propio
  **4.81% del cuadro**, y `draw()` de **0.467ms a 0.518** (400 pasadas por lado), o sea
  **+0.051ms** sobre 16.7. Con la gruesa hay menos formas y mas grandes.

## El suelo outrun del nivel 1 (`wave.mode` 2 + `mesh`, `outrun` en `fx.js`)
El nivel 1 enciende la MISMA capa `mesh` del nivel 2: ni una funcion de dibujo nueva. Lo unico
que cambia son la ola (`mode` 2 = `outrun`, la cordillera de `fx.js`) y los dos colores
(`mesh: { lo: "#3b2a04", hi: "#ffd166" }`, o sea el atardecer retro; el medio da `#c19c47`). El
dorado no es gusto: el nivel entero es violeta y `KILL` es el rosa caliente, o sea que el cyan
del respaldo (`MESH_LO`/`MESH_HI`) seria un cuarto color en una pantalla que ya tiene tres. El
oro esta a **144 grados de tono** del violeta-indigo de `neon.fam` (258 contra 41.9), que es la
referencia outrun: cielo y estructuras violetas, piso oro.

**Y no se acerca a lo que MATA**, medido en los tres puntos de la rampa contra `KILL`
(`0xed4679`): distancia RGB **215 / 109 / 141** y de tono **59.8 / 60.2 / 60.3 grados** para
`v` = -1 / 0 / +1. Lo mas parecido a `KILL` del nivel 1 **no es el oro sino su propio rosa**
(`neon.sec.drop` = `#ec4899`, a **32.1 de RGB y 11.3 grados**), y eso ya estaba shippeado, o sea
que el oro entra 3.4 veces mas lejos en el peor caso que se puede dar en pantalla.
`test-music.js` falla por debajo de 100 de RGB o de 45 grados en cualquier nivel que declare
`mesh` (el respaldo cyan da 236 / 214 / 249). El ambar (`#ffb703`) se probo y es peor en todo
(crudo 142 / 164) y ademas su valle se acerca a 52.5 grados de tono.

**La reja NO es geometria nueva: es `drawMesh` con la ola en 0.** Las filas cada `MESH_DZ` = 70
del mundo y las lineas de cruce una de cada `MESH_CROSS` = 3 ya estaban; con `v` = 0 las filas
salen rectas y los cruces salen verticales convergiendo al punto de fuga, o sea que el modo nuevo
no agrega ni un punto: solo dice DONDE la ola vale 0 y donde no. Por eso el campo cercano es reja
plana de verdad y no una montana chiquita: medido, el relieve cresta a valle da **0.0px a z=400 y
z=700** (el 0% de las columnas de esa fila lleva montana) y todo lo que esta por debajo de
**y=541, o sea el 32% del alto de pantalla y donde los pixeles son mas grandes**, es reja.

**`outrun` no lleva `t` ni `rip`.** No lleva `t` porque el terreno YA se mueve: las filas corren
hacia la camara por `off = (songT*speed) % MESH_DZ`, o sea **15.1 filas/s** a speed 1060, y una
montana que ademas oscile en su sitio se lee como gelatina. No hace falta un `MESH_DZ` por nivel
para clavarla al beat: son **6.99 filas por beat**, o sea que la reja ya vuelve a caer en el mismo
sitio cada beat con una deriva de una fila cada ~640 beats. No lleva `rip` porque el rizo del
campo cercano es la octava de la ola del nivel 2 y aca el campo cercano es justo la parte plana.

**No toca la pista y no deja cuna negra**, las dos cosas medidas y no supuestas: el pixel de la
capa mas cercano al centro se queda a **87.9-88.1px** del borde de la pista (peor caso fila por
fila entre y360 e y560 sobre 8 frames), que es el `MESH_GAP` de 90px de pantalla menos el grosor
del trazo, y es plano con la profundidad porque el hueco es constante en pantalla. Hacia arriba la
capa llega de x=0 a x=1245 en todas las filas del fondo y su pixel mas alto cae en **y=352..355**
contra el fondo real de la pista en **y=355.36**, o sea que la toca: **0 px de luma < 6** de 1248
en las cuatro filas del fondo y en los ocho frames.

**La cordillera arranca donde arranca la FILA, no en un x fijo del mundo.** `MTN_X0` = 700 es
mundo y el borde interno de la malla es `xi = edge + MESH_GAP / s(z)`, o sea **pantalla**: los
dos solo coinciden en z=4000, asi que de cerca la fila entera caia dentro de la meseta plana y no
habia relieve. Por eso `outrun(x, z, x0)` recibe el arranque del que dibuja (`drawMesh` le pasa su
`xi`) y 700 queda de respaldo para `drawMeshFlat`, donde las franjas son cortes a una x fija del
mundo y el numero mundo si es el que corresponde. Medido en pantalla, cresta a valle en px a
lat=0.24:

    z:            400   700  1100  1500  2000  2600  3300  4000
    con 700 fijo  0.0   0.0   3.4  22.3  30.8  28.4  23.3  18.4
    con el borde  0.1   4.0  21.2  33.4  32.5  29.0  23.5  18.4

y las columnas que llevan relieve pasan de **0% en z=700, 43% en z=1100 y 68% en z=1500** a
**96-97% en todas las filas**. El relieve vale exactamente 0 EN `xi`, o sea que la cordillera no
se acerca ni un pixel a la pista. `test-music.js` lo afirma con tres `x0` (345, 520, 700).

**Los periodos entran en Nyquist con margen** (`MTN_KX` = pi/620, o sea 1240 de periodo en x, y
`MTN_KZ` = 2pi/1400): el paso entre columnas es de 16px de PANTALLA, o sea que en el mundo se
abre con la distancia, y las muestras por periodo van z=400 411 / 700 63.8 / 1100 30.0 / 1500
21.8 / 2000 16.2 / 2600 12.3 / 3300 9.7 / 4000 8.0. El peor caso son **8.0 contra las 3 de
Nyquist**. En z el paso es fijo (filas cada 70) y da 20 muestras por periodo en toda la pista.

**El arco por seccion sale de la jerarquia, no del ojo** (ver `wave`): se aisla la capa (la misma
fila con y sin `mesh` en `decor`, restando los dos PNG) y se compara la luma de SU tinta contra el
parche del plano del suelo de la misma banda (y400-520, o sea z 1250..2400). Un parche "de afuera"
mentiria: ahi ya hay pins, rave, formas y skyline.

    buildup  a=1.20 -> 0.80   12.32%   0.93   ratio 0.40 / 0.32
    break    a=0.80 -> 0       0.00%   0.00   ratio 0        <- el apagon se la come entera
    drop     a=1.45           12.51%   1.79   ratio 0.55 / 0.96
    drop2    a=0.75           12.41%   0.97   ratio 0.96 / 1.00
    outro    a=0.85 -> 0.35   12.28%   0.99   ratio 0.94 / 0.91

El drop2 iba en 1.45 y el outro en 1.30, y ahi la malla le GANABA a la pista (**1.26/1.32** y
**1.11/1.07**): la pista del nivel 1 en esos dos tramos es la mas apagada de la cancion (luma
26.1/24.2 y 24.6/25.2 contra 58.8/46.0 en el drop), o sea que el mismo alpha que en el drop la
deja por encima. Barrido en vivo, drop2: 1.15 -> 1.13/1.19, 0.95 -> 1.06/1.10, 0.85 -> 1.01/1.05,
0.75 -> **0.96/1.00**; outro: 1.05 -> 1.02/0.98, 0.85 -> **0.94/0.91**. La cobertura casi no se
mueve (12.66% -> 12.41%): lo que baja es el brillo de la linea, no cuanta linea hay.

**Y NO lleva `metro`, que es lo primero que se pide cuando una capa parece congelada.** El nivel 1
no tiene el problema que creo ese dial: medido con `pulseAt(t, cues, 0.16, rol)` cada 10ms y con
el rol que dice `glow` seccion por seccion, `beat` > 0.05 cubre **99.8% del drop, 100% del drop2 y
100% del outro** (media 0.310 / 0.328 / 0.328, p95 0.819 / 0.866 / 0.866), contra el 0% del drop2
y del outro que tiene el nivel 2. El **13.8% del buildup** no es un agujero, es el diseno
(`glow.buildup = "mark"`: el bajo no aparece hasta que entra de verdad). Y aunque `lat` valiera 0
la reja no se congela: la parte plana no depende de `lat` (`v` = 0 da desplazamiento 0 con
cualquier `amp`) y el movimiento sale de `off`. Si el buildup queda apagado el dial es
**`wave.buildup.a`**, que toca solo el alpha de la malla; `metro` entra en `this.kik` y le meteria
al drop del nivel 1 el temblor del suelo y el golpe blanco de cada kick, dos efectos que ese nivel
se diseno sin ellos.

Y no lleva `shape: "pyra"`: las facetas son para las crestas de agua del drop2 del nivel 2,
cuestan +0.05ms medidos y aca rellenarian las montanas de macizo.

**El nivel 1 sigue dando 0 px con la malla APAGADA**: con `mesh` fuera de `decor` y en t = 12 /
36.3 / 50.2 / 65 (los cuatro fuera de los dos tramos de `neg`) y en las tres camaras, los **12
diffs contra `git archive HEAD` dan 0 px distintos y max delta 0**. O sea que lo unico que movio
el nivel 1 es lo que el nivel declaro.

## Diales que dejaron de estar escritos en el renderer (`dropSec`, `neon.rig`, `acid`)
- **`dropSec`**: cual seccion es EL drop (rave clavado + temblor). Estaba puesto como
  `sec === "drop"`, o sea que el drop2 del nivel 2 se quedaba con la luz del buildup; pero
  arreglarlo con `startsWith("drop")` es peor, porque **el nivel 1 tiene un `drop` Y un `drop2`**
  (59.08-87.69s) y solo el primero es su drop: medido, `startsWith` le encendia el rave clavado y
  el temblor durante 28.6s que se disenaron sin ellos (**169813 px distintos a t=65**). Lo dice el
  nivel, con respaldo `"drop"`.
- **`neon.rig`**: el color del abanico y de los focos. **No puede salir de `neon.fam`**: el
  renderer traia DOS listas hardcodeadas y distintas entre si (violeta/cyan/rosa los focos,
  cyan/violeta/rosa/accentSoft el abanico), asi que `fam` no es respaldo exacto de ninguna. El
  respaldo son esas dos listas tal cual, que es lo que deja el nivel 1 en 0 px.
- **`acid`**: la frase que vuela en el break. El pool de objetos de texto se dimensiona a
  `MAX_ACID` = 24 y no a la frase del nivel: crear textos en `draw()` seria una fuga por frame.
  La del nivel 2 es **"LET THE BASS QUICK DOWN"**, que es lo que dice, y no la del nivel 1.
- **`acidFx.style` y `acidFx.move`**: la LETRA y el GESTO tambien son del nivel. Se reporto que
  "el texto es el mismo que el del otro nivel": iban las dos cosas escritas en el renderer.
  - **La letra** va en `style` (un `Phaser.Text` style entero, o sea sin diales sueltos que
    despues haya que ir agregando de a uno) y el respaldo es el del nivel 1 tal cual. El nivel 2
    va a una condensada pesada (`Impact` / `Haettenschweiler` / `Arial Narrow`) en su cyan, que
    es lo unico que hay en pantalla durante su apagon. `setStyle` se llama **solo cuando el
    estilo cambia**, no por frame: re-medir 24 textos en cada `draw()` es tirar el layout.
  - **El gesto** va en `move`, y el del nivel 2 (`"stamp"`) es el REVES del nivel 1. Ahi las
    letras vienen de lejos y revientan hacia la camara porque tienen un nivel del que
    despegarse; aca el break es negro entero (`dark`, f63-f67) y las letras son **lo unico que
    se ve en 2.47s**, asi que se ESTAMPAN palabra por palabra (medido: una cada **219.5ms =
    0.501 beats**, o sea medio beat a 137bpm, contra los 219.0 de la cuenta) llegando encima de
    la camara (z de 406 a 700, o sea escala x1.72 a x1) y clavandose. La salida es z **creciendo**
    y las letras convergen SOLAS al punto de fuga, que es exactamente donde 26.8ms despues entra
    el reactor con el fogonazo del snare: `OUT` = 0.80 son 330ms = 0.75 beats y terminan en p=1,
    o sea **285.8ms antes del drop2**. El gesto no alarga la cue ni un frame.
- Y el barrido del rave (`drawRave`) toma el color de `neon.fam` en vez del violeta escrito a
  mano (el nivel 1 declara exactamente ese violeta), y **se salta las cues con efecto propio**
  (`c.fx`): a v=1400 los 2.2s de la voz son 3080z de barrido, o sea una losa tapando la malla.
- **La `dur` la puede poner el ROL** (`dur` en `map`) y no solo el evento: `fxAt` sin `dur` no da
  progreso y el schema del nivel 2 no trae ni una, o sea que sus efectos de barrido serian un
  golpe puntual y las letras no se moverian. **Y el `every` tambien**: el canal de la voz del
  nivel 2 trae 2 eventos (t=27.706 y t=29.334) y con los dos puestos la frase se repetia **4.3
  beats DENTRO del drop** (que entra en 29.642), que es el "la letra se repite en los primeros
  beats del drop" que se reporto. `every: 2` deja solo el primero y su `dur` es **1.65** y no
  2.2: 27.706 + 1.65 = **29.356**, o sea que la ultima letra se apaga 27ms antes del golpe de
  snare que abre el fogonazo (29.383). La `dur` es lo que dura la frase EN PANTALLA, no lo que
  dura en el audio: si se pasa de su tramo, pisa lo siguiente.

## Dictar por fila / tile (donde no hay senal)
`T` cicla apagado / filas / tiles. **Una fila = un beat** (la banda que ya se ve en el suelo,
y el hueco minimo en el que se puede reaccionar: 0.462s a 130bpm en el nivel 1, 0.438s a 137 en
el 2). `tile = fila * N + carril` con **N = los carriles del nivel**, carril 0 = izquierda: con
3 son los tiles de siempre y con 4 la numeracion es otra, o sea que un tile solo significa algo
dentro de su nivel (la fila y el carril significan lo mismo en todos). La numeracion es global y
estable: sale de la grilla, no de las cues, asi que apagar o mover cues no la mueve. El HUD
muestra `f<fila>` de donde esta el jugador.

En `music.js`: `rowAt(t, lv)`, `timeOfRow(fila, lv)`, `tileOf(fila, carril, N)`, `rowOfTile`,
`laneOfTile`, las tres con **default 3** para los llamadores que no tienen nivel a mano. Cada
cue ademas trae su `.row`, para pasar de un numero al otro.

Estas directivas del `script` CREAN obstaculo donde no habia cue (llegan al jugador justo
en el tiempo de su fila, o sea salen `leadOf(speed)` antes):

    { tile: [323, 324], kind: "low" }      // fila 107 carril 2 y fila 108 carril 0
    { row: 78, lane: 0, kind: "block" }    // = tile 234

Su `n` es `"t323"`, no un numero: no entra en la numeracion de cues ni la corre, y las
reglas por `#n` (`from`/`to`) no lo tocan.

## Dictar bailando (`record.js`, teclas `Y` / `U`)
`Y` corre la pista VACIA (quedan las lineas y las filas, no se dibuja ni se choca nada) y
graba `(accion, songT)`. `U` lo convierte en directivas `{ row, lane, kind }`, las tira por
consola y se las baja como `.js` pegable en `LEVELS[...].script`. Donde saltaste va un `low`,
donde te deslizaste un `high`, donde cambiaste de carril un `block` **en el carril que
dejaste**, y donde no hiciste nada no va nada.

- La fila se elige por el **impacto** (`accion + LEAD`), no por la pulsacion: `LEAD.jump` es
  el apice del salto (227ms) y `LEAD.slide` media ventana de slide (250ms). Cuantizar a la
  fila corrige la latencia humana entera: medido, 60ms de retraso -> 0ms en el guion.
- Tolerancia medida a 130bpm y v=700: **salto -109..+119ms, slide -194..+196ms**. Fuera de
  eso no hay ninguna fila valida (la banda segura es mas angosta que el beat) y esa accion
  **se descarta**: `toScript` replaya la grabacion contra lo que genero y tira lo que esa
  misma grabacion no esquivaria. Por eso el guion sale mas corto que las acciones.
- Rebobinar rebobina la grabacion (se tira lo posterior al nuevo `songT`).
- El barrido de celdas recorre **los N carriles del nivel** (`toScript(..., n)`, default 3), o
  sea que dictar en el nivel 2 prueba 4 por fila y no 3. Es el unico sitio de `record.js` donde
  N aparece: todo lo demas se choca por indice de carril y no se entera.
- Todavia ignora orbs, flips y el relleno de los huecos: eso se dicta a mano.

### `Y` graba DESDE DONDE ESTAS, y `U` no puede pisar lo anterior
`Y` ya no vacia la grabacion: tira lo grabado **de aca en adelante** (lo estas rehaciendo) y
se queda con `recFrom` = la fila donde lo apretaste. `toScript(..., from)` replaya igual desde
0 (hace falta el estado del jugador) pero **no emite ni una directiva anterior a esa fila**, y
el volcado lo dice en la primera linea. O sea que lo exportado se **pega al final** del
`script` en vez de reemplazarlo.

Eso es lo que blinda lo que ya esta escrito: el guion de la f0-f127 se edito a mano despues de
grabarlo (ver el solver), asi que regenerarlo entero desde el rec crudo perderia esas
ediciones. Con `from` no hay forma de perderlas por accidente. `test-music.js` lo afirma:
dictar desde la f64 da exactamente el mismo guion que dictar desde la f0, recortado.

**Retocar un tramo VIEJO**: clic en su sector, `Y`, jugarlo hasta el final, `U`, y en el guion
se reemplaza de esa fila para abajo. Rebobinar antes del punto de arranque tambien baja
`recFrom`: si volves atras es porque queres dictar desde ahi.

### El guion del nivel 2 salio de bailarlo (485 obstaculos)
Se dicto entero con `Y`/`U` y se pego en `LEVELS["orbit-motion"].script`. Lo que lo valida es el
**mismo solver por filas del nivel 1**, con SUS carriles y SU velocidad (v=1400, 4 carriles):
busqueda en anchura fila por fila con la fisica de verdad, corrida con `g=1` y con `g=-1`, y
`test-music.js` reporta la cuenta en cada corrida:

    485 obstaculos (170 block, 288 gap, 15 low, 12 high), fila mas flaca 7 estados

- **157 de las 165 filas** llevan algo. Las 8 vacias son la f0-f2 (la entrada) y la **f63-f67**,
  que es el apagon: un obstaculo dentro del `dark` es un obstaculo que no se ve, y el test falla
  si aparece uno ahi.
- **133 filas dejan UN solo carril libre** y 5 dejan dos; hay **19 filas sin carril libre** y eso
  no es un muro: **ninguna** tiene las 4 de `block` (el solver lo prueba), o sea que se pasan
  saltando o deslizandose, que es justo lo que se dicto bailando.
- Los `gap` salen encadenados por carril (zanjas de hasta **36 filas seguidas**): eso es lo que
  hace que la pista se lea como cuatro rieles con agujeros y no como una pared por beat.
- Las 3 cues de rol `orb` que aparecen son **jump orbs** que puso `chains()` sola, donde se
  encadenaron dos saltos con menos de `CHAIN` beats de hueco.

### Clic en la tira = ir a ese sector (`stripSeek`)
La tira de abajo (tecla `M`) ya dibujaba las secciones; ahora lleva ademas una marca por
**sector** del suelo y se puede pinchar. El clic cae en el **arranque del sector** que pisaste,
no en el punto exacto: el sector es el tramo con el que se mira el nivel (14-20 filas). Con
`shift` va al compas mas cercano, para afinar. Es la unica forma de empezar a grabar en el
medio sin acordarse del numero de fila. Un clic en cualquier otro lado sigue siendo play.

## Medir, no estimar
Nada de BPM/tiempos a ojo. Se miden sobre el audio y se deja el numero medido en el commit.
