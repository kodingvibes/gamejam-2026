import musicaUrl from "../../assets/musica-arcade-de-lluvia.mp3";

const VOLUMEN_DE_MUSICA = 0.1;
const LLUVIA_BASE = 0.029;
const LLUVIA_POR_CAUDAL = 0.048;
const LLUVIA_MAXIMA = 0.17;

class Sonido {
  private contexto: AudioContext | null = null;
  private maestro: GainNode | null = null;
  private musica: GainNode | null = null;
  private musicaFuente: AudioBufferSourceNode | null = null;
  private lluvia: GainNode | null = null;
  private motor: GainNode | null = null;
  private motorOscilador: OscillatorNode | null = null;
  private succion: GainNode | null = null;
  private succionFuente: AudioBufferSourceNode | null = null;
  private ultimoGranizo = 0;

  encender() {
    if (this.contexto) {
      if (this.contexto.state === "suspended") {
        void this.contexto.resume();
      }
      return;
    }
    const Constructor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Constructor) {
      return;
    }
    this.contexto = new Constructor();
    this.maestro = this.contexto.createGain();
    this.maestro.gain.value = 0.5;
    this.maestro.connect(this.contexto.destination);
    this.lluvia = this.contexto.createGain();
    this.lluvia.gain.value = 0;
    this.lluvia.connect(this.maestro);
    this.arrancarLluvia();
    this.arrancarMotor();
    this.arrancarSuccion();
    void this.arrancarMusica();
    if (this.contexto.state === "suspended") {
      void this.contexto.resume();
    }
  }

  get despierto(): boolean {
    return this.contexto?.state === "running";
  }

  intensidadDeLluvia(caudal: number) {
    if (!this.contexto || !this.lluvia) {
      return;
    }
    const objetivo = Math.min(LLUVIA_MAXIMA, LLUVIA_BASE + caudal * LLUVIA_POR_CAUDAL);
    this.lluvia.gain.setTargetAtTime(objetivo, this.contexto.currentTime, 0.6);
  }

  /** Llamar cada frame: sube o baja el ronroneo del motor segun si la camioneta se mueve. */
  actualizarMotor(enMovimiento: boolean, enAgua: boolean) {
    if (!this.contexto || !this.motor || !this.motorOscilador) {
      return;
    }
    const objetivo = enMovimiento ? (enAgua ? 0.12 : 0.16) : 0.02;
    this.motor.gain.setTargetAtTime(objetivo, this.contexto.currentTime, 0.15);
    const frecuencia = enMovimiento ? (enAgua ? 58 : 72) : 40;
    this.motorOscilador.frequency.setTargetAtTime(frecuencia, this.contexto.currentTime, 0.2);
  }

  /** Llamar cada frame: sube o baja la succion segun si se esta destapando una rejilla. */
  actualizarSuccion(trabajando: boolean) {
    if (!this.contexto || !this.succion) {
      return;
    }
    const objetivo = trabajando ? 0.22 : 0;
    this.succion.gain.setTargetAtTime(objetivo, this.contexto.currentTime, 0.1);
  }

  chapoteo() {
    this.golpe(190, 0.14, 0.22, "sine");
  }

  rejillaDestapada() {
    this.golpe(420, 0.18, 0.3, "triangle");
    this.golpe(640, 0.14, 0.24, "triangle", 0.09);
  }

  granizo() {
    this.golpe(1800, 0.04, 0.12, "square");
  }

  /** Llamar cada frame durante la partida: con probabilidad segun granizoPorSegundo, suena un golpe. */
  talVezGranizo(granizoPorSegundo: number, segundos: number) {
    if (!this.contexto || granizoPorSegundo <= 0) {
      return;
    }
    if (this.contexto.currentTime - this.ultimoGranizo < 0.05) {
      return;
    }
    if (Math.random() < granizoPorSegundo * segundos) {
      this.ultimoGranizo = this.contexto.currentTime;
      this.granizo();
    }
  }

  derrota() {
    this.golpe(150, 0.9, 0.32, "sawtooth");
    this.golpe(90, 1.4, 0.28, "sine", 0.2);
  }

  victoria() {
    [523, 659, 784].forEach((nota, indice) => {
      this.golpe(nota, 0.35, 0.22, "triangle", indice * 0.12);
    });
  }

  recuerdoAtrapado() {
    this.golpe(880, 0.12, 0.2, "triangle");
    this.golpe(1320, 0.1, 0.16, "triangle", 0.07);
  }

  recuerdoPerdido() {
    this.golpe(150, 0.24, 0.16, "sawtooth");
  }

  private async arrancarMusica() {
    if (!this.contexto || !this.maestro || this.musica || this.musicaFuente) {
      return;
    }
    const contexto = this.contexto;
    const salida = contexto.createGain();
    salida.gain.value = VOLUMEN_DE_MUSICA;
    salida.connect(this.maestro);
    this.musica = salida;
    try {
      const respuesta = await fetch(musicaUrl);
      const codificado = await respuesta.arrayBuffer();
      const buffer = await contexto.decodeAudioData(codificado);
      if (this.musicaFuente) {
        return;
      }
      const fuente = contexto.createBufferSource();
      fuente.buffer = buffer;
      fuente.loop = true;
      fuente.connect(salida);
      fuente.start();
      this.musicaFuente = fuente;
    } catch {
      salida.disconnect();
      this.musica = null;
    }
  }

  private arrancarLluvia() {
    if (!this.contexto || !this.lluvia) {
      return;
    }
    const largo = this.contexto.sampleRate * 2;
    const buffer = this.contexto.createBuffer(1, largo, this.contexto.sampleRate);
    const datos = buffer.getChannelData(0);
    let anterior = 0;
    for (let muestra = 0; muestra < largo; muestra += 1) {
      const blanco = Math.random() * 2 - 1;
      anterior = anterior * 0.86 + blanco * 0.14;
      datos[muestra] = anterior * 3.2;
    }
    const fuente = this.contexto.createBufferSource();
    fuente.buffer = buffer;
    fuente.loop = true;
    const filtro = this.contexto.createBiquadFilter();
    filtro.type = "bandpass";
    filtro.frequency.value = 1400;
    filtro.Q.value = 0.4;
    fuente.connect(filtro);
    filtro.connect(this.lluvia);
    fuente.start();
  }

  private arrancarMotor() {
    if (!this.contexto || !this.maestro) {
      return;
    }
    this.motor = this.contexto.createGain();
    this.motor.gain.value = 0;
    this.motor.connect(this.maestro);

    this.motorOscilador = this.contexto.createOscillator();
    this.motorOscilador.type = "sawtooth";
    this.motorOscilador.frequency.value = 40;
    const filtro = this.contexto.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = 220;
    filtro.Q.value = 0.7;
    this.motorOscilador.connect(filtro);
    filtro.connect(this.motor);
    this.motorOscilador.start();
  }

  private arrancarSuccion() {
    if (!this.contexto || !this.maestro) {
      return;
    }
    this.succion = this.contexto.createGain();
    this.succion.gain.value = 0;
    this.succion.connect(this.maestro);

    const largo = this.contexto.sampleRate;
    const buffer = this.contexto.createBuffer(1, largo, this.contexto.sampleRate);
    const datos = buffer.getChannelData(0);
    let anterior = 0;
    for (let muestra = 0; muestra < largo; muestra += 1) {
      const blanco = Math.random() * 2 - 1;
      anterior = anterior * 0.7 + blanco * 0.3;
      datos[muestra] = anterior * 2.6;
    }
    this.succionFuente = this.contexto.createBufferSource();
    this.succionFuente.buffer = buffer;
    this.succionFuente.loop = true;
    const filtro = this.contexto.createBiquadFilter();
    filtro.type = "bandpass";
    filtro.frequency.value = 420;
    filtro.Q.value = 1.1;
    const lfo = this.contexto.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 5.5;
    const lfoGanancia = this.contexto.createGain();
    lfoGanancia.gain.value = 90;
    lfo.connect(lfoGanancia);
    lfoGanancia.connect(filtro.frequency);
    lfo.start();
    this.succionFuente.connect(filtro);
    filtro.connect(this.succion);
    this.succionFuente.start();
  }

  private golpe(
    frecuencia: number,
    duracion: number,
    volumen: number,
    forma: OscillatorType,
    retraso = 0,
  ) {
    if (!this.contexto || !this.maestro) {
      return;
    }
    const ahora = this.contexto.currentTime + retraso;
    const oscilador = this.contexto.createOscillator();
    const ganancia = this.contexto.createGain();
    oscilador.type = forma;
    oscilador.frequency.setValueAtTime(frecuencia, ahora);
    oscilador.frequency.exponentialRampToValueAtTime(Math.max(40, frecuencia * 0.55), ahora + duracion);
    ganancia.gain.setValueAtTime(0, ahora);
    ganancia.gain.linearRampToValueAtTime(volumen, ahora + 0.01);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, ahora + duracion);
    oscilador.connect(ganancia);
    ganancia.connect(this.maestro);
    oscilador.start(ahora);
    oscilador.stop(ahora + duracion + 0.05);
  }
}

export const sonido = new Sonido();
