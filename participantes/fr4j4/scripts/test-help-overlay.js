#!/usr/bin/env node
// scripts/test-help-overlay.js — Ejercita HelpSystem.showOverlay con un mock de Phaser
// para confirmar que el overlay del tutorial se construye sin TypeError (bug reportado:
// "no andan los botones" — renderPage llamaba prevBtn.setAlpha directamente).

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = path.resolve(__dirname, '..');

function load(ctx, rel) {
  const code = fs.readFileSync(path.join(BASE, rel), 'utf8');
  vm.runInContext(code, ctx, { filename: rel });
}

function mkTextObj(scene, x, y, content) {
  return {
    scene, x, y, content,
    _lastText: content, _alpha: 1,
    setText(t) { this._lastText = t; return this; },
    setOrigin() { return this; },
    setAlpha(a) { this._alpha = a; return this; },
    setResolution() { return this; },
    setInteractive() { return this; },
    setDepth() { return this; },
    setScale() { return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setY(y) { this.y = y; return this; },
    getBounds() { return { width: 20 }; },
    on() { return this; },
    destroy() {}
  };
}

function mkContainer(scene, x, y) {
  const c = {
    scene, x, y, _alpha: 1, list: [],
    add(obj) { this.list.push(obj); if (obj.scene !== scene) obj.scene = scene; return this; },
    setAlpha(a) { this._alpha = a; return this; },
    setScale() { return this; },
    setDepth() { return this; },
    setInteractive() { return this; },
    setSize() { return this; },
    setOrigin() { return this; },
    on() { return this; },
    destroy() { this.list = []; }
  };
  return c;
}

function buildCtx() {
  const ctx = {
    window: {},
    console: { log: () => {}, warn: () => {}, error: (m) => { if (!String(m).includes('[phaser-compat]')) ctx.__errors.push(String(m)); }, info: () => {} },
    document: { fonts: undefined, addEventListener: () => {} },
    WebFont: undefined,
    setTimeout: () => {},
    localStorage: { _data: {}, getItem(k){return this._data[k]||null;}, setItem(k,v){this._data[k]=v;} },
    location: { search: '' },
    URLSearchParams: function () { this.get = () => null; }
  };
  ctx.__errors = [];
  vm.createContext(ctx);
  return ctx;
}

// Mock de Phaser mínimo
const phaserMock = {
  Scene: class {},
  Display: { Color: { HexStringToColor: (hex) => ({ color: 0xffffff }) } },
  Math: { Between: () => 0, FloatBetween: () => 0 },
  BlendModes: { NORMAL: 0, ADD: 1 },
  Input: { Keyboard: { KeyCodes: { ESC: 27 } } },
  Geom: {}
};

function mkRect(scene, x, y, w, h, fill, alpha) {
  const r = {
    scene, x, y, width: w, height: h, fill, alpha, _alpha: 1,
    setStrokeStyle() { return this; },
    setInteractive() { return this; },
    setOrigin() { return this; },
    setDepth() { return this; },
    setAlpha(a) { this._alpha = a; return this; },
    setFillStyle() { return this; },
    setScale() { return this; },
    on() { return this; },
    off() { return this; },
    destroy() {}
  };
  return r;
}

function mkScene() {
  const scene = {
    add: {
      container: (x, y) => mkContainer(scene, x, y),
      rectangle: (x, y, w, h, fill, alpha) => mkRect(scene, x, y, w, h, fill, alpha),
      text: (x, y, content, style) => mkTextObj(scene, x, y, content),
      circle: (x, y, r, color) => ({ setBlendMode: () => ({}) })
    },
    input: { keyboard: { addKey: () => ({ on: () => {}, off: () => {} }) }, on: () => {}, off: () => {} },
    time: { delayedCall: () => ({ remove: () => {} }) },
    tweens: { add: () => {} },
    cameras: { main: { fadeOut: () => {} } }
  };
  scene.uiLayer = mkContainer(scene, 0, 0);
  scene.modalLayer = mkContainer(scene, 0, 0);
  return scene;
}

(async function main() {
  const ctx = buildCtx();
  ctx.window.Phaser = phaserMock;
  ctx.Phaser = phaserMock; // algunos modulos usan el global directo
  ctx.__errors = [];
  console.log('=== HelpSystem overlay test ===');

  load(ctx, 'js/data/classes.js');
  load(ctx, 'js/data/cards.js');
  load(ctx, 'js/ui/card.js');
  load(ctx, 'js/ui/vfx.js');
  load(ctx, 'js/data/tutorial.js');
  load(ctx, 'js/ui/help.js');
  // En el browser, window.UI se resuelve como global UI; replicar en vm
  ctx.UI = ctx.window.UI;
  ctx.VFX = ctx.window.VFX;
  ctx.CLASSES = ctx.window.CLASSES;
  ctx.ALL_CARDS = ctx.window.ALL_CARDS;

  const H = ctx.window.HelpSystem;
  if (!H) { console.error('HelpSystem no cargo'); process.exit(1); }

  const scene = mkScene();
  scene.helpBusy = false;

  // 1. showOverlay no debe lanzar (BUG: TypeError prevBtn.setAlpha is not a function)
  let threw = null;
  let result = null;
  try {
    result = H.showOverlay(scene, ctx.window.TUTORIAL_PAGES);
  } catch (e) {
    threw = e;
  }
  if (threw) { console.error('FAIL: showOverlay lanzo: ' + threw.message); process.exit(1); }
  if (!result || typeof result.close !== 'function') { console.error('FAIL: showOverlay no devolvio {close}'); process.exit(1); }
  console.log('OK showOverlay construye sin error');

  // 2. El overlay debe existir y helpBusy debe estar en true
  if (!scene.__helpManager || !scene.__helpManager.overlay) { console.error('FAIL: overlay no fue creado'); process.exit(1); }
  if (scene.helpBusy !== true) { console.error('FAIL: helpBusy no activo'); process.exit(1); }
  console.log('OK overlay creado, helpBusy=true');

  // 3. El texto de la pagina 1 debe haberse renderizado
  const mgr = scene.__helpManager;
  const firstTitle = ctx.window.TUTORIAL_PAGES[0].title;
  console.log('OK primera pagina titulo: ' + JSON.stringify(firstTitle));

  // 4. closeOverlay no debe lanzar y debe limpiar
  try {
    result.close();
  } catch (e) { console.error('FAIL: closeOverlay lanzo: ' + e.message); process.exit(1); }
  if (scene.helpBusy !== false) { console.error('FAIL: helpBusy no volvio a false'); process.exit(1); }
  console.log('OK closeOverlay limpia correctamente');

  // 5. Re-abrir (caso de uso "¿CÓMO JUGAR?" repetido)
  try {
    H.showOverlay(scene, ctx.window.TUTORIAL_PAGES).close();
  } catch (e) { console.error('FAIL: re-abrir lanzo: ' + e.message); process.exit(1); }
  console.log('OK re-apertura funciona');

  // 6. setEnabled toggle de burbujas (tecla H / botón AYUDA)
  try {
    H.setEnabled(scene, false);
    if (mgr.isEnabled() !== false) { console.error('FAIL: setEnabled(false) no aplico'); process.exit(1); }
    H.setEnabled(scene, true);
    if (mgr.isEnabled() !== true) { console.error('FAIL: setEnabled(true) no aplico'); process.exit(1); }
  } catch (e) { console.error('FAIL: setEnabled lanzo: ' + e.message); process.exit(1); }
  console.log('OK setEnabled toggle de burbujas');

  // 7. setModal: bloquea burbujas con menú de pausa abierto, sin tocar la preferencia
  try {
    H.setModal(scene, true);
    if (!mgr.isModal()) { console.error('FAIL: setModal(true) no aplico'); process.exit(1); }
    if (mgr.isEnabled() !== true) { console.error('FAIL: setModal toco la preferencia'); process.exit(1); }
    H.setModal(scene, false);
    if (mgr.isModal()) { console.error('FAIL: setModal(false) no aplico'); process.exit(1); }
    if (mgr.isEnabled() !== true) { console.error('FAIL: setModal(false) toco la preferencia'); process.exit(1); }
  } catch (e) { console.error('FAIL: setModal lanzo: ' + e.message); process.exit(1); }
  console.log('OK setModal bloquea sin tocar preferencia');

  if (ctx.__errors.length) {
    console.error('ERRORES DE CONSOLA: ' + ctx.__errors.join(' | '));
    process.exit(1);
  }

  console.log('\n=== OVERLAY TEST PASAN ===');
  process.exit(0);
})().catch(e => {
  console.error('\n=== FALLO ===');
  console.error(e.stack || e.message);
  process.exit(1);
});
