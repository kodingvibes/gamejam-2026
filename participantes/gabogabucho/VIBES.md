# VIBES — Fase 2 sobre Mr. Lastre

Mejoras hechas por **felipe** sobre el juego de **gabogabucho**.

Antes de tocar nada leí `CONCEPTO.md` y `README.md`. El verbo central sigue siendo inclinar,
la chatarra sigue pegándose sola, la piedra sigue arrancando piezas y el borde izquierdo sigue
siendo la única forma de morir. No moví balance, ni velocidades, ni el largo de los tracks, ni
la posición de un solo obstáculo.

## Qué cambié

### La campaña no podía avanzar del Nivel 1 al Nivel 2

Este era el problema grande. `game.js` usaba `nextLevelId(...)` y `campaignTotal(...)` dentro de
`startNextLevel()`, pero ninguna de las dos estaba en el `const { ... } = LastreModel` de arriba
del archivo. `LastreModel` es un global, las funciones sueltas no. Apretar ENTER en la pantalla
de "NIVEL 1 COMPLETADO" lanzaba `ReferenceError: nextLevelId is not defined` y no pasaba nada:
te quedabas mirando el resultado del Nivel 1 para siempre.

Lo confirmé en el navegador antes de tocar el código, y después de arreglarlo verifiqué que la
transición entrega bien la puntuación acumulada (`campaignScore` llega al Nivel 2 con el total
del Nivel 1).

Es una trampa fea porque el test de la transición estaba y pasaba: `mass-model.test.js` prueba
`nextLevelId` contra el modelo directamente, y el modelo siempre estuvo bien. Lo que faltaba era
el cable entre el modelo y el juego. Agregué un test que lee `game.js` y falla si alguna de esas
funciones se vuelve a usar sin importarla.

### El aviso de ruta hablaba del basurero en el Nivel 2

`routeMessage` tenía "YA SE VE EL BASURERO" escrito a mano, así que en los últimos 150 px del
Distrito Mecánico decía que se veía el basurero cuando el destino es el centro de reciclaje.
Ahora usa el rótulo del nivel cuando se le pasa uno, y conserva el texto original cuando no,
para no romper la prueba que ya existía.

### El HUD se pisaba con la ruta en el Nivel 2

El HUD izquierdo decía `LASTRE · NIVEL 2 · ...` y crecía lo suficiente para chocar contra el
`CENTRO DE RECICLAJE 451 m` alineado a la derecha. Se leía `pulso LISTQENTRO DE RECICLAJE`.
En el Nivel 2 el prefijo ahora es `NIVEL 2` en vez de `LASTRE · NIVEL 2`. El Nivel 1 quedó igual.

### Un Graphics huérfano en el Nivel 2

`mechanicalPaint`, `mechanicalPistons` y `mechanicalRotors` se inicializaban en `create()` y se
volvían a inicializar dentro de `makeMechanicalDistrict()`. El primer Graphics quedaba colgando
sin que nadie lo dibujara ni lo destruyera. Ahora se crean una sola vez, en `create()`.

### Estado de nivel duplicado a mano

`create()` repetía a mano los trece campos que `freshLevelState()` ya devuelve, y que ya tienen
test. Ahora los toma de ahí, con `collected` como `Set` porque el juego lo usa así.

## Qué agregué

### Sonido

El juego estaba mudo. Agregué `sound.js`: una clase con Web Audio, sin un solo archivo de audio,
sin dependencias y sin descargas. Tiene señales distintas para pegar chatarra, rasparse en el
raspador, perder una pieza contra la piedra, el pulso, el golpe mecánico, el superimán, llegar
al destino y que te alcance el borde.

El tono de la chatarra sube según cuántas piezas llevas encima, así que engordar se escucha
además de verse. El `AudioContext` nace recién cuando empiezas la partida, respetando la política
de autoplay de Chrome. Se apaga y se prende con **M**, y la preferencia queda guardada en
`localStorage`, así que si lo silencias sigue silenciado en el siguiente nivel y en la próxima
sesión.

### Pausa

**P** pausa y despausa. Congela Matter y el avance de la cámara, y muestra un cartel.
El cronómetro descuenta el tiempo en pausa: `startedAt` se corre al despausar, así que pausar no
regala ni cobra bonus de tiempo. No se puede pausar en el menú, ni muerto, ni en la pantalla de
resultado.

### Un gancho para mirar el juego

`this.debugMode` estaba asignado y no lo usaba nadie. Ahora `?debug=1` deja la escena en
`window.__lastre`, que es como verifiqué todo lo de arriba sin jugar tres minutos a ciegas cada
vez. Sirve para cualquiera que quiera revisar el balance de verdad.

## Qué quedó frágil

- **El HUD del Nivel 2 quedó justo, no resuelto.** Sigue siendo texto de ancho fijo contra texto
  alineado a la derecha. Con una partida muy cargada, `chatarra $` con cinco cifras y `piezas`
  con dos, puede volver a rozar la ruta. La solución de verdad es medir el ancho y recortar, no
  acortar el prefijo.
- **La pausa no bloquea el teclado de juego.** Torque y pulso no hacen nada porque `update()`
  sale antes, pero las teclas siguen llegando. Si alguien agrega algo que actúe fuera de
  `update()`, va a funcionar en pausa sin querer.
- **El sonido no tiene mezcla.** Son tonos y ruido filtrado con ganancias elegidas a oído, sin
  compresor ni límite. Si se disparan muchas señales juntas (raspador largo con chatarra cerca),
  puede sumar más volumen del que me gustaría. `master` está en 0.9 y es la perilla única.
- **`localStorage` puede tirar excepción** en algunos contextos y lo tapo con `try/catch` que
  devuelve `false`. Si falla, el mute simplemente no se recuerda; no rompe nada.
- Todo lo probé en Chromium headless a 1100x620 y en el tamaño nativo. No lo probé en Firefox,
  ni en Safari, ni en un teléfono.

## Sueños que no alcancé

- **Balance.** Sin tocar una tecla te alcanza el borde a los 26 m, y aguantando torque derecho
  llegué a 242 m de los 1025 que mide el Nivel 1. Puede ser exactamente lo que gabogabucho
  quiere (el concepto dice que en menos de un minuto tienes que descubrir que se pierde por
  quedarse atrás), y por eso no moví nada: no es mi juego y la regla dice mejorar, no rebalancear.
  Pero me quedé con ganas de medirlo en serio con el gancho de debug y traerle números en vez de
  opiniones.
- **Táctil.** Es teclado puro. En un teléfono no se puede jugar. Tres zonas en pantalla
  (inclinar izquierda, inclinar derecha, pulso) lo abrirían entero, pero eso necesita probarse en
  un dispositivo real y no alcancé.
- **Que la chatarra se escuche distinta según la pieza.** Engranaje, chapa y tuerca suenan igual;
  solo cambia el tono según cuánto llevas. Cada forma tiene su valor y su collider, y merecía su
  propio timbre.
- **Música.** Un loop industrial de fondo, sintetizado, que se ponga más denso a medida que te
  cargas de chatarra. Se me ocurrió tarde.

## Cómo verificar

```bash
cd participantes/gabogabucho
node --test mass-model.test.js       # 26 pruebas
python -m http.server 8080           # desde la raíz del repo
```

`http://localhost:8080/participantes/gabogabucho/` para jugar.
`?debug=1` deja la escena en `window.__lastre`. `?level=2`, `?autostart`, `?grow=`, `?qa=`
siguen funcionando igual que antes.
