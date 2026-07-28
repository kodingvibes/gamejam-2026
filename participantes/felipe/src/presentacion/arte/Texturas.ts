import Phaser from "phaser";

import { SPRITES, type SpriteData } from "./sprites";

const DIGITOS = "0123456789abcdefghijklmnopqrstuvwxyz";
const TRANSPARENTE = ".";

function componentes(color: string): [number, number, number] {
  const entero = Number.parseInt(color.slice(1), 16);
  return [(entero >> 16) & 255, (entero >> 8) & 255, entero & 255];
}

function pintar(escena: Phaser.Scene, clave: string, sprite: SpriteData) {
  if (escena.textures.exists(clave)) {
    return;
  }
  const textura = escena.textures.createCanvas(clave, sprite.ancho, sprite.alto);
  if (!textura) {
    return;
  }
  const contexto = textura.getContext();
  const imagen = contexto.createImageData(sprite.ancho, sprite.alto);
  const paleta = sprite.paleta.map(componentes);
  for (let fila = 0; fila < sprite.alto; fila += 1) {
    const linea = sprite.filas[fila];
    for (let columna = 0; columna < sprite.ancho; columna += 1) {
      const caracter = linea[columna];
      if (caracter === TRANSPARENTE) {
        continue;
      }
      const color = paleta[DIGITOS.indexOf(caracter)];
      if (!color) {
        continue;
      }
      const destino = (fila * sprite.ancho + columna) * 4;
      imagen.data[destino] = color[0];
      imagen.data[destino + 1] = color[1];
      imagen.data[destino + 2] = color[2];
      imagen.data[destino + 3] = 255;
    }
  }
  contexto.putImageData(imagen, 0, 0);
  textura.refresh();
}

export function crearTexturas(escena: Phaser.Scene) {
  for (const [clave, sprite] of Object.entries(SPRITES)) {
    pintar(escena, clave, sprite as SpriteData);
  }
}
