/**
 * Música procedural y SFX con Web Audio API. Sin assets, sin dependencias.
 *
 * API pública (todo es no-op seguro si el navegador no expone Web Audio):
 *   unlock()                       crea el AudioContext. Llamar SOLO desde un gesto de usuario.
 *   newMatch(random)               tonalidad al azar y melodía en blanco. random() es inyectable.
 *   startMusic() / stopMusic()     arranca o detiene el secuenciador. startMusic hace unlock().
 *   setDifficulty(difficulty)      'easy'|'medium'|'hard' -> 84/100/120 bpm. Otro valor -> 96 bpm.
 *   setProgress(ratio)             0..1 de líneas trazadas. Define las capas del arreglo.
 *   playMove(lineId, gridSize)     pluck afinado según la línea trazada y nota para el arpegio.
 *   playBoxClaim(chainIndex, byPlayer)  remate por grados de escala. chainIndex 0..CHAIN_CAP,
 *                                  byPlayer 0 humano (sube) o 1 IA (baja). Agacha el bed.
 *   playInvalid() / playHover()    feedback corto de UI.
 *   playTurnChange(player)         player 0 o 1.
 *   playLeadChange(player, isComeback)  cambio de líder. player 0 sube, 1 baja.
 *                                  isComeback (remontada desde 3+ abajo) añade nota y ganancia.
 *   playClinch()                   la partida queda matemáticamente decidida. No es victoria.
 *   playStamp(isRecord)            sello de la nota final en la pantalla de resultado.
 *   setNoSafeMoves(flag)           sin jugadas seguras: fuerza el cambio de marcha en el downbeat.
 *   playVictory() / playDefeat()   remates finales.
 *   setMuted(muted) / toggleMute() devuelven el estado de silencio (boolean).
 *   vibrate(pattern)               háptico móvil, apagado por el mismo silencio.
 *   getBands()                     {low, mid} cada uno 0..1.
 *   getBeat()                      pulso 0..1 desde el último bombo.
 *
 * Singleton: new AudioManager() siempre devuelve la misma instancia, porque Phaser
 * reinicia escenas y Chrome limita la cantidad de AudioContext por pestaña.
 */
class AudioManager {
  constructor() {
    if (AudioManager.instance) return AudioManager.instance;
    AudioManager.instance = this;
    this.context = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.analyser = null;
    this.spectrum = null;
    this.noiseBuffer = null;
    this.reverb = null;
    this.delay = null;
    this.muted = false;
    this.playing = false;
    this.timerId = null;
    this.step = 0;
    this.bar = 0;
    this.nextStepTime = 0;
    this.bpm = AudioManager.DEFAULT_BPM;
    this.progress = 0;
    this.transpose = 0;
    // Buffer circular de grados: cada jugada reescribe el arpegio.
    this.melody = [];
    this.gear = false;
    // Se enciende cuando findSafeMoves llega a cero: adelanta el cambio de marcha al
    // momento real en que cambia el carácter de la partida, no al umbral fijo.
    this.forceGear = false;
    this.lastKickTime = -10;
    this.prevKickTime = -10;
    this.lastHoverTime = -10;
  }

  /** @param {string} lineId @returns {{type: string, row: number, column: number}|null} */
  static parseLineId(lineId) {
    const match = /^([hv])-(\d+)-(\d+)$/.exec(String(lineId));
    if (!match) return null;
    return { type: match[1], row: Number(match[2]), column: Number(match[3]) };
  }

  /**
   * Grado de escala de una línea, 0..SCALE.length*2. El recorrido por el tablero
   * se normaliza para que cualquier rejilla cubra el mismo par de octavas.
   * @param {string} lineId @param {number} gridSize @returns {number}
   */
  static degreeForLine(lineId, gridSize) {
    const parsed = AudioManager.parseLineId(lineId);
    if (!parsed) return 0;
    const size = Number.isInteger(gridSize) && gridSize > 2 ? gridSize : 3;
    const along = parsed.type === 'h' ? parsed.column : parsed.row;
    const across = parsed.type === 'h' ? parsed.row : parsed.column;
    const steps = AudioManager.SCALE.length * 2;
    const raw = Math.round(((along + across) / (2 * size - 3)) * steps);
    return Math.min(steps, Math.max(0, raw));
  }

  /** Semitonos sobre la tónica de un grado de escala. @param {number} degree @returns {number} */
  static midiForDegree(degree) {
    const size = AudioManager.SCALE.length;
    const index = Math.max(0, Math.round(degree));
    return 12 * Math.floor(index / size) + AudioManager.SCALE[index % size];
  }

  /** Nota MIDI de una línea, relativa a ROOT_MIDI. @param {string} lineId @param {number} gridSize @returns {number} */
  static midiForLine(lineId, gridSize) {
    const parsed = AudioManager.parseLineId(lineId);
    if (!parsed) return AudioManager.ROOT_MIDI;
    const verticalShift = parsed.type === 'v' ? 12 : 0;
    return AudioManager.ROOT_MIDI + verticalShift
      + AudioManager.midiForDegree(AudioManager.degreeForLine(lineId, gridSize));
  }

  /** @param {number} midi @returns {number} Hz */
  static frequency(midi) {
    return 440 * (2 ** ((midi - 69) / 12));
  }

  /** @param {string} lineId @param {number} gridSize @returns {number} Hz */
  static frequencyForLine(lineId, gridSize) {
    return AudioManager.frequency(AudioManager.midiForLine(lineId, gridSize));
  }

  /**
   * Grado base del remate de caja. El humano sube con la racha y la IA baja, así el
   * mismo golpe se lee como "toma" o como "ay". El índice se acota aquí dentro: es el
   * único sitio donde vive el tope, y por eso es lo que fijan las pruebas.
   * @param {number} index posición en la racha @param {number} byPlayer 0 humano, 1 IA
   * @returns {number} grado de escala 0..CHAIN_CAP
   */
  static claimDegreeBase(index, byPlayer = 0) {
    const value = Number.isFinite(index) ? Math.floor(index) : 0;
    const clamped = Math.min(AudioManager.CHAIN_CAP, Math.max(0, value));
    return byPlayer === 1 ? AudioManager.CHAIN_CAP - clamped : clamped;
  }

  /**
   * Notas del aviso de cambio de líder, en grados de escala: quinta justa y octava.
   * La remontada añade una tercera nota por encima. El jugador 1 recibe la inversión
   * descendente, misma convención que playTurnChange.
   * @param {number} player 0 humano, 1 IA @param {boolean} isComeback
   * @returns {number[]} grados de escala
   */
  static leadChangeDegrees(player = 0, isComeback = false) {
    // Grado 3 -> 7 semitonos (quinta), 5 -> 12 (octava), 8 -> 19 (docena).
    const degrees = isComeback ? [3, 5, 8] : [3, 5];
    return player === 1 ? degrees.reverse() : degrees;
  }

  /** @param {number} progress 0..1 @returns {{pulse: boolean, pad: boolean, bass: boolean, hats: boolean, arp: boolean, gear: boolean, lead: boolean}} */
  static layersForProgress(progress) {
    const ratio = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
    const layers = {};
    Object.keys(AudioManager.LAYER_THRESHOLDS).forEach((name) => {
      layers[name] = ratio >= AudioManager.LAYER_THRESHOLDS[name];
    });
    return layers;
  }

  /** Crea el AudioContext. Solo debe llamarse dentro de un gesto de usuario. */
  unlock() {
    if (this.context) {
      // Fuera de un gesto de usuario resume() rechaza con NotAllowedError: se ignora.
      if (this.context.state === 'suspended') this.context.resume()?.catch(() => {});
      return this.context;
    }
    const AudioContextClass = typeof window !== 'undefined'
      ? (window.AudioContext || window.webkitAudioContext)
      : null;
    if (!AudioContextClass) return null;

    const context = new AudioContextClass();
    this.context = context;
    this.master = context.createGain();
    this.master.gain.value = this.muted ? 0 : AudioManager.MASTER_GAIN;
    this.musicBus = context.createGain();
    // El bed iba 14dB por debajo de cualquier sting: por eso sonaba vacío.
    this.musicBus.gain.value = AudioManager.MUSIC_GAIN;
    this.sfxBus = context.createGain();
    this.sfxBus.gain.value = 0.8;
    this.analyser = context.createAnalyser();
    // 512 bins de ~43Hz a 44.1kHz: con fftSize 256 el bombo entero caía en un solo bin.
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.75;
    this.spectrum = new Uint8Array(this.analyser.frequencyBinCount);
    const compressor = context.createDynamicsCompressor();
    // Compresor de pegamento, no limitador: el ataque de 8ms deja pasar el transitorio
    // del bombo en vez de comérselo como hacía el ajuste por defecto (3ms, ratio 12).
    compressor.threshold.value = -14;
    compressor.knee.value = 8;
    compressor.ratio.value = 3.5;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.14;
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    // El analizador cuelga del master en paralelo: ve la señal limpia, pre saturador y
    // pre compresor, así el limitador ya no aplasta los visuales. Post master mantiene
    // correcto el silencio: master.gain a 0 anula el espectro.
    this.master.connect(this.analyser);
    // Sumidero a ganancia 0. La rama del analizador no llega al destino y la norma solo
    // obliga a procesar lo que sí llega: esto lo garantiza sin añadir ni un dB.
    const analyserSink = context.createGain();
    analyserSink.gain.value = 0;
    this.analyser.connect(analyserSink).connect(context.destination);

    let tail = this.master;
    if (typeof context.createWaveShaper === 'function') {
      const shaper = context.createWaveShaper();
      const curve = new Float32Array(1024);
      // Normalizado por tanh(drive): satura sin subir de nivel y sin pelear con el compresor.
      // Los armónicos que genera del bombo son lo que hace audible el grave en un móvil.
      for (let index = 0; index < 1024; index += 1) {
        const x = (index / 1023) * 2 - 1;
        curve[index] = Math.tanh(x * AudioManager.SATURATION_DRIVE) / Math.tanh(AudioManager.SATURATION_DRIVE);
      }
      shaper.curve = curve;
      shaper.oversample = '2x'; // sin esto los hats alias y suenan a fritura
      this.master.connect(shaper);
      tail = shaper;
    }
    tail.connect(compressor);
    compressor.connect(context.destination);

    // Envíos globales: cada voz termina en silencio digital, así que el compás tiene
    // huecos. La reverb y el delay los rellenan con la energía de las propias voces
    // sin tocar ni una línea de pluck/sustained/noise/kick.
    if (typeof context.createConvolver === 'function') {
      const reverb = context.createConvolver();
      const length = Math.floor(context.sampleRate * AudioManager.REVERB_SECONDS);
      const impulse = context.createBuffer(2, length, context.sampleRate);
      for (let channel = 0; channel < 2; channel += 1) {
        const data = impulse.getChannelData(channel);
        let previous = 0;
        for (let index = 0; index < length; index += 1) {
          const ratio = index / length;
          // Un polo pasa-bajo: sin esto la cola de ruido blanco suena a siseo de cinta.
          previous = previous * 0.62 + (Math.random() * 2 - 1) * 0.38;
          // La rampa de 12ms de entrada evita el chasquido inicial.
          data[index] = previous * ((1 - ratio) ** 3.2) * Math.min(1, index / (context.sampleRate * 0.012));
        }
      }
      reverb.buffer = impulse;
      reverb.connect(this.master);
      this.reverb = reverb;
    }
    this.delay = context.createDelay(1.5);
    this.delay.delayTime.value = 3 * this.stepDuration(); // corchea con puntillo
    const feedback = context.createGain();
    feedback.gain.value = 0.32;
    const feedbackTone = context.createBiquadFilter();
    feedbackTone.type = 'lowpass';
    feedbackTone.frequency.value = 2400;
    this.delay.connect(feedbackTone).connect(feedback).connect(this.delay);
    this.delay.connect(this.master);
    // El envío va filtrado en 300Hz: mandar graves a una reverb es barro, y además deja
    // el bombo y el bajo fuera de los efectos, así getBands().low no cambia ni un bit.
    const send = (source, amount, target) => {
      if (!target) return;
      const gain = context.createGain();
      gain.gain.value = amount;
      const highpass = context.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 300;
      source.connect(gain).connect(highpass).connect(target);
    };
    send(this.musicBus, 0.16, this.reverb);
    send(this.musicBus, 0.13, this.delay);
    send(this.sfxBus, 0.24, this.reverb);
    send(this.sfxBus, 0.16, this.delay);

    // Ruido blanco reutilizado por hats, barridos y remates.
    const frames = Math.floor(context.sampleRate * 0.4);
    this.noiseBuffer = context.createBuffer(1, frames, context.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let index = 0; index < frames; index += 1) data[index] = Math.random() * 2 - 1;
    if (context.state === 'suspended') context.resume()?.catch(() => {});
    return context;
  }

  /** Voz corta y percusiva. @param {number} frequency @param {number} time @param {number} duration @param {number} gainValue @param {string} type @param {AudioNode} bus */
  pluck(frequency, time, duration = 0.24, gainValue = 0.16, type = 'triangle', bus = this.sfxBus) {
    const context = this.context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    filter.type = 'lowpass';
    // Envolvente de filtro por nota: antes todas compartían el mismo pico estático en
    // frequency*6 y sonaban al mismo timbre. El barrido da el ataque brillante.
    filter.frequency.setValueAtTime(Math.min(14000, frequency * 9), time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(200, frequency * 1.6), time + duration * 0.55);
    filter.Q.value = 3;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(gainValue, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(filter).connect(gain).connect(bus);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.03);
  }

  /** Voz sostenida del bed: bajo con filtro cerrado o pad si cutoff es alto. */
  sustained(frequency, time, duration, gainValue, cutoff, bus = this.musicBus, type = 'sawtooth') {
    const context = this.context;
    if (!context) return;
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, time);
    // Dos osciladores a +-9 cents baten a ~1.15Hz en una nota de 110Hz. Con uno solo
    // el detune no batía contra nada: dejaba el bed 7 cents bajo y nada más.
    [-9, 9].forEach((cents) => {
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, time);
      oscillator.detune.setValueAtTime(cents, time);
      oscillator.connect(filter);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.05);
    });
    // Dos sierras correlacionadas suman unos +5dB, así que 0.6 y no 0.5.
    const level = gainValue * 0.6;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(level, time + duration * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    filter.connect(gain).connect(bus);
  }

  /** Bombo del pulso base. @param {number} time @param {number} gainValue */
  kick(time, gainValue = 0.5) {
    const context = this.context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(130, time);
    oscillator.frequency.exponentialRampToValueAtTime(44, time + 0.11);
    gain.gain.setValueAtTime(gainValue, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    oscillator.connect(gain).connect(this.musicBus);
    oscillator.start(time);
    oscillator.stop(time + 0.26);
    this.prevKickTime = this.lastKickTime;
    this.lastKickTime = time;
  }

  /** @param {number} time @param {number} duration @param {number} gainValue @param {number} cutoff @param {AudioNode} bus */
  noise(time, duration = 0.05, gainValue = 0.08, cutoff = 6000, bus = this.musicBus) {
    const context = this.context;
    if (!context || !this.noiseBuffer) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    source.buffer = this.noiseBuffer;
    // El buffer dura 0.4s: sin loop cualquier cola más larga se queda muda a medias.
    source.loop = true;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(cutoff, time);
    gain.gain.setValueAtTime(gainValue, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter).connect(gain).connect(bus);
    source.start(time);
    source.stop(time + duration + 0.02);
  }

  /** Redoble de ruido: sirve de fill de frase y de riser antes del cambio de marcha. */
  noiseRoll(time, stepDuration, hits = 4) {
    for (let index = 0; index < hits; index += 1) {
      const ratio = index / hits;
      this.noise(time + index * stepDuration, stepDuration * 0.9, 0.03 + ratio * 0.05, 900 + ratio * 5200);
    }
  }

  /** @returns {number} duración de una semicorchea en segundos */
  stepDuration() {
    return 60 / this.bpm / 4;
  }

  /** Tónica de la partida: ROOT_MIDI más la transposición sorteada. @returns {number} */
  root() {
    return AudioManager.ROOT_MIDI + this.transpose;
  }

  /** Acorde actual dentro del vamp de 4 compases. @returns {number} 0..3 */
  chordIndex() {
    return this.bar % AudioManager.CHORD_OFFSETS.length;
  }

  /**
   * Arranca una partida: sortea la tonalidad y borra la melodía anterior.
   * random es inyectable para que las pruebas fijen el resultado.
   * @param {function(): number} random @returns {number} semitonos de transposición
   */
  newMatch(random = Math.random) {
    const keys = AudioManager.KEY_OFFSETS;
    const value = typeof random === 'function' ? Number(random()) : 0;
    const index = Number.isFinite(value) ? Math.floor(value * keys.length) : 0;
    this.transpose = keys[Math.min(keys.length - 1, Math.max(0, index))];
    this.melody = [];
    this.bar = 0;
    this.gear = false;
    this.forceGear = false;
    return this.transpose;
  }

  /** Empuja un grado al buffer circular que toca el arpegio. @param {number} degree */
  pushMelody(degree) {
    if (!Number.isFinite(degree)) return;
    this.melody.push(Math.max(0, Math.round(degree)));
    if (this.melody.length > AudioManager.MELODY_SLOTS) this.melody.shift();
  }

  startMusic() {
    if (!this.unlock() || this.playing) return;
    this.playing = true;
    this.step = 0;
    this.bar = 0;
    this.nextStepTime = this.context.currentTime + 0.08;
    this.timerId = setInterval(() => this.tick(), AudioManager.TICK_MS);
  }

  stopMusic() {
    this.playing = false;
    if (this.timerId !== null) clearInterval(this.timerId);
    this.timerId = null;
  }

  /** Agenda por adelantado los pasos que caen en la ventana de lookahead. */
  tick() {
    const context = this.context;
    if (!context || !this.playing) return;
    // Pestaña en segundo plano o pico de CPU: el reloj se adelantó al secuenciador.
    // Sin este salto se agendarían de golpe todos los pasos ya vencidos.
    if (this.nextStepTime < context.currentTime) this.nextStepTime = context.currentTime + 0.02;
    while (this.nextStepTime < context.currentTime + AudioManager.LOOKAHEAD) {
      // Swing: solo se retrasa el disparo, la rejilla sigue recta y no acumula deriva.
      const swing = this.step % 2 === 1 ? this.stepDuration() * AudioManager.SWING : 0;
      this.scheduleStep(this.step, this.nextStepTime + swing);
      this.nextStepTime += this.stepDuration();
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.bar = (this.bar + 1) % AudioManager.PHRASE_BARS;
    }
  }

  /** @param {number} step 0..15 @param {number} time */
  scheduleStep(step, time) {
    const layers = AudioManager.layersForProgress(this.progress);
    const stepDuration = this.stepDuration();
    const scale = AudioManager.SCALE;
    const bar = this.bar;
    const chord = this.chordIndex();
    // El fill cada 4 compases construye tanto hacia el drop como hacia el cierre de frase.
    const fill = bar % 4 === 3;
    // Único compás que distingue la primera mitad de la frase de la segunda: se caen
    // arpegio y hats, y bombo, bajo y pad siguen, así getBeat() nunca se queda plano.
    const drop = bar === AudioManager.DROP_BAR;
    // El cambio de marcha se resuelve en el downbeat: cae como cambio musical, no como
    // glitch. forceGear lo adelanta al momento en que ya no quedan jugadas seguras.
    const wantsGear = layers.gear || this.forceGear;
    if (step === 0) this.gear = wantsGear;

    const kickSteps = AudioManager.KICK_PATTERNS[bar % AudioManager.KICK_PATTERNS.length];
    // kick() sigue siendo el único que toca lastKickTime: getBeat() no se entera del cambio.
    if (layers.pulse && kickSteps.includes(step)) this.kick(time, step === 0 || step === 8 ? 0.5 : 0.34);
    if (layers.pulse && step === 12) {
      // Fill de fin de frase o riser previo al cambio de marcha, nunca los dos a la vez.
      if (fill || (wantsGear && !this.gear)) this.noiseRoll(time, stepDuration, 4);
      else this.noise(time, 0.12, 0.05, 3000);
    }
    if (layers.bass && AudioManager.BASS_STEPS.includes(step)) {
      // El bajo sí se mueve en semitonos: es quien dibuja el acorde (i - VI - III - VII).
      const interval = AudioManager.BASS_INTERVALS[AudioManager.BASS_STEPS.indexOf(step)];
      const root = this.root() + AudioManager.CHORD_OFFSETS[chord];
      this.sustained(AudioManager.frequency(root - 12 + interval), time, stepDuration * 2.2, 0.22, this.gear ? 620 : 420);
    }
    if (layers.pad && step === 0) {
      // Sin una voz sostenida el compás tiene huecos de silencio real. El corte se
      // abre con el progreso: el pad se destapa a medida que se llena el tablero.
      const padRoot = this.root() + AudioManager.CHORD_OFFSETS[chord];
      AudioManager.CHORD_TRIADS[chord].forEach((semitone, position) => {
        this.sustained(
          AudioManager.frequency(padRoot + 12 + semitone), time, stepDuration * 16.5,
          0.05 - position * 0.008, 900 + this.progress * 1600, this.musicBus, 'sawtooth',
        );
      });
    }
    if (layers.hats && !drop && (step % 2 === 1 || (bar % 4 === 3 && step % 4 === 2))) {
      this.noise(time, 0.035, step % 4 === 3 ? 0.07 : 0.04, 7000);
    }
    const arpSteps = AudioManager.ARP_PATTERNS[bar % AudioManager.ARP_PATTERNS.length];
    const slot = arpSteps.indexOf(step);
    if (layers.arp && slot >= 0 && !drop) {
      const figure = this.melody.length ? this.melody : AudioManager.DEFAULT_MELODY;
      // 3 es coprimo con MELODY_SLOTS: la figura rota entera a lo largo de la frase
      // en vez de repetir el mismo compás ocho veces.
      const read = (bar * 3 + slot) % AudioManager.MELODY_SLOTS;
      // El acorde desplaza el arpegio por grados y no por semitonos: se mueve con el
      // bajo pero no puede salirse de la pentatónica.
      const degree = (figure[read % figure.length] + chord) % (scale.length * 2 + 1);
      const frequency = AudioManager.frequency(this.root() + 12 + AudioManager.midiForDegree(degree));
      // El arpegio es cama, no efecto: va al bus de música para que lo atenúe.
      // El analizador cuelga del master, así que ve los dos buses pase lo que pase.
      this.pluck(frequency, time, stepDuration * 1.6, slot === 0 ? 0.13 : 0.095,
        this.gear ? 'sawtooth' : 'square', this.musicBus);
    }
    if (layers.lead && step === 0) {
      // Tríada por cuartas rotada con el acorde: consonante sobre los cuatro grados.
      [0, 2, 4].forEach((offset) => {
        const frequency = AudioManager.frequency(this.root() + 12 + scale[(chord + offset) % scale.length]);
        // El lead entra en 0.75 y el cambio de instrumento en 0.62: aquí gear ya es siempre true.
        this.sustained(frequency, time, stepDuration * 14, 0.04, 3200, this.musicBus, 'square');
      });
    }
  }

  /** @param {string} difficulty */
  setDifficulty(difficulty) {
    this.bpm = AudioManager.BPM_BY_DIFFICULTY[difficulty] ?? AudioManager.DEFAULT_BPM;
    // Escritura directa segura: GameScene llama aquí antes de startMusic, así que no hay
    // cola en vuelo. Cambiar delayTime con una cola sonando haría un doppler feísimo.
    if (this.delay) this.delay.delayTime.value = 3 * this.stepDuration();
  }

  /** @param {number} ratio 0..1 de cajas completadas */
  setProgress(ratio) {
    this.progress = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  }

  /** @param {boolean} muted @returns {boolean} */
  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.master && this.context) {
      const target = this.muted ? 0 : AudioManager.MASTER_GAIN;
      this.master.gain.setTargetAtTime(target, this.context.currentTime, 0.02);
    }
    return this.muted;
  }

  /** @returns {boolean} nuevo estado de silencio */
  toggleMute() {
    return this.setMuted(!this.muted);
  }

  /** @param {string} lineId @param {number} gridSize */
  playMove(lineId, gridSize) {
    // El tablero escribe la melodía: el arpegio lee este buffer en los compases siguientes.
    if (AudioManager.parseLineId(lineId)) this.pushMelody(AudioManager.degreeForLine(lineId, gridSize));
    if (!this.unlock()) return;
    const frequency = AudioManager.frequency(AudioManager.midiForLine(lineId, gridSize) + this.transpose);
    const time = this.context.currentTime;
    this.pluck(frequency, time, 0.22, 0.18, 'triangle');
    this.pluck(frequency * 2, time + 0.012, 0.1, 0.05, 'sine');
  }

  /** @param {number} chainIndex posición en la racha, se acota a 0..CHAIN_CAP @param {number} byPlayer 0 humano, 1 IA */
  playBoxClaim(chainIndex = 0, byPlayer = 0) {
    if (!this.unlock()) return;
    const index = Number.isFinite(chainIndex)
      ? Math.min(AudioManager.CHAIN_CAP, Math.max(0, Math.floor(chainIndex))) : 0;
    // Sin retraso: la escena ya escalona los golpes de una misma jugada, y sumar aquí el
    // índice de racha dejaba el remate hasta 270ms detrás de su propio estallido.
    const time = this.context.currentTime;
    const degreeBase = AudioManager.claimDegreeBase(index, byPlayer);
    // La escalera pasó de 6 a 10 peldaños. Las pendientes se reparten sobre CHAIN_CAP
    // en vez de subir 0.1 por peldaño: así el peldaño 10 aterriza en el mismo techo de
    // 1.6 que antes tenía el 6, sigue subiendo en todos y no recorta contra el master.
    const ramp = index / AudioManager.CHAIN_CAP;
    const boost = 1 + ramp * 0.6;
    // Por encima del peldaño 6 no se apilan más voces: se aprieta el escalonado. Diez
    // remates en ~600ms con 55ms de separación se solapan hasta hacer barro.
    const spread = index > 6 ? 0.04 : 0.055;
    [0, 2, 4].forEach((offset, position) => {
      const midi = this.root() + 12 + AudioManager.midiForDegree(degreeBase + offset);
      this.pluck(AudioManager.frequency(midi), time + position * spread, 0.28, 0.15 * boost, 'square');
    });
    if (index <= 2) {
      // Campana FM: dos senos en razón 3.5 dan el brillo metálico del remate. Solo hasta
      // el tercer eslabón: más arriba la cadena ya apila demasiadas voces.
      const bell = AudioManager.frequency(this.root() + 12 + AudioManager.midiForDegree(degreeBase + 6));
      this.pluck(bell, time, 0.5, 0.07, 'sine', this.sfxBus);
      this.pluck(bell * 3.5, time, 0.22, 0.03, 'sine', this.sfxBus);
    }
    // Barrido de ruido ascendente en vez de un golpe plano. Misma pendiente repartida:
    // el peldaño 10 llega al 0.088 que antes marcaba el 6.
    [2500, 5000, 9000].forEach((cutoff, position) => {
      this.noise(time + position * 0.05, 0.12, 0.04 + ramp * 0.048, cutoff, this.sfxBus);
    });
    // El bed se aparta un instante: el contraste de volumen es lo que agranda el premio.
    // Cada caja de la racha vuelve a llamar aquí, así el duck se estira solo.
    if (this.musicBus) {
      const bus = this.musicBus.gain;
      bus.cancelScheduledValues(time);
      bus.setValueAtTime(AudioManager.MUSIC_GAIN * AudioManager.DUCK_DEPTH, time);
      bus.setTargetAtTime(AudioManager.MUSIC_GAIN, time + 0.1, 0.14);
    }
  }

  playInvalid() {
    if (!this.unlock()) return;
    const time = this.context.currentTime;
    this.pluck(92, time, 0.14, 0.14, 'square');
    this.pluck(87, time + 0.02, 0.12, 0.1, 'square');
  }

  /** Solo suena si el audio ya está activo. Se limita para no saturar al pasar el ratón. */
  playHover() {
    if (!this.context || this.muted) return;
    const time = this.context.currentTime;
    if (time - this.lastHoverTime < 0.14) return;
    this.lastHoverTime = time;
    this.pluck(AudioManager.frequency(this.root() + 36), time, 0.05, 0.035, 'sine');
  }

  /** @param {number} player 0 o 1 */
  playTurnChange(player = 0) {
    if (!this.unlock()) return;
    const time = this.context.currentTime;
    const notes = player === 1 ? [12, 7] : [7, 12];
    notes.forEach((semitone, position) => {
      const frequency = AudioManager.frequency(this.root() + 12 + semitone);
      this.pluck(frequency, time + position * 0.07, 0.16, 0.09, 'triangle');
    });
  }

  /**
   * Cambio de líder: el marcador acaba de invertirse. Medido 0.7-1.1 veces por partida,
   * o sea un evento y no un goteo, así que puede permitirse ocupar el primer plano.
   * @param {number} player 0 humano, 1 IA @param {boolean} isComeback remontada desde 3+ abajo
   */
  playLeadChange(player = 0, isComeback = false) {
    if (!this.unlock()) return;
    const time = this.context.currentTime;
    const degrees = AudioManager.leadChangeDegrees(player, isComeback);
    // La remontada pega algo más fuerte, pero se queda lejos de playVictory: esto avisa,
    // no celebra. Va por sfxBus para que el duck del remate de caja también le aplique.
    const level = isComeback ? 0.14 : 0.105;
    degrees.forEach((degree, position) => {
      const midi = this.root() + 12 + AudioManager.midiForDegree(degree);
      this.pluck(AudioManager.frequency(midi), time + position * 0.09, 0.26, level, 'triangle');
    });
  }

  /**
   * La partida queda decidida matemáticamente (medido 3.6 jugadas antes del final en
   * 5x5 y 6.9 en 6x6). Golpe grave y seco, sin resolución: no es victoria, y quien
   * pierde no debe oírlo como un castigo.
   */
  playClinch() {
    if (!this.unlock()) return;
    const time = this.context.currentTime;
    // Tónica y quinta en el registro grave, casi a la vez: peso sin fanfarria.
    [0, 7].forEach((semitone, position) => {
      this.pluck(AudioManager.frequency(this.root() + semitone), time + position * 0.03,
        0.42, 0.15, 'sawtooth');
    });
    // Hinchada de ruido: dos golpes que abren el corte hacia arriba, cortos.
    [700, 2200].forEach((cutoff, position) => {
      this.noise(time + position * 0.07, 0.2, 0.05, cutoff, this.sfxBus);
    });
  }

  /**
   * Sello de la nota final, ~900ms después de abrirse el panel. Se cuela DEBAJO de la
   * cola de playVictory/playDefeat que ya está sonando: impacto corto y cola metálica.
   * @param {boolean} isRecord añade el gliss ascendente del récord
   */
  playStamp(isRecord = false) {
    if (!this.unlock()) return;
    const time = this.context.currentTime;
    // Impacto: fundamental una octava abajo más un chasquido de ruido. Eso es el "clac".
    this.pluck(AudioManager.frequency(this.root() - 12), time, 0.18, 0.18, 'square');
    this.noise(time, 0.09, 0.09, 1800, this.sfxBus);
    // Cola metálica con la misma razón 3.5 del remate de caja, a propósito fuera de escala.
    const bell = AudioManager.frequency(this.root() + 24);
    this.pluck(bell, time + 0.02, 0.7, 0.055, 'sine', this.sfxBus);
    this.pluck(bell * 3.5, time + 0.02, 0.3, 0.022, 'sine', this.sfxBus);
    if (!isRecord) return;
    [0, 2, 4, 6].forEach((degree, position) => {
      const midi = this.root() + 24 + AudioManager.midiForDegree(degree);
      this.pluck(AudioManager.frequency(midi), time + 0.12 + position * 0.06, 0.24, 0.075, 'triangle');
    });
  }

  /**
   * Sin jugadas seguras: alguien está obligado a abrir. No suena nada aquí, solo levanta
   * la bandera; el cambio se resuelve en el downbeat siguiente dentro de scheduleStep.
   * @param {boolean} flag
   */
  setNoSafeMoves(flag) {
    this.forceGear = Boolean(flag);
  }

  playVictory() {
    if (!this.unlock()) return;
    const time = this.context.currentTime;
    [0, 1, 2, 3, 4, 5].forEach((position) => {
      const scale = AudioManager.SCALE;
      const semitone = scale[position % scale.length] + (position >= 5 ? 12 : 0);
      const frequency = AudioManager.frequency(this.root() + 12 + semitone);
      this.pluck(frequency, time + position * 0.09, 0.4, 0.16, 'square');
    });
    this.sustained(AudioManager.frequency(this.root() + 12), time + 0.5, 1.6, 0.08, 2200, this.sfxBus);
  }

  playDefeat() {
    if (!this.unlock()) return;
    const time = this.context.currentTime;
    [4, 2, 0].forEach((degree, position) => {
      // La última nota baja un semitono para desafinar el cierre.
      const midi = this.root() + AudioManager.SCALE[degree] - (position === 2 ? 1 : 0);
      this.pluck(AudioManager.frequency(midi), time + position * 0.16, 0.5, 0.14, 'sawtooth');
    });
    this.noise(time, 0.9, 0.05, 500, this.sfxBus);
  }

  /** @returns {Uint8Array|null} espectro actualizado */
  readSpectrum() {
    if (!this.analyser || !this.spectrum) return null;
    this.analyser.getByteFrequencyData(this.spectrum);
    return this.spectrum;
  }

  /** @returns {{low: number, mid: number}} cada banda 0..1 */
  getBands() {
    const spectrum = this.readSpectrum();
    if (!spectrum) return { low: 0, mid: 0 };
    const average = (from, to) => {
      let total = 0;
      for (let index = from; index < to; index += 1) total += spectrum[index];
      return total / (to - from) / 255;
    };
    // Bandas definidas en Hz: el ancho de bin depende del sampleRate real.
    const bin = (hz) => Math.max(1, Math.round((hz * this.analyser.fftSize) / this.context.sampleRate));
    const split = bin(200); // debajo bombo (130->44Hz) y bajo (55-82Hz), encima arpegio y lead
    const top = Math.min(spectrum.length, Math.max(split + 1, bin(2500)));
    return {
      low: average(0, split),
      mid: average(split, top),
    };
  }

  /** @returns {number} 0..1 decaimiento desde el último bombo */
  getBeat() {
    if (!this.context || !this.playing) return 0;
    // lastKickTime es la hora AGENDADA, hasta LOOKAHEAD por delante: usar el último
    // bombo que ya sonó, si no el destello se adelanta al golpe.
    const now = this.context.currentTime;
    const kickTime = this.lastKickTime <= now ? this.lastKickTime : this.prevKickTime;
    return Math.exp(-Math.max(0, now - kickTime) * 6);
  }

  /**
   * Vibración opcional. El silencio también apaga los hápticos, y el patrón se
   * ignora si el dispositivo no expone la API.
   * @param {number|number[]} pattern
   */
  vibrate(pattern) {
    if (this.muted || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    try {
      navigator.vibrate(pattern);
    } catch (error) {
      // Algunos navegadores declaran la API y la rechazan sin gesto previo.
    }
  }
}

AudioManager.instance = null;
AudioManager.ROOT_MIDI = 45; // A2
AudioManager.SCALE = Object.freeze([0, 3, 5, 7, 10]); // pentatónica menor
// Tope de la escalera de racha. DEBE seguir a GAME_FEEL.streakCap en js/utils/Constants.js.
// No se lee de ahí a propósito: el sandbox de las pruebas carga solo este archivo y no
// puede ganar una dependencia de Constants.js.
AudioManager.CHAIN_CAP = 10;
AudioManager.DEFAULT_BPM = 96;
AudioManager.BPM_BY_DIFFICULTY = Object.freeze({ easy: 84, medium: 100, hard: 120 });
// gear va en la misma tabla que las capas: el final de partida es un umbral más, no otro sistema.
// Umbrales sobre líneas trazadas, no cajas: con los viejos el arreglo casi nunca llegaba a sonar.
AudioManager.LAYER_THRESHOLDS = Object.freeze({ pulse: 0, pad: 0, bass: 0, hats: 0.12, arp: 0.3, gear: 0.62, lead: 0.75 });
AudioManager.BASS_STEPS = Object.freeze([0, 3, 8, 11]);
// Intervalos sobre la fundamental del acorde: tónica, quinta y octava valen sobre los cuatro.
AudioManager.BASS_INTERVALS = Object.freeze([0, 7, 0, 12]);
// Vamp menor i - VI - III - VII (en La: Am F C G), un compás por acorde.
AudioManager.CHORD_OFFSETS = Object.freeze([0, 8, 3, 10]);
// Calidad de cada acorde del vamp: i menor, los otros tres mayores. Una tríada menor
// sobre VI/III/VII metería Ab/Eb/Bb contra el La menor natural del resto.
AudioManager.CHORD_TRIADS = Object.freeze([
  Object.freeze([0, 3, 7]), Object.freeze([0, 4, 7]),
  Object.freeze([0, 4, 7]), Object.freeze([0, 4, 7]),
]);
AudioManager.PHRASE_BARS = 8;
// Bombo por compás: el 0 y el 8 nunca faltan, así getBeat() mantiene el pulso visual.
AudioManager.KICK_PATTERNS = Object.freeze([
  Object.freeze([0, 8]),
  Object.freeze([0, 8, 14]),
  Object.freeze([0, 6, 8]),
  Object.freeze([0, 3, 8, 11]),
]);
AudioManager.MELODY_SLOTS = 8;
// Figura de arranque mientras el jugador todavía no ha trazado nada.
AudioManager.DEFAULT_MELODY = Object.freeze([0, 2, 4, 5, 7, 5, 4, 2]);
// Transposiciones seguras: todo es relativo, pero se limita a una quinta para no perder graves.
AudioManager.KEY_OFFSETS = Object.freeze([0, 2, 3, 5, 7]);
// El índice 0 de cada patrón es el acento. Las cuatro figuras comparten el paso 4 y la
// primera pone el paso 2 en la posición 1: las pruebas fijan ambas cosas.
AudioManager.ARP_PATTERNS = Object.freeze([
  Object.freeze([0, 2, 4, 6, 10, 12]),
  Object.freeze([0, 4, 6, 7, 10, 12, 14]),
  Object.freeze([2, 4, 8, 11, 12, 14]),
  Object.freeze([0, 3, 4, 6, 8, 10, 12]),
]);
// Compás del bajón. Cae en bar % 4 === 0, o sea el patrón de bombo escaso sobre la
// tónica: el hueco aterriza en el compás más estable del vamp sin tocar nada más.
AudioManager.DROP_BAR = 4;
AudioManager.SWING = 0.1;
AudioManager.MASTER_GAIN = 0.7;
AudioManager.MUSIC_GAIN = 0.85;
// Cuánto se aparta el bed en un remate. No bajar de 0.35 o el tablero parpadea,
// porque el analizador cuelga del master.
AudioManager.DUCK_DEPTH = 0.45;
// Perilla de calibración en un móvil real, no un valor medido: subir satura más grave
// audible en altavoz pequeño, bajar limpia los agudos.
AudioManager.SATURATION_DRIVE = 2.2;
// Único coste real de DSP de la lista (convolución FFT particionada). Si los 60fps
// aprietan en el 390x844, bajar a 1.1. No inventar un número de CPU: medirlo.
AudioManager.REVERB_SECONDS = 1.4;
AudioManager.LOOKAHEAD = 0.12;
AudioManager.TICK_MS = 25;
