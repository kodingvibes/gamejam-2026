// Tres camaras del mismo mundo. Lo unico que cambia es la proyeccion: fisica, cues y
// colisiones son identicas desde las tres (el mundo sigue siendo funcion de songT).
// `this` es la escena: frame() fija el encuadre del frame, proj() pasa mundo -> pantalla.
// zn = z minimo que se dibuja: lo que queda detras de la camara no se pinta.
import { PLAYER_Z, PLAYER_H, SLIDE_H } from "./physics.js";

export const CAM_Y = 340;

export const CAMS = [
  {
    id: "atras", body: true, zn: 60,
    frame(w, h) {
      // el horizonte cruza la pantalla con el giro: la pista necesita el lado largo, o el
      // jugador se sale por arriba al quedar de cabeza
      this.horizon = this.bgY = h * (0.5 - 0.14 * Math.cos(this.roll));
      this.fov = h * 1.05;   // el jugador cae al ~85% de la altura en cualquier canvas
      this.camY = CAM_Y * Math.cos(this.roll);   // el giro es la camara cruzando el piso
    },
    // camY < 0 = camara al otro lado del piso: la pista pasa a ser techo y todo lo que
    // sale de proj (bandas, cajas, cues, jugador) se da vuelta junto.
    proj(x, y, z) {
      const s = this.fov / Math.max(z, 1);
      return { x: this.scale.width / 2 + x * s, y: this.horizon + (this.camY - y) * s, s };
    },
  },
  {
    // Geometry dash de verdad: 2D plano, UN solo carril. La x del mundo no proyecta a
    // ningun lado, o sea los tres carriles se colapsan en la misma linea. Por eso las
    // zonas con `cam: "lado"` tienen que ser de un carril (`zones` en music.js): si no,
    // dos cajas de carriles distintos se dibujarian una encima de la otra.
    // `flat` = no hay carriles que dibujar: las bandas del suelo cruzan la pantalla.
    id: "lado", body: true, zn: 60, flat: true,
    frame(w, h) {
      this.fov = h / 1000;       // escala fija: no depende de z
      this.horizon = h * 0.72;   // el suelo (y=0)
      this.camY = Math.cos(this.roll);   // solo el signo: de que lado se rellena el suelo
      // las capas van mas arriba (si no, las cajas se pierden); de cabeza se espejan en el
      // horizonte, que es el unico sitio donde no las tapa el suelo
      this.bgY = this.camY >= 0 ? h * 0.46 : this.horizon;
    },
    // de perfil la camara no gira: con la gravedad invertida el mundo (jugador incluido)
    // cuelga del plano y=0, que pasa a ser el techo. Es el mismo mundo, sin espejo.
    proj(x, y, z) {
      const s = this.fov;
      return { x: this.scale.width * 0.2 + (z - PLAYER_Z) * s, y: this.horizon - y * s, s };
    },
  },
  {
    // Primera persona: la camara ES el jugador (misma hitbox, mismas teclas), asi que
    // sigue su carril y su altura de ojos. El muneco no se dibuja.
    // El plano cercano esta a 90 y no a 40: con 40 lo que te pasa al lado proyectaba a
    // s=21 (fov/40) y un hueco del carril de al lado se comia un cuarto de la pantalla
    // como una mancha plana. Con 90 el maximo es s=9.4 y lo cercano se lee como cercano.
    id: "1a persona", body: false, zn: PLAYER_Z + 90,
    frame(w, h) {
      this.horizon = this.bgY = h * (0.5 - 0.14 * Math.cos(this.roll));
      this.fov = h * 1.05;
      // ojos (con grav -1 queda negativa). Deslizando la cabeza baja a la altura de slide:
      // sin esto la camara no se mueve y desde dentro no se sabe si estas agachado o no.
      const eye = (this.sliding > 0 && this.y === 0 ? SLIDE_H : PLAYER_H) * 0.72;
      // CADENCIA: dos zancadas por beat. Sin esto la camara va sobre rieles y no se percibe
      // que corres (el suelo es plano y no hay muneco que de referencia): es lo que hacia
      // que la vista se leyera como una foto. Sale de songT, o sea que rebobinar la rebobina,
      // y se apaga en el aire: saltando no hay pisadas.
      const p = (this.songT / (this.lv?.beat ?? 0.4615)) * Math.PI * 2;
      const paso = this.y === 0 && this.dash <= 0 ? 1 : 0;
      this.bobY = paso * Math.abs(Math.sin(p)) * 4;      // la cabeza sube en cada pisada
      this.bobX = paso * Math.sin(p / 2) * 7;            // y el cuerpo se balancea, medio ciclo
      this.camY = this.y + this.grav * (eye + this.bobY);
    },
    proj(x, y, z) {
      const s = this.fov / Math.max(z - PLAYER_Z + 90, 90);
      // el balanceo va en PANTALLA (es la cabeza girando, no el mundo moviendose): asi el
      // horizonte se mueve con vos y no hay que reproyectar nada.
      return {
        x: this.scale.width / 2 + (x - this.x) * s + this.bobX,
        y: this.horizon + (this.camY - y) * s, s,
      };
    },
  },
];
