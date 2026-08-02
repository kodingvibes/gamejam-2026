/** Normaliza el azar inyectable para producir siempre un índice válido. */
function normalizeRandom(random) {
  const value = Number((random ?? Math.random)());
  return Number.isFinite(value) ? Math.min(0.999999, Math.max(0, value)) : 0;
}

function chooseRandomMove(moves, random) {
  if (moves.length === 0) return null;
  return moves[Math.floor(normalizeRandom(random) * moves.length)];
}

/** Devuelve las jugadas que completan una o más cajas inmediatamente. */
function findScoringMoves(state) {
  return getAvailableMoves(state).filter((lineId) => getCompletedBoxesForMove(state, lineId).length > 0);
}

function countOccupiedEdges(state, box) {
  return box.edges.filter((edgeId) => state.lines.find((line) => line.id === edgeId)?.owner !== null).length;
}

/** Simula una jugada y mide las cajas que quedarían listas para el rival. */
function evaluateMoveRisk(state, lineId) {
  const result = applyMove(state, lineId);
  if (!result?.accepted) return Number.POSITIVE_INFINITY;

  const threatenedBoxes = result.state.boxes.filter((box) => (
    box.owner === null && countOccupiedEdges(result.state, box) === 3
  )).length;
  const completedCount = result.completedBoxIds.length;

  // Entregar cajas domina el desempate; las amenazas refinan el orden después.
  return completedCount * (state.boxes.length + 1) + threatenedBoxes;
}

/** Movimiento sin puntuación inmediata que no deja una caja con tres lados. */
function findSafeMoves(state) {
  return getAvailableMoves(state).filter((lineId) => (
    getCompletedBoxesForMove(state, lineId).length === 0
    && evaluateMoveRisk(state, lineId) === 0
  ));
}

/** Elige aleatoriamente entre las jugadas con menor riesgo. */
function chooseLowestRiskMove(state, moves, random = Math.random) {
  if (moves.length === 0) return null;
  const availableMoves = new Set(getAvailableMoves(state));
  const validMoves = moves.filter((lineId) => availableMoves.has(lineId));
  if (validMoves.length === 0) return null;

  const risks = validMoves.map((lineId) => evaluateMoveRisk(state, lineId));
  const lowestRisk = Math.min(...risks);
  const candidates = validMoves.filter((lineId, index) => risks[index] === lowestRisk);
  return chooseRandomMove(candidates, random);
}

function chooseMediumMove(state, options = {}) {
  const random = options.random ?? Math.random;
  const scoringMoves = findScoringMoves(state);
  if (scoringMoves.length > 0) {
    const highestScore = Math.max(
      ...scoringMoves.map((lineId) => getCompletedBoxesForMove(state, lineId).length),
    );
    const bestScoringMoves = scoringMoves.filter((lineId) => (
      getCompletedBoxesForMove(state, lineId).length === highestScore
    ));
    return chooseRandomMove(bestScoringMoves, random);
  }

  const safeMoves = findSafeMoves(state);
  if (safeMoves.length > 0) {
    const { blunderRate } = AI_PERSONALITY[AI_DIFFICULTY.MEDIUM];
    if (normalizeRandom(random) > blunderRate) return chooseRandomMove(safeMoves, random);
    // Fallo deliberado: entrega una cadena en vez de esconderse. Filtrar aquí y no
    // delegar en chooseLowestRiskMove, que con jugadas seguras devuelve justo esas.
    const safeSet = new Set(safeMoves);
    const riskyMoves = getAvailableMoves(state).filter((lineId) => !safeSet.has(lineId));
    if (riskyMoves.length > 0) return chooseRandomMove(riskyMoves, random);
    return chooseRandomMove(safeMoves, random);
  }
  return chooseLowestRiskMove(state, getAvailableMoves(state), random);
}

/**
 * Decisiones puras de la IA. EASY conserva su selección aleatoria.
 * MEDIUM solo simula estados nuevos y no conoce Phaser, SVG ni Board.
 */
function chooseMove(state, difficulty = AI_DIFFICULTY.EASY, options = {}) {
  const availableMoves = getAvailableMoves(state);
  if (availableMoves.length === 0 || state.gameOver) return null;
  if (difficulty === AI_DIFFICULTY.MEDIUM) return chooseMediumMove(state, options);
  if (difficulty === AI_DIFFICULTY.HARD) return chooseHardMove(state, options);

  return chooseRandomMove(availableMoves, options.random);
}
