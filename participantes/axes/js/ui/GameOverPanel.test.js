/*
 * Pruebas mínimas sin navegador para la escalera de rango y los récords.
 * Ejecutar desde la raíz: node participantes/axes/js/ui/GameOverPanel.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Sin localStorage a propósito: el respaldo en memoria es parte de lo que se prueba.
const context = vm.createContext({ console, Math });
[path.join(__dirname, '..', 'utils', 'Constants.js'), path.join(__dirname, 'GameOverPanel.js')]
  .forEach((filePath) => vm.runInContext(fs.readFileSync(filePath, 'utf8'), context, { filename: filePath }));
const GameOverPanel = vm.runInContext('GameOverPanel', context);

// Fronteras exactas de la escalera: cada peldaño empieza en su umbral, no antes.
const expected = [
  [1, 'S'], [0.75, 'S'], [0.7499, 'A'], [0.6, 'A'], [0.5999, 'B'],
  [0.5, 'B'], [0.4999, 'C'], [0.375, 'C'], [0.3749, 'D'], [0.29, 'D'],
  [0.25, 'D'], [0.2499, 'E'], [0, 'E'],
];
expected.forEach(([share, letter]) => {
  assert.equal(GameOverPanel.gradeFor(share).letter, letter, `share ${share}`);
});

// Ningún valor puede caerse por los extremos ni devolver un rango sin texto.
[-1, 2, NaN, undefined, null].forEach((share) => {
  const grade = GameOverPanel.gradeFor(share);
  assert.ok(grade && typeof grade.letter === 'string' && grade.caption.length > 0);
});
assert.equal(GameOverPanel.gradeFor(2).letter, 'S');
assert.equal(GameOverPanel.gradeFor(NaN).letter, 'E');

assert.equal(GameOverPanel.nextGradeFor('S'), null);
assert.equal(GameOverPanel.nextGradeFor('E').letter, 'D');
assert.equal(GameOverPanel.nextGradeFor('B').letter, 'A');
assert.equal(GameOverPanel.nextGradeFor('desconocido'), null);

// La clave separa modo y tamaño: un récord de 6x6 no puede bloquear el de 3x3.
assert.notEqual(GameOverPanel.recordKey('vs-ai', 6), GameOverPanel.recordKey('vs-ai', 3));
assert.notEqual(GameOverPanel.recordKey('local', 5), GameOverPanel.recordKey('vs-ai', 5));

// Sin localStorage el récord sigue vivo en memoria durante la sesión.
const key = GameOverPanel.recordKey('local', 5);
assert.equal(GameOverPanel.readRecord(key), null);
GameOverPanel.writeRecord(key, { score: 9, streak: 4, grade: 'B' });
assert.equal(GameOverPanel.readRecord(key).score, 9);
assert.equal(GameOverPanel.readRecord(GameOverPanel.recordKey('local', 6)), null);

console.log('GameOverPanel: OK');
