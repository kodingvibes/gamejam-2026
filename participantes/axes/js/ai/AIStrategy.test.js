/*
 * Pruebas mínimas sin navegador para GameLogic y AIStrategy.
 * Ejecutar desde la raíz: node participantes/axes/js/ai/AIStrategy.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({ console, Math });
const files = [
  '../utils/Constants.js',
  '../utils/GameLogic.js',
  '../utils/MatchConfig.js',
  './HardStrategy.js',
  './AIStrategy.js',
];
files.forEach((relativePath) => {
  const filePath = path.join(__dirname, relativePath);
  vm.runInContext(fs.readFileSync(filePath, 'utf8'), context, { filename: filePath });
});

const state = context.initBoard(3);
const moves = context.getAvailableMoves(state);
assert.equal(moves.length, 12);
assert.deepEqual(context.chooseMove(state, 'easy', { random: () => 0 }), moves[0]);
assert.deepEqual(context.chooseMove(state, 'easy', { random: () => 0.99999 }), moves.at(-1));

const snapshot = JSON.stringify(state);
const result = context.applyMove(state, moves[0]);
assert.equal(result.accepted, true);
assert.notEqual(result.state, state);
assert.equal(JSON.stringify(state), snapshot);
assert.equal(context.getAvailableMoves(result.state).includes(moves[0]), false);

function stateWithOwners(owners) {
  return {
    ...state,
    lines: state.lines.map((line) => ({ ...line, owner: owners[line.id] ?? null })),
    boxes: state.boxes.map((box) => ({ ...box, owner: null })),
    scores: [0, 0],
    currentPlayer: 1,
    gameOver: false,
  };
}

const scoringState = stateWithOwners({
  'h-0-0': 0,
  'h-1-0': 0,
  'v-0-0': 0,
});
assert.deepEqual(Array.from(context.findScoringMoves(scoringState)), ['v-0-1']);
assert.equal(context.chooseMove(scoringState, 'medium'), 'v-0-1');

const doubleScoringState = stateWithOwners({
  'h-0-0': 0,
  'h-1-0': 0,
  'v-0-0': 0,
  'h-0-1': 0,
  'h-1-1': 0,
  'v-0-2': 0,
});
assert.deepEqual(Array.from(context.findScoringMoves(doubleScoringState)), ['v-0-1']);
assert.equal(context.chooseMove(doubleScoringState, 'medium'), 'v-0-1');

const safeState = stateWithOwners({ 'h-0-0': 0 });
const safeMoves = context.findSafeMoves(safeState);
assert.ok(safeMoves.length > 0);
assert.equal(context.chooseMove(safeState, 'medium', { random: () => 0 }), safeMoves[0]);
assert.equal(
  context.chooseMove(safeState, 'medium', { random: () => 0.5 }),
  context.chooseMove(safeState, 'medium', { random: () => 0.5 }),
);
assert.equal(context.evaluateMoveRisk(safeState, safeMoves[0]), 0);

const dangerState = stateWithOwners({ 'h-0-0': 0, 'h-1-0': 0 });
assert.ok(!context.findSafeMoves(dangerState).includes('v-0-0'));
assert.ok(!context.findSafeMoves(dangerState).includes('v-0-1'));
// 0.99 queda por encima de blunderRate: MEDIUM juega seguro y esquiva v-0-0.
assert.notEqual(context.chooseMove(dangerState, 'medium', { random: () => 0.99 }), 'v-0-0');
// 0.1 queda por debajo: con el fallo deliberado sí entrega la cadena que antes esquivaba.
// Sin esta rama MEDIUM nunca abría y la partida se decidía sola.
assert.equal(context.chooseMove(dangerState, 'medium', { random: () => 0.1 }), 'v-0-0');

const allDangerousState = stateWithOwners({
  'h-0-0': 0,
  'h-0-1': 0,
  'h-1-0': 0,
  'h-1-1': 0,
  'h-2-0': 0,
  'h-2-1': 0,
});
assert.equal(context.findSafeMoves(allDangerousState).length, 0);
assert.equal(context.evaluateMoveRisk(allDangerousState, 'v-0-0'), 1);
assert.equal(context.evaluateMoveRisk(allDangerousState, 'v-0-1'), 2);
assert.equal(context.chooseMove(allDangerousState, 'medium', { random: () => 0 }), 'v-0-0');

assert.equal(context.chooseMove(doubleScoringState, 'hard', { random: () => 0 }), 'v-0-1');
const hardSafeMove = context.chooseMove(dangerState, 'hard', { random: () => 0 });
assert.ok(context.findSafeMoves(dangerState).includes(hardSafeMove));
const hardSnapshot = JSON.stringify(dangerState);
const hardTimeoutMove = context.chooseMove(dangerState, 'hard', { maxThinkTimeMs: 0, random: () => 0 });
assert.ok(context.getAvailableMoves(dangerState).includes(hardTimeoutMove));
assert.equal(JSON.stringify(dangerState), hardSnapshot);
assert.equal(context.chooseMove({ ...dangerState, lines: dangerState.lines.map((line) => ({ ...line, owner: 0 })) }, 'hard'), null);

const turnAfterNeutralMove = context.applyMove(safeState, safeMoves[0]);
assert.equal(turnAfterNeutralMove.state.currentPlayer, 0);
const turnAfterScoringMove = context.applyMove(scoringState, 'v-0-1');
assert.equal(turnAfterScoringMove.state.currentPlayer, 1);

const mediumSnapshot = JSON.stringify(safeState);
context.chooseMove(safeState, 'medium', { random: () => 0.5 });
assert.equal(JSON.stringify(safeState), mediumSnapshot);
assert.equal(context.chooseMove({ ...safeState, lines: safeState.lines.map((line) => ({ ...line, owner: 0 })) }, 'medium'), null);

const finishedState = {
  ...state,
  lines: state.lines.map((line) => ({ ...line, owner: 0 })),
  gameOver: true,
};
assert.equal(context.getAvailableMoves(finishedState).length, 0);
assert.equal(context.chooseMove(finishedState), null);

const localConfig = context.createMatchConfig(3, 'local');
const aiConfig = context.createMatchConfig(3, 'vs-ai');
const mediumConfig = context.createMatchConfig(3, 'vs-ai', 'medium');
const clonedAiConfig = context.cloneMatchConfig(aiConfig);
assert.notEqual(clonedAiConfig, aiConfig);
assert.deepEqual(JSON.parse(JSON.stringify(clonedAiConfig)), JSON.parse(JSON.stringify(aiConfig)));
assert.notEqual(clonedAiConfig.players, aiConfig.players);
assert.equal(context.isHumanTurn(localConfig, state), true);
assert.equal(context.isAITurn(aiConfig, state), false);
assert.equal(context.isAITurn(aiConfig, { ...state, currentPlayer: 1 }), true);
assert.equal(mediumConfig.players[1].difficulty, 'medium');

console.log('AIStrategy tests: OK');
