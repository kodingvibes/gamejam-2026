# Whack Combo — Diseño

## Concepto

Clicker de reflejos hecho en Phaser 3. Aparecen targets en posiciones aleatorias
de un tablero 3x3. Cada acierto suma puntos con multiplicador creciente; cada
click en vacio resetea el combo a x1. Sin game over: la meta es maximizar el
score en 60 segundos.

Soporta mouse y touch (mobile/desktop), pausa, dificultad configurable, ranking
local y animaciones/spawn sound en cada acierto.

## Reglas

- Duracion fija: **60 segundos** (default; las dificultades cambian spawn/permanencia, ver mas abajo).
- Score por acierto: `10 x multiplicador`.
- Multiplicador: sube +1 cada 5 aciertos consecutivos. Cap en x10.
- Miss (click/touch fuera de un target) = combo reseteado a x1. No resta puntos, no quita vidas.

### Dificultad configurable (menu principal)

| Dificultad | Spawn inicial | Permanencia target | Multiplicador cap | Duracion |
|------------|---------------|--------------------|-------------------|----------|
| Easy       | 1100 ms       | 1500 ms            | x5                | 60 s     |
| Normal     | 900 ms        | 1100 ms            | x10               | 60 s     |
| Hard       | 600 ms        | 800 ms             | x10               | 60 s     |

- Spawn dinamico por combo: `spawn = max(spawnMin, spawnBase - combo x 60ms)`.
- Permanencia NO escala por combo (mantiene desafio justo por dificultad).

### Spawn

- 1 target vivo a la vez. Aparece en una celda aleatoria del tablero 3x3.
- Si no lo clickean en su ventana, desaparece solo sin penalidad.

## Stack

- Phaser 3 via CDN jsdelivr (`phaser.min.js`). Sin build, sin npm.
- HTML + CSS + JS plano. Canvas lo maneja Phaser.
- Assets externos:
  - **PNG decorativo**: fondo del tablero (1 archivo, fuente libre a confirmar).
  - **Audio**: pack **Kenney Impact Sounds (CC0)**, descargado de
    `https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip`,
    descomprimido en `assets/audio/`. Licencia CC0 (dominio publico). Lista
    exacta de archivos seleccionados + URL en `CREDITS.md`.
- Sprites de gameplay (target) generados proceduralmente con
  `Phaser.Graphics` (circulo + sombra + ojo animado). Permiten animacion
  sin dependencias externas.

## Estructura de archivos

```
participantes/jpyunism/
├── README.md          como jugar, controles, licencia
├── DESIGN.md          este archivo
├── CREDITS.md          atribuciones y URLs de assets externos
├── index.html          carga Phaser CDN + game.js, monta <div id="game">
├── style.css           fondo oscuro, centrado, fuente sans-serif
├── game.js             escena Phaser con toda la logica
└── assets/
    ├── audio/
    │   └── (mp3/ogg seleccionados de Kenney Impact Sounds)
    └── images/
        └── (png decorativo de fondo)
```

## Pantallas

### Menu principal
- Titulo grande: `WHACK COMBO`.
- Botones: `Easy`, `Normal`, `Hard`.
- Boton extra: `View Ranking` (modal con top 10 local).

### HUD (en juego)
- Arriba centrado: `Score: N   |   Combo: xM   |   Time: S`.
- Canvas 720x540 centrado. Tablero 3x3 dibujado con PNG de fondo.
- Target procedural aparece/desaparece con tween de escala (0.2 -> 1.0, ease-back).
- Pausa: tecla `P` o boton `||` en HUD -> overlay "Paused. Press P to resume".

### Game over
- Overlay semitransparente con `Tiempo! Score final: N` + record si entro al top.
- Botones: `Play again` (misma dificultad) y `Menu` (volver a menu).

## Animaciones y feedback

- **Spawn del target**: tween escala 0 -> 1 (180 ms, ease-back).
- **Hit (acierto)**: tween escala 1 -> 1.4 -> 0 (200 ms) + sonido `hit.ogg`.
- **Miss**: flash sutil del HUD + sonido `miss.ogg` (volumen bajo).
- **Combo x5+**: target cambia color (dorado) + sonido mas agudo.
- **Timer <=10s**: HUD del timer parpadea.
- **Game over**: fade-in del overlay (300 ms).

## Controles

- **Mouse**: click izquierdo en target.
- **Touch**: tap en target (mobile).
- **Teclado**: `P` pausa/reanuda, `R` reinicia, `Esc` vuelve al menu.
- El boton "Play again" del overlay tambien sirve para reiniciar con mouse/touch.

## Ranking (local)

- Persistido en `localStorage` bajo la clave `whackcombo:ranking:v1`.
- Estructura: `[{ name, score, difficulty, date }]` ordenado descendente por score.
- Top 10 visible en modal desde el menu.
- Tras game over, si el score entro al top 10: prompt inline pidiendo nombre (default: `Player`).
- Sin backend. Sin cuentas. Sin red.

## Pausa

- Activada por tecla `P`, boton `||` del HUD, o blur de la ventana (cambiar tab
  -> pausa automatica).
- Mientras esta en pausa: spawner detenido, timers congelados, escena visible.
- Resume: misma tecla/boton. Si el blur causo la pausa, click/tap resume.

## Mobile/touch

- Phaser detecta touch por defecto; el handler de input cubre pointer down.
- Canvas se escala proporcional al viewport (`Phaser.Scale.FIT`).
- HUD: textos con fuente mas grande (>=18 px) para legibilidad en pantallas pequenas.

## Comportamiento al terminar el tiempo

1. Detener spawn.
2. Guardar score en ranking si califica.
3. Mostrar overlay de game over con fade-in.

## Criterio de "funciona" (regla del repo)

1. Servir la carpeta con static server (`python3 -m http.server 8000`).
2. Abrir `http://localhost:8000` en desktop -> menu aparece con tres botones.
3. Click en `Normal` -> primer target aparece en <2s.
4. Click/touch en target suma score y dispara sonido + animacion.
5. Click/touch en vacio resetea combo.
6. Tecla `P` pausa; misma tecla reanuda.
7. Timer llega a 0 -> overlay con score y boton "Play again".
8. Probar en mobile via DevTools emulation o dispositivo real.

## Estimacion

- Codigo: ~45-60 min (un solo `game.js`, ~250 lineas + modulos logicos).
- Descarga + curation de assets: ~10 min.
- PR + revision por @Motoko: variable.

## Licencias

- Codigo del juego: repositorio del jam (asumida MIT salvo indicacion).
- Assets externos: ver `CREDITS.md` (Kenney CC0 + PNG a confirmar).