class Sonido {
  private contexto: AudioContext | null = null;
  private maestro: GainNode | null = null;
  private lluvia: GainNode | null = null;

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
    const objetivo = Math.min(0.35, 0.06 + caudal * 0.09);
    this.lluvia.gain.setTargetAtTime(objetivo, this.contexto.currentTime, 0.6);
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

  derrota() {
    this.golpe(150, 0.9, 0.32, "sawtooth");
    this.golpe(90, 1.4, 0.28, "sine", 0.2);
  }

  victoria() {
    [523, 659, 784].forEach((nota, indice) => {
      this.golpe(nota, 0.35, 0.22, "triangle", indice * 0.12);
    });
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
