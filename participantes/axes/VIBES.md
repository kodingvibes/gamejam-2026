# VIBES · Timbiriche

Mejora de Fase 2 sobre el Timbiriche de **axes**, por **pabloprx**.
Eje asignado: **juice audio-reactive + game feel**.

Todo se hizo dentro de `participantes/axes/`. Sin dependencias nuevas, sin assets
externos, sin paso de build: siguen siendo clases globales en `<script>` ordenados.
La mecánica no se tocó: el que cierra caja puntúa y repite turno, igual que siempre.

---

## Qué cambié

### Audio procedural (`js/utils/AudioManager.js`)
- Secuenciador Web Audio con lookahead, escala pentatónica menor y bpm según la
  dificultad de la IA. Nada pregrabado: todo se sintetiza.
- **El tablero escribe la melodía**: cada línea trazada empuja su grado a un buffer
  circular del que lee el arpegio. Jugar en otra zona del tablero cambia la melodía
  de verdad, no es decoración.
- El arreglo crece por capas según el progreso de la partida, con variación de bombo
  y hats por compás, relleno al cerrar cada frase de 4, y cambio de instrumento al
  62% anunciado con un riser. Tonalidad sorteada por partida.
- Swing del 10% en las semicorcheas impares, sin arrastre de reloj.
- Verificado por estructura, no de oído: capturando el stream de notas programadas,
  los compases distintos por frase pasan de 1 a 5.

### Game feel
- Visualizador reactivo: el brillo del lienzo, la opacidad de la rejilla y las cajas
  reclamadas laten con el audio (`AnalyserNode`).
- Estallido de partículas al reclamar caja, sacudida de escenario, confeti en el
  panel final y sello de rango con impacto y sonido.
- Hápticos en móvil.
- Medidor de **terreno seguro** bajo el tablero: cuántas jugadas quedan que no
  regalen una caja. Es la tensión del medio juego, que antes era invisible.
- Botón SONIDO con preferencia persistida en `localStorage`.

### Menú
- **El arranque era invisible**: elegir tamaño de tablero iniciaba la partida, y lo
  único que lo decía era un texto de ayuda que hablaba de clics. Ahora elegir solo
  elige, y hay un `EMPEZAR` ancho al fondo del panel con latido de escala, más ENTER
  y espacio como atajo.
- Iconos dibujados con `Graphics`, sin assets: dos asientos para hot-seat, barras de
  señal para la dificultad, y la retícula real de puntos de cada tamaño de tablero.
- Fondo `NeonGrid`: tres capas de rejilla con celda, color y velocidad distintas
  (la magenta va al contrario) más un barrido de tubo de rayos. Cada capa se dibuja
  una vez y solo se desplaza dentro de una celda, así que el coste por frame es mover
  tres objetos. Medido a 60fps.

### Móvil
- El mundo era cuadrado y `Scale.FIT` lo dejaba como un cuadrado centrado con unos
  400px de negro arriba y abajo. Ahora `Constants.js` mide el aspecto de `#game` y lo
  adopta como aspecto del mundo, así que FIT llena la pantalla (verificado: 390x844
  da canvas de 390x816). HUD, menú, panel final y modal se recolocan con offsets
  sobre un centro responsive; **en horizontal los valores son los originales**, así
  que escritorio no cambia.
- Si cambia la forma de la ventana (girar, emulación del navegador) la página se
  recarga para rehacer el layout.
- El layout vertical entra a partir de un aspecto de 1.7. Por debajo de ahí el mundo
  sale tan corto que el tablero centrado se come el HUD de arriba y el medidor cae
  sobre los botones, así que tablets y ventanas medio altas usan el de escritorio.
  `Constants.test.js` barre aspectos y falla si alguna pareja vuelve a solaparse.

### Claridad
- El modal de reinicio decía `SÍ` / `NO` sin decir a qué. Ahora las etiquetas llevan
  el verbo (`REINICIAR` / `SEGUIR JUGANDO`), el mensaje pone el marcador en juego, y
  el botón lleno y luminoso es el que **no** destruye nada.
- `SIN SALIDA` no decía sin salida de qué. Ahora `SIN TERRENO SEGURO · TOCA REGALAR
  CAJA`, con las mismas palabras que la cuenta normal.

### Bugs preexistentes arreglados por el camino
- El botón `VS IA · HARD` nunca quedaba marcado como seleccionado.
- Se filtraba un `AudioContext` por cada reinicio de escena.
- Click sobre una línea ya trazada era un click muerto y silencioso.
- `REINICIAR` quedaba inutilizable tras cancelar la confirmación una vez.
- La IA MEDIUM nunca abría cadena, así que la partida se decidía sola. Se le puso una
  tasa de fallo deliberado medida con 300 partidas simuladas (ver abajo).

---

## Qué quedó frágil

1. **La IA HARD bloquea el hilo principal ~140ms por jugada** (16-17 tirones por
   partida). Es previo a mi trabajo y no lo toqué: arreglarlo bien pide sacar la
   búsqueda a un worker o trocearla, y eso es cambiar el motor del juego, no pulirlo.

2. **`blunderRate = 0.35` está medido contra un bot débil, no contra humanos.** El
   banco de pruebas es un bot casual que come si puede y si no juega al azar. Con ese
   rival: rate 0 da 1.7/9 cajas y 9% de victorias, 0.35 da 3.2/9 y 23%, 0.5 da 4.1/9
   y 40%. Un humano real juega mejor que ese bot, así que 0.35 debería quedar cerca de
   una pelea justa, pero **es una estimación**. Es la perilla de dificultad: subirlo
   ablanda, bajarlo endurece. Está en `AI_PERSONALITY`, en `Constants.js`.

3. **El layout se decide al cargar, no en caliente.** Cambiar la forma de la ventana
   recarga la página, y eso pierde una partida en curso. Recolocar todas las escenas
   sin recargar costaba mucho más de lo que valía en un jam.

4. **Trampa de la arquitectura, importante para quien siga:** el tablero es un SVG del
   DOM (`#board-svg`, z-index 60) y el HUD/menús/modales son el canvas Phaser
   (z-index **50**), es decir **debajo**. Cualquier cosa que Phaser dibuje sobre la
   región del tablero es invisible. Los efectos dentro del tablero tienen que ser nodos
   SVG (`js/effects/BoardFx.js`). Ambas capas comparten `viewBox "0 0 GAME_WIDTH
   GAME_HEIGHT"`, así que las coordenadas de mundo sí son intercambiables.

5. **El panel final imprime "EMPATE" dos veces** en tablas, en el título y en el
   subtítulo. Lo vi tarde y no lo toqué por no meter mano en el panel a última hora.

6. Las pruebas (`*.test.js`) corren con `node --test`-less: `node:assert/strict` y un
   sandbox `node:vm`, sin framework y sin `document`. Cubren lógica pura (IA, audio,
   récords), **no** render. Todo lo visual se verificó por captura con Chrome headless,
   no hay test automático que lo proteja.

---

## Sueños que no alcancé

- **Que la música reaccione a la cadena, no solo al progreso.** Hoy el arreglo crece
  con las cajas cerradas; lo bonito sería que abrir una cadena larga tensara la
  armonía y cerrarla la resolviera.
- **Sacar la IA HARD a un worker** y aprovechar los 140ms de espera para una animación
  de "está pensando" que valga la pena, en vez de un tirón.
- **Un modo puzzle**: tableros con posición inicial y un objetivo de cajas, para tener
  algo que jugar solo que no sea la IA.
- **Deshacer la última jugada** en hot-seat. Es la petición número uno de cualquiera
  que juega dots-and-boxes en una servilleta.
- Repetición del final de partida, resaltando la jugada donde se decidió.

---

## Cómo verificar

```
python3 -m http.server 8099      # o cualquier servidor estático sobre esta carpeta
for t in js/**/*.test.js; do node "$t"; done
```

Las pruebas no necesitan navegador ni dependencias.
