/**
 * Música procedural y SFX con Web Audio API. Sin assets, sin dependencias.
 *
 * API pública (todo es no-op seguro si el navegador no expone Web Audio):
 *   unlock()                       crea el AudioContext. Llamar SOLO desde un gesto de usuario.
 *   newMatch(random)               tonalidad al azar y melodía en blanco. random() es inyectable.
 *   startMusic() / stopMusic()     arranca o detiene el secuenciador. startMusic hace unlock().
 *   setDifficulty(difficulty)      'easy'|'medium'|'hard' -> 84/100/120 bpm. Otro valor -> 96 bpm.
 *   setProgress(ratio)             0..1 de cajas completadas. Define las capas del arreglo.
 *   playMove(lineId, gridSize)     pluck afinado según la línea trazada y nota para el arpegio.
 *   playBoxClaim(chainIndex)       arpegio ascendente. chainIndex 0..n dentro de la misma jugada.
 *   playInvalid() / playHover()    feedback corto de UI.
 *   playTurnChange(player)         player 0 o 1.
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

  /** @param {number} progress 0..1 @returns {{pulse: boolean, bass: boolean, hats: boolean, arp: boolean, lead: boolean}} */
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
    // 0.50 en vez de 0.55: el bed tiene más voces por compás que antes y no debe subir de nivel.
    this.musicBus.gain.value = 0.5;
    this.sfxBus = context.createGain();
    this.sfxBus.gain.value = 1;
    this.analyser = context.createAnalyser();
    // 512 bins de ~43Hz a 44.1kHz: con fftSize 256 el bombo entero caía en un solo bin.
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.75;
    this.spectrum = new Uint8Array(this.analyser.frequencyBinCount);
    const compressor = context.createDynamicsCompressor();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(compressor);
    compressor.connect(this.analyser);
    this.analyser.connect(context.destination);

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
    filter.frequency.setValueAtTime(Math.min(12000, frequency * 6), time);
    filter.Q.value = 6;
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
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.detune.setValueAtTime(-7, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(gainValue, time + duration * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(filter).connect(gain).connect(bus);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.05);
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
    const fill = bar === AudioManager.PHRASE_BARS - 1;
    // El cambio de marcha se resuelve en el downbeat: cae como cambio musical, no como glitch.
    if (step === 0) this.gear = layers.gear;

    const kickSteps = AudioManager.KICK_PATTERNS[bar % AudioManager.KICK_PATTERNS.length];
    // kick() sigue siendo el único que toca lastKickTime: getBeat() no se entera del cambio.
    if (layers.pulse && kickSteps.includes(step)) this.kick(time, step === 0 || step === 8 ? 0.5 : 0.34);
    if (layers.pulse && step === 12) {
      // Fill de fin de frase o riser previo al cambio de marcha, nunca los dos a la vez.
      if (fill || (layers.gear && !this.gear)) this.noiseRoll(time, stepDuration, 4);
      else this.noise(time, 0.12, 0.05, 3000);
    }
    if (layers.bass && AudioManager.BASS_STEPS.includes(step)) {
      // El bajo sí se mueve en semitonos: es quien dibuja el acorde (i - VI - III - VII).
      const interval = AudioManager.BASS_INTERVALS[AudioManager.BASS_STEPS.indexOf(step)];
      const root = this.root() + AudioManager.CHORD_OFFSETS[chord];
      this.sustained(AudioManager.frequency(root - 12 + interval), time, stepDuration * 2.2, 0.22, this.gear ? 620 : 420);
    }
    if (layers.hats && (step % 2 === 1 || (bar % 4 === 3 && step % 4 === 2))) {
      this.noise(time, 0.035, step % 4 === 3 ? 0.07 : 0.04, 7000);
    }
    if (layers.arp && step % 2 === 0) {
      const figure = this.melody.length ? this.melody : AudioManager.DEFAULT_MELODY;
      // El acorde desplaza el arpegio por grados y no por semitonos: se mueve con el
      // bajo pero no puede salirse de la pentatónica.
      // El módulo es sobre los grados que devuelve degreeForLine (0..scale*2 inclusive),
      // así el desplazamiento del acorde vuelve abajo en vez de irse a un agudo chillón.
      const degree = (figure[(step / 2) % figure.length] + chord) % (scale.length * 2 + 1);
      const frequency = AudioManager.frequency(this.root() + 12 + AudioManager.midiForDegree(degree));
      // El arpegio es cama, no efecto: va al bus de música para que lo atenúe.
      // El analizador cuelga del master, así que ve los dos buses pase lo que pase.
      this.pluck(frequency, time, stepDuration * 1.6, 0.07, this.gear ? 'sawtooth' : 'square', this.musicBus);
    }
    if (layers.lead && step === 0) {
      // Tríada por cuartas rotada con el acorde: consonante sobre los cuatro grados.
      [0, 2, 4].forEach((offset) => {
        const frequency = AudioManager.frequency(this.root() + 12 + scale[(chord + offset) % scale.length]);
        // El lead entra en 0.85 y el cambio de instrumento en 0.8: aquí gear ya es siempre true.
        this.sustained(frequency, time, stepDuration * 14, 0.04, 3200, this.musicBus, 'square');
      });
    }
  }

  /** @param {string} difficulty */
  setDifficulty(difficulty) {
    this.bpm = AudioManager.BPM_BY_DIFFICULTY[difficulty] ?? AudioManager.DEFAULT_BPM;
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

  /** @param {number} chainIndex posición dentro de la cadena de cajas de la jugada */
  playBoxClaim(chainIndex = 0) {
    if (!this.unlock()) return;
    const index = Number.isFinite(chainIndex) ? Math.min(6, Math.max(0, Math.floor(chainIndex))) : 0;
    const base = this.root() + 12 + index * 2;
    // La cadena entera se dispara en el mismo frame: sin este desfase los arpegios
    // se apilan. 0.045s va justo por debajo del paso interno de 0.055s, así que
    // encadenan como una sola escalera en vez de sonar como notas repetidas.
    const time = this.context.currentTime + index * 0.045;
    AudioManager.SCALE.slice(0, 3).forEach((semitone, position) => {
      this.pluck(AudioManager.frequency(base + semitone), time + position * 0.055, 0.28, 0.15, 'square');
    });
    this.noise(time, 0.18, 0.05 + index * 0.01, 4000, this.sfxBus);
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
AudioManager.DEFAULT_BPM = 96;
AudioManager.BPM_BY_DIFFICULTY = Object.freeze({ easy: 84, medium: 100, hard: 120 });
// gear va en la misma tabla que las capas: el final de partida es un umbral más, no otro sistema.
AudioManager.LAYER_THRESHOLDS = Object.freeze({ pulse: 0, bass: 0.15, hats: 0.4, arp: 0.65, gear: 0.8, lead: 0.85 });
AudioManager.BASS_STEPS = Object.freeze([0, 3, 8, 11]);
// Intervalos sobre la fundamental del acorde: tónica, quinta y octava valen sobre los cuatro.
AudioManager.BASS_INTERVALS = Object.freeze([0, 7, 0, 12]);
// Vamp menor i - VI - III - VII (en La: Am F C G), un compás por acorde.
AudioManager.CHORD_OFFSETS = Object.freeze([0, 8, 3, 10]);
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
AudioManager.SWING = 0.1;
AudioManager.MASTER_GAIN = 0.7;
AudioManager.LOOKAHEAD = 0.12;
AudioManager.TICK_MS = 25;
