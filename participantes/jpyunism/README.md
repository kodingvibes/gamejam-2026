# Whack Combo

Clicker de reflejos hecho con Phaser 3. Aparecen targets en un tablero 3x3;
click/touch suma puntos con multiplicador creciente. Sin game over: la meta
es maximizar el score en 60 segundos.

## Como jugar

1. Elegi dificultad en el menu (`Easy` / `Normal` / `Hard`).
2. Click o tap en los targets antes de que desaparezcan.
3. Cada 5 aciertos sube el multiplicador (cap en x5 en Easy, x10 en Normal/Hard).
4. Si clickeas en vacio, el combo vuelve a x1 (no resta puntos).
5. Al terminar los 60 segundos, aparece el ranking top-10 (guardado en
   `localStorage` de tu navegador).

## Controles

| Accion            | Desktop       | Mobile |
|-------------------|---------------|--------|
| Golpear target    | Click         | Tap    |
| Pausa             | Tecla `P`     | Boton `\|\|` |
| Reiniciar         | Tecla `R`     | -      |
| Volver al menu    | Tecla `Esc`   | Boton en pantalla |

## Dificultades

| Dificultad | Spawn base | Permanencia | Combo cap | Ritmo |
|------------|-----------:|------------:|----------:|-------|
| Easy       | 1100 ms    | 1500 ms     | x5        | Relax  |
| Normal     |  900 ms    | 1100 ms     | x10       | Default |
| Hard       |  600 ms    |  800 ms     | x10       | Brutal |

A medida que encadenas hits, el spawn se acelera (`spawnBase - hits * spawnStep`,
hasta `spawnMin`).

## Stack

- Phaser 3 (CDN).
- HTML + CSS + JS plano. Sin build, sin `npm install`.
- Un solo archivo de juego (`game.js`) con 4 escenas: `Boot`, `Menu`, `Game`,
  `Pause`, `GameOver`.
- Assets externos: ver `CREDITS.md` (todos CC0 de Kenney).

## Como correrlo

Necesita un static server porque algunos navegadores bloquean `fetch` desde
`file://`:

```bash
cd participantes/jpyunism
python3 -m http.server 8000
# abrir http://localhost:8000
```

Alternativas: `npx serve`, `php -S localhost:8000`, etc.

## Estructura

```
jpyunism/
├── README.md
├── DESIGN.md          (spec del juego)
├── CREDITS.md         (atribuciones de assets)
├── index.html
├── style.css
├── game.js
└── assets/
    ├── images/background.png
    └── audio/{hit,miss,gameover}.ogg
```

## Ranking

Se guarda en `localStorage` bajo la clave `whackcombo:ranking:v1`. Top 10 por
score. Limpiar el storage del navegador borra el ranking.

## Licencia

Codigo: ver licencia del repositorio padre (`kodingvibes/gamejam-2026`).
Assets: `CREDITS.md` (todos CC0).