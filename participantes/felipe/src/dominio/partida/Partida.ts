import { DIFICULTAD } from "../../config";
import { Azar } from "../agua/Azar";
import { Frente } from "../agua/Frente";
import type { Curva, Oleada } from "../agua/Oleadas";
import { curvaSinFin, curvaTemporal, envolventeDeCaudal } from "../agua/Oleadas";
import { Alameda } from "../corredor/Alameda";
import type { Sumidero } from "../corredor/Sumidero";
import { ALCANCE_METROS, Jugador } from "./Jugador";
import { MODOS, type Modo } from "./Modo";
import { Puntaje } from "./Puntaje";

export type Resultado = "jugando" | "ganada" | "perdida";

export const DESTAPADO_POR_SEGUNDO = 0.6;
export const CRECIDA_CERCA_DE_LA_MONEDA = 1.6;
export const SUCIEDAD_INICIAL = 0.97;
export const SUMIDEROS_SUCIOS_AL_INICIO = 4;
export const SUCIEDAD_INICIAL_MINIMA = 0.84;
export const SEMILLA_POR_DEFECTO = 20260801;

export class Partida {
  private segundos = 0;
  private inundacionActual = 0;
  private resultadoActual: Resultado = "jugando";

  private constructor(
    readonly modo: Modo,
    readonly alameda: Alameda,
    readonly curva: Curva,
    readonly frente: Frente,
    readonly puntaje: Puntaje,
    readonly jugador: Jugador,
  ) {}

  static comenzar(modo: Modo, semilla: number = SEMILLA_POR_DEFECTO): Partida {
    const azar = new Azar(semilla);
    const alameda = Alameda.porDefecto(azar);
    const rango = SUCIEDAD_INICIAL - SUCIEDAD_INICIAL_MINIMA;
    alameda.sumideros.slice(0, SUMIDEROS_SUCIOS_AL_INICIO).forEach((sumidero) => {
      sumidero.ensuciar((SUCIEDAD_INICIAL_MINIMA + azar.fraccion() * rango) / sumidero.factorDeSuciedad);
    });
    const curva = modo === MODOS.temporal ? curvaTemporal() : curvaSinFin();
    return new Partida(
      modo,
      alameda,
      curva,
      new Frente(alameda.largoMetros),
      new Puntaje(),
      new Jugador(120),
    );
  }

  sumideroAlAlcance(): Sumidero | null {
    const cercano = this.alameda.masCercano(this.jugador.metro);
    return Math.abs(cercano.metro - this.jugador.metro) <= ALCANCE_METROS ? cercano : null;
  }

  get tiempoSegundos(): number {
    return this.segundos;
  }

  get resultado(): Resultado {
    return this.resultadoActual;
  }

  get terminada(): boolean {
    return this.resultadoActual !== "jugando";
  }

  get oleada(): Oleada {
    return this.curva.oleadaEn(this.segundos);
  }

  get numeroDeOleada(): number {
    return this.curva.numeroDeOleada(this.segundos);
  }

  get inundacion(): number {
    return this.inundacionActual;
  }

  get avance(): number {
    return this.frente.metro / this.frente.largoMetros;
  }

  get caudal(): number {
    return (
      this.oleada.caudal *
      envolventeDeCaudal(this.segundos) *
      (1 + this.avance * CRECIDA_CERCA_DE_LA_MONEDA) *
      DIFICULTAD
    );
  }

  avanzar(segundos: number, inundacion: number) {
    if (this.terminada || segundos <= 0) {
      return;
    }
    this.segundos += segundos;
    this.inundacionActual = Math.max(0, Math.min(1, inundacion));
    this.puntaje.correrTiempo(segundos);

    const oleada = this.curva.oleadaEn(this.segundos);
    this.alameda.ensuciarTodos(oleada.obstruccionPorSegundo * segundos * DIFICULTAD);
    this.frente.avanzar(segundos);

    if (this.inundacionActual >= 1) {
      this.resultadoActual = "perdida";
      return;
    }
    if (this.modo === MODOS.temporal && this.frente.llegoALaMoneda) {
      this.resultadoActual = "ganada";
    }
  }

  destapar(sumidero: Sumidero, segundos: number): boolean {
    const estabaTapado = sumidero.estado !== "limpio";
    sumidero.destapar(DESTAPADO_POR_SEGUNDO * segundos);
    const quedoLimpio = sumidero.estado === "limpio";
    if (estabaTapado && quedoLimpio) {
      this.puntaje.anotarDestapada();
      return true;
    }
    return false;
  }
}
