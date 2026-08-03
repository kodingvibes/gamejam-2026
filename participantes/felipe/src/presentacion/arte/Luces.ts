import Phaser from "phaser";

export const CONO_DE_FOCO = "foco-cono";
export const RESPLANDOR = "resplandor-redondo";

export interface GeometriaDeFoco {
  x: number;
  y: number;
  direccion: -1 | 1;
}

export const ALCANCE_DEL_FOCO = 128;
const CONO_ANCHO = ALCANCE_DEL_FOCO;
const CONO_ALTO = 48;
const MEDIA_APERTURA_INICIAL = 3;
const MEDIA_APERTURA_FINAL = CONO_ALTO / 2;
const MORRO_DESDE_EL_CENTRO = 30;
const ALTURA_DEL_FARO = 18;
const RESPLANDOR_LADO = 32;

export function actualizarGeometriaDeFoco(
  foco: GeometriaDeFoco,
  camionetaX: number,
  sueloY: number,
  haciaLaIzquierda: boolean,
) {
  foco.direccion = haciaLaIzquierda ? -1 : 1;
  foco.x = camionetaX + foco.direccion * MORRO_DESDE_EL_CENTRO;
  foco.y = sueloY - ALTURA_DEL_FARO;
}

function intensidadEnCono(frente: number, distanciaLateral: number): number {
  if (frente < 0 || frente >= ALCANCE_DEL_FOCO) {
    return 0;
  }
  const avance = frente / (ALCANCE_DEL_FOCO - 1);
  const mediaApertura =
    MEDIA_APERTURA_INICIAL + avance * (MEDIA_APERTURA_FINAL - MEDIA_APERTURA_INICIAL);
  if (distanciaLateral >= mediaApertura) {
    return 0;
  }
  const borde = 1 - distanciaLateral / mediaApertura;
  const transicionLateral = borde * borde * (3 - 2 * borde);
  return (1 - avance) * transicionLateral;
}

export function intensidadEnFoco(foco: GeometriaDeFoco, x: number, y: number): number {
  const frente = (x - foco.x) * foco.direccion;
  return intensidadEnCono(frente, Math.abs(y - foco.y));
}

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
    for (let y = 0; y < CONO_ALTO; y += 1) {
      const intensidad = intensidadEnCono(x, Math.abs(y - centro));
      const alfa = Math.round(intensidad * 175);
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
