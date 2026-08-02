# Guia para el que siga (humano o agente)

Esto es lo que hay que saber para tocar el juego sin romperlo. Los NUMEROS y el porque de
cada uno estan en `CLAUDE.md` (diario tecnico) y el registro de tandas en `NOTAS.md`; esto
es el **como se hace**.

---

## 0. Correrlo

```bash
python3 -m http.server 8123
# http://localhost:8123
```

Hace falta un servidor. No es capricho: el juego son **modulos ES** y carga sus schemas y su
audio con `fetch`, y abriendo `index.html` con doble clic el navegador le da origen `null` y
bloquea las dos cosas por CORS. No hay nada que instalar ni que compilar: **sin npm, sin
node_modules, sin bundler**. Lo que esta en la carpeta es lo que corre.

Tres URLs y no hay mas:

| URL | Que es |
|-----|--------|
| `/` | el menu (HTML plano, no descarga ni Phaser) |
| `/?level=orbit-motion` | el nivel en **modo diseno** (marcas, teclas, inmune) |
| `/?level=orbit-motion&play=1` | el nivel **jugable** (1 vida, sin marcas) |

El flag lo lleva JUGAR, o sea que la ausencia de `?play=1` ya es el modo diseno. En el menu se
abre en diseno **manteniendo la D** al hacer clic.

Tests: `node test.js` y `node test-music.js`. Sin framework, con `assert`. **Se corren siempre
antes de commitear**: entre otras cosas resuelven los dos niveles con un solver por filas
(busqueda en anchura con la fisica de verdad, gravedad normal e invertida), o sea que "se puede
pasar" es algo que se comprueba.

---

## 1. La regla que manda sobre todas

**El mundo es funcion de `songT`** (el segundo de la cancion). Nada de estado acumulado, nada
de `Math.random()`, nada de `Date.now()`. Si necesitas ruido, `hash(i)`.

De ahi sale todo lo demas gratis: pausa, camara lenta, rebobinar. Y de ahi sale la forma de
verificar un cambio: **rebobinar al mismo `songT` tiene que dar el MISMO pixel**. Si un efecto
nuevo cambia al rebobinar, esta mal, aunque se vea bien.

La excepcion son el jugador (`invuln`, `dash`, la cuenta de la muerte) y el FFT del audio. Nada
mas.

---

## 2. Los ficheros

```
index.html        menu + arranque del juego (una sola pagina)
AIRunnerGame.js   la escena: TODO el dibujo (draw()) y el input
music.js          LEVELS (los niveles), la grilla, cues, roles, filas/tiles
physics.js        carriles, hitbox, salto/slide, colisiones, velocidades
transport.js      songT anclado a AudioContext, FFT
cams.js           las tres camaras (atras / lado / 1a persona)
avatar.js         el muneco (vectorial, no sprite)
reactor.js        el reactor del nivel 2 (geometria como datos, sin Phaser)
fx.js             geometria de efectos (rayos, piramides, cordillera outrun)
record.js         grabar bailando -> guion (teclas Y/U)
theme.js          la paleta base
assets/*.schema.json   las SENALES de cada tema (salidas del beatmapper)
assets/*-cut.mp3       el audio recortado a la parte que se juega
beatmapper/       la herramienta para marcar los temas
tools/            bancos sueltos: avatar.html, reactor-lab.html
```

**Un nivel no vive en el renderer.** Todo lo que separa un nivel de otro se declara en
`LEVELS` (`music.js`) y el renderer solo lee. Si te encuentras escribiendo `if (nivel === ...)`
en `AIRunnerGame.js`, es un dial que falta en `LEVELS`.

Y todo dial nuevo lleva **respaldo exacto de lo que el renderer hacia antes de existir el
dial**, para que el otro nivel no se mueva ni un pixel.

---

## 3. Senales vs roles: de donde sale un nivel

El schema exporta **senales**, no niveles. El schema no sabe que es un obstaculo.

```
tema (mp3) --beatmapper--> assets/x.schema.json   (canales con t, v, dur)
                                  |
                                  v
                         LEVELS[...].map          (que hace cada canal EN ESTE NIVEL)
                                  |
                                  v
                    bg / mark / fx / orb / flip / obstacle
```

Un canal (`bass`, `acid`, `snare`...) es solo "aca suena esto". Que haga en el nivel lo elige
**el codigo del nivel**:

| Rol | Que hace |
|-----|----------|
| `bg` | el latido del decorado (rig, pins, barras) |
| `mark` | lo que late en lo que se JUEGA (cajas, portones, formas) |
| `fx` | barridos y estallidos, y deja la linea numerada para dictar |
| `orb` | orb de dash / jump orb |
| `flip` | desde ahi se corre por el techo |
| `obstacle` | obstaculo (casi nunca: los obstaculos salen del `script`) |

Se elige **contando eventos, no de oido**. Ejemplo real del nivel 2: `response1`/`snare` son
rafagas (3 golpes y despues 71 beats sin nada), o sea que de `mark` dejarian el nivel a oscuras
compases enteros: van de `fx`.

**No hay sistema de "construi tus guidelines y cargalo como nivel".** Es a proposito: eso son
semanas y esto es una jam.

---

## 4. El beatmapper: marcar el tema

`beatmapper/` sirviendolo con el mismo servidor. Que hace: cargas el mp3, marcas el BPM **a
mano (tap)**, defines `tags` (canales) con una tecla cada uno, y vas apretando esa tecla al
ritmo de lo que suena. Exporta el `.schema.json`.

Lo que importa del export:

- `tempo`: `bpm`, `offset` (donde cae el beat 0) y `beatsPerBar`. **La grilla sale de aca** y
  de ella salen las FILAS, que es como se dicta todo.
- `track.trim`: `start`/`end` en tiempo del track ORIGINAL. `music.js` les resta `trim.start`.
- `sections`: los tramos con nombre (buildup / break / drop / outro).
- `events`: `{ t, tag }`, tiempos **absolutos del original**.

Tres cosas medidas que ahorran una tarde:

1. **Marcar a mano se adelanta ~69ms** con dispersion de 33ms, o sea sesgo constante y no
   ruido: se corrige de una y despues se cuantiza cada tag a SU subdivision (kicks a la negra,
   acid a la semicorchea). Cuantizar todo a la negra deja restos de 72-144ms.
2. **`trim.end` va a una fila entera**: `trim.start + filas * beat`. Si no, la ultima fila
   queda partida.
3. El audio se re-corta en el mismo sitio:
   `ffmpeg -ss <start> -t <dur> -i tema.mp3 -vn -c:a libmp3lame -b:a 192k assets/x-cut.mp3`.
   El `-vn` no es opcional: el tema trae caratula y sin eso ffmpeg no escribe nada.
   **MP3 y no m4a**: iOS no decodifica mp4 por Web Audio (medido, ver `CLAUDE.md`).

`tools/analyze.py` solo sirve para **cuadrar** la grilla y los patrones contra el audio real.
Nunca para inventar la estructura.

---

## 5. Anadir un nivel

1. Marcar el tema (arriba) -> `assets/<id>.schema.json` + `assets/<id>-cut.mp3`.
2. Entrada en `LEVELS` (`music.js`). Copiar `LEVELS["orbit-motion"]` y cambiar, que es el mas
   completo. Lo minimo que el test EXIGE:
   - `schema`, `audio`, `speed`, `bg`, `lanes`.
   - `map`: rol por canal.
   - `glow`: **una entrada por seccion** y con un rol que tenga cues en ese tramo (el test falla
     si algo late con algo que no suena ahi).
   - `enter`: una entrada por seccion.
   - `sectors`: contiguos, empezando en la fila 0 y llegando a la ultima, **sin agujeros**.
   - `modes`: un modo de eq por sector, y que exista en `drawBars`.
   - `decor`: solo nombres que el renderer dibuje (la lista blanca se **saca del codigo**, no se
     escribe a mano).
   - `wave`: **las cinco secciones puestas** si declaras `mesh`, o la que falte cae en el
     respaldo (el agua del nivel 2) a mitad de cancion.
3. Alta en el menu: una `<li>` en `index.html`.
4. `node test-music.js`. Va a decir que falta.
5. Dictar los obstaculos bailando (abajo).

**La velocidad se calcula, no se copia.** La ventana de cambio de carril es
`beat - (d + PLAYER_D)/v`, con `d`=75 (block) y `PLAYER_D`=28, o sea `103/v` de descuento. Para
dejar la misma ventana que el nivel 1 (364ms): `v = 103 / (beat - 0.36437)`. A 137bpm eso da
1400. Con un beat mas corto y la velocidad vieja el nivel se cierra.

---

## 6. Dictar los obstaculos BAILANDO (`Y` / `U`)

Los obstaculos no salen de las senales: salen del `script`. Y el `script` se dicta jugando.

1. Abrir el nivel en **modo diseno** (`/?level=<id>`).
2. Ir al sitio: clic en la tira de abajo (va al arranque de ese sector) o `G` y escribir `f78`.
3. **`Y`**: la pista corre VACIA (quedan las lineas y las filas, no se choca nada) y graba
   `(accion, songT)`. Bailas el tema: saltas, te deslizas, cambias de carril.
4. **`U`**: lo convierte en directivas y te lo baja como `.js`, pegable en
   `LEVELS[<id>].script`.

Que genera: donde saltaste un `low`, donde te deslizaste un `high`, donde cambiaste de carril
un `block` **en el carril que dejaste**, y donde no hiciste nada, nada.

- La fila se elige por el **impacto** (`accion + LEAD`), no por la pulsacion, o sea que corrige
  tu latencia entera (medido: 60ms de retraso -> 0ms en el guion).
- Lo que ni tu propia grabacion esquivaria **se descarta solo**: por eso el guion sale mas
  corto que las acciones.
- **`Y` graba DESDE DONDE ESTAS**: tira lo posterior y `U` no emite ni una directiva anterior a
  esa fila. O sea que lo exportado se **pega al final** del `script` y no pisa lo que ya estaba
  editado a mano. Para retocar un tramo viejo: clic en su sector, `Y`, jugarlo, `U`, y en el
  guion reemplazas de esa fila para abajo.

Orbs, flips y el relleno de huecos se dictan a mano.

---

## 7. Modo diseno: las teclas

Sin `?play=1`. La lista sale en pantalla.

| | |
|--|--|
| `SPACE` | play / pausa |
| `1`-`5` | velocidad x1 / .5 / .25 / .1 / .05 (jugador **y** musica) |
| `,` `.` | **-/+ un compas** (con `shift`, un beat) |
| `L` | loop de 8 compases |
| `G` | ir a `#cue` (o `f78` = fila) |
| `HOME` | al principio |
| `M` | las marcas (lineas numeradas + tira de abajo) |
| `T` | numeros de fila / de tile |
| `C` | camara: atras / lado / 1a persona |
| `J` | capas de fondo (todas / base / detalle) |
| `P` | fantasma (blanco y negro, solo lineas) |
| `H` | invertir gravedad a mano |
| `Y` `U` | grabar / exportar guion |
| `K` inmune · `X` mute · `V` feel · `-` `+` sync fino | |
| clic en la tira de abajo | ir al arranque de ese sector (`shift` = al compas) |

Como se leen las marcas:

- Cada senal se dibuja como una **linea numerada** cruzando la pista: eso es el `#n`. El `#n` es
  **estable**: apagar o mover una cue no renumera el resto, porque se numera despues de ordenar
  por tiempo. Por eso el guion escrito a mano sigue apuntando a lo mismo aunque se apende al
  schema.
- Con `T` el suelo se numera por **filas** (`f78`). **Una fila = un beat**, y es la banda que ya
  se ve en el suelo. Segundo `T` y se numeran los **tiles**: `tile = fila * N + carril`, con
  `N` = carriles del nivel y carril 0 = izquierda. Un tile solo significa algo dentro de su
  nivel; la fila y el carril significan lo mismo en todos.
- Al lado del `f<n>` va lo que pide cada carril: `#` caja, `_` hueco, `^` saltar, `v` agachar,
  `o` orb, `O` jump orb, `x` carril muerto.

---

## 8. "Quiero cambiar algo del nivel": la receta

Ejemplo literal: *"el obstaculo de la fila #t32, el primero de la derecha, muevelo a la
izquierda"*.

1. **Ir ahi.** `,` y `.` mueven un compas (4 filas); con `shift`, un beat (una fila). O directo:
   `G` y escribir `f32`. O clic en la tira de abajo para caer en ese sector.
2. **Encender los numeros.** `T` una vez = filas, dos veces = tiles. `M` si no se ven las
   lineas numeradas de las cues.
3. **Pausar y afinar.** `SPACE` para congelar, `4` o `5` para ir en camara lenta y ver la fila
   entrar.
4. **Leer el sitio.** El HUD dice en que `f<n>` esta el jugador. Con tiles encendidos, el
   primero de la derecha de la fila 32 en un nivel de 4 carriles es el carril 3, o sea
   `tile = 32*4 + 3 = 131`.
5. **Editarlo** en `LEVELS[<id>].script` (`music.js`), que es el UNICO sitio:

   ```js
   { row: 32, lane: 3, kind: "block" }   // lo que hay
   { row: 32, lane: 0, kind: "block" }   // movido al carril de la izquierda
   ```

   Las dos formas son equivalentes: `{ row, lane, kind }` o `{ tile: [131], kind }`.
   `kind`: `block` (pared, mata), `gap` (agujero en el suelo, mata), `low` (saltar),
   `high` (deslizarse), y los roles `orb` / `flip` con `role` en vez de `kind`.
6. **Recargar y mirar la misma fila.** Como el mundo es funcion de `songT`, volver a `f32` te
   devuelve exactamente el mismo cuadro: se puede comparar de verdad.
7. **`node test-music.js`.** El solver por filas dice si el nivel se sigue pasando. Si moviste
   el obstaculo a la unica salida que quedaba, el test falla ahi, no en la partida del jurado.

Notas del `script` que muerden:

- Una directiva con `row`/`tile` **CREA** un obstaculo donde no habia cue. Su `n` es `"t131"`,
  o sea que no entra en la numeracion de cues ni la corre, y las reglas por `#n` no lo tocan.
- Una directiva con `at`/`from`/`to` **direcciona cues** existentes por `#n` (capas, tintes).
  No crea nada.
- **Donde va un orb NO va obstaculo**: esa celda es del orb.
- Una zanja de `gap` de menos de 3 filas se cruza de un salto: el test falla si dejas una.

---

## 9. Debug

**A ojo, con el modo diseno.** Es la forma normal y para eso existe: pausar, camara lenta,
rebobinar por compases, `C` para mirar el mismo sitio desde las tres camaras, `J` para apagar
capas de fondo y ver que capa esta tapando que, `P` para ver solo las lineas.

**Con `window.__dbg`** desde la consola: es la escena. `__dbg.songT`, `__dbg.lv` (el nivel
resuelto), `__dbg.beat`, `__dbg.pulse`, `__dbg.hype`, `__dbg.dead`... Y `window.__game` es el
juego de Phaser. Para saltar a un tiempo exacto sin tocar el teclado: `__dbg.seek(36.3)`.

**Con `agent-browser`** (un agente, o tu con la CLI) es como se midio todo lo de `CLAUDE.md`:

```bash
agent-browser open "http://localhost:8123/?level=orbit-motion"
agent-browser eval "__dbg.seek(36.3); __dbg.tp.pause()"
agent-browser screenshot a.png
```

y despues se restan dos PNG con PIL para contar pixeles distintos. Tres cosas que ya dieron un
falso positivo y estan aca para que no lo den otra vez:

1. **Puerto nuevo por tanda de medicion.** El `?cb=` de la pagina **no busta los modulos**: los
   `import` van sin cache buster, asi que reusar un puerto donde el navegador ya cargo otra
   version sirve los modulos VIEJOS con el HTML nuevo. Se delata comparando un campo que solo
   existe en una de las dos versiones.
2. **Prueba de vida obligatoria.** Dos `songT` distintos tienen que diferir en >90% del cuadro.
   Sin eso, "0 px de diferencia" puede significar "no se dibujo nada".
3. **HEAD contra HEAD tiene que dar 0 px.** Es la otra mitad de la prueba.

El invariante que protege el trabajo de otro: **un dial nuevo tiene que dejar el otro nivel a
0 px de diferencia** contra `git archive <sha>` servido en otro puerto. Si no da 0, el respaldo
del dial no reproduce lo que el renderer hacia antes.

---

## 10. El nivel 3 esta a medias (aca es por donde se sigue)

Estan los assets, no esta el nivel:

```
assets/breathe.schema.json    Kobosil - BR3ATH3, marcado a mano
assets/breathe-cut.mp3        el corte, ya a filas enteras
```

Medido del export: **155 bpm** (beat 0.387097s), offset 0.256, corte
`136.5126 -> 247.6094` del original = **287 filas = 111.10s**, **232 eventos** en 4 canales
(`vocal melody` 106, `melody drop` 83, `outropads` 23, `bass` 20) y 6 secciones marcadas
(intro / buildup / break / drop / break2 / outro; el corte llega hasta dentro del outro).

Lo que falta, en orden:

1. La entrada en `LEVELS` (seccion 5). Ojo con dos cosas: las `sections` del schema van mas
   alla del corte, asi que hay que recortar la ultima a la fila 286; y **`glow` necesita un rol
   con cues en cada seccion** (la `intro` tiene poquisimo: contar antes de elegir).
2. La velocidad, con la cuenta de la seccion 5: `v = 103 / (0.387097 - 0.36437)` = **4532**, o
   sea que a 155bpm la ventana de carril del nivel 1 **no se puede reproducir subiendo la
   velocidad** (queda absurda). Hay que decidir: o se acepta una ventana mas corta que la del
   nivel 1 (mas dificil, que a 155bpm es lo honesto), o se dictan las filas de a dos. **Esto
   hay que medirlo antes de dictar nada**, porque de ahi sale si el nivel es jugable.
3. Los sectores, los modos de eq y el `decor`.
4. Dictarlo bailando (seccion 6).

El resto del motor ya esta: 4 carriles, la malla, el reactor, los `fx` por fila, el negativo,
la grilla como metronomo. Un nivel nuevo es **declararlo**, no escribir renderer.
