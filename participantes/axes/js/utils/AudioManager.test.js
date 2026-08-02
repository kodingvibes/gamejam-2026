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

assert.deepEqual(plain(AudioManager.layersForProgress(0)), {
  pulse: true, bass: false, hats: false, arp: false, lead: false,
});
assert.deepEqual(plain(AudioManager.layersForProgress(0.15)), {
  pulse: true, bass: true, hats: false, arp: false, lead: false,
});
assert.deepEqual(plain(AudioManager.layersForProgress(0.4)), {
  pulse: true, bass: true, hats: true, arp: false, lead: false,
});
assert.deepEqual(plain(AudioManager.layersForProgress(0.65)), {
  pulse: true, bass: true, hats: true, arp: true, lead: false,
});
assert.deepEqual(plain(AudioManager.layersForProgress(1)), {
  pulse: true, bass: true, hats: true, arp: true, lead: true,
});
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
assert.deepEqual(plain(first.getBands()), { low: 0, mid: 0 });
assert.equal(first.getBeat(), 0);
assert.equal(first.toggleMute(), true);
assert.equal(first.toggleMute(), false);
first.setDifficulty('hard');
assert.equal(first.bpm, 120);
// Dificultad desconocida: tempo por defecto en lugar de quedarse con el anterior.
first.setDifficulty('imposible');
assert.equal(first.bpm, AudioManager.DEFAULT_BPM);

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
