const test = require('node:test');
const assert = require('node:assert/strict');

const {
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
} = require('./mass-model.js');

test('la cámara acelera suavemente y tiene un límite', () => {
  assert.equal(cameraSpeed(0), 72);
  assert.equal(cameraSpeed(30), 84);
  assert.equal(cameraSpeed(999), 108);
});

test('la derrota depende de la posición relativa a cámara', () => {
  assert.equal(screenX(250, 100), 150);
  assert.equal(isCaughtByCamera(145, 100, 40), false);
  assert.equal(isCaughtByCamera(139, 100, 40), true);
});

test('dos teclas producen torque opuesto y se cancelan juntas', () => {
  assert.equal(torqueForInput(true, false, 0.04), -0.04);
  assert.equal(torqueForInput(false, true, 0.04), 0.04);
  assert.equal(torqueForInput(true, true, 0.04), 0);
});

test('el raspado desprende la pieza mas cercana al punto real de contacto', () => {
  const parts = [
    { id: 'core', x: 100, y: 100, isCore: true },
    { id: 'top', x: 102, y: 60 },
    { id: 'left', x: 60, y: 99 },
    { id: 'bottom', x: 101, y: 142 }
  ];

  assert.equal(choosePartToShed(parts, 100, 55), 'top');
  assert.equal(choosePartToShed(parts, 55, 100), 'left');
  assert.equal(choosePartToShed(parts, 100, 150), 'bottom');
});

test('el raspado nunca desprende el nucleo aunque sea lo mas cercano', () => {
  const parts = [
    { id: 'core', x: 100, y: 100, isCore: true },
    { id: 'scrap', x: 140, y: 100 }
  ];

  assert.equal(choosePartToShed(parts, 100, 100), 'scrap');
  assert.equal(choosePartToShed([parts[0]], 100, 100), null);
});

test('el pulso aumenta sublinealmente: más masa recibe menos aceleración', () => {
  const lightForce = jumpForceForMass(2, 2, 0.04);
  const heavyForce = jumpForceForMass(8, 2, 0.04);

  assert.equal(lightForce, 0.04);
  assert.equal(heavyForce, 0.08);
  assert.ok(heavyForce / 8 < lightForce / 2);
});

test('solo puede pulsar apoyado y fuera del cooldown', () => {
  assert.equal(canHop(378, 380, 0), true);
  assert.equal(canHop(350, 380, 0), false);
  assert.equal(canHop(378, 380, 10), false);
});

test('la chatarra alterna formas cuya medida define el collider', () => {
  assert.deepEqual(scrapSpecForIndex(0), { kind: 'gear', radius: 7 });
  assert.deepEqual(scrapSpecForIndex(1), { kind: 'plate', width: 18, height: 8 });
  assert.deepEqual(scrapSpecForIndex(2), { kind: 'nut', radius: 9, sides: 6 });
  assert.deepEqual(scrapSpecForIndex(3), { kind: 'gear', radius: 10 });
});

test('la ruta comunica el basurero sin interrumpir el juego', () => {
  assert.equal(routeMessage(0, 12000), 'BASURERO MUNICIPAL 1200 m');
  assert.equal(routeMessage(11850, 12000), 'YA SE VE EL BASURERO');
  assert.equal(routeMessage(12000, 12000), 'DESTINO ALCANZADO');
});

test('cada forma y tamano de chatarra tiene un valor determinista', () => {
  assert.equal(scrapValue({ kind: 'gear', radius: 7 }), 10);
  assert.equal(scrapValue({ kind: 'gear', radius: 13 }), 30);
  assert.equal(scrapValue({ kind: 'plate', width: 18, height: 8 }), 15);
  assert.equal(scrapValue({ kind: 'plate', width: 26, height: 12 }), 35);
  assert.equal(scrapValue({ kind: 'nut', radius: 9 }), 20);
  assert.equal(scrapValue({ kind: 'nut', radius: 13 }), 40);
});

test('la puntuacion suma solo valor entregado y un bonus de tiempo no negativo', () => {
  assert.deepEqual(scoreDelivery(125, 150), {
    deliveredValue: 125,
    elapsedSeconds: 150,
    timeBonus: 300,
    total: 425
  });
  assert.deepEqual(scoreDelivery(0, 181), {
    deliveredValue: 0,
    elapsedSeconds: 181,
    timeBonus: 0,
    total: 0
  });
  assert.equal(scoreDelivery(80, -5).timeBonus, 1800);
});

test('el nucleo, el root y cualquier child pertenecen al mismo compuesto', () => {
  const compound = { id: 'blob' };
  const child = { id: 'scrap', parent: compound };
  const stranger = { id: 'soft', parent: { id: 'soft-root' } };
  assert.equal(belongsToCompound(compound, compound), true);
  assert.equal(belongsToCompound(child, compound), true);
  assert.equal(belongsToCompound(stranger, compound), false);
  assert.equal(belongsToCompound(null, compound), false);
});

test('las zonas tienen entradas y salidas sin solaparse', () => {
  assert.equal(zoneAt(4999), 'city');
  assert.equal(zoneAt(5000), 'construction');
  assert.equal(zoneAt(6999), 'construction');
  assert.equal(zoneAt(7000), 'city');
  assert.equal(zoneAt(8000), 'electromagnetic');
  assert.equal(zoneAt(9500), 'mechanical');
  assert.equal(zoneAt(9600), 'mechanical');
  assert.equal(zoneAt(12499), 'mechanical');
  assert.equal(zoneAt(12500), 'city');
});

test('el campo entra y sale con rampas legibles', () => {
  assert.equal(zoneInfluence(7999, 8000, 9500, 180), 0);
  assert.equal(zoneInfluence(8000, 8000, 9500, 180), 0);
  assert.equal(zoneInfluence(8090, 8000, 9500, 180), 0.5);
  assert.equal(zoneInfluence(8180, 8000, 9500, 180), 1);
  assert.equal(zoneInfluence(9410, 8000, 9500, 180), 0.5);
  assert.equal(zoneInfluence(9500, 8000, 9500, 180), 0);
});

test('el campo escala sublinealmente y suspende menos a la masa pesada', () => {
  const light = magneticFieldForce(2, 2, 0.002, 1);
  const heavy = magneticFieldForce(8, 2, 0.002, 1);
  assert.equal(light, 0.002);
  assert.equal(heavy, 0.004);
  assert.ok(heavy / 8 < light / 2);
  assert.equal(magneticFieldForce(8, 2, 0.002, 0), 0);
});

test('el potenciador renueva duracion y su atraccion termina en el radio', () => {
  assert.equal(boostDurationAfterPickup(1200, 6000), 6000);
  assert.equal(boostDurationAfterPickup(7200, 6000), 7200);
  assert.equal(attractionStrength(0, 120), 1);
  assert.equal(attractionStrength(60, 120), 0.5);
  assert.equal(attractionStrength(120, 120), 0);
  assert.equal(attractionStrength(140, 120), 0);
});

test('la fase mecanica es periodica y queda normalizada', () => {
  assert.equal(oscillatorPhase(0, 2000, 0), 0);
  assert.equal(oscillatorPhase(500, 2000, 0), 0.25);
  assert.equal(oscillatorPhase(2000, 2000, 0), 0);
  assert.equal(oscillatorPhase(2500, 2000, 0.25), 0.5);
});

test('el piston respeta extremos, centro y periodicidad', () => {
  assert.equal(pistonYAt(0, 100, 40, 2000), 100);
  assert.equal(pistonYAt(500, 100, 40, 2000), 140);
  assert.equal(pistonYAt(1000, 100, 40, 2000), 100);
  assert.equal(pistonYAt(1500, 100, 40, 2000), 60);
  assert.equal(pistonYAt(2500, 100, 40, 2000), 140);
});

test('el barredor rota en forma periodica con fase configurable', () => {
  assert.equal(rotorAngleAt(0, 2400, 0), 0);
  assert.equal(rotorAngleAt(600, 2400, 0), Math.PI / 2);
  assert.equal(rotorAngleAt(2400, 2400, 0), 0);
  assert.equal(rotorAngleAt(0, 2400, 0.5), Math.PI);
});

test('la configuracion define dos niveles con track y meta propios', () => {
  assert.equal(levelConfig('level1').title, 'CIUDAD');
  assert.equal(levelConfig('level1').trackLength, 10900);
  assert.equal(levelConfig('level1').destinationX, 10250);
  assert.equal(levelConfig('level2').title, 'DISTRITO MECANICO');
  assert.equal(levelConfig('level2').trackLength, 5400);
  assert.equal(levelConfig('level2').destinationX, 4750);
  assert.equal(levelConfig('nope'), null);
  assert.equal(LEVELS.level2.theme, 'factory');
});

test('la transicion avanza del nivel 1 al 2 y termina la campana', () => {
  assert.equal(nextLevelId('level1'), 'level2');
  assert.equal(nextLevelId('level2'), null);
});

test('cada nivel arranca con estado limpio: sin recoleccion, sin cronometro', () => {
  const state = freshLevelState();
  assert.deepEqual(state.collected, []);
  assert.equal(state.startedAt, null);
  assert.equal(state.finished, false);
  assert.equal(state.boostMs, 0);
});

test('la puntuacion de campana suma los totales de cada nivel', () => {
  assert.equal(campaignTotal([{ total: 425 }, { total: 380 }]), 805);
  assert.equal(campaignTotal([]), 0);
  assert.equal(campaignTotal([{ total: 100 }, null]), 100);
});

test('la ruta usa el rotulo de destino propio del nivel', () => {
  assert.equal(routeMessage(0, 4750, 'CENTRO DE RECICLAJE'), 'CENTRO DE RECICLAJE 475 m');
  assert.equal(routeMessage(1000, 4750, 'CENTRO DE RECICLAJE'), 'CENTRO DE RECICLAJE 375 m');
  assert.equal(routeMessage(4750, 4750, 'CENTRO DE RECICLAJE'), 'DESTINO ALCANZADO');
});

test('el aviso de llegada nombra el destino del nivel y no siempre el basurero', () => {
  assert.equal(routeMessage(4650, 4750, 'CENTRO DE RECICLAJE'), 'YA SE VE CENTRO DE RECICLAJE');
  assert.equal(routeMessage(10200, 10250, 'BASURERO MUNICIPAL'), 'YA SE VE BASURERO MUNICIPAL');
  assert.equal(routeMessage(11850, 12000), 'YA SE VE EL BASURERO');
});

test('el juego importa del modelo la transicion de nivel y el total de campana', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, 'game.js'), 'utf8');
  const destructured = source.slice(0, source.indexOf('} = LastreModel;'));
  for (const name of ['nextLevelId', 'campaignTotal', 'freshLevelState']) {
    assert.ok(destructured.includes(name), `game.js usa ${name} sin importarlo de LastreModel`);
  }
});
