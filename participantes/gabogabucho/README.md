# MR. LASTRE

Auto-runner físico lateral hecho con **Phaser 4.2.1 + Matter**. Mr. Lastre es un pequeño electroimán que cruza la **Ciudad** hasta el basurero municipal y después atraviesa el **Distrito Mecánico** hasta el centro de reciclaje, en una campaña de dos niveles.

## Ejecutar

No requiere instalación ni build.

```bash
python -m http.server 8080
```

Abrir:

`http://localhost:8080/participantes/gabogabucho/`

## Controles

- **A / ←** — torque antihorario.
- **D / →** — torque horario.
- **Espacio** — pulso magnético corto. Cuanta más masa, menor altura.
- **↑ / ↓ (o W / S)** — navegar el menú de inicio.
- **Enter** — confirmar el menú e iniciar partida; avanzar al Nivel 2 al completar el Nivel 1.
- **R** — reiniciar el nivel actual.
- **P** — pausar y continuar.
- **M** — encender o apagar el sonido.

## Campaña

Una campaña de **niveles separados**: cada nivel tiene escenario, track, cronómetro y puntuación propios. La puntuación se acumula entre niveles.

- **Nivel 1 · Ciudad** — enseñanza de adhesión, torque, pulso, piedra, raspadores, grúa, superimán y campo electromagnético. Termina en el basurero municipal y muestra el desglose de tiempo, bonus y chatarra entregada.
- **Nivel 2 · Distrito Mecánico** — escenario de fábrica con prensas verticales y barredores rotatorios. Arranca con el núcleo compacto y un cronómetro propio; al terminarlo se muestra el resultado individual y el total de la campaña.

## Inicio

El juego arranca con un **menú de inicio** en el Nivel 1 que ofrece dos modos: la **Campaña completa** (Ciudad y luego Distrito Mecánico, con puntuación acumulada) o el **Nivel 2 directo** (entrenamiento en la fábrica, partida suelta). Se navega con **↑ ↓** (o **W/S**) y se confirma con **Enter**, **Espacio** o click.

## Objetivo

Llegar al destino mientras la cámara empuja. Engranajes, chapas y tuercas se pegan al cuerpo; el hormigón arranca masa. Si el borde izquierdo alcanza el núcleo, termina la partida.

Cada pieza dibujada tiene la misma forma que su collider Matter y, al adherirse, pasa a ser parte del único cuerpo compuesto de Mr. Lastre.

El juego comienza en el **menú de inicio**; la física y el cronómetro esperan hasta que el jugador confirme la partida. Toda la chatarra adherida conserva el magnetismo: una pieza de la periferia también puede capturar otra.

## Zonas interactivas (Nivel 1)

- **Raspadores voluntarios:** aparecen 300–500 px antes de varios pasos exigentes. El rodillo elevado se alcanza con pulso y torque; cada contacto sostenido puede arrancar varias piezas con una pausa controlada entre ellas. Cada pieza perdida también quita su valor y frena a Mr. Lastre. La calle inferior queda libre para ignorarlos y después hay un tramo sin chatarra para recuperar velocidad.
- **Zona de obra (500–700 m):** una grúa sostiene una carga Matter real. El arco rojo anticipa su trayectoria; el golpe desestabiliza y cuesta terreno, pero no mata ni desprende piezas por regla especial.
- **Superimán (antes de 800 m):** activa durante 6 segundos un radio de imantado de 120 px. La chatarra viaja hacia la parte más cercana del compuesto y solo entonces se incorpora.
- **Campo electromagnético (800–950 m):** paneles de techo atraen hacia arriba. La fuerza escala con la raíz de la masa, así que un Mr. Lastre pesado se suspende menos.

Cada zona tiene señal de entrada, un tramo de desarrollo y una salida limpia. Las instrucciones están en la ciudad para no alargar la pantalla inicial.

## Zonas interactivas (Nivel 2 · Distrito Mecánico)

- **Prensa vertical:** una prensa cae desde el techo y vuelve a subir en ciclos regulares. Cada golpe reduce la velocidad y cuesta terreno, pero **nunca mata ni desprende piezas**. La ventana segura se aprende mirando el ritmo.
- **Barredor rotatorio:** un rodillo atraviesa la calle de lado a lado. El contacto prolongado arranca chatarra con una pausa controlada (cooldown propio) y frena a Mr. Lastre; superarlo a tiempo evita la pérdida.
- **Progresión rítmica:** primero una prensa sola, luego un barredor solo, después combinaciones de ambos, y un tramo de recuperación limpio antes del centro de reciclaje.
- **Recuperación y meta:** después de las máquinas hay un tramo sin obstáculos para recuperar velocidad; la meta es el **Centro de Reciclaje** con cartel de llegada propio.

En el Nivel 2 solo mata el borde izquierdo: las máquinas desestabilizan y frenan, pero no eliminan ni sueltan piezas.

## Puntuación

- Cada pieza muestra su valor antes de recogerla; forma y tamaño determinan valores entre **$10 y $40**.
- Al llegar, se suma únicamente el valor de la chatarra que sigue adherida. Una pieza perdida contra la piedra deja de puntuar.
- El bonus de tiempo es transparente: **$10 por cada segundo restante de un objetivo de 180 segundos**, sin valores negativos.
- Al completar el Nivel 2 se muestra la **puntuación total de la campaña** (suma de los totales de ambos niveles).

## Estado

- [x] Corte 0: cuerpo compuesto mutable con Matter; masa, inercia y centroide se recalculan.
- [x] Corte 1: loop básico crecer → deformarse → rasparse → recuperar terreno.
- [x] Pulso magnético dependiente de masa para reorientar aterrizajes.
- [x] Corte 2: ciudad industrial, señalética, ruta y basurero como meta.
- [x] Corte 3: identidad de Mr. Lastre y taxonomía procedural de chatarra física.
- [x] Onboarding, valores de chatarra, magnetismo periférico y puntuación de entrega.
- [x] Corte 4: zonas sistémicas con péndulo, campo vertical y superimán temporal.
- [x] Corte 5: Distrito Mecánico con secuencias rítmicas de prensas y barredores.
- [x] Corte 5b: campaña por niveles separados — Nivel 1 (Ciudad) y Nivel 2 (Distrito Mecánico) con transición y puntuación acumulada.
- [ ] Corte 6: sonido y ajuste de ritmo tras pruebas con jugadores.

## Verificación técnica

- `?level=1` — fuerza el Nivel 1 (Ciudad).
- `?level=2` — fuerza el Nivel 2 (Distrito Mecánico).
- `?grow=7` — fuerza siete adhesiones para inspeccionar el compuesto.
- `?grow=7&shed=right` — fuerza crecimiento y desprende una parte del lado derecho.
- `?autostart` — omite la pantalla inicial para pruebas visuales automatizadas.
- Nivel 1:
  - `?level=1&qa=construction` — posiciona jugador y cámara frente a la grúa.
  - `?level=1&qa=boost` — posiciona al jugador sobre el pickup para inspeccionar su aura y atracción.
  - `?level=1&qa=field` — posiciona al jugador dentro del campo electromagnético.
  - `?level=1&qa=scraper` — posiciona al jugador antes de un raspador, mostrando la ruta inferior opcional y el tramo de recuperación. Combinar con `&grow=7` permite probar una descarga múltiple.
- Nivel 2:
  - `?level=2&qa=mechanical` — entrada y señal del Distrito Mecánico.
  - `?level=2&qa=piston` — secuencia inicial que enseña la prensa y su ventana segura.
  - `?level=2&qa=rotor` — secuencia del barredor y la puerta cercana.
