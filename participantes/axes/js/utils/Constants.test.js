/*
 * El layout responsive es aritmética: unas posiciones se cuelgan del tablero centrado
 * (crecen a la mitad del ritmo del mundo) y otras del borde inferior (crecen al ritmo
 * entero). En aspectos vertical bajos esas dos familias se cruzaban y el HUD se pisaba.
 * Esto barre aspectos reales y falla si alguna pareja vuelve a solaparse.
 * Ejecutar desde la raíz: node participantes/axes/js/utils/Constants.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'Constants.js'), 'utf8');

// Los const de nivel superior no se cuelgan del objeto global del sandbox, así que hay
// que sacarlos con una expresión dentro del propio contexto.
const EXPORTS = '({ GAME_HEIGHT, IS_PORTRAIT, BOARD_STYLE, BOARD_BOTTOM, HUD_LAYOUT, SAFE_METER, MENU_LAYOUT })';

/**
 * Carga Constants.js como si #game midiera 800 x 800*aspect.
 * @param {number} [aspect] sin valor, sin DOM: es el caso de las otras pruebas.
 */
function layoutFor(aspect) {
  const context = vm.createContext(aspect === undefined ? { console, Math } : {
    console,
    Math,
    setTimeout,
    clearTimeout,
    window: { addEventListener() {} },
    document: {
      getElementById: () => ({ getBoundingClientRect: () => ({ width: 800, height: 800 * aspect }) }),
    },
  });
  vm.runInContext(source, context, { filename: 'Constants.js' });
  return vm.runInContext(EXPORTS, context);
}

// Sin DOM (el resto de pruebas) el mundo tiene que seguir siendo el cuadrado de siempre.
const headless = layoutFor();
assert.equal(headless.GAME_HEIGHT, 800);
assert.equal(headless.IS_PORTRAIT, false);

// 1.75 y 2.17 son el iPad mini y el iPhone en vertical descontando la barra de la página;
// 1.33 y 1.6 son tablet 4:3 y ventana de escritorio estrecha, que van al layout horizontal.
[1.0, 1.33, 1.5, 1.6, 1.7, 1.75, 1.9, 2.0, 2.17, 2.4, 3.0].forEach((aspect) => {
  const c = layoutFor(aspect);
  const donde = `aspecto ${aspect}`;

  if (!c.IS_PORTRAIT) {
    assert.equal(c.GAME_HEIGHT, 800, `${donde}: horizontal debe conservar el mundo cuadrado`);
    return;
  }

  const frameTop = c.BOARD_STYLE.top - c.BOARD_STYLE.framePadding;
  // El marco del tablero es un rect SVG opaco por encima del canvas: lo que quede
  // dentro de su franja no se ve, aunque Phaser lo dibuje.
  assert.ok(c.HUD_LAYOUT.thinkingY + 12 < frameTop, `${donde}: PENSANDO cae dentro del marco`);
  assert.ok(c.HUD_LAYOUT.chainY + 14 < frameTop, `${donde}: el banner de cadena cae dentro del marco`);
  assert.ok(
    c.HUD_LAYOUT.chainY - 14 > c.HUD_LAYOUT.turnY + c.HUD_LAYOUT.turnHeight / 2,
    `${donde}: el banner de cadena pisa la píldora de turno`,
  );

  assert.ok(
    c.SAFE_METER.barY + c.SAFE_METER.height / 2 < c.HUD_LAYOUT.buttonY - c.HUD_LAYOUT.buttonHeight / 2,
    `${donde}: el medidor de terreno pisa los botones`,
  );
  assert.ok(c.SAFE_METER.labelY > c.BOARD_BOTTOM, `${donde}: la etiqueta del medidor pisa el tablero`);
  assert.ok(
    c.HUD_LAYOUT.buttonY + c.HUD_LAYOUT.buttonHeight / 2 <= c.GAME_HEIGHT,
    `${donde}: los botones se salen del mundo`,
  );

  // El menú se cuelga del centro del mundo: el título es el offset más negativo.
  assert.ok(c.MENU_LAYOUT.titleY - 34 > 0, `${donde}: el título del menú sale por arriba`);
  assert.ok(c.MENU_LAYOUT.recordY < c.GAME_HEIGHT, `${donde}: el récord del menú sale por abajo`);
});

console.log('Constants tests: OK');
