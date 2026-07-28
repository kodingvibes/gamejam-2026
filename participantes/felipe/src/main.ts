import { createTapaoGame } from "./presentacion/TapaoGame";

const contenedor = document.getElementById("tapao");

if (contenedor) {
  const juego = createTapaoGame(contenedor);
  if (new URLSearchParams(window.location.search).has("debug")) {
    (window as unknown as Record<string, unknown>).__tapao = juego;
  }
}
