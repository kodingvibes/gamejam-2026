# DECKSTINY

Juego de **duelo de cartas por turnos** (deck-building) creado para el **GameJam 2026 de [KodingVibes.com](https://kodingvibes.com)**, comunidad de desarrolladores y vibecoders.

Elige una de 5 clases, arma tu baraja y reduce a 0 la vida del héroe rival. Identidad visual CRT/arcade pixel: scanlines, glitch y fuentes retro.

## Ejecutar

No requiere instalación ni bundler. Sirve `participantes/fr4j4/` con un servidor estático:

```bash
python -m http.server 8080 --directory participantes/fr4j4
```

Abre <http://localhost:8080> en el navegador. También puedes abrir `index.html` directamente.

## Cómo jugar

1. En el menú elige **CAMPAÑA** (5 etapas con dificultad creciente), **VS IA** (partida con temporizador), **Practice** (sin presión) o **Deckbuilder** (armar tu baraja).
2. Selecciona una **clase** (cada una tiene HP, recurso y poder de héroe distintos) y una baraja con al menos **5 cartas**.
3. Robas 2 cartas por turno. El maná sube de 1 a 7.
4. Juega cartas de daño directo, invoca criaturas y ataca.
5. Reduce la vida del rival a 0 para ganar.

## Modo campaña

- **5 etapas** contra enemigos fijos de dificultad creciente (Aprendiz → Cazador → Centinela → Nigromante → Bardo del Caos).
- Tu **vida persiste** entre batallas: al ganar una etapa curas **+5 HP** (nunca por encima de tu máximo).
- Pierdes si tu vida llega a 0 en cualquier etapa. Ganar la última etapa completa la campaña.
- Las etapas usan barajas enemigas de la clase correspondiente, así que cada una se siente distinta.

Si es tu primera vez, el juego te muestra un tutorial "¿CÓMO JUGAR?" con todos los conceptos. También puedes abrirlo desde el menú en cualquier momento, o pasar el mouse sobre los elementos para ver burbujas de ayuda.

## Controles

| Acción | Control |
|--------|---------|
| Terminar turno | Botón `FIN DE TURNO`, tecla `E` o `ENTER` |
| Menú durante la batalla | Tecla `ESC` o botón `☰` |
| Desplazar log de batalla | Rueda del mouse sobre el panel |
| Pantalla completa | Esquina superior derecha `⛶` |
| Detalle de carta (deckbuilder) | Clic en la carta |
| Menú de baraja (renombrar/duplicar/eliminar) | Clic largo o clic derecho sobre el slot |

## Clases

| Clase | HP | Recurso | Poder de héroe (1 de maná) | Estilo |
|-------|----|---------|---------------------------|--------|
| 🧙 Mago | 25 | Maná (cap 7) | Bola de Fuego: 2 daño directo | Control / Burst |
| 💀 Necromancer | 30 | Sangre (paga vida) | Invocar Esqueleto 1/1 | Swarm / Desgaste |
| ⚔️ Guerrero | 35 + 2 armadura | Armadura | 1 daño a criatura + 1 armadura | Tank / Control |
| 🗡️ Asesino | 28 | Veneno | Navaja: 1 daño (2 si veneno) | Aggro / Burst |
| 🎭 Bardo | 30 | Inspiración | Nota Molesta: 1 daño directo | Disrupción / Combo |

### Recursos especiales

- **Sangre** (Necromancer): pagas vida (mínimo 1 HP) para lanzar cartas poderosas.
- **Veneno** (Asesino): daña al enemigo al comienzo de su turno y baja de a 1.
- **Inspiración** (Bardo): se gana con cartas y alimenta efectos de robo o descarte.

## Keywords de criaturas

| Keyword | Efecto |
|---------|--------|
| **Guardia** | Protege a tu héroe: los ataques la golpean primero |
| **Evasivo** | No puede ser bloqueado por criaturas mientras ataca |
| **Celeridad** | Puede atacar el mismo turno en que es invocada |
| **Consumible** | Al jugarse no vuelve al descarte |

## Deckbuilder

- Mínimo **5 cartas** por baraja.
- Cada carta tiene un **máximo de copias** (`maxCopies`).
- Filtros por coste y tipo (Acción / Criatura), y vista "solo en deck".
- La curva de maná y el promedio te ayudan a balancear tu mazo.
- Puedes crear, renombrar, duplicar y eliminar barajas (mantén presionado o clic derecho sobre un slot).

## Estructura

```text
index.html                     entrada: fuentes, Phaser 4.2.1 CDN y scripts
js/main.js                     configuración de Phaser (640x360, FIT)
js/data/classes.js             5 clases y sus poderes de héroe
js/data/cards.js               cartas y efectos estructurados
js/data/campaign.js            etapas del modo campaña
js/data/tutorial.js            glosario y páginas del tutorial
js/ui/help.js                  HelpSystem: burbujas de ayuda y overlay
js/ui/card.js                  renderizado de cartas
js/ui/vfx.js                   helpers visuales (botones, tooltips, estrellas)
js/ui/crt.js                   scanlines CRT
js/engine/HeroSprite.js        sprites animados de héroes
js/scenes/                     Boot, Menu, DeckPicker, Deck, Game, GameOver
scripts/verify.js              verificación automática (node)
docs/HERO_SPRITES.md           docs técnica de sprites
```

## Verificación

```bash
node scripts/verify.js
```

Revisa sintaxis, orden de carga, globals y cobertura del glosario. Debe terminar con `=== TODOS LOS CHECKS PASAN ===`.

## Versión

`1.1.0` · GameJam 2026 — Fase 2 (campaña, balance y documentación). Creado por **fr4j4 - 2026**.
