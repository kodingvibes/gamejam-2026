# DAFTRUN

Un runner de ritmo. La pista no es un decorado con musica encima: **todo lo que se
dibuja es funcion del segundo de la cancion**, obstaculos incluidos, asi que el nivel
llega siempre en el mismo beat y rebobinar lo rebobina entero.

Dos niveles jugables, uno por tema:

| # | Nivel | Tema | BPM | Filas |
|---|-------|------|-----|-------|
| 01 | INSOMNIA | `insomnia-drop` | 130 | 220 (101.5s) |
| 02 | SPACE ORBIT | `orbit-motion` | 137 | 165 (72.3s) |
| 03 | (a medias) | `breathe` | 155 | 287 (111.1s) |

El 03 tiene el tema marcado y recortado pero **no esta enchufado**: es el punto de
continuacion para el que siga esto (ver `GUIA.md`, seccion 10).

## Jugar

**En el navegador, sin instalar nada:**
https://kodingvibes.github.io/gamejam-2026/participantes/pabloprx/

**En local**, doble clic en `run.command` (macOS / Linux), o a mano:

```bash
python3 -m http.server 8123
# y abrir http://localhost:8123
```

Hace falta un servidor y no es un capricho: el juego son **modulos ES** y carga sus
schemas y su audio con `fetch`, y abriendo el `index.html` con doble clic el navegador
le da origen `null` y bloquea las dos cosas por CORS. Es una regla del navegador, no
del proyecto. No hay nada que instalar: `python3` ya viene en macOS y en Linux.

## Controles

| Tecla | |
|-------|--|
| `←` `→` / `A` `D` | cambiar de carril |
| `↑` / `W` | saltar (**mantener** para enganchar los orbs) |
| `↓` / `S` | deslizarse |
| `SPACE` | pausa |

Rojo mata, y es lo unico rojo de la pantalla. El resto lo dice la **forma**: chevron
hacia arriba = saltar, chevron hacia abajo = deslizarse, X = no se pasa. Los agujeros
del suelo matan igual: se saltan o se esquivan de carril.

Una vida. Al morir el mundo se congela **en el sitio**, el cartel dice cuanto llevabas
(`MUERTO 41%`), y medio segundo despues vuelve a empezar. Esa espera no se puede saltar:
es lo que evita machacar el reintento.

## Modo diseno

Es con lo que se hicieron los niveles y esta entero: se entra desde el menu
**manteniendo `D`**, o a mano en `index.html?level=insomnia-drop` (sin `&play=1`).
Ahi cada senal de la cancion se dibuja como una linea numerada sobre la pista, el
suelo va numerado por filas, y se puede parar, ir en camara lenta, rebobinar por
compases, cambiar de camara (3a persona / perfil / 1a persona) y **dictar el nivel
bailandolo** (`Y` graba, `U` lo exporta como guion). La lista de teclas sale en
pantalla.

`tools/avatar.html` es el banco del muneco y `tools/reactor-lab.html` el del reactor;
`beatmapper/` es donde se marcaron los tres temas a mano.

## Como esta hecho

Phaser 3.90 por CDN como modulo ES. **Sin npm, sin `node_modules`, sin bundler**: no
hay paso de build, lo que esta en la carpeta es lo que corre. Los tests son
`node test.js` y `node test-music.js`, con `assert` y sin framework; entre otras cosas
**resuelven los dos niveles con un solver por filas** (busqueda en anchura con la
fisica de verdad, con gravedad normal e invertida), o sea que "se puede pasar" es algo
que se comprueba y no una opinion.

`CLAUDE.md` es el diario tecnico: cada numero que hay en el codigo esta ahi con como se
midio y contra que. `NOTAS.md` es el registro de tandas. **`GUIA.md` es por donde empieza
el que siga esto**: como correrlo, como se marca un tema en el beatmapper, como se agrega
un nivel, como se dicta bailando, la tabla de teclas del modo diseno y como mover un
obstaculo concreto.

El **nivel 3 esta a medias y a proposito**: el tema ya esta marcado y recortado
(`assets/breathe.schema.json` + `assets/breathe-cut.m4a`, 155bpm, 287 filas, 111.1s) y no
esta enchufado en `LEVELS`. Los cuatro pasos que faltan estan en la seccion 10 de `GUIA.md`.

Audio: los dos temas van recortados a la parte que se juega.
