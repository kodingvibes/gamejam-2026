import Phaser from "phaser";

export const CONO_DE_FOCO = "foco-cono";
export const RESPLANDOR = "resplandor-redondo";

const CONO_ANCHO = 96;
const CONO_ALTO = 40;
const RESPLANDOR_LADO = 32;

function pintarCono(escena: Phaser.Scene) {
  if (escena.textures.exists(CONO_DE_FOCO)) {
    return;
  }
  const textura = escena.textures.createCanvas(CONO_DE_FOCO, CONO_ANCHO, CONO_ALTO);
  if (!textura) {
    return;
  }
  const contexto = textura.getContext();
  const imagen = contexto.createImageData(CONO_ANCHO, CONO_ALTO);
  const centro = CONO_ALTO / 2;
  for (let x = 0; x < CONO_ANCHO; x += 1) {
    const avance = x / (CONO_ANCHO - 1);
    const media = 2 + avance * (centro - 2);
    const largo = Math.pow(1 - avance, 1.5);
    for (let y = 0; y < CONO_ALTO; y += 1) {
      const distancia = Math.abs(y - centro);
      if (distancia > media) {
        continue;
      }
      const perfil = Math.pow(1 - distancia / media, 0.9);
      const alfa = Math.round(largo * perfil * 150);
      if (alfa <= 0) {
        continue;
      }
      const destino = (y * CONO_ANCHO + x) * 4;
      imagen.data[destino] = 255;
      imagen.data[destino + 1] = 244;
      imagen.data[destino + 2] = 198;
      imagen.data[destino + 3] = alfa;
    }
  }
  contexto.putImageData(imagen, 0, 0);
  textura.refresh();
}

function pintarResplandor(escena: Phaser.Scene) {
  if (escena.textures.exists(RESPLANDOR)) {
    return;
  }
  const textura = escena.textures.createCanvas(RESPLANDOR, RESPLANDOR_LADO, RESPLANDOR_LADO);
  if (!textura) {
    return;
  }
  const contexto = textura.getContext();
  const imagen = contexto.createImageData(RESPLANDOR_LADO, RESPLANDOR_LADO);
  const centro = (RESPLANDOR_LADO - 1) / 2;
  for (let y = 0; y < RESPLANDOR_LADO; y += 1) {
    for (let x = 0; x < RESPLANDOR_LADO; x += 1) {
      const dx = (x - centro) / centro;
      const dy = (y - centro) / centro;
      const distancia = Math.sqrt(dx * dx + dy * dy);
      if (distancia >= 1) {
        continue;
      }
      const alfa = Math.round(Math.pow(1 - distancia, 2.2) * 255);
      if (alfa <= 0) {
        continue;
      }
      const destino = (y * RESPLANDOR_LADO + x) * 4;
      imagen.data[destino] = 255;
      imagen.data[destino + 1] = 255;
      imagen.data[destino + 2] = 255;
      imagen.data[destino + 3] = alfa;
    }
  }
  contexto.putImageData(imagen, 0, 0);
  textura.refresh();
}

export function crearLuces(escena: Phaser.Scene) {
  pintarCono(escena);
  pintarResplandor(escena);
}

export function esWebGL(escena: Phaser.Scene): boolean {
  return escena.game.renderer.type === Phaser.WEBGL;
}
