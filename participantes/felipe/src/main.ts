import type Phaser from "phaser";

import type { Partida } from "./dominio/partida/Partida";
import { createTapaoGame } from "./presentacion/TapaoGame";
import { mejorPuntaje } from "./presentacion/Records";
import { sonido } from "./presentacion/audio/Sonido";

const contenedor = document.getElementById("tapao");

if (contenedor) {
  const juego = createTapaoGame(contenedor);
  if (new URLSearchParams(window.location.search).has("debug")) {
    exponerParaDepuracionYQa(juego);
  }
}

function partidaActual(juego: Phaser.Game): Partida | undefined {
  const escena = juego.scene.getScene("Juego") as unknown as { partida?: Partida } | null;
  return escena?.partida;
}

function estadoDelJuego(juego: Phaser.Game) {
  const partida = partidaActual(juego);
  if (!partida) {
    return { started: false, gameOver: false, mode: "menu", score: 0, bestScore: null };
  }
  const gano = partida.terminada && partida.resultado === "ganada";
  return {
    started: true,
    gameOver: partida.terminada,
    mode: partida.terminada ? (gano ? "win" : "game_over") : "playing",
    result: partida.terminada ? (gano ? "win" : "lose") : null,
    score: partida.puntaje.total,
    bestScore: mejorPuntaje(partida.modo),
    modo: partida.modo,
    inundacion: partida.inundacion,
    tiempoSegundos: partida.tiempoSegundos,
  };
}

// QA/debug seam: exposes hooks the `game-qa` skill's Playwright tests read
// (window.__GAME__, window.__GAME_STATE__, render_game_to_text, advanceTime),
// layered on top of the pre-existing window.__tapao seam. Only active behind
// ?debug=1 — inert in the shipped build.
function exponerParaDepuracionYQa(juego: Phaser.Game) {
  const w = window as unknown as Record<string, unknown>;
  w.__tapao = juego;
  w.__GAME__ = juego;
  w.__EVENT_BUS__ = juego.events;
  w.__sonidoDebug = sonido;

  Object.defineProperty(w, "__GAME_STATE__", {
    configurable: true,
    get: () => estadoDelJuego(juego),
  });

  w.render_game_to_text = () => {
    const partida = partidaActual(juego);
    return JSON.stringify({
      coords: "origin:top-left x:right y:down; world position in meters along la Alameda",
      ...estadoDelJuego(juego),
      jugador: partida
        ? {
            metro: Math.round(partida.jugador.metro * 10) / 10,
            rumbo: partida.jugador.rumbo,
            trabajando: partida.jugador.estaTrabajando,
          }
        : null,
      frente: partida
        ? {
            metro: Math.round(partida.frente.metro * 10) / 10,
            metrosSalvados: Math.round(partida.frente.metrosSalvados),
          }
        : null,
      caudal: partida ? Math.round(partida.caudal * 100) / 100 : null,
    });
  };

  w.advanceTime = (ms: number) =>
    new Promise<void>((resolve) => {
      const inicio = performance.now();
      const paso = () => {
        if (performance.now() - inicio >= ms) {
          resolve();
          return;
        }
        requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    });
}
