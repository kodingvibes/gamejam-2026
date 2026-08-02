/*
 * Pruebas mínimas sin navegador para el mapeo musical de AudioManager.
 * Ejecutar desde la raíz: node participantes/axes/js/utils/AudioManager.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Stubs de los globales que el archivo puede tocar. Nada de esto se ejecuta al cargar.
const context = vm.createContext({
  console,
  Math,
  window: {},
  setInterval: () => 0,
  clearInterval: () => {},
  Uint8Array,
});
const filePath = path.join(__dirname, 'AudioManager.js');
vm.runInContext(fs.readFileSync(filePath, 'utf8'), context, { filename: filePath });
// Las clases no se publican en el objeto global de un script, hay que evaluarlas.
const AudioManager = vm.runInContext('AudioManager', context);
// Los objetos nacen en el realm del sandbox: se comparan por valor, no por prototipo.
const plain = (value) => JSON.parse(JSON.stringify(value));

assert.deepEqual(plain(AudioManager.parseLineId('h-2-3')), { type: 'h', row: 2, column: 3 });
assert.equal(AudioManager.parseLineId('roto'), null);
assert.equal(AudioManager.midiForLine('roto', 5), AudioManager.ROOT_MIDI);

// El mapeo es total y siempre cae dentro de la escala para cualquier tablero jugable.
[3, 4, 5, 6].forEach((gridSize) => {
  const lineIds = [];
  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize - 1; column += 1) lineIds.push(`h-${row}-${column}`);
  }
  for (let row = 0; row < gridSize - 1; row += 1) {
    for (let column = 0; column < gridSize; column += 1) lineIds.push(`v-${row}-${column}`);
  }
  assert.equal(lineIds.length, 2 * gridSize * (gridSize - 1));

  lineIds.forEach((lineId) => {
    const midi = AudioManager.midiForLine(lineId, gridSize);
    assert.ok(Number.isInteger(midi), `${lineId} no devuelve nota entera`);
    assert.ok(midi >= AudioManager.ROOT_MIDI && midi <= AudioManager.ROOT_MIDI + 36, `${lineId} fuera de rango: ${midi}`);
    assert.ok(
      AudioManager.SCALE.includes((midi - AudioManager.ROOT_MIDI) % 12),
      `${lineId} fuera de escala: ${midi}`,
    );
    const frequency = AudioManager.frequencyForLine(lineId, gridSize);
    assert.ok(frequency > 100 && frequency < 1000, `${lineId} frecuencia fuera de rango: ${frequency}`);
  });
});

// Misma posición relativa, misma nota, sin importar el tamaño del tablero.
assert.equal(AudioManager.midiForLine('h-0-0', 3), AudioManager.midiForLine('h-0-0', 6));
assert.equal(AudioManager.midiForLine('h-2-1', 3), AudioManager.midiForLine('h-5-4', 6));
// Las verticales suenan una octava por encima de su equivalente horizontal.
assert.equal(AudioManager.midiForLine('v-0-0', 5) - AudioManager.midiForLine('h-0-0', 5), 12);
assert.equal(AudioManager.frequency(69), 440);

assert.deepEqual(plain(AudioManager.BPM_BY_DIFFICULTY), { easy: 84, medium: 100, hard: 120 });

// Gemelo de GAME_FEEL.streakCap en js/utils/Constants.js: si uno cambia, el otro también.
assert.equal(AudioManager.CHAIN_CAP, 10);

// El grado base del remate se acota en los dos extremos: es el riesgo real de subir el tope.
for (let index = 0; index <= 12; index += 1) {
  const human = AudioManager.claimDegreeBase(index, 0);
  const ai = AudioManager.claimDegreeBase(index, 1);
  assert.equal(human, Math.min(AudioManager.CHAIN_CAP, index), `humano sin acotar en ${index}`);
  assert.equal(ai, AudioManager.CHAIN_CAP - human, `la IA no invierte en ${index}`);
  assert.ok(human >= 0 && human <= AudioManager.CHAIN_CAP, `fuera de rango en ${index}`);
  assert.ok(ai >= 0 && ai <= AudioManager.CHAIN_CAP, `fuera de rango en ${index}`);
}
assert.equal(AudioManager.claimDegreeBase(-3, 0), 0);
assert.equal(AudioManager.claimDegreeBase(NaN, 0), 0);
assert.equal(AudioManager.claimDegreeBase(99, 0), AudioManager.CHAIN_CAP);
assert.equal(AudioManager.claimDegreeBase(99, 1), 0);

// Cambio de líder: el humano sube, la IA baja y la remontada es más larga.
const rising = plain(AudioManager.leadChangeDegrees(0, false));
const falling = plain(AudioManager.leadChangeDegrees(1, false));
assert.ok(rising.every((degree, index) => index === 0 || degree > rising[index - 1]), 'el humano no sube');
assert.ok(falling.every((degree, index) => index === 0 || degree < falling[index - 1]), 'la IA no baja');
assert.deepEqual(falling, rising.slice().reverse());
assert.ok(plain(AudioManager.leadChangeDegrees(0, true)).length > rising.length, 'la remontada no es más larga');
// Devuelve un array nuevo cada vez: reverse() no puede morder la llamada siguiente.
assert.deepEqual(plain(AudioManager.leadChangeDegrees(0, false)), rising);
// Misma invariante que las líneas: todo grado cae dentro de la escala.
[0, 1].forEach((player) => {
  [false, true].forEach((isComeback) => {
    plain(AudioManager.leadChangeDegrees(player, isComeback)).forEach((degree) => {
      assert.ok(
        AudioManager.SCALE.includes(AudioManager.midiForDegree(degree) % 12),
        `grado fuera de escala: ${degree}`,
      );
    });
  });
});

// Desde la primera jugada ya hay bombo, bajo y pad: es lo que evita que suene vacío.
assert.deepEqual(plain(AudioManager.layersForProgress(0)), {
  pulse: true, pad: true, bass: true, hats: false, arp: false, gear: false, lead: false,
});
assert.deepEqual(plain(AudioManager.layersForProgress(0.12)), {
  pulse: true, pad: true, bass: true, hats: true, arp: false, gear: false, lead: false,
});
assert.deepEqual(plain(AudioManager.layersForProgress(0.3)), {
  pulse: true, pad: true, bass: true, hats: true, arp: true, gear: false, lead: false,
});
// El cambio de marcha entra antes que el lead: 0.62 contra 0.75.
assert.deepEqual(plain(AudioManager.layersForProgress(0.62)), {
  pulse: true, pad: true, bass: true, hats: true, arp: true, gear: true, lead: false,
});
assert.deepEqual(plain(AudioManager.layersForProgress(0.75)), {
  pulse: true, pad: true, bass: true, hats: true, arp: true, gear: true, lead: true,
});
assert.deepEqual(plain(AudioManager.layersForProgress(1)), plain(AudioManager.layersForProgress(0.75)));
// Valores inválidos o fuera de rango degradan a la capa base sin romper.
assert.deepEqual(plain(AudioManager.layersForProgress(NaN)), plain(AudioManager.layersForProgress(0)));
assert.deepEqual(plain(AudioManager.layersForProgress(-1)), plain(AudioManager.layersForProgress(0)));
assert.deepEqual(plain(AudioManager.layersForProgress(5)), plain(AudioManager.layersForProgress(1)));

// Singleton: la escena puede reiniciarse sin apilar contextos ni secuenciadores.
const first = vm.runInContext('new AudioManager()', context);
const second = vm.runInContext('new AudioManager()', context);
assert.equal(first, second);
// Sin Web Audio disponible el juego sigue siendo jugable: todo es no-op.
assert.equal(first.unlock(), null);
first.startMusic();
assert.equal(first.playing, false);
first.playMove('h-0-0', 5);
first.playBoxClaim(2);
first.playVictory();
// Los eventos nuevos también son no-op sin Web Audio: nada de esto puede tirar.
first.playLeadChange(0, false);
first.playLeadChange(1, true);
first.playClinch();
first.playStamp(true);
first.playStamp();
first.setNoSafeMoves(true);
assert.equal(first.forceGear, true);
first.setNoSafeMoves(false);
assert.equal(first.forceGear, false);
assert.deepEqual(plain(first.getBands()), { low: 0, mid: 0 });
assert.equal(first.getBeat(), 0);
assert.equal(first.toggleMute(), true);
assert.equal(first.toggleMute(), false);
first.setDifficulty('hard');
assert.equal(first.bpm, 120);
// Dificultad desconocida: tempo por defecto en lugar de quedarse con el anterior.
first.setDifficulty('imposible');
assert.equal(first.bpm, AudioManager.DEFAULT_BPM);

// --- Bed evolutivo -------------------------------------------------------
// Mismo singleton: se le cambian las voces por sondas para leer lo que agenda.
const bed = first;
const capture = () => {
  const events = [];
  bed.kick = (time) => events.push({ voice: 'kick', time });
  bed.noise = (time) => events.push({ voice: 'noise', time });
  bed.noiseRoll = (time) => events.push({ voice: 'roll', time });
  bed.sustained = (frequency, time) => events.push({ voice: 'sustained', frequency, time });
  bed.pluck = (frequency, time) => events.push({ voice: 'arp', frequency, time });
  return events;
};
const arpNote = (slot, chord = 0) => AudioManager.frequency(
  AudioManager.ROOT_MIDI + 12
    + AudioManager.midiForDegree((slot + chord) % (AudioManager.SCALE.length * 2 + 1)),
);
bed.progress = 1;
bed.bpm = 120;
bed.newMatch(() => 0);

// El arpegio arranca con la figura por defecto mientras nadie ha trazado nada.
// En el compás 0 el paso 2 es la posición 1 del patrón, y el pad solo entra en el paso 0.
assert.equal(AudioManager.ARP_PATTERNS[0].indexOf(2), 1);
let events = capture();
bed.scheduleStep(2, 0);
assert.equal(events.length, 1, `el paso 2 del compás 0 agendó de más: ${events.length}`);
assert.equal(events[0].frequency, arpNote(AudioManager.DEFAULT_MELODY[1]));

// El tablero reescribe el arpegio: playMove empuja el grado de la línea trazada.
bed.melody = [];
bed.playMove('h-0-0', 5);
bed.playMove('v-4-4', 5);
assert.deepEqual(plain(bed.melody), [
  AudioManager.degreeForLine('h-0-0', 5),
  AudioManager.degreeForLine('v-4-4', 5),
]);
events = capture();
bed.scheduleStep(2, 0);
assert.equal(events[0].frequency, arpNote(bed.melody[1]), 'el arpegio no leyó el buffer');
// Buffer circular: nunca crece más allá de MELODY_SLOTS y descarta lo más viejo.
for (let index = 0; index < AudioManager.MELODY_SLOTS + 4; index += 1) bed.pushMelody(index % 10);
assert.equal(bed.melody.length, AudioManager.MELODY_SLOTS);
assert.equal(bed.melody[0], 4);
bed.pushMelody(NaN);
assert.equal(bed.melody.length, AudioManager.MELODY_SLOTS);

// El bajo recorre el vamp i - VI - III - VII: un acorde distinto por compás.
const bassNotes = [0, 1, 2, 3].map((bar) => {
  bed.bar = bar;
  assert.equal(bed.chordIndex(), bar);
  const bassEvents = capture();
  bed.scheduleStep(0, 0);
  return bassEvents.find((event) => event.voice === 'sustained').frequency;
});
assert.deepEqual(bassNotes, plain(AudioManager.CHORD_OFFSETS).map(
  (offset) => AudioManager.frequency(AudioManager.ROOT_MIDI + offset - 12),
));
assert.equal(new Set(bassNotes).size, 4, 'la progresión no se mueve');

// El arpegio se mueve con el acorde pero por grados: siempre dentro de la escala.
// Los cuatro patrones contienen el paso 4 y ningún bombo ni hat cae ahí en esos compases.
bed.melody = [];
[0, 1, 2, 3].forEach((bar) => {
  assert.ok(AudioManager.ARP_PATTERNS[bar].includes(4), `el patrón ${bar} no tiene el paso 4`);
  bed.bar = bar;
  const arpEvents = capture();
  bed.scheduleStep(4, 0);
  const midi = Math.round(69 + 12 * Math.log2(arpEvents[0].frequency / 440)) - AudioManager.ROOT_MIDI;
  assert.ok(AudioManager.SCALE.includes(midi % 12), `arpegio fuera de escala en el compás ${bar}`);
});

// El bajón: en DROP_BAR se caen arpegio y hats, pero el bombo y el pad siguen ahí
// para que getBeat() y el pulso del tablero no se queden planos.
bed.bar = AudioManager.DROP_BAR;
let dropEvents = capture();
bed.scheduleStep(4, 0);
assert.equal(dropEvents.length, 0, 'el arpegio sonó durante el bajón');
dropEvents = capture();
bed.scheduleStep(1, 0);
assert.equal(dropEvents.length, 0, 'los hats sonaron durante el bajón');
dropEvents = capture();
bed.scheduleStep(0, 0);
assert.ok(dropEvents.some((event) => event.voice === 'kick'), 'el bombo se fue con el bajón');
assert.ok(dropEvents.some((event) => event.voice === 'sustained'), 'el bed se quedó mudo en el bajón');
bed.bar = 0;

// El compás avanza al envolver el paso 15 y el swing retrasa solo los impares.
bed.bar = 0;
bed.step = 15;
bed.playing = true;
bed.context = { currentTime: 0 };
bed.nextStepTime = 0;
const swung = capture();
bed.tick();
assert.equal(bed.step, 0);
assert.equal(bed.bar, 1, 'el compás no avanzó');
assert.ok(swung.length > 0 && swung.every((event) => event.time > 0), 'el paso impar no lleva swing');
assert.equal(bed.nextStepTime, 0.125, 'el swing desplazó la rejilla');
// La frase se cierra y vuelve a empezar.
bed.bar = AudioManager.PHRASE_BARS - 1;
bed.step = 15;
bed.nextStepTime = 0;
bed.tick();
assert.equal(bed.bar, 0, 'la frase no cierra en PHRASE_BARS');
bed.playing = false;
bed.context = null;

// El cambio de marcha del 62% espera al downbeat en lugar de entrar a media nota.
bed.gear = false;
bed.bar = 0;
bed.progress = 0.9;
capture();
bed.scheduleStep(4, 0);
assert.equal(bed.gear, false, 'el cambio de marcha no esperó al compás');
bed.scheduleStep(0, 0);
assert.equal(bed.gear, true, 'el cambio de marcha no entró en el downbeat');

// Sin jugadas seguras el cambio de marcha se adelanta al umbral fijo, pero sigue
// resolviéndose en el downbeat: es un cambio musical, no un glitch a media nota.
bed.gear = false;
bed.progress = 0;
bed.forceGear = false;
capture();
bed.scheduleStep(0, 0);
assert.equal(bed.gear, false, 'el cambio de marcha entró sin motivo');
bed.setNoSafeMoves(true);
bed.scheduleStep(4, 0);
assert.equal(bed.gear, false, 'forceGear no esperó al downbeat');
bed.scheduleStep(0, 0);
assert.equal(bed.gear, true, 'forceGear no cambió de marcha en el downbeat');
// El riser del paso 12 solo puede dispararse mientras la marcha aún no ha entrado.
bed.gear = false;
bed.bar = 0; // bar % 4 !== 3: aquí no hay fill de frase que confunda la lectura
let riser = capture();
bed.scheduleStep(12, 0);
assert.ok(riser.some((event) => event.voice === 'roll'), 'no hubo riser antes del cambio');
bed.gear = true;
riser = capture();
bed.scheduleStep(12, 0);
assert.ok(!riser.some((event) => event.voice === 'roll'), 'el riser se disparó dos veces');
// newMatch limpia la bandera: la partida siguiente no arranca ya en la marcha larga.
bed.newMatch(() => 0);
assert.equal(bed.forceGear, false);
bed.gear = false;
bed.progress = 0.9;
bed.bar = 0;

// Tonalidad por partida: siempre dentro del set seguro, incluso con valores basura.
[0, 0.19, 0.5, 0.99, 1.5, -1, NaN].forEach((value) => {
  assert.ok(
    AudioManager.KEY_OFFSETS.includes(bed.newMatch(() => value)),
    `transposición fuera del set con ${value}`,
  );
});
assert.equal(bed.newMatch(() => 0), AudioManager.KEY_OFFSETS[0]);
assert.equal(bed.newMatch(() => 0.99), AudioManager.KEY_OFFSETS[AudioManager.KEY_OFFSETS.length - 1]);
assert.ok(AudioManager.KEY_OFFSETS.includes(bed.newMatch()));
// newMatch deja la melodía y la frase en blanco para la partida siguiente.
bed.pushMelody(3);
bed.bar = 5;
bed.newMatch(() => 0);
assert.deepEqual(plain(bed.melody), []);
assert.equal(bed.bar, 0);

// La transposición llega a todas las capas afinadas, no solo al bajo.
const notesForKey = (transpose) => {
  bed.newMatch(() => 0);
  bed.transpose = transpose;
  bed.progress = 1;
  const keyEvents = capture();
  [0, 2].forEach((step) => bed.scheduleStep(step, 0));
  return keyEvents.filter((event) => event.frequency).map((event) => event.frequency);
};
const dry = notesForKey(0);
const up = notesForKey(7);
assert.ok(dry.length >= 5, `faltan voces afinadas en el compás: ${dry.length}`);
assert.equal(dry.length, up.length);
up.forEach((frequency, index) => {
  assert.ok(Math.abs(frequency / dry[index] - 2 ** (7 / 12)) < 1e-9, 'una capa se quedó sin transponer');
});
bed.newMatch(() => 0);
bed.progress = 0;

// El remate de caja se construye sobre grados de escala: antes subía en semitonos y a
// partir del segundo eslabón metía una tercera mayor y un tritono contra un bed menor.
bed.context = { currentTime: 0 };
const realUnlock = bed.unlock;
bed.unlock = () => bed.context;
[0, 1].forEach((player) => {
  // Hasta 12: por encima del tope el índice se acota y debe seguir sonando afinado.
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].forEach((index) => {
    const claim = capture();
    bed.playBoxClaim(index, player);
    // La campana FM del final va en razón 3.5, que a propósito no es una nota de la
    // escala: solo se comprueban los tres plucks principales, que son los tres primeros.
    claim.filter((event) => event.frequency).slice(0, 3).forEach((event) => {
      const midi = Math.round(69 + 12 * Math.log2(event.frequency / 440)) - bed.root();
      assert.ok(AudioManager.SCALE.includes(((midi % 12) + 12) % 12), `remate fuera de escala en ${index}/${player}`);
    });
  });
});
// El contorno se invierte para la IA: el humano sube, la IA baja.
const claimHuman = capture();
bed.playBoxClaim(0, 0);
const claimAi = capture();
bed.playBoxClaim(0, 1);
assert.notEqual(claimHuman[0].frequency, claimAi[0].frequency, 'la IA remata igual que el humano');
// El pivote de la inversión está en CHAIN_CAP / 2: ahí ambos coinciden a propósito.
const pivot = AudioManager.CHAIN_CAP / 2;
const pivotHuman = capture();
bed.playBoxClaim(pivot, 0);
const pivotAi = capture();
bed.playBoxClaim(pivot, 1);
assert.equal(pivotHuman[0].frequency, pivotAi[0].frequency);
// El nuevo tope sigue subiendo de tono en todos los peldaños para el humano.
const claimPitches = [];
for (let index = 0; index <= AudioManager.CHAIN_CAP; index += 1) {
  const rung = capture();
  bed.playBoxClaim(index, 0);
  claimPitches.push(rung[0].frequency);
}
assert.ok(
  claimPitches.every((frequency, index) => index === 0 || frequency > claimPitches[index - 1]),
  'la escalera de racha deja de subir',
);
// Por encima del peldaño 6 la escalera no puede apilar más voces que el 6: se hace barro.
const voicesAt = (index) => {
  const rung = capture();
  bed.playBoxClaim(index, 0);
  return rung.length;
};
const sixVoices = voicesAt(6);
[7, 8, 9, 10].forEach((index) => {
  assert.ok(voicesAt(index) <= sixVoices, `el peldaño ${index} apila más voces que el 6`);
});

// El aviso de cambio de líder y el sello son eventos completos, no no-ops, con contexto.
const leadEvents = capture();
bed.playLeadChange(0, false);
assert.equal(leadEvents.length, AudioManager.leadChangeDegrees(0, false).length);
assert.ok(leadEvents[1].frequency > leadEvents[0].frequency, 'el cambio de líder no sube');
const comebackEvents = capture();
bed.playLeadChange(0, true);
assert.ok(comebackEvents.length > leadEvents.length, 'la remontada no añade nota');
const clinchEvents = capture();
bed.playClinch();
assert.ok(clinchEvents.some((event) => event.voice === 'noise'), 'el clinch se quedó sin ruido');
const stampEvents = capture();
bed.playStamp(false);
const recordEvents = capture();
bed.playStamp(true);
assert.ok(recordEvents.length > stampEvents.length, 'el récord no añade el gliss');
bed.unlock = realUnlock;
bed.context = null;

// Secuenciador resincronizado: una pestaña en segundo plano atrasa nextStepTime
// varios segundos y no debe vaciar de golpe todos los pasos vencidos.
const scheduled = [];
first.context = { currentTime: 10 };
first.playing = true;
first.nextStepTime = 0;
first.scheduleStep = (step, time) => scheduled.push(time);
first.tick();
assert.ok(scheduled.length <= 2, `pasos apilados tras el atasco: ${scheduled.length}`);
assert.ok(scheduled.length > 0, 'el secuenciador se quedó sin agendar nada');
assert.ok(scheduled.every((time) => time >= 10), 'pasos agendados en el pasado');
first.playing = false;
first.context = null;

console.log('AudioManager tests: OK');
