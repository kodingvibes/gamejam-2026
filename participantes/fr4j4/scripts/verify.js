#!/usr/bin/env node
// scripts/verify.js — Verificación automatica del proyecto.
//
// Corre sin browser. Carga todos los scripts del juego en orden (como index.html),
// mockea Phaser, y ejecuta el path crítico de HeroSprite (el bug que tuvo el user)
// más todos los callsites de GameScene.
//
// Uso: node scripts/verify.js
// Salida: exit 0 si pasa, exit 1 si falla.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = path.resolve(__dirname, '..');
const HERO_DIR = path.join(BASE, 'js/data/sprites/heroes');

function load(ctx, rel) {
  const code = fs.readFileSync(path.join(BASE, rel), 'utf8');
  vm.runInContext(code, ctx, { filename: rel });
}

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAIL: ' + msg);
}

function buildCtx() {
  const errors = [];
  const ctx = {
    window: {},
    console: {
      log: () => {},
      warn: (m) => { if (String(m).includes('load error')) return; },
      error: (m) => { if (!String(m).includes('[phaser-compat]')) errors.push(m); },
      info: () => {}
    },
    document: { fonts: undefined, addEventListener: () => {} },
    WebFont: undefined,
    setTimeout: () => {},
    localStorage: { _data: {}, getItem(k){return this._data[k]||null;}, setItem(k,v){this._data[k]=v;} },
    location: { search: '' }
  };
  ctx.__errors = errors;
  vm.createContext(ctx);
  return ctx;
}

function step(name, fn) {
  process.stdout.write('  ' + name + ' ... ');
  try { fn(); console.log('OK'); }
  catch (e) { console.log('FAIL'); throw e; }
}

(async function main() {
  console.log('=== Deckstiny verification ===\n');

  // --- 1. Sintaxis ---
  console.log('1. Sintaxis de todos los .js');
  const files = [
    'js/main.js',
    'js/phaser-compat.js',
    'js/data/classes.js',
    'js/data/cards.js',
    'js/data/campaign.js',
    'js/ui/card.js',
    'js/ui/crt.js',
    'js/ui/vfx.js',
    'js/data/tutorial.js',
    'js/ui/help.js',
    'js/engine/HeroSprite.js',
    'js/data/sprites/heroes/mago.js',
    'js/data/sprites/heroes/necromancer.js',
    'js/data/sprites/heroes/guerrero.js',
    'js/data/sprites/heroes/asesino.js',
    'js/data/sprites/heroes/bardo.js',
    'js/scenes/BootScene.js',
    'js/scenes/MenuScene.js',
    'js/scenes/DeckScene.js',
    'js/scenes/GameScene.js',
    'js/scenes/GameOverScene.js',
    'js/scenes/DeckPickerScene.js'
  ];
  step('archivos existen', () => {
    for (const f of files) assert(fs.existsSync(path.join(BASE, f)), 'falta ' + f);
  });
  for (const f of files) {
    if (f.endsWith('.js')) {
      step(f.replace(BASE + '/', ''), () => {
        new vm.Script(fs.readFileSync(path.join(BASE, f), 'utf8'), { filename: f });
      });
    }
  }

  // --- 2. Carga en orden ---
  console.log('\n2. Carga de scripts en orden (como index.html)');
  const ctx = buildCtx();
  step('phaser-compat', () => load(ctx, 'js/phaser-compat.js'));
  step('classes', () => load(ctx, 'js/data/classes.js'));
  step('cards', () => load(ctx, 'js/data/cards.js'));
  step('campaign', () => load(ctx, 'js/data/campaign.js'));
  step('UI/card', () => load(ctx, 'js/ui/card.js'));
  step('UI/crt', () => load(ctx, 'js/ui/crt.js'));
  step('UI/vfx', () => load(ctx, 'js/ui/vfx.js'));
  step('tutorial', () => load(ctx, 'js/data/tutorial.js'));
  step('help', () => load(ctx, 'js/ui/help.js'));
  step('sprite/mago', () => load(ctx, 'js/data/sprites/heroes/mago.js'));
  step('sprite/necromancer', () => load(ctx, 'js/data/sprites/heroes/necromancer.js'));
  step('sprite/guerrero', () => load(ctx, 'js/data/sprites/heroes/guerrero.js'));
  step('sprite/asesino', () => load(ctx, 'js/data/sprites/heroes/asesino.js'));
  step('sprite/bardo', () => load(ctx, 'js/data/sprites/heroes/bardo.js'));
  step('sprite/dummy', () => load(ctx, 'js/data/sprites/heroes/dummy.js'));
  step('HeroSprite engine', () => load(ctx, 'js/engine/HeroSprite.js'));

  // --- 3. Globals expuestas ---
  console.log('\n3. Globals expuestas');
  step('CLASSES', () => assert(Array.isArray(ctx.window.CLASSES) && ctx.window.CLASSES.length === 5, 'CLASSES debe tener 5 entradas'));
  step('ALL_CARDS', () => assert(ctx.window.ALL_CARDS, 'ALL_CARDS falta'));
  ['MAGO','NECROMANCER','GUERRERO','ASESINO','BARDO','DUMMY'].forEach(id => {
    step('HERO_SPRITE_' + id, () => assert(ctx.window['HERO_SPRITE_' + id], 'falta HERO_SPRITE_' + id));
  });
  step('HeroSprite', () => {
    assert(ctx.window.HeroSprite, 'HeroSprite falta');
    assert(typeof ctx.window.HeroSprite.create === 'function', 'create no es funcion');
    assert(typeof ctx.window.HeroSprite.preload === 'function', 'preload no es funcion');
  });
  step('TUTORIAL_GLOSSARY', () => {
    assert(Array.isArray(ctx.window.TUTORIAL_GLOSSARY) && ctx.window.TUTORIAL_GLOSSARY.length >= 15, 'glosario debe tener >= 15 entradas');
  });
  step('TUTORIAL_PAGES', () => {
    assert(Array.isArray(ctx.window.TUTORIAL_PAGES) && ctx.window.TUTORIAL_PAGES.length === 7, 'tutorial debe tener 7 paginas');
  });
  step('HelpSystem API', () => {
    const hs = ctx.window.HelpSystem;
    assert(hs, 'HelpSystem falta');
    assert(typeof hs.register === 'function', 'register no es funcion');
    assert(typeof hs.showOverlay === 'function', 'showOverlay no es funcion');
    assert(typeof hs.clearZones === 'function', 'clearZones no es funcion');
    assert(typeof hs.setEnabled === 'function', 'setEnabled no es funcion');
  });
  step('CAMPAIGN_STAGES', () => {
    const cs = ctx.window.CAMPAIGN_STAGES;
    const classes = ctx.window.CLASSES || [];
    assert(Array.isArray(cs) && cs.length >= 3, 'campaña debe tener >= 3 etapas');
    cs.forEach((st, i) => {
      assert(st.id && st.name, 'etapa ' + i + ' falta id/name');
      assert(classes.some(c => c.id === st.classId), 'etapa ' + i + ' classId invalido');
      assert(st.hp > 0, 'etapa ' + i + ' hp invalido');
    });
  });
  step('balance: m_bola costo 2', () => {
    const c = (ctx.window.ALL_CARDS.mago || []).find(x => x.id === 'm_bola');
    assert(c && c.cost === 2, 'm_bola debe costar 2 (era 1 por 3 daño, OP)');
  });
  step('balance: g_ataque costo 3', () => {
    const c = (ctx.window.ALL_CARDS.guerrero || []).find(x => x.id === 'g_ataque');
    assert(c && c.cost === 3, 'g_ataque debe costar 3 (era 2 por 5 daño, OP)');
  });
  step('balance: g_levantar costo 2', () => {
    const c = (ctx.window.ALL_CARDS.guerrero || []).find(x => x.id === 'g_levantar');
    assert(c && c.cost === 2, 'g_levantar debe costar 2 (era 1 por 4 armadura, OP)');
  });
  step('balance: n_drenar 2 daño + 2 cura', () => {
    const c = (ctx.window.ALL_CARDS.necromancer || []).find(x => x.id === 'n_drenar');
    const dmg = (c.effects || []).find(e => e.type === 'damage');
    const heal = (c.effects || []).find(e => e.type === 'heal');
    assert(dmg && heal && dmg.amount === 2 && heal.amount === 2, 'n_drenar debe ser 2/2 (era 3/3, OP)');
  });
  step('balance: b_nota 2 daño', () => {
    const c = (ctx.window.ALL_CARDS.bardo || []).find(x => x.id === 'b_nota');
    const dmg = (c.effects || []).find(e => e.type === 'damage');
    assert(c && dmg && dmg.amount === 2, 'b_nota debe ser 2 daño (era 1, debil)');
  });

  // --- 3b. Glosario cubre todos los efectos y keywords ---
  console.log('\n3b. Glosario cubre efectos y keywords');
  const glossaryIds = new Set((ctx.window.TUTORIAL_GLOSSARY || []).map(g => g.id));
  const allEffects = new Set();
  for (const clsId in (ctx.window.ALL_CARDS || {})) {
    for (const card of ctx.window.ALL_CARDS[clsId] || []) {
      (card.effects || []).forEach(e => allEffects.add(e.type));
    }
  }
  const effectToGlossary = {
    damage: 'mana', heal: 'mana', armor: 'armor', draw: 'draw', venom: 'venom',
    inspiration: 'inspiration', summon: 'board-slots', damage_all_enemies: 'mana',
    freeze: 'freeze', weaken: 'weaken', fortify: 'fortify', silence: 'silence',
    cost_reduction: 'cost-reduction', copy_card: 'deck', swap_hands: 'hand',
    discard_random: 'discard', consumable: 'consumable', sacrifice: 'sacrifice',
    board_buff: 'fortify', damage_conditional: 'venom', conditional: 'mana'
  };
  step('efectos tienen entrada de glosario', () => {
    for (const eff of allEffects) {
      const mapped = effectToGlossary[eff];
      assert(mapped && glossaryIds.has(mapped), 'efecto "' + eff + '" no tiene entrada de glosario');
    }
  });
  step('keywords tienen entrada de glosario', () => {
    ['guard', 'evasive', 'celerity', 'consumable'].forEach(k => {
      assert(glossaryIds.has(k), 'keyword "' + k + '" no tiene entrada de glosario');
    });
  });

  // --- 4. Path crítico: create + setState ---
  console.log('\n4. Path crítico (bug original del usuario)');
  const makeMockScene = (hasTexture, opts = {}) => {
    const texW = opts.texW || 1024;
    const texH = opts.texH || 1024;
    return {
      textures: {
        exists: () => hasTexture,
        get: (key) => ({
          getSourceImage: () => ({ width: texW, height: texH, naturalWidth: texW, naturalHeight: texH }),
          width: texW, height: texH
        })
      },
      load: {
        image: () => {},
        spritesheet: (key, src, frameCfg) => {
          mockScenesLoaded.push({ key, src, frameCfg });
        }
      },
      add: {
        image: (x, y, key, frame) => {
          const img = {
            x: x || 0, y: y || 0,
            width: texW, height: texH,
            scaleX: 1, scaleY: 1,
            displayWidth: texW, displayHeight: texH,
            originX: 0.5, originY: 0.5,
            frame: frame || 0,
            visible: true, alpha: 1, depth: 0,
            setFrame: function(f) { this.frame = f; this._lastSetFrame = f; return this; },
            setOrigin: function(ox, oy) { this.originX = ox; this.originY = oy; return this; },
            setScale: function(s) {
              this.scaleX = s; this.scaleY = s;
              this.displayWidth = this.width * s;
              this.displayHeight = this.height * s;
              return this;
            },
            setFlip: function(h, v) { this._lastFlip = { h: !!h, v: !!v }; return this; },
            destroy: function() {}
          };
          return img;
        },
        graphics: () => ({ fillStyle:()=>({}), fillRect:()=>({}), lineStyle:()=>({}), strokeRect:()=>({}), destroy:()=>{} }),
        text: () => ({ setOrigin: () => ({ destroy: () => {} }), destroy: () => {} })
      }
    };
  };
  const mockScene = (hasTexture) => makeMockScene(hasTexture);
  const mockScenesLoaded = [];

  step('HeroSprite.create con texture no lanza', () => {
    const inst = ctx.window.HeroSprite.create(mockScene(true), {
      config: ctx.window.HERO_SPRITE_MAGO, side: 'left', x: 72, y: 96, icon: '🧙'
    });
    assert(inst, 'no devolvió instancia');
  });
  step('HeroSprite.create sin texture (fallback) no lanza', () => {
    const inst = ctx.window.HeroSprite.create(mockScene(false), {
      config: ctx.window.HERO_SPRITE_MAGO, side: 'left', x: 72, y: 96, icon: '🧙'
    });
    assert(inst, 'no devolvió instancia');
    assert(inst.available === false, 'available debio ser false');
  });
  step('instance.setState es función', () => {
    const inst = ctx.window.HeroSprite.create(mockScene(true), {
      config: ctx.window.HERO_SPRITE_MAGO, side: 'left', x: 72, y: 96, icon: '🧙'
    });
    assert(typeof inst.setState === 'function', 'BUG ORIGINAL: setState no es funcion');
    inst.destroy();
  });
  step('setState vacio cae a idle', () => {
    const inst = ctx.window.HeroSprite.create(mockScene(true), {
      config: ctx.window.HERO_SPRITE_MAGO, side: 'left', x: 72, y: 96, icon: '🧙'
    });
    inst.setState('attack'); // array vacio -> fallback
    assert(inst.currentFrames && inst.currentFrames.length > 0, 'debe tener frames de fallback');
    inst.destroy();
  });
  step('one-shot vuelve a idle tras consumir frames', () => {
    const cfg = JSON.parse(JSON.stringify(ctx.window.HERO_SPRITE_MAGO));
    cfg.states.attack = [{ x: 256, y: 0, vflip: false, hflip: false, dur: 100 }];
    const inst = ctx.window.HeroSprite.create(mockScene(true), {
      config: cfg, side: 'left', x: 72, y: 96, icon: '🧙'
    });
    inst.setState('attack');
    assert(inst.currentState === 'attack', 'setState(attack) no aplico');
    inst.update(0, 100);
    assert(inst.currentState === 'idle', 'one-shot debio volver a idle, got ' + inst.currentState);
    inst.destroy();
  });
  step('hflip global side=right', () => {
    const captured = [];
    const cfg = JSON.parse(JSON.stringify(ctx.window.HERO_SPRITE_MAGO));
    cfg.states.idle = [{ x: 0, y: 0, vflip: false, hflip: false, dur: 200 }];
    const scene = mockScene(true);
    const inst = ctx.window.HeroSprite.create(scene, { config: cfg, side: 'right', x: 568, y: 96, icon: '🧙' });
    inst.sprite.setFlip = (h, v) => { captured.push({ h: !!h, v: !!v }); };
    inst._applyFrame();
    assert(captured.length > 0 && captured[captured.length - 1].h === true, 'side=right debio aplicar hflip=true');
    inst.destroy();
  });
  step('XOR hflip cancela espejado', () => {
    const captured = [];
    const cfg = JSON.parse(JSON.stringify(ctx.window.HERO_SPRITE_MAGO));
    cfg.states.idle = [{ x: 0, y: 0, vflip: false, hflip: true, dur: 200 }];
    const inst = ctx.window.HeroSprite.create(mockScene(true), { config: cfg, side: 'right', x: 568, y: 96, icon: '🧙' });
    inst.sprite.setFlip = (h, v) => { captured.push({ h: !!h, v: !!v }); };
    inst._applyFrame();
    assert(captured.length > 0 && captured[captured.length - 1].h === false, 'hflip=true XOR side=right debio dar h=false');
    inst.destroy();
  });
  step('preload usa spritesheet() con frameWidth/frameHeight', () => {
    mockScenesLoaded.length = 0;
    const scene = makeMockScene(true);
    ctx.window.HeroSprite.preload(scene, ctx.window.HERO_SPRITE_MAGO);
    assert(mockScenesLoaded.length === 1, 'preload debio llamar load.spritesheet una vez');
    const loaded = mockScenesLoaded[0];
    assert(loaded.frameCfg.frameWidth === 512, 'frameWidth debio ser 512, got ' + loaded.frameCfg.frameWidth);
    assert(loaded.frameCfg.frameHeight === 512, 'frameHeight debio ser 512, got ' + loaded.frameCfg.frameHeight);
  });
  step('create asigna frame 0 al inicio (esquina sup izq)', () => {
    const cfg = JSON.parse(JSON.stringify(ctx.window.HERO_SPRITE_MAGO));
    cfg.frameSize = { w: 512, h: 512 };
    cfg.scale = 0.25;
    const scene = makeMockScene(true, { texW: 2048, texH: 2048 });
    const inst = ctx.window.HeroSprite.create(scene, { config: cfg, side: 'left', x: 72, y: 96, icon: '🧙' });
    assert(inst.sprite.frame === 0, 'frame inicial debio ser 0, got ' + inst.sprite.frame);
    inst.destroy();
  });
  step('xy a frameIndex: {x:512,y:512} de frameSize 512 = frame 5', () => {
    const cfg = JSON.parse(JSON.stringify(ctx.window.HERO_SPRITE_MAGO));
    cfg.frameSize = { w: 512, h: 512 };
    cfg.scale = 0.25;
    const scene = makeMockScene(true, { texW: 2048, texH: 2048 });
    const inst = ctx.window.HeroSprite.create(scene, { config: cfg, side: 'left', x: 72, y: 96, icon: '🧙' });
    assert(inst.sprite._lastSetFrame === 0, 'frame inicial debio ser 0, got ' + inst.sprite._lastSetFrame);
    // Forzar frameIndex al segundo elemento y aplicar
    inst.currentFrames = [
      { x: 0,   y: 0,   vflip: false, hflip: false, dur: 200 },
      { x: 512, y: 512, vflip: false, hflip: false, dur: 200 }
    ];
    inst.frameIndex = 1;
    inst._applyFrame();
    assert(inst.sprite._lastSetFrame === 5, 'frame {x:512,y:512} debio ser 5 (row=1 col=1), got ' + inst.sprite._lastSetFrame);
    inst.destroy();
  });

  // --- 5. Errores en consola ---
  console.log('\n5. Sin errores en consola');
  if (ctx.__errors.length > 0) {
    console.log('  ERRORES CAPTURADOS:');
    ctx.__errors.forEach(e => console.log('    ' + e));
    throw new Error('Hubo errors en consola');
  }
  console.log('  OK');

  console.log('\n=== TODOS LOS CHECKS PASAN ===');
  process.exit(0);
})().catch(e => {
  console.error('\n=== FALLO ===');
  console.error(e.stack || e.message);
  process.exit(1);
});