(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LastreModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function cameraSpeed(elapsedSeconds) {
    return Math.min(108, 72 + elapsedSeconds * 0.4);
  }

  function screenX(worldX, cameraX) {
    return worldX - cameraX;
  }

  function isCaughtByCamera(worldX, cameraX, leftMargin) {
    return screenX(worldX, cameraX) < leftMargin;
  }

  function torqueForInput(left, right, strength) {
    if (left === right) return 0;
    return left ? -strength : strength;
  }

  function choosePartToShed(parts, impactX, impactY) {
    const candidates = parts.filter(part => !part.isCore);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const distanceA = Math.hypot(a.x - impactX, a.y - impactY);
      const distanceB = Math.hypot(b.x - impactX, b.y - impactY);
      return distanceA - distanceB;
    });
    return candidates[0].id;
  }

  function jumpForceForMass(mass, coreMass, baseForce) {
    return baseForce * Math.sqrt(Math.max(1, mass / coreMass));
  }

  function canHop(boundsMaxY, groundY, cooldownMs) {
    return cooldownMs <= 0 && boundsMaxY >= groundY - 5;
  }

  function scrapSpecForIndex(index) {
    const sizeStep = Math.floor(index / 3) % 3;
    if (index % 3 === 0) return { kind: 'gear', radius: 7 + sizeStep * 3 };
    if (index % 3 === 1) return { kind: 'plate', width: 18 + sizeStep * 4, height: 8 + sizeStep * 2 };
    return { kind: 'nut', radius: 9 + sizeStep * 2, sides: 6 };
  }

  function routeMessage(distance, destination, destinationLabel) {
    const remaining = Math.max(0, destination - distance);
    const label = destinationLabel || 'BASURERO MUNICIPAL';
    if (remaining === 0) return 'DESTINO ALCANZADO';
    if (remaining <= 150) return destinationLabel ? `YA SE VE ${destinationLabel}` : 'YA SE VE EL BASURERO';
    return `${label} ${Math.ceil(remaining / 10)} m`;
  }

  function scrapValue(spec) {
    if (spec.kind === 'gear') return 10 + Math.max(0, Math.round((spec.radius - 7) / 3)) * 10;
    if (spec.kind === 'plate') return 15 + Math.max(0, Math.round((spec.width - 18) / 4)) * 10;
    if (spec.kind === 'nut') return 20 + Math.max(0, Math.round((spec.radius - 9) / 2)) * 10;
    return 0;
  }

  function scoreDelivery(deliveredValue, elapsedSeconds) {
    const seconds = Math.max(0, Math.floor(elapsedSeconds));
    const value = Math.max(0, Math.floor(deliveredValue));
    const timeBonus = Math.max(0, 180 - seconds) * 10;
    return {
      deliveredValue: value,
      elapsedSeconds: seconds,
      timeBonus,
      total: value + timeBonus
    };
  }

  function belongsToCompound(body, compound) {
    return Boolean(body && compound && (body === compound || body.parent === compound));
  }

  function zoneAt(worldX) {
    if (worldX >= 5000 && worldX < 7000) return 'construction';
    if (worldX >= 8000 && worldX < 9500) return 'electromagnetic';
    if (worldX >= 9500 && worldX < 12500) return 'mechanical';
    return 'city';
  }

  function zoneInfluence(worldX, start, end, ramp) {
    if (worldX <= start || worldX >= end || ramp <= 0) return 0;
    return Math.max(0, Math.min(1, (worldX - start) / ramp, (end - worldX) / ramp));
  }

  function magneticFieldForce(mass, coreMass, baseForce, influence) {
    const ratio = Math.max(1, mass / coreMass);
    return baseForce * Math.sqrt(ratio) * Math.max(0, Math.min(1, influence));
  }

  function boostDurationAfterPickup(currentMs, durationMs) {
    return Math.max(0, currentMs, durationMs);
  }

  function attractionStrength(distance, radius) {
    if (radius <= 0) return 0;
    return Math.max(0, Math.min(1, 1 - distance / radius));
  }

  function oscillatorPhase(elapsedMs, periodMs, phaseOffset) {
    if (periodMs <= 0) return 0;
    const phase = elapsedMs / periodMs + (phaseOffset || 0);
    return ((phase % 1) + 1) % 1;
  }

  function pistonYAt(elapsedMs, centerY, amplitude, periodMs, phaseOffset) {
    return centerY + Math.sin(oscillatorPhase(elapsedMs, periodMs, phaseOffset) * Math.PI * 2) * amplitude;
  }

  function rotorAngleAt(elapsedMs, periodMs, phaseOffset) {
    return oscillatorPhase(elapsedMs, periodMs, phaseOffset) * Math.PI * 2;
  }

  const LEVELS = {
    level1: {
      id: 'level1',
      title: 'CIUDAD',
      theme: 'city',
      trackLength: 10900,
      destinationX: 10250,
      destinationLabel: 'BASURERO MUNICIPAL',
      stoneGates: [1250, 2250, 3350, 4550, 5900, 7400, 9050],
      scrapers: [4050, 6900, 8550],
      softEnd: 9400,
      boostPickupX: 7600,
      field: { start: 8000, end: 9500, ramp: 180 },
      hasCrane: true,
      hasField: true,
      hasBoost: true,
      qa: {
        construction: [5650, 5400],
        boost: [7575, 7200],
        field: [8150, 7920],
        scraper: [3850, 3650]
      }
    },
    level2: {
      id: 'level2',
      title: 'DISTRITO MECANICO',
      theme: 'factory',
      trackLength: 5400,
      destinationX: 4750,
      destinationLabel: 'CENTRO DE RECICLAJE',
      stoneGates: [],
      scrapers: [],
      softEnd: 4450,
      hasCrane: false,
      hasField: false,
      hasBoost: false,
      qa: {
        mechanical: [300, 200],
        piston: [820, 720],
        rotor: [1950, 1800]
      }
    }
  };

  function levelConfig(levelId) {
    return LEVELS[levelId] || null;
  }

  function nextLevelId(levelId) {
    if (levelId === 'level1') return 'level2';
    return null;
  }

  function freshLevelState() {
    return {
      collected: [],
      startedAt: null,
      started: false,
      dead: false,
      finished: false,
      shedCooldown: 0,
      scraperCooldown: 0,
      mechanicalHitCooldown: 0,
      jumpCooldown: 0,
      boostMs: 0,
      scrapeNoticeMs: 0,
      scrapeLostValue: 0,
      mechanicalNoticeMs: 0
    };
  }

  function campaignTotal(results) {
    return (results || []).reduce((sum, entry) => sum + ((entry && entry.total) || 0), 0);
  }

  return {
    cameraSpeed,
    screenX,
    isCaughtByCamera,
    torqueForInput,
    choosePartToShed,
    jumpForceForMass,
    canHop,
    scrapSpecForIndex,
    routeMessage,
    scrapValue,
    scoreDelivery,
    belongsToCompound,
    zoneAt,
    zoneInfluence,
    magneticFieldForce,
    boostDurationAfterPickup,
    attractionStrength,
    oscillatorPhase,
    pistonYAt,
    rotorAngleAt,
    LEVELS,
    levelConfig,
    nextLevelId,
    freshLevelState,
    campaignTotal
  };
});
