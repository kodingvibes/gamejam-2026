# Tapa'o

Cae el temporal sobre Santiago y el agua empieza a subir en la Alameda. Manejas la camioneta municipal, destapas sumideros y tratas de llegar a La Moneda antes de que la avenida se te inunde entera.

## Cómo correrlo

```bash
cd participantes/felipe
npm install
npm run dev
```

Se abre en la dirección que imprime Vite. Para compilar de verdad:

```bash
npm run build   # tsc --noEmit + vite build
npm test        # 33 tests sobre la simulación y las reglas
```

## Cómo se juega

Todo con teclado.

| Tecla | Qué hace |
|---|---|
| Flechas | Manejar la camioneta |
| Espacio (mantenido) | Destapar la rejilla marcada en amarillo |
| P | Pausa |
| R | Reiniciar |
| Esc | Volver al menú |

La cámara avanza sola hacia La Moneda, pase lo que pase. Vas encerrado en esa ventana: si te quedas atrás, te arrastra. Mientras destapas no te mueves, y manejar sobre agua te frena al 45%.

Pierdes cuando el agua sube por sobre la vereda y tapa los edificios. Ganas el modo Temporal si llegas a La Moneda sin ahogarte. El modo Sin Fin no se gana, solo se aguanta.

Mientras más cerca estás de La Moneda, más fuerte llueve.

## Cómo está armado

```
src/
├── dominio/          # las reglas del juego, sin una línea de Phaser
│   ├── agua/         # Azar, Granos (autómata celular), Frente, Oleadas
│   ├── corredor/     # Hitos, Sumidero, Alameda
│   └── partida/      # Modo, Jugador, Puntaje, Partida
└── presentacion/     # la única capa que dibuja
    ├── escenas/      # Boot, Menu, Juego, Hud, Pausa, Final
    ├── agua/         # ventana de simulación, perfil de calle, balance
    ├── arte/         # paleta y sprites como datos, texturas de Phaser
    ├── audio/        # sonido sintetizado con WebAudio
    └── mundo/        # escenario y camioneta
```

El agua es un autómata celular tipo arena: granos que caen, se esparcen y escurren hacia los sumideros por la pendiente de la calle. Vive en `dominio/agua/Granos.ts` y no sabe nada de Phaser, así que se puede probar en Node sin navegador. Los tests de `test/granos.test.ts` cubren conservación del agua, determinismo por semilla y el balance entre lluvia y drenaje.

Los sprites no son imágenes: están escritos como datos en `src/presentacion/arte/sprites.ts` y Phaser los convierte en texturas al arrancar. Se editan cambiando letras.

Los brazos del presidente en la pantalla final no son cuadros de animación: son sprites sueltos girados por tween.

## Dos cosas para quien lo tome después

`?debug=1` en la URL deja el juego en `window.__tapao`, útil para saltar a una escena o leer el estado de la partida desde la consola.

Las constantes de balance viven juntas: la lluvia y el drenaje en `src/presentacion/agua/Balance.ts`, las oleadas en `src/dominio/agua/Oleadas.ts`, y el resto en `src/presentacion/Escala.ts`.

## Créditos

Los hitos de la Alameda están dibujados a mano usando fotos y fichas del Consejo de Monumentos Nacionales como referencia. Nada de arte descargado: todo el pixel art es propio y vive como datos dentro del repositorio.
