// DeckScene — Deckbuilder wizard (4 steps) + CRT/arcade visual identity
// 100% Phaser nativo: modales, menú contextual, confirmación y toast son containers.
// Layout: rexLayoutPlugin (Sizers/GridSizer/ScrollablePanel). Cartas verticales (proporción de naipe).
// Tipografía: Press Start 2P (headers/botones) + VT323 (cuerpo/nombres/descripciones).
// Root container escalado 2x → Phaser renderiza a 1280x720 real, CSS escala al viewport.
// Resolucion interna lógica: 640x360.

const CLASS_LORE = {
  mago: 'Domina el fuego y el hielo. Prefiere destruir desde lejos antes de que el enemigo pueda alzar un cuchillo.',
  necromancer: 'Cultiva la muerte como jardín. Sus esqueletos no descansan hasta que el rival caiga.',
  guerrero: 'Porta acero y escudo. Más resiste, más castiga; la batalla es su hogar.',
  asesino: 'Sombra con cuchillo. Ama el veneno, odia la luz, y gana antes de que empiece el duelo.',
  bardo: 'Con una nota desafinada desarma planes y con un verso perfecto los redefine.'
};

class DeckScene extends Phaser.Scene {
  constructor() { super('DeckScene'); }

  init(data) {
    this.mode = data.mode || null;
    this.fromPicker = data.fromPicker || false;
  }

  create() {
    const W = 640, H = 360;
    this.W = W; this.H = H;
    this.cameras.main.setBackgroundColor('#0d0d1a');

    this.bgLayer = this.add.layer().setDepth(0);
    this.uiLayer = this.add.layer().setDepth(10);
    this.modalLayer = this.add.layer().setDepth(20);

    this.isMobile = window.innerWidth < 700;
    this.currentStep = 1;
    this.selectedClass = 'mago';
    this.activeSlot = 0;
    this.allDecks = ensureStarterDecks();
    this.dirty = false;
    this.previewOpen = false;
    this.stars = [];
    this.costFilters = new Set();
    this.typeFilters = new Set();
    this.showOnlyInDeck = false;
    this.openSlotTimers = [];

    this.L = this.isMobile
      ? { gridCols: 1, panelSide: 'bottom' }
      : { gridCols: 2, panelSide: 'right' };

    this.buildStepContainers();
    this.showStep(1);
    CRT.addScanlines(this);
    this.checkRotationHint();
    this.input.on('pointerdown', (pointer) => this.handleFullscreenTap(pointer));
    this._helpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this._helpKey.on('down', () => this.toggleHelpBubbles());
  }

  // ===== PERSISTENCE =====
  loadAllDecks() {
    try {
      const raw = localStorage.getItem('deckstiny_decks');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  }
  saveAllDecks() {
    localStorage.setItem('deckstiny_decks', JSON.stringify(this.allDecks));
  }
  get currentDeck() {
    if (!this.allDecks[this.selectedClass]) this.allDecks[this.selectedClass] = [];
    return this.allDecks[this.selectedClass][this.activeSlot];
  }
  get currentCards() {
    const d = this.currentDeck;
    return (d && d.cards) || {};
  }
  set currentCards(cards) {
    this.currentDeck.cards = cards;
  }

  // ===== STEP CONTAINERS =====
  buildStepContainers() {
    this.step1 = this.add.container(0, 0);
    this.step2 = this.add.container(0, 0);
    this.step3 = this.add.container(0, 0);
    this.step4 = this.add.container(0, 0);
    [this.step1, this.step2, this.step3, this.step4].forEach(s => s.setVisible(false));
  }

  showStep(n) {
    [this.step1, this.step2, this.step3, this.step4].forEach((s, i) => {
      if (s) { s.removeAll(true); s.setVisible(i + 1 === n); }
    });
    if (this.uiLayer) this.uiLayer.removeAll(true);
    if (this.bgLayer) this.bgLayer.removeAll(true);
    if (this.modalLayer) this.modalLayer.removeAll(true);
    if (this.fxContainer) this.fxContainer.removeAll(true);
    if (this.slotGridScrollable) { this.slotGridScrollable.destroy(true); this.slotGridScrollable = null; }
    if (this.cardGridScrollable) { this.cardGridScrollable.destroy(true); this.cardGridScrollable = null; }
    if (this.openSlotTimers) {
      this.openSlotTimers.forEach(t => { if (t && t.remove) t.remove(); });
      this.openSlotTimers = [];
    }
    this.time.removeAllEvents();
    this.children.list.forEach(c => {
      if (c.type === 'Text' && (c.text === '▼' || c.text === '▲')) {
        c.destroy();
      }
    });
    this.currentStep = n;
    this.stars = [];
    if (n === 1) this.renderStep1();
    if (n === 2) this.renderStep2();
    if (n === 3) this.renderStep3();
    if (n === 4) this.renderStep4();
    this.registerStepHelp(n);
  }

  registerStepHelp(n) {
    const H = window.HelpSystem;
    if (!H) return;
    H.clearZones(this);
    // Burbujas por defecto SOLO en la primera sesión (y en modo práctica vía H).
    let seenTutorial = true;
    try { seenTutorial = !!localStorage.getItem('deckstiny_tutorial_done'); } catch (e) {}
    const bubblesOn = this.mode === 'test' || !seenTutorial;
    H.setEnabled(this, bubblesOn);
    const G = (id) => {
      const g = (window.TUTORIAL_GLOSSARY || []).find(x => x.id === id);
      return g || { title: id.toUpperCase(), desc: '' };
    };

    if (n === 1) {
      // Hero power panel (right panel)
      const rightX = 236, rightW = this.W - rightX - 8;
      const hpY = this.H - 82;
      H.register(this, { x: rightX + rightW / 2, y: hpY }, G('hero-power').title, G('hero-power').desc, { w: 180, h: 40, above: false });
    } else if (n === 3) {
      // DECK LED (top-right panel area)
      const panelX = this.isMobile ? 8 : 236 + 88 * this.L.gridCols + 40;
      const panelW = this.isMobile ? this.W - 16 : this.W - panelX - 8;
      H.register(this, { x: panelX + panelW / 2, y: 68 }, 'DECK', 'Contador de cartas en tu baraja. Mínimo 5 para poder combatir. El LED se enciende al validar.', { w: 160, h: 40, above: false });
      // Mana curve (below DECK LED)
      H.register(this, { x: panelX + panelW / 2, y: this.isMobile ? 118 : 130 }, G('mana').title, 'Curva de maná: distribución de costes de tu baraja. Un buen mazo mezcla cartas baratas y caras.', { w: 160, h: 40, above: false });
      // Card grid
      const gridX = 8, gridW = this.isMobile ? this.W - 16 : 88 * this.L.gridCols;
      H.register(this, { x: gridX + gridW / 2, y: 250 }, G('deckbuilder').title, 'Clic en una carta para ver su detalle y agregarla a tu baraja. Respeta el máximo de copias.', { w: 180, h: 40, above: false });
    } else if (n === 4) {
      H.register(this, { x: 130, y: 60 }, 'REVIEW', 'Revisa tu baraja antes de guardar. Total, coste promedio, acciones/criaturas y curva de maná.', { w: 160, h: 40, above: false });
    }

    // Botón visible de ayuda (esquina superior derecha) — se recrea en cada step
    if (!this.helpBtn || !this.helpBtn.active) {
      this.helpBtn = this.add.rectangle(this.W - 70, 40, 96, 20, 0x16213e)
        .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor('#8892a0').color)
        .setInteractive({ useHandCursor: true });
      this.uiLayer.add(this.helpBtn);
      this.helpBtnText = UI.text(this, this.W - 70, 40, 'AYUDA: OFF', {
        fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#8892a0'
      }).setOrigin(0.5);
      this.uiLayer.add(this.helpBtnText);
      this.helpBtn.on('pointerdown', () => this.toggleHelpBubbles());
    }
    this.refreshHelpBtn();
  }

  // ===== GRAPHICS HELPERS =====
  // (delegado a js/ui/vfx.js)

  // ===== STEP 1: CLASS =====
  renderStep1() {
    const c = this.step1;
    VFX.header(this, c, 'ELIGE CLASE', '#faba72', { stepCount: 4, activeStep: 1, showFullscreen: true, fullscreenCallback: () => this.toggleFullscreen(), width: this.W, height: 22 });
    VFX.stars(this, c);

    const selectedCls = CLASSES.find(x => x.id === this.selectedClass) || CLASSES[0];
    const selectedColor = Phaser.Display.Color.HexStringToColor(selectedCls.colorHex).color;

    const leftX = 8, leftY = 36, leftW = 220, leftH = this.H - 36 - 38;
    const rightX = leftX + leftW + 8, rightY = leftY, rightW = this.W - rightX - 8, rightH = leftH;

    // Left panel — class picker
    VFX.lcdPanel(this, c, leftX + leftW / 2, leftY + leftH / 2, leftW, leftH);
    const rowH = Math.floor(leftH / CLASSES.length);
    CLASSES.forEach((cl, i) => {
      const y = leftY + i * rowH + rowH / 2;
      const active = cl.id === selectedCls.id;
      const color = Phaser.Display.Color.HexStringToColor(cl.colorHex).color;
      const bg = this.add.rectangle(leftX + leftW / 2, y, leftW - 12, rowH - 4, 0x16213e)
        .setStrokeStyle(2, active ? color : 0x2a2a4a)
        .setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => { this.selectedClass = cl.id; this.activeSlot = 0; this.showStep(1); });
      c.add(bg);
      VFX.classSeal(this, c, leftX + 30, y, 18, cl.icon, cl.colorHex, active);
      c.add(UI.text(this, leftX + 58, y - 5, cl.name.toUpperCase(), {
        fontFamily: '"Press Start 2P"', fontSize: '8px',
        color: active ? cl.colorHex : '#e0e0e0'
      }).setOrigin(0, 0.5));
      c.add(UI.text(this, leftX + 58, y + 8, cl.style, {
        fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#8892a0'
      }).setOrigin(0, 0.5));
      if (active) {
        c.add(UI.text(this, leftX + leftW - 14, y, '>', {
          fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#faba72'
        }).setOrigin(1, 0.5));
      }
    });

    // Right panel — class details
    VFX.lcdPanel(this, c, rightX + rightW / 2, rightY + rightH / 2, rightW, rightH);
    VFX.classSeal(this, c, rightX + rightW / 2, rightY + 46, 36, selectedCls.icon, selectedCls.colorHex, true);
    c.add(UI.text(this, rightX + rightW / 2, rightY + 92, selectedCls.name.toUpperCase(), {
      fontFamily: '"Press Start 2P"', fontSize: '12px', color: selectedCls.colorHex
    }).setOrigin(0.5));

    const statY = rightY + 120;
    c.add(UI.text(this, rightX + 14, statY, `HP ${selectedCls.hp}`, {
      fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#bdcd9c'
    }).setOrigin(0, 0.5));
    c.add(UI.text(this, rightX + rightW / 2, statY, `ARM ${selectedCls.armor}`, {
      fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#9fcafd'
    }).setOrigin(0.5));
    c.add(UI.text(this, rightX + rightW - 14, statY, selectedCls.resource.toUpperCase(), {
      fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#faba72'
    }).setOrigin(1, 0.5));

    c.add(UI.text(this, rightX + rightW / 2, statY + 16, selectedCls.style, {
      fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#e0e0e0'
    }).setOrigin(0.5));

    const lore = CLASS_LORE[selectedCls.id] || '';
    c.add(UI.text(this, rightX + rightW / 2, statY + 40, lore, {
      fontFamily: '"VT323"', fontSize: '12px', color: '#8892a0', align: 'center', wordWrap: { width: rightW - 20 }
    }).setOrigin(0.5));

    // Hero power card
    const hpY = rightY + rightH - 46;
    VFX.lcdPanel(this, c, rightX + rightW / 2, hpY, rightW - 16, 46);
    const hp = selectedCls.heroPower;
    VFX.costHex(this, c, rightX + 24, hpY - 8, 8, hp.cost, selectedCls.colorHex);
    c.add(UI.text(this, rightX + rightW / 2, hpY - 10, 'HABILIDAD HEROICA', {
      fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#555570'
    }).setOrigin(0.5));
    c.add(UI.text(this, rightX + 42, hpY + 4, hp.name.toUpperCase(), {
      fontFamily: '"Press Start 2P"', fontSize: '7px', color: selectedCls.colorHex
    }).setOrigin(0, 0.5));
    c.add(UI.text(this, rightX + 42, hpY + 18, hp.desc, {
      fontFamily: '"VT323"', fontSize: '11px', color: '#e0e0e0'
    }).setOrigin(0, 0.5));

    UI.button(this, 60, this.H - 28, 'ATRAS', '#8892a0', () => {
      if (this.fromPicker) this.scene.start('DeckPickerScene', { mode: this.mode || 'test' });
      else this.scene.start('MenuScene');
    }, { layer: this.uiLayer, minWidth: 80, height: 20, fontSize: '7px' });
    UI.button(this, this.W - 80, this.H - 28, 'SELECCIONAR', selectedCls.colorHex, () => this.showStep(2), { layer: this.uiLayer, minWidth: 120, height: 24, fontSize: '7px' });
  }

  // ===== STEP 2: SLOT =====
  renderStep2() {
    const c = this.step2;
    const cls = CLASSES.find(x => x.id === this.selectedClass);
    VFX.header(this, c, `${cls.icon} ${cls.name.toUpperCase()} · ELIGE SLOT`, '#faba72', { stepCount: 4, activeStep: 2, showFullscreen: true, fullscreenCallback: () => this.toggleFullscreen(), width: this.W, height: 22 });
    VFX.stars(this, c);
    if (!this.allDecks[this.selectedClass]) this.allDecks[this.selectedClass] = [];
    const slots = this.allDecks[this.selectedClass];

    if (this.isMobile) {
      const cardH = 56, cardW = this.W - 16;
      const slotAreaX = 8, slotAreaY = 36, slotAreaW = cardW;
      const slotAreaH = this.H - 36 - 86; // leave room for ATRAS + NUEVA BARAJA
      this.renderSlotGrid(c, slots, { cardW, cardH, cols: 1, gap: 4, slotAreaX, slotAreaY, slotAreaW, slotAreaH, showArrows: false });
      UI.button(this, 60, this.H - 56, 'ATRAS', '#8892a0', () => this.showStep(1), { layer: this.uiLayer, minWidth: 80, height: 20, fontSize: '7px' });
      UI.button(this, this.W / 2, this.H - 30, '+ NUEVA BARAJA', '#faba72', () => this.createSlot(), { layer: this.uiLayer, minWidth: this.W - 32, height: 32, fontSize: '7px' });
    } else {
      const cardW = 140, cardH = 70, cols = 2, gap = 16;
      const slotAreaW = cols * cardW + (cols - 1) * gap;
      const slotAreaX = (this.W - slotAreaW) / 2;
      const slotAreaY = 40;
      const slotAreaH = this.H - 40 - 42; // stop before + NUEVA BARAJA (y≈332, h=26)
      this.renderSlotGrid(c, slots, { cardW, cardH, cols, gap, slotAreaX, slotAreaY, slotAreaW, slotAreaH, showArrows: true });
      UI.button(this, 60, this.H - 28, 'ATRAS', '#8892a0', () => this.showStep(1), { layer: this.uiLayer, minWidth: 80, height: 20, fontSize: '7px' });
      UI.button(this, this.W - 80, this.H - 28, '+ NUEVA BARAJA', '#faba72', () => this.createSlot(), { layer: this.uiLayer, minWidth: 140, height: 26, fontSize: '7px' });
    }
  }

  renderSlotGrid(c, slots, opts) {
    const { cardW, cardH, cols, gap, slotAreaX, slotAreaY, slotAreaW, slotAreaH, showArrows = true } = opts;
    if (slots.length === 0) {
      VFX.lcdPanel(this, c, slotAreaX + slotAreaW / 2, slotAreaY + slotAreaH / 2, slotAreaW - 16, 60);
      c.add(UI.text(this, slotAreaX + slotAreaW / 2, slotAreaY + slotAreaH / 2, 'No tienes barajas.\nCrea la primera.', {
        fontFamily: '"Press Start 2P"', fontSize: this.isMobile ? '7px' : '9px', color: '#4af0c8', align: 'center'
      }).setOrigin(0.5));
      return;
    }

    this.slotGridScrollable = this.add.container(slotAreaX, slotAreaY);
    this.slotGridScrollAreaY = slotAreaY;
    this.slotGridScrollH = slotAreaH;
    const sizer = this.add.container(0, 0);
    this.slotGridScrollable.add(sizer);
    c.add(this.slotGridScrollable);

    const accent = (s) => s ? 0xfaba72 : 0x2a2a4a;
    slots.forEach((s, i) => {
      const slotContainer = this.add.container(0, 0);
      const col = i % cols;
      const row = Math.floor(i / cols);
      slotContainer.setPosition(col * (cardW + gap) + cardW / 2, row * (cardH + gap) + cardH / 2);

      const bg = this.add.rectangle(0, 0, cardW, cardH, 0x16213e)
        .setStrokeStyle(2, accent(i === this.activeSlot))
        .setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => { this.activeSlot = i; this.showStep(3); });
      slotContainer.add(bg);

      if (this.isMobile) {
        slotContainer.add(this.add.rectangle(0, -cardH / 2 + 11, cardW, 20, 0x0a0a14));
        const total = Object.values(s.cards || {}).reduce((a, b) => a + b, 0);
        slotContainer.add(UI.text(this, -cardW / 2 + 8, -cardH / 2 + 11, (s.name || 'Baraja').toUpperCase(), {
          fontFamily: '"Press Start 2P"', fontSize: '8px',
          color: i === this.activeSlot ? '#faba72' : '#e0e0e0'
        }).setOrigin(0, 0.5));
        slotContainer.add(this.add.circle(-cardW / 2 + 14, 10, 6, 0x0d0d1a).setStrokeStyle(1, 0x050510));
        slotContainer.add(this.add.circle(-cardW / 2 + 32, 10, 6, 0x0d0d1a).setStrokeStyle(1, 0x050510));
        slotContainer.add(UI.text(this, cardW / 2 - 22, 10, `${total}`, {
          fontFamily: '"Press Start 2P"', fontSize: '12px',
          color: total >= 5 ? '#bdcd9c' : '#ff6b6b'
        }).setOrigin(1, 0.5));

        const menuBtn = this.add.rectangle(cardW / 2 - 8, -cardH / 2 + 11, 14, 14, 0x1a2a4e)
          .setStrokeStyle(1, 0xfaba72)
          .setInteractive({ useHandCursor: true });
        menuBtn.on('pointerdown', (pointer) => {
          pointer.event && pointer.event.stopPropagation();
          this.openSlotMenu(i, slotContainer.x + cardW / 2 - 8, slotContainer.y - cardH / 2 + 11);
        });
        slotContainer.add(menuBtn);
        slotContainer.add(UI.text(this, cardW / 2 - 8, -cardH / 2 + 11, '⋯', {
          fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#faba72'
        }).setOrigin(0.5));
      } else {
        slotContainer.add(this.add.rectangle(0, -cardH / 2 + 12, cardW, 22, 0x0a0a14).setStrokeStyle(1, 0x050510));
        slotContainer.add(UI.text(this, -cardW / 2 + 8, -cardH / 2 + 12, (s.name || 'Baraja').toUpperCase(), {
          fontFamily: '"Press Start 2P"', fontSize: '7px',
          color: i === this.activeSlot ? '#faba72' : '#e0e0e0'
        }).setOrigin(0, 0.5));
        slotContainer.add(this.add.circle(-cardW / 2 + 10, 8, 6, 0x0d0d1a).setStrokeStyle(1, 0x050510));
        slotContainer.add(this.add.circle(-cardW / 2 + 26, 8, 6, 0x0d0d1a).setStrokeStyle(1, 0x050510));
        const total = Object.values(s.cards || {}).reduce((a, b) => a + b, 0);
        slotContainer.add(UI.text(this, cardW / 2 - 22, 8, `${total} CARTAS`, {
          fontFamily: '"Press Start 2P"', fontSize: '6px',
          color: total >= 5 ? '#bdcd9c' : '#ff6b6b'
        }).setOrigin(1, 0.5));

        const menuBtn = this.add.rectangle(cardW / 2 - 8, -cardH / 2 + 12, 12, 14, 0x1a2a4e)
          .setStrokeStyle(1, 0xfaba72)
          .setInteractive({ useHandCursor: true });
        menuBtn.on('pointerdown', (pointer) => {
          pointer.event && pointer.event.stopPropagation();
          this.openSlotMenu(i, slotContainer.x + cardW / 2 - 8, slotContainer.y - cardH / 2 + 12);
        });
        slotContainer.add(menuBtn);
        slotContainer.add(UI.text(this, cardW / 2 - 8, -cardH / 2 + 12, '⋯', {
          fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#faba72'
        }).setOrigin(0.5));

        if (i === this.activeSlot) {
          slotContainer.add(this.add.rectangle(cardW / 2 - 36, -cardH / 2 + 10, 40, 10, 0xfaba72));
          slotContainer.add(UI.text(this, cardW / 2 - 36, -cardH / 2 + 10, 'ACTIVE', {
            fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#0d0d1a'
          }).setOrigin(0.5));
        }
      }
      sizer.add(slotContainer);
    });

    const rows = Math.ceil(slots.length / cols);
    const gridH = rows * cardH + (rows - 1) * gap;
    this.slotGridScrollOffset = 0;
    this.slotGridMaxOffset = Math.max(0, gridH - slotAreaH);
    this.slotGridCardH = cardH;
    this.applySlotClip(sizer, slotAreaH, cardH);

    if (showArrows) {
      const arrowX = slotAreaX + slotAreaW + 8;
      const upArrow = UI.text(this, arrowX, slotAreaY + 6, '▲', {
        fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#faba72'
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.scrollSlotGrid(-cardH / 2));
      const downArrow = UI.text(this, arrowX, slotAreaY + slotAreaH - 8, '▼', {
        fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#faba72'
      }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.scrollSlotGrid(cardH / 2));
      c.add([upArrow, downArrow]);
    }

    let dragStartY = null;
    const dragZone = this.add.rectangle(slotAreaX + slotAreaW / 2, slotAreaY + slotAreaH / 2,
      slotAreaW - 16, slotAreaH, 0x000000, 0)
      .setOrigin(0.5).setInteractive({ useHandCursor: false }).setDepth(-1);
    dragZone.on('pointerdown', (p) => { dragStartY = p.y; });
    dragZone.on('pointermove', (p) => {
      if (dragStartY !== null && p.isDown) {
        const dy = p.y - dragStartY;
        if (Math.abs(dy) > 4) { this.scrollSlotGrid(dy * 0.5); dragStartY = p.y; }
      }
    });
    dragZone.on('pointerup', () => { dragStartY = null; });
    dragZone.on('pointerout', () => { dragStartY = null; });

    if (!this._slotWheelAdded) {
      this.input.on('wheel', (pointer, gameObjects, dx, dy) => {
        if (this.currentStep !== 2) return;
        if (pointer.x >= slotAreaX && pointer.x <= slotAreaX + slotAreaW &&
            pointer.y >= slotAreaY && pointer.y <= slotAreaY + slotAreaH) {
          this.scrollSlotGrid(dy * 0.3);
        }
      });
      this._slotWheelAdded = true;
    }
  }

  scrollSlotGrid(dy) {
    if (!this.slotGridScrollable) return;
    const next = Phaser.Math.Clamp(this.slotGridScrollOffset + dy, 0, this.slotGridMaxOffset);
    this.slotGridScrollOffset = next;
    this.slotGridScrollable.y = this.slotGridScrollAreaY - next;
    if (this.slotGridScrollable.list[0]) {
      this.applySlotClip(this.slotGridScrollable.list[0], this.slotGridScrollH, this.slotGridCardH);
    }
  }

  // Hide slot rows that fall outside the scroll viewport.
  applySlotClip(sizer, clipH, cardH) {
    if (!sizer) return;
    const scrollY = this.slotGridScrollOffset;
    const viewTop = scrollY;
    const viewBottom = scrollY + clipH;
    sizer.iterate((child) => {
      if (!child) return;
      const y = child.y;
      const halfH = (child.displayHeight || cardH || 60) / 2;
      const top = y - halfH;
      const bot = y + halfH;
      child.setVisible(bot > viewTop && top < viewBottom && bot <= viewBottom && top >= viewTop);
    });
  }

  // ===== STEP 3: BUILD =====
  renderStep3() {
    const c = this.step3;
    const cls = CLASSES.find(x => x.id === this.selectedClass);
    VFX.header(this, c, `${cls.icon} ${cls.name.toUpperCase()} · ARMA BARAJA`, '#faba72', { stepCount: 4, activeStep: 3, showFullscreen: true, fullscreenCallback: () => this.toggleFullscreen(), width: this.W, height: 22 });
    VFX.stars(this, c);
    const cards = ALL_CARDS[this.selectedClass] || [];
    const deck = this.currentCards;
    const total = Object.values(deck).reduce((a, b) => a + b, 0);
    const classColor = cls.colorHex;
    const classColorNum = Phaser.Display.Color.HexStringToColor(classColor).color;

    const filterY = 32;

    const gridY = 58;
    const gridBottomY = this.H - 30;
    let gridAreaX, gridAreaY, gridAreaW, gridAreaH;
    let panelX, panelY, panelW, panelH;

    if (this.isMobile) {
      gridAreaX = 8; gridAreaY = gridY; gridAreaW = this.W - 16;
      panelH = 90;
      gridAreaH = gridBottomY - gridY - panelH - 4;
      panelX = 8; panelW = this.W - 16;
      panelY = this.H - panelH - 30;
    } else {
      const cols = this.L.gridCols;
      const cardW = 88, cardH = 120;
      const cardGap = 8;
      const panelGap = 40;
      gridAreaW = cols * cardW + (cols - 1) * cardGap;
      // Use all vertical room available; the bottom cap hides any peeking row.
      gridAreaH = gridBottomY - gridY;
      gridAreaX = 8;
      gridAreaY = gridY;
      panelX = gridAreaX + gridAreaW + panelGap;
      panelW = this.W - panelX - 8;
      panelY = gridY;
      panelH = gridBottomY - gridY;
    }

    // Background frames so grid and panel never visually bleed into each other
    const frameG = this.add.graphics();
    frameG.fillStyle(0x0d0d1a, 1);
    frameG.lineStyle(1, 0x2a2a4a, 0.5);
    frameG.fillRoundedRect(gridAreaX - 2, gridAreaY - 2, gridAreaW + 4, gridAreaH + 4, 3);
    frameG.strokeRoundedRect(gridAreaX - 2, gridAreaY - 2, gridAreaW + 4, gridAreaH + 4, 3);
    frameG.fillRoundedRect(panelX - 2, panelY - 2, panelW + 4, panelH + 4, 3);
    frameG.strokeRoundedRect(panelX - 2, panelY - 2, panelW + 4, panelH + 4, 3);
    c.add(frameG);

    const filtered = cards.filter(card => {
      if (this.costFilters.size > 0) {
        const costBucket = Math.min(card.cost, 6);
        if (!this.costFilters.has(costBucket)) return false;
      }
      if (this.typeFilters.size > 0 && !this.typeFilters.has(card.type)) return false;
      if (this.showOnlyInDeck && (deck[card.id] || 0) === 0) return false;
      return true;
    });

    this.cardGridScrollable = null;
    if (filtered.length > 0) {
      const cardW = this.isMobile ? (this.W - 24) : 88;
      const cardH = this.isMobile ? 110 : 120;
      const cols = this.L.gridCols;
      const rows = Math.ceil(filtered.length / cols);
      const gridH = rows * cardH + (rows - 1) * 6;
      this.cardGridScrollable = this.add.container(gridAreaX, gridAreaY);
      this.cardGridScrollAreaY = gridAreaY;
      this.cardGridScrollH = gridAreaH;
      const cardGridSizer = this.createCardGridSizer(filtered, deck, classColor);
      this.cardGridScrollable.add(cardGridSizer);
      this.cardGridScrollable.setSize(gridAreaW, gridAreaH);
      c.add(this.cardGridScrollable);

      this.cardGridScrollOffset = 0;
      this.cardGridMaxOffset = Math.max(0, gridH - gridAreaH);
      // Show partial rows that intersect the viewport; caps hide the parts outside.
      this.applyCardClip(cardGridSizer, gridAreaX, gridAreaY, gridAreaW, gridAreaH);

      if (!this.isMobile) {
        // Place arrows below the grid, never over cards or the side panel
        const arrowY = gridAreaY + gridAreaH + 8;
        const arrowX = gridAreaX + gridAreaW / 2;
        const upArrow = UI.text(this, arrowX - 12, arrowY, '▲', {
          fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#faba72'
        }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true })
          .on('pointerdown', () => this.scrollCardGrid(-40));
        const downArrow = UI.text(this, arrowX + 12, arrowY, '▼', {
          fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#faba72'
        }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true })
          .on('pointerdown', () => this.scrollCardGrid(40));
        c.add([upArrow, downArrow]);
      }

      let dragStartY = null;
      const dragZone = this.add.rectangle(gridAreaX + gridAreaW / 2, gridAreaY + gridAreaH / 2,
        gridAreaW - 16, gridAreaH, 0x000000, 0)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: false })
        .setDepth(-1);
      dragZone.on('pointerdown', (p) => { dragStartY = p.y; });
      dragZone.on('pointermove', (p) => {
        if (dragStartY !== null && p.isDown) {
          const dy = p.y - dragStartY;
          if (Math.abs(dy) > 4) {
            this.scrollCardGrid(dy);
            dragStartY = p.y;
          }
        }
      });
      dragZone.on('pointerup', () => { dragStartY = null; });
      dragZone.on('pointerout', () => { dragStartY = null; });

      this.input.on('wheel', (pointer, gameObjects, dx, dy) => {
        if (pointer.x >= gridAreaX && pointer.x <= gridAreaX + gridAreaW &&
            pointer.y >= gridAreaY && pointer.y <= gridAreaY + gridAreaH) {
          this.scrollCardGrid(dy * 0.5);
        }
      });
    } else {
      c.add(UI.text(this, gridAreaX + gridAreaW / 2, gridAreaY + gridAreaH / 2,
        'Sin cartas.\nAjusta los filtros.', {
        fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#8892a0', align: 'center'
      }).setOrigin(0.5));
    }

    const lcdG = this.add.graphics();
    lcdG.fillStyle(0x0a1828, 1);
    lcdG.fillRoundedRect(panelX, panelY, panelW, panelH, 4);
    lcdG.lineStyle(2, 0x3a3a5e, 0.5);
    lcdG.strokeRoundedRect(panelX, panelY, panelW, panelH, 4);
    lcdG.fillStyle(0x000000, 0.18);
    for (let i = 0; i < panelH; i += 2) lcdG.fillRect(panelX + 1, panelY + 1 + i, panelW - 2, 1);
    c.add(lcdG);

    c.add(UI.text(this, panelX + 8, panelY + 10, `DECK [${total}]`, {
      fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#faba72'
    }).setOrigin(0, 0));
    const validColor = total >= 5 ? 0x4af0c8 : 0xff6b6b;
    c.add(this.add.circle(panelX + panelW - 12, panelY + 12, 4, validColor).setBlendMode(Phaser.BlendModes.ADD));

    const eqData = [0, 0, 0, 0, 0, 0, 0];
    Object.entries(deck).forEach(([id, n]) => {
      const card = cards.find(x => x.id === id);
      if (card) eqData[Math.min(card.cost, 6)] += n;
    });
    const eqMax = Math.max(...eqData, 1);
    if (this.isMobile) {
      const eqBarW = 6, eqGap = 2, eqBaseY = panelY + 56;
      const eqStartX = panelX + 8 + eqBarW / 2;
      for (let m = 0; m <= 6; m++) {
        const h = Math.max(3, (eqData[m] / eqMax) * 24);
        VFX.eqBar(this, c, eqStartX + m * (eqBarW + eqGap), eqBaseY, h, 0x4af0c8, h + 1);
      }
      UI.button(this, panelX + panelW - 60, panelY + 30, 'CLEAR', '#ff6b6b', () => this.clearDeck(), { layer: this.uiLayer, minWidth: 56, height: 20, fontSize: '7px' });
      UI.button(this, panelX + panelW - 60, panelY + 58, 'AUTO', '#9fcafd', () => this.quickFill(), { layer: this.uiLayer, minWidth: 56, height: 20, fontSize: '7px' });
    } else {
      const eqBarW = 14, eqGap = 6, eqBaseY = panelY + 60;
      const eqStartX = panelX + (panelW - (7 * eqBarW + 6 * eqGap)) / 2 + eqBarW / 2;
      for (let m = 0; m <= 6; m++) {
        const h = Math.max(4, (eqData[m] / eqMax) * 40);
        VFX.eqBar(this, c, eqStartX + m * (eqBarW + eqGap), eqBaseY, h, 0x4af0c8, h + 2);
        c.add(UI.text(this, eqStartX + m * (eqBarW + eqGap), eqBaseY + 9, `${m}`, {
          fontFamily: '"VT323"', fontSize: '13px', color: '#8892a0'
        }).setOrigin(0.5, 0));
        if (eqData[m] > 0) {
          c.add(UI.text(this, eqStartX + m * (eqBarW + eqGap), eqBaseY - h - 2, `${eqData[m]}`, {
            fontFamily: '"VT323"', fontSize: '14px', color: '#e0e0e0'
          }).setOrigin(0.5, 1));
        }
      }
      let ty = panelY + 90;
      const trackPanelX = panelX + 8;
      const trackPanelW = panelW - 16;
      c.add(UI.text(this, trackPanelX, ty, 'CARTAS EN DECK', {
        fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#faba72'
      }).setOrigin(0, 0));
      ty += 10;
      cards.filter(card => (deck[card.id] || 0) > 0).sort((a, b) => a.cost - b.cost).forEach(card => {
        if (ty > panelY + panelH - 28) return;
        c.add(UI.text(this, trackPanelX, ty, `${card.cost}M`, {
          fontFamily: '"VT323"', fontSize: '14px', color: '#4af0c8'
        }).setOrigin(0, 0));
        c.add(UI.text(this, trackPanelX + 22, ty, card.name.slice(0, 16), {
          fontFamily: '"VT323"', fontSize: '14px', color: '#e0e0e0'
        }).setOrigin(0, 0));
        c.add(UI.text(this, trackPanelX + trackPanelW, ty, `x${deck[card.id]}`, {
          fontFamily: '"VT323"', fontSize: '14px', color: '#faba72'
        }).setOrigin(1, 0));
        ty += 13;
      });
      UI.button(this, panelX + 45, panelY + panelH - 14, 'CLEAR', '#ff6b6b', () => this.clearDeck(), { layer: this.uiLayer, minWidth: 70, height: 18, fontSize: '7px' });
      UI.button(this, panelX + 125, panelY + panelH - 14, 'AUTO', '#9fcafd', () => this.quickFill(), { layer: this.uiLayer, minWidth: 70, height: 18, fontSize: '7px' });
    }

    UI.button(this, 60, this.H - 14, 'ATRAS', '#8892a0', () => this.showStep(2), { layer: this.uiLayer, minWidth: 80, height: 20, fontSize: '7px' });
    UI.button(this, this.W - 60, this.H - 14, 'SIGUIENTE', '#faba72', () => this.showStep(4), { layer: this.uiLayer, minWidth: 80, height: 20, fontSize: '7px' });

    // Top cap: hide any card grid overflow above the grid frame.
    const topCap = this.add.graphics();
    topCap.fillStyle(0x0d0d1a, 1);
    topCap.fillRect(gridAreaX - 2, 22, gridAreaW + 4, gridAreaY - 22);
    c.add(topCap);

    // Bottom cap: hide any card grid overflow below the frame until the buttons.
    const bottomCap = this.add.graphics();
    bottomCap.fillStyle(0x0d0d1a, 1);
    bottomCap.fillRect(gridAreaX - 2, gridAreaY + gridAreaH, gridAreaW + 4, this.H - 22 - (gridAreaY + gridAreaH));
    c.add(bottomCap);

    // Draw the cost/type filter LAST so it sits above any possible leakage.
    this.renderFilterBar(c, cards, filterY);
  }

  renderFilterBar(c, cards, filterY) {
    VFX.lcdPanel(this, c, this.W / 2, filterY, this.W - 16, 14);
    c.add(UI.text(this, 14, filterY, 'COST:', {
      fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#4af0c8'
    }).setOrigin(0, 0.5));
    const costs = ['0', '1', '2', '3', '4', '5', '6+'];
    costs.forEach((cc, i) => {
      const cx = 42 + i * 18;
      const active = this.costFilters.has(i);
      const costBg = c.add(this.add.rectangle(cx, filterY, 14, 10, 0x0a0a14)
        .setStrokeStyle(1, active ? 0xfaba72 : 0x2a2a4a)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => { if (!active) costBg.setStrokeStyle(1, 0x4af0c8); })
        .on('pointerout', () => { if (!active) costBg.setStrokeStyle(1, 0x2a2a4a); })
        .on('pointerdown', () => {
          if (this.costFilters.has(i)) this.costFilters.delete(i); else this.costFilters.add(i);
          this.showStep(3);
        }));
      c.add(UI.text(this, cx, filterY, cc, {
        fontFamily: '"Press Start 2P"', fontSize: '6px',
        color: active ? '#faba72' : '#8892a0'
      }).setOrigin(0.5));
    });
    const typeTags = [
      { label: 'AC', id: 'accion' },
      { label: 'CR', id: 'criatura' },
      { label: 'DECK', id: '__deck' }
    ];
    const tagStartX = this.W - 78;
    typeTags.forEach((tag, i) => {
      const cx = tagStartX + i * 24;
      const active = tag.id === '__deck'
        ? this.showOnlyInDeck
        : this.typeFilters.has(tag.id);
      const lbl = tag.label;
      const tw = 22;
      const tagBg = c.add(this.add.rectangle(cx, filterY, tw, 10, 0x0a0a14)
        .setStrokeStyle(1, active ? 0xfaba72 : 0x2a2a4a)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => { if (!active) tagBg.setStrokeStyle(1, 0x4af0c8); })
        .on('pointerout', () => { if (!active) tagBg.setStrokeStyle(1, 0x2a2a4a); })
        .on('pointerdown', () => {
          if (tag.id === '__deck') { this.showOnlyInDeck = !this.showOnlyInDeck; }
          else if (this.typeFilters.has(tag.id)) this.typeFilters.delete(tag.id);
          else this.typeFilters.add(tag.id);
          this.showStep(3);
        }));
      c.add(UI.text(this, cx, filterY, lbl, {
        fontFamily: '"Press Start 2P"', fontSize: '6px',
        color: active ? '#faba72' : '#8892a0'
      }).setOrigin(0.5));
    });
  }

  createCardGridSizer(cards, deck, classColor) {
    const cols = this.L.gridCols;
    const cardW = this.isMobile ? (this.W - 24) : 88;
    const cardH = this.isMobile ? 110 : 120;
    const gap = 6;

    const grid = this.add.container(0, 0);

    cards.forEach((card, i) => {
      const count = deck[card.id] || 0;
      const inDeck = count > 0;
      const cardContainer = CardFactory.Card(this, {
        card, count, inDeck, classColor,
        cardW, cardH, mode: 'grid'
      });
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = col * (cardW + gap) + cardW / 2;
      const cy = row * (cardH + gap) + cardH / 2;
      cardContainer.setPosition(cx, cy);
      CardFactory.bindOpenModal(cardContainer, card, (c) => this.openCardModal(c));
      CardFactory.attachHover(cardContainer);
      grid.add(cardContainer);
    });

    return grid;
  }

  scrollCardGrid(dy) {
    if (!this.cardGridScrollable) return;
    const next = Phaser.Math.Clamp(this.cardGridScrollOffset + dy, 0, this.cardGridMaxOffset);
    this.cardGridScrollOffset = next;
    this.cardGridScrollable.y = this.cardGridScrollAreaY - next;
    if (this.cardGridClipInfo) {
      this.applyCardClip(
        this.cardGridScrollable.list[0],
        this.cardGridClipInfo.x,
        this.cardGridClipInfo.y,
        this.cardGridClipInfo.w,
        this.cardGridClipInfo.h
      );
    }
  }

  // Hide cards outside the scroll area. Phaser 4 removed GeometryMask in WebGL.
  // We hide top-level game objects in the container whose bounds fall outside.
  applyCardClip(grid, clipX, clipY, clipW, clipH) {
    if (!grid) return;
    this.cardGridClipInfo = { x: clipX, y: clipY, w: clipW, h: clipH };
    const scrollY = this.cardGridScrollOffset;
    // Viewport in the sizer's local space (grid origin at 0,0)
    const viewTop = scrollY;
    const viewBottom = scrollY + clipH;
    grid.iterate((child) => {
      if (!child) return;
      const y = child.y;
      const halfH = (child.displayHeight || 60) / 2;
      const top = y - halfH;
      const bot = y + halfH;
      // Show only cards that are fully inside the viewport so nothing bleeds into the filter.
      child.setVisible(top >= viewTop && bot <= viewBottom);
    });
  }

  // ===== STEP 4: REVIEW =====
  renderStep4() {
    const c = this.step4;
    const cls = CLASSES.find(x => x.id === this.selectedClass);
    VFX.header(this, c, `${cls.icon} ${cls.name.toUpperCase()} · REVIEW`, '#faba72', { stepCount: 4, activeStep: 4, showFullscreen: true, fullscreenCallback: () => this.toggleFullscreen(), width: this.W, height: 22 });
    VFX.stars(this, c);
    const cards = ALL_CARDS[this.selectedClass] || [];
    const deck = this.currentCards;
    const total = Object.values(deck).reduce((a, b) => a + b, 0);
    let totalCost = 0, count = 0;
    Object.entries(deck).forEach(([id, n]) => {
      const card = cards.find(x => x.id === id);
      if (card) { totalCost += card.cost * n; count += n; }
    });
    const avg = count > 0 ? (totalCost / count).toFixed(1) : '0.0';
    const acciones = cards.filter(card => (deck[card.id] || 0) > 0 && card.type === 'accion').reduce((s, card) => s + deck[card.id], 0);
    const criat = cards.filter(card => (deck[card.id] || 0) > 0 && card.type === 'criatura').reduce((s, card) => s + deck[card.id], 0);
    const valid = total >= 5;
    const eqData = [0, 0, 0, 0, 0, 0, 0];
    Object.entries(deck).forEach(([id, n]) => {
      const card = cards.find(x => x.id === id);
      if (card) eqData[Math.min(card.cost, 6)] += n;
    });
    const eqMax = Math.max(...eqData, 1);

    if (this.isMobile) {
      let ly = 30;
      VFX.lcdPanel(this, c, this.W / 2, ly + 18, this.W - 16, 32);
      c.add(UI.text(this, this.W / 2, ly + 8, 'TOTAL', {
        fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#555570'
      }).setOrigin(0.5, 0));
      c.add(UI.text(this, this.W / 2, ly + 24, `${total}`, {
        fontFamily: '"Press Start 2P"', fontSize: '14px',
        color: valid ? '#4af0c8' : '#ff6b6b'
      }).setOrigin(0.5));
      ly += 38;
      VFX.lcdPanel(this, c, this.W / 2 - 80, ly + 14, 140, 26);
      c.add(UI.text(this, this.W / 2 - 130, ly + 14, 'AVG', {
        fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#555570'
      }).setOrigin(0, 0.5));
      c.add(UI.text(this, this.W / 2 - 80, ly + 14, `${avg}`, {
        fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#4af0c8'
      }).setOrigin(0.5));
      VFX.lcdPanel(this, c, this.W / 2 + 80, ly + 14, 140, 26);
      c.add(UI.text(this, this.W / 2 + 30, ly + 14, 'AC/CR', {
        fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#555570'
      }).setOrigin(0, 0.5));
      c.add(UI.text(this, this.W / 2 + 80, ly + 14, `${acciones}/${criat}`, {
        fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#4af0c8'
      }).setOrigin(0.5));
      ly += 34;
      const eqBarW = 12, eqGap = 4, eqBaseY = ly + 50;
      const eqStartX = (this.W - (7 * eqBarW + 6 * eqGap)) / 2 + eqBarW / 2;
      for (let m = 0; m <= 6; m++) {
        const h = Math.max(4, (eqData[m] / eqMax) * 40);
        VFX.eqBar(this, c, eqStartX + m * (eqBarW + eqGap), eqBaseY, h, 0x4af0c8, h + 2);
        c.add(UI.text(this, eqStartX + m * (eqBarW + eqGap), eqBaseY + 6, `${m}`, {
          fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#555570'
        }).setOrigin(0.5, 0));
      }
      ly += 68;
      let ty = ly;
      cards.filter(card => (deck[card.id] || 0) > 0).sort((a, b) => a.cost - b.cost).forEach(card => {
        if (ty > this.H - 50) return;
        c.add(UI.text(this, this.W / 2, ty, `${card.cost}M  ${card.name.slice(0, 14)}  x${deck[card.id]}`, {
          fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#e0e0e0'
        }).setOrigin(0.5, 0));
        ty += 9;
      });
      // ATRAS is placed above the wide GUARDAR button on mobile to avoid overlap
      UI.button(this, 60, this.H - 38, 'ATRAS', '#8892a0', () => this.showStep(3), { layer: this.uiLayer, minWidth: 80, height: 20, fontSize: '7px' });
      UI.button(this, this.W / 2, this.H - 14, 'GUARDAR', '#faba72', () => this.saveDeck(), { layer: this.uiLayer, minWidth: this.W - 32, height: 22, fontSize: '7px' });
    } else {
      const leftW = 220;
      let ly = 32;
      VFX.lcdPanel(this, c, leftW / 2 + 16, ly + 18, leftW - 16, 36);
      c.add(UI.text(this, leftW / 2 + 16, ly + 12, 'TOTAL CARTAS', {
        fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#555570'
      }).setOrigin(0.5, 0));
      c.add(UI.text(this, leftW / 2 + 16, ly + 30, `${total}`, {
        fontFamily: '"Press Start 2P"', fontSize: '14px',
        color: valid ? '#4af0c8' : '#ff6b6b'
      }).setOrigin(0.5));
      c.add(this.add.circle(leftW - 8, ly + 14, 3, valid ? 0x4af0c8 : 0xff6b6b).setBlendMode(Phaser.BlendModes.ADD));
      ly += 46;
      VFX.lcdPanel(this, c, leftW / 2 + 16, ly + 18, leftW - 16, 28);
      c.add(UI.text(this, 16 + 8, ly + 18, 'AVG', {
        fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#555570'
      }).setOrigin(0, 0.5));
      c.add(UI.text(this, leftW / 2 + 16, ly + 18, `${avg}`, {
        fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#4af0c8'
      }).setOrigin(0.5));
      ly += 34;
      VFX.lcdPanel(this, c, leftW / 2 + 16, ly + 14, leftW - 16, 28);
      c.add(UI.text(this, 16 + 8, ly + 14, 'AC/CR', {
        fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#555570'
      }).setOrigin(0, 0.5));
      c.add(UI.text(this, leftW / 2 + 16, ly + 14, `${acciones} / ${criat}`, {
        fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#4af0c8'
      }).setOrigin(0.5));
      ly += 34;
      c.add(UI.text(this, leftW / 2 + 16, ly + 4, 'CURVA DE MANA', {
        fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#faba72'
      }).setOrigin(0.5));
      const eqBarW = 14, eqGap = 4, eqBaseY = ly + 70;
      const eqStartX = 16 + (leftW - (7 * eqBarW + 6 * eqGap)) / 2 + eqBarW / 2;
      for (let m = 0; m <= 6; m++) {
        const h = Math.max(4, (eqData[m] / eqMax) * 50);
        VFX.eqBar(this, c, eqStartX + m * (eqBarW + eqGap), eqBaseY, h, 0x4af0c8, h + 2);
        c.add(UI.text(this, eqStartX + m * (eqBarW + eqGap), eqBaseY + 6, `${m}`, {
          fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#555570'
        }).setOrigin(0.5, 0));
        if (eqData[m] > 0) {
          c.add(UI.text(this, eqStartX + m * (eqBarW + eqGap), eqBaseY - h - 4, `${eqData[m]}`, {
            fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#e0e0e0'
          }).setOrigin(0.5, 1));
        }
      }
      // Lift GUARDAR/PROBAR above the bottom navigation strip so nothing overlaps ATRAS/SIGUIENTE
      UI.button(this, leftW / 2 - 40, this.H - 52, 'GUARDAR', '#faba72', () => this.saveDeck(), { layer: this.uiLayer, minWidth: 90, height: 24, fontSize: '7px' });
      UI.button(this, leftW / 2 + 70, this.H - 52, 'PROBAR', '#bdcd9c', () => { this.saveDeck(); this.scene.start('DeckPickerScene', { mode: 'test' }); }, { layer: this.uiLayer, minWidth: 70, height: 24, fontSize: '7px' });

      const listX = leftW + 24;
      const listW = this.W - listX - 8;
      const listH = this.H - 50;
      const lcdG = this.add.graphics();
      lcdG.fillStyle(0x0a1828, 1);
      lcdG.fillRoundedRect(listX, 28, listW, listH, 4);
      lcdG.lineStyle(2, 0x3a3a5e, 0.5);
      lcdG.strokeRoundedRect(listX, 28, listW, listH, 4);
      lcdG.fillStyle(0x000000, 0.18);
      for (let i = 0; i < listH; i += 2) lcdG.fillRect(listX + 1, 29 + i, listW - 2, 1);
      c.add(lcdG);
      c.add(UI.text(this, listX + 8, 36, 'TRACK LISTING', {
        fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#faba72'
      }).setOrigin(0, 0));
      let ty = 52;
      cards.filter(card => (deck[card.id] || 0) > 0).sort((a, b) => a.cost - b.cost).forEach(card => {
        VFX.classSeal(this, c, listX + 16, ty + 6, 5, '', cls.colorHex, true);
        c.add(UI.text(this, listX + 28, ty + 2, `${card.cost}M`, {
          fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#4af0c8'
        }).setOrigin(0, 0));
        c.add(UI.text(this, listX + 50, ty + 2, card.name, {
          fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#e0e0e0'
        }).setOrigin(0, 0));
        c.add(UI.text(this, listX + listW - 8, ty + 2, `x${deck[card.id]}`, {
          fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#faba72'
        }).setOrigin(1, 0));
        ty += 14;
      });
    }

    if (!this.isMobile) {
      UI.button(this, 60, this.H - 14, 'ATRAS', '#8892a0', () => this.showStep(3), { layer: this.uiLayer, minWidth: 80, height: 20, fontSize: '7px' });
    }
  }

  saveDeck() {
    const total = Object.values(this.currentCards).reduce((a, b) => a + b, 0);
    if (total < 5) { this.showToast('Minimo 5 cartas!'); return; }
    this.saveAllDecks();
    this.dirty = false;
    this.showToast('Baraja guardada!');
  }

  // ===== MODAL LAYER (Phaser-native) =====
  clearModalLayer() {
    if (this.modalLayer) this.modalLayer.removeAll(true);
  }

  closeModalLayer() {
    this.clearModalLayer();
  }

  // ===== CARD DETAIL MODAL =====
  openCardModal(card) {
    if (this.previewOpen) return;
    this.previewOpen = true;
    if (window.HelpSystem) window.HelpSystem.getManager(this).setModal(true);
    this.clearModalLayer();
    const m = this.add.container(0, 0).setDepth(500);
    this.modalLayer.add(m);

    const overlay = this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x000000, 0.7)
      .setInteractive({ useHandCursor: false });
    overlay.on('pointerdown', () => this.closeCardModal());
    m.add(overlay);

    const cls = CLASSES.find(x => x.id === this.selectedClass);
    const classColor = cls.colorHex;
    const deck = this.currentCards;
    const count = deck[card.id] || 0;

    const cardW = 160, cardH = 220;
    const cardRoot = CardFactory.Card(this, {
      card, count, inDeck: count > 0, classColor, mode: 'modal'
    });
    const modalCenterX = this.W / 2;
    const modalCenterY = this.H / 2 - 50;
    cardRoot.setPosition(modalCenterX, modalCenterY);
    m.add(cardRoot);

    const maxTxt = UI.text(this, this.W / 2, modalCenterY + cardH / 2 + 14,
      `Max ${card.maxCopies} copias`, {
      fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#8892a0'
    }).setOrigin(0.5);
    m.add(maxTxt);

    const btnY = modalCenterY + cardH / 2 + 38;
    const minusBg = this.add.rectangle(this.W / 2 - 50, btnY, 50, 24, 0x16213e)
      .setStrokeStyle(2, 0xff6b6b)
      .setInteractive({ useHandCursor: true });
    m.add(minusBg);
    m.add(UI.text(this, this.W / 2 - 50, btnY, '−', {
      fontFamily: '"Press Start 2P"', fontSize: '16px', color: '#ff6b6b'
    }).setOrigin(0.5));

    const countTxt = UI.text(this, this.W / 2, btnY, `${count}/${card.maxCopies}`, {
      fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#faba72'
    }).setOrigin(0.5);
    m.add(countTxt);

    const plusBg = this.add.rectangle(this.W / 2 + 50, btnY, 50, 24, 0x16213e)
      .setStrokeStyle(2, 0xbdcd9c)
      .setInteractive({ useHandCursor: true });
    m.add(plusBg);
    m.add(UI.text(this, this.W / 2 + 50, btnY, '+', {
      fontFamily: '"Press Start 2P"', fontSize: '16px', color: '#bdcd9c'
    }).setOrigin(0.5));

    const closeBg = this.add.rectangle(this.W / 2, btnY + 28, 80, 20, 0x16213e)
      .setStrokeStyle(2, 0xff6b6b)
      .setInteractive({ useHandCursor: true });
    m.add(closeBg);
    m.add(UI.text(this, this.W / 2, btnY + 28, 'CERRAR', {
      fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#ff6b6b'
    }).setOrigin(0.5));

    const update = () => {
      const c2 = this.currentCards[card.id] || 0;
      countTxt.setText(`${c2}/${card.maxCopies}`);
      minusBg.setFillStyle(0x16213e, c2 === 0 ? 0.4 : 1);
      plusBg.setFillStyle(0x16213e, c2 >= card.maxCopies ? 0.4 : 1);
      minusBg.disableInteractive();
      plusBg.disableInteractive();
      if (c2 > 0) minusBg.setInteractive({ useHandCursor: true });
      if (c2 < card.maxCopies) plusBg.setInteractive({ useHandCursor: true });
      this.dirty = true;
      this.step3.removeAll(true);
      this.renderStep3();
    };

    minusBg.on('pointerdown', () => { this.adjustCard(card.id, -1); update(); });
    plusBg.on('pointerdown', () => { this.adjustCard(card.id, 1); update(); });
    closeBg.on('pointerdown', () => this.closeCardModal());

    minusBg.setFillStyle(0x16213e, count === 0 ? 0.4 : 1);
    plusBg.setFillStyle(0x16213e, count >= card.maxCopies ? 0.4 : 1);
    if (count === 0) minusBg.disableInteractive();
    if (count >= card.maxCopies) plusBg.disableInteractive();
  }

  closeCardModal() {
    this.clearModalLayer();
    this.previewOpen = false;
    if (window.HelpSystem) window.HelpSystem.getManager(this).setModal(false);
  }

  adjustCard(cardId, delta) {
    const cards = ALL_CARDS[this.selectedClass] || [];
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    const deck = this.currentCards;
    const cur = deck[cardId] || 0;
    const next = cur + delta;
    if (next < 0 || next > card.maxCopies) return;
    deck[cardId] = next;
    if (next === 0) delete deck[cardId];
    this.dirty = true;
  }

  clearDeck() {
    this.currentCards = {};
    this.dirty = true;
    this.showStep(3);
  }

  quickFill() {
    const cards = ALL_CARDS[this.selectedClass] || [];
    const deck = {};
    cards.forEach(c => { deck[c.id] = c.maxCopies; });
    this.currentCards = deck;
    this.dirty = true;
    this.showStep(3);
  }

  // ===== SLOT CONTEXT MENU (Phaser-native) =====
  openSlotMenu(slotIndex, x, y) {
    this.clearModalLayer();
    if (window.HelpSystem) window.HelpSystem.getManager(this).setModal(true);
    const m = this.add.container(0, 0).setDepth(500);
    this.modalLayer.add(m);

    const overlay = this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x000000, 0.001)
      .setInteractive({ useHandCursor: false });
    m.add(overlay);

    const menuW = 130, menuH = 90;
    let mx = x, my = y;
    if (mx + menuW > this.W) mx = this.W - menuW - 4;
    if (my + menuH > this.H) my = this.H - menuH - 4;
    if (mx < 0) mx = 4;
    if (my < 0) my = 4;

    const bg = this.add.rectangle(mx + menuW / 2, my + menuH / 2, menuW, menuH, 0x16213e)
      .setStrokeStyle(1, 0x2a2a4a);
    m.add(bg);

    const actions = [
      { label: 'RENOMBRAR', color: '#e0e0e0', cb: () => { this.closeSlotModal(); this.renameSlot(slotIndex); } },
      { label: 'DUPLICAR', color: '#e0e0e0', cb: () => { this.closeSlotModal(); this.duplicateSlot(slotIndex); } },
      { label: 'ELIMINAR', color: '#ff6b6b', cb: () => { this.closeSlotModal(); this.deleteSlot(slotIndex); } }
    ];
    overlay.on('pointerdown', () => { this.closeSlotModal(); });
    actions.forEach((a, i) => {
      const by = my + 8 + i * 26;
      const bb = this.add.rectangle(mx + menuW / 2, by + 9, menuW - 8, 22, 0x16213e)
        .setInteractive({ useHandCursor: true });
      m.add(bb);
      m.add(UI.text(this, mx + 10, by + 9, a.label, {
        fontFamily: '"Press Start 2P"', fontSize: '7px', color: a.color
      }).setOrigin(0, 0.5));
      bb.on('pointerover', () => bb.setFillStyle(0x1a2a4e, 1));
      bb.on('pointerout', () => bb.setFillStyle(0x16213e, 1));
      bb.on('pointerdown', a.cb);
    });
  }

  clearModalLayer() {
    if (this.modalLayer) this.modalLayer.removeAll(true);
  }

  closeModalLayer() {
    this.clearModalLayer();
  }

  closeSlotModal() {
    this.clearModalLayer();
    if (window.HelpSystem) window.HelpSystem.getManager(this).setModal(false);
  }

  createSlot() {
    const name = window.prompt('Nombre de la baraja:');
    if (!name || !name.trim()) return;
    const trimmed = name.trim().slice(0, 24);
    const existing = this.allDecks[this.selectedClass] || [];
    if (existing.some(s => (s.name || '') === trimmed)) {
      this.showToast('Ya existe una baraja con ese nombre');
      return;
    }
    if (!this.allDecks[this.selectedClass]) this.allDecks[this.selectedClass] = [];
    this.allDecks[this.selectedClass].push({ name: trimmed, cards: {} });
    this.activeSlot = this.allDecks[this.selectedClass].length - 1;
    this.saveAllDecks();
    this.showStep(3);
  }

  renameSlot(i) {
    const slots = this.allDecks[this.selectedClass] || [];
    const cur = slots[i];
    if (!cur) return;
    const name = window.prompt('Nuevo nombre:', cur.name || '');
    if (!name || !name.trim()) return;
    const trimmed = name.trim().slice(0, 24);
    if (slots.some((s, idx) => idx !== i && (s.name || '') === trimmed)) {
      this.showToast('Ya existe una baraja con ese nombre');
      return;
    }
    cur.name = trimmed;
    this.saveAllDecks();
    this.showStep(2);
  }

  duplicateSlot(i) {
    const slots = this.allDecks[this.selectedClass] || [];
    const cur = slots[i];
    if (!cur) return;
    const base = (cur.name || 'Baraja') + ' copia';
    let name = base, n = 1;
    while (slots.some(s => (s.name || '') === name)) { name = `${base} ${++n}`; }
    slots.splice(i + 1, 0, { name: name.slice(0, 24), cards: { ...cur.cards } });
    this.saveAllDecks();
    this.showStep(2);
  }

  deleteSlot(i) {
    const slots = this.allDecks[this.selectedClass] || [];
    if (!slots[i]) return;
    this.confirmAction('¿Eliminar esta baraja?', () => {
      slots.splice(i, 1);
      if (this.activeSlot >= slots.length) this.activeSlot = Math.max(0, slots.length - 1);
      this.saveAllDecks();
      this.showStep(2);
    }, { noLabel: 'CANCELAR', yesLabel: 'ELIMINAR', yesColor: '#ff6b6b' });
  }

  // ===== CONFIRM DIALOG (Phaser-native) =====
  confirmAction(msg, onYes, options = {}) {
    const noLabel = options.noLabel || 'CANCELAR';
    const yesLabel = options.yesLabel || 'SALIR';
    const yesColor = options.yesColor || '#ff6b6b';
    if (window.HelpSystem) window.HelpSystem.getManager(this).setModal(true);
    this.clearModalLayer();
    const m = this.add.container(0, 0).setDepth(600);
    this.modalLayer.add(m);
    const overlay = this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x000000, 0.7)
      .setInteractive();
    m.add(overlay);
    const pw = 280, ph = 100;
    const px = this.W / 2, py = this.H / 2;
    const panel = this.add.rectangle(px, py, pw, ph, 0x16213e).setStrokeStyle(2, 0xfaba72);
    m.add(panel);
    m.add(UI.text(this, px, py - 24, msg, {
      fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#e0e0e0',
      wordWrap: { width: pw - 24 }, align: 'center'
    }).setOrigin(0.5));
    const noBg = this.add.rectangle(px - 50, py + 18, 90, 22, 0x16213e)
      .setStrokeStyle(1, 0x2a2a4a).setInteractive({ useHandCursor: true });
    m.add(noBg);
    m.add(UI.text(this, px - 50, py + 18, noLabel, {
      fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#e0e0e0'
    }).setOrigin(0.5));
    const yesBg = this.add.rectangle(px + 50, py + 18, 90, 22, 0x16213e)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(yesColor).color).setInteractive({ useHandCursor: true });
    m.add(yesBg);
    m.add(UI.text(this, px + 50, py + 18, yesLabel, {
      fontFamily: '"Press Start 2P"', fontSize: '7px', color: yesColor
    }).setOrigin(0.5));
    noBg.on('pointerdown', () => { this.clearModalLayer(); if (window.HelpSystem) window.HelpSystem.getManager(this).setModal(false); });
    yesBg.on('pointerdown', () => { this.clearModalLayer(); if (window.HelpSystem) window.HelpSystem.getManager(this).setModal(false); onYes(); });
  }

  confirmExit() {
    if (this.dirty) {
      this.confirmAction('¿Salir sin guardar? Se perderán los cambios.', () => this.scene.start('MenuScene'));
    } else {
      this.scene.start('MenuScene');
    }
  }

  // ===== TOAST (Phaser-native) =====
  showToast(msg) {
    const m = this.add.container(0, 0).setDepth(700);
    const w = Math.max(160, msg.length * 7 + 32);
    const bg = this.add.rectangle(this.W / 2, this.H - 50, w, 32, 0x16213e)
      .setStrokeStyle(2, 0xfaba72);
    m.add(bg);
    m.add(UI.text(this, this.W / 2, this.H - 50, msg, {
      fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#faba72'
    }).setOrigin(0.5));
    this.tweens.add({
      targets: bg, alpha: { from: 1, to: 0 }, duration: 1500, ease: 'Cubic.easeIn',
      onComplete: () => m.destroy(true)
    });
  }

  toggleHelpBubbles() {
    const H = window.HelpSystem;
    if (!H) return;
    const m = H.getManager(this);
    const nowOn = !m.isEnabled();
    m.setEnabled(nowOn);
    this.refreshHelpBtn();
    this.showToast(nowOn ? 'AYUDA ACTIVA' : 'AYUDA DESACTIVADA');
  }

  refreshHelpBtn() {
    const H = window.HelpSystem;
    const on = H ? H.getManager(this).isEnabled() : true;
    if (this.helpBtnText) {
      this.helpBtnText.setText(on ? 'AYUDA: ON' : 'AYUDA: OFF');
      this.helpBtnText.setColor(on ? '#bdcd9c' : '#8892a0');
    }
    if (this.helpBtn) {
      this.helpBtn.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(on ? '#bdcd9c' : '#8892a0').color);
    }
  }

  // ===== ROTATION HINT (Phaser-native) =====
  checkRotationHint() {
    if (window.innerWidth < window.innerHeight && localStorage.getItem('deckstiny_rotated_dismissed') !== 'true') {
      this.clearModalLayer();
      const m = this.add.container(0, 0).setDepth(800);
      this.modalLayer.add(m);
      const overlay = this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x000000, 0.92)
        .setInteractive();
      m.add(overlay);
      m.add(UI.text(this, this.W / 2, this.H / 2 - 20, '📱', { fontSize: '32px' }).setOrigin(0.5));
      m.add(UI.text(this, this.W / 2, this.H / 2 + 10, 'Gira tu dispositivo\npara jugar en horizontal', {
        fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#faba72',
        align: 'center', lineSpacing: 6
      }).setOrigin(0.5));
      const btnBg = this.add.rectangle(this.W / 2, this.H / 2 + 60, 130, 26, 0x16213e)
        .setStrokeStyle(1, 0x2a2a4a).setInteractive({ useHandCursor: true });
      m.add(btnBg);
      m.add(UI.text(this, this.W / 2, this.H / 2 + 60, 'ENTENDIDO', {
        fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#8892a0'
      }).setOrigin(0.5));
      btnBg.on('pointerdown', () => {
        localStorage.setItem('deckstiny_rotated_dismissed', 'true');
        this.clearModalLayer();
      });
    }
  }

  // ===== FULLSCREEN =====
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      try { document.documentElement.requestFullscreen(); } catch (e) {}
    } else {
      try { document.exitFullscreen(); } catch (e) {}
    }
  }

  handleFullscreenTap(pointer) {
    if (pointer.x > this.W - 40 && pointer.y < 24) {
      this.toggleFullscreen();
    }
  }
}

window.DeckScene = DeckScene;