import Phaser from "phaser";

import {
  ALTO_DE_CELDA,
  ANCHO_DE_CELDA,
  CARACTERES,
  CLAVE_DE_FUENTE,
  GLIFOS,
  GLIFOS_POR_FILA,
  normalizar,
  TEXTURA_DE_FUENTE,
} from "./fuente";

const ANCHO_DE_GLIFO = 5;
const ALTO_DE_GLIFO = 7;

export function crearFuentePixel(escena: Phaser.Scene) {
  if (escena.cache.bitmapFont.has(CLAVE_DE_FUENTE)) {
    return;
  }
  const filas = Math.ceil(CARACTERES.length / GLIFOS_POR_FILA);
  const ancho = GLIFOS_POR_FILA * ANCHO_DE_CELDA;
  const alto = filas * ALTO_DE_CELDA;
  if (!escena.textures.exists(TEXTURA_DE_FUENTE)) {
    const textura = escena.textures.createCanvas(TEXTURA_DE_FUENTE, ancho, alto);
    if (!textura) {
      return;
    }
    const contexto = textura.getContext();
    const imagen = contexto.createImageData(ancho, alto);
    for (let indice = 0; indice < CARACTERES.length; indice += 1) {
      const glifo = GLIFOS[CARACTERES[indice]];
      if (!glifo) {
        continue;
      }
      const columnaBase = (indice % GLIFOS_POR_FILA) * ANCHO_DE_CELDA;
      const filaBase = Math.floor(indice / GLIFOS_POR_FILA) * ALTO_DE_CELDA;
      for (let fila = 0; fila < ALTO_DE_GLIFO; fila += 1) {
        for (let columna = 0; columna < ANCHO_DE_GLIFO; columna += 1) {
          if (glifo[fila][columna] !== "#") {
            continue;
          }
          const destino = ((filaBase + fila) * ancho + columnaBase + columna) * 4;
          imagen.data[destino] = 255;
          imagen.data[destino + 1] = 255;
          imagen.data[destino + 2] = 255;
          imagen.data[destino + 3] = 255;
        }
      }
    }
    contexto.putImageData(imagen, 0, 0);
    textura.refresh();
  }
  const datos = Phaser.GameObjects.RetroFont.Parse(escena, {
    image: TEXTURA_DE_FUENTE,
    width: ANCHO_DE_CELDA,
    height: ALTO_DE_CELDA,
    chars: CARACTERES,
    charsPerRow: GLIFOS_POR_FILA,
    "offset.x": 0,
    "offset.y": 0,
    "spacing.x": 0,
    "spacing.y": 0,
    lineSpacing: 3,
  });
  escena.cache.bitmapFont.add(CLAVE_DE_FUENTE, datos);
}

export function textoPixel(
  escena: Phaser.Scene,
  x: number,
  y: number,
  texto: string,
  tamano: number,
  color: number,
): Phaser.GameObjects.BitmapText {
  const escala = Math.max(1, Math.round(tamano / ALTO_DE_CELDA));
  return escena.add
    .bitmapText(x, y, CLAVE_DE_FUENTE, normalizar(texto), ALTO_DE_CELDA * escala)
    .setTint(color);
}
