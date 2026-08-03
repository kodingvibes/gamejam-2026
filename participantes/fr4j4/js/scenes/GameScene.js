// GameScene — Motor de juego core + modo test
// Resolucion interna fija: 640x360. Phaser escala con FIT.

class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  init(data) {
    this.mode = data.mode || 'test';
    this.classId = data.classId || null;
    this.slotIndex = data.slotIndex || 0;
    // Modo campaña: etapa actual + HP persistente entre batallas
    this.campaignStage = data.campaignStage !== undefined ? data.campaignStage : 0;
    this.campaignHp = data.campaignHp !== undefined ? data.campaignHp : null;
    this.endTurnBtn = null;
    this.menuBtn = null;
    this.handCards = [];
    this.handZones = [];
    this.handFocused = -1;
    this.menuOverlay = null;
    this.menuOpen = false;
    this.creatureCardPreview = null;
  }

  create() {
    const W = 640;
    const H = 360;
    this.W = W; this.H = H;
    this.cameras.main.setBackgroundColor('#0d0d1a');

    this.bgLayer = this.add.layer().setDepth(0);
    this.uiLayer = this.add.layer().setDepth(10);
    this.handContainer = this.add.container(0, 0).setDepth(15);
    this.modalLayer = this.add.layer().setDepth(20);
    this.fxContainer = this.add.container(0, 0).setDepth(1001);

    ensureStarterDecks();

    if (!this.classId) {
      const t = UI.text(this, W / 2, H / 2, 'NO TIENES BARAJA — VUELVE AL MENÚ', {
        fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#ff6b6b'
      }).setOrigin(0.5);
      this.uiLayer.add(t);
      this.time.delayedCall(2000, () => this.scene.start('MenuScene'));
      return;
    }

    this.cls = CLASSES.find(c => c.id === this.classId);
    this.selectedClass = this.classId;
    this.buildDeck();
    this.initState();
    this.renderLayout();
    CRT.addScanlines(this);
    this.startPlayerTurn();
    this.registerHelp();
    this.refreshHelpBtn();
    this.input.keyboard.on('keydown-E', () => this.tryEndTurn());
    this.input.keyboard.on('keydown-ENTER', () => this.tryEndTurn());
    this.input.keyboard.on('keydown-ESC', () => this.toggleMenu());
    this._helpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this._helpKey.on('down', () => this.toggleHelpBubbles());

    this.input.on('pointerdown', (pointer, gameObjects) => {
      if (this.state.targetingMode && gameObjects.length === 0) {
        this.cancelTargeting();
      }
    });
    this.input.on('pointerdown', (pointer) => this.handleFullscreenTap(pointer));

    this.input.on('wheel', (pointer, gameObjects, dx, dy) => {
      if (!this.logList || !this.logScrollZone) return;
      const wx = pointer.worldX, wy = pointer.worldY;
      const zx = this.logScrollZone.x, zy = this.logScrollZone.y;
      const zw = this.logScrollZone.input ? this.logScrollZone.input.hitArea.width : this.logPanelW;
      const zh = this.logScrollZone.input ? this.logScrollZone.input.hitArea.height : this.logPanelH;
      const overPanel = wx >= zx - zw / 2 && wx <= zx + zw / 2
        && wy >= zy - zh / 2 && wy <= zy + zh / 2;
      if (!overPanel) return;
      const wasAtBottom = this.logScrollY >= this.maxLogScroll;
      const step = Math.max(this.logLineH, Math.abs(dy) * 0.5);
      if (dy < 0) {
        this.logScrollY = Math.max(0, this.logScrollY - step);
      } else if (dy > 0) {
        this.logScrollY = Math.min(this.maxLogScroll, this.logScrollY + step);
      }
      this.reflowLog();
    });
  }

  shutdown() {
    if (this.pHero) { this.pHero.destroy(); this.pHero = null; }
    if (this.eHero) { this.eHero.destroy(); this.eHero = null; }
    // per-card input listeners are destroyed with their zones
  }

  registerHelp() {
    const H = window.HelpSystem;
    if (!H) return;
    const G = (id) => {
      const g = (window.TUTORIAL_GLOSSARY || []).find(x => x.id === id);
      return g || { title: id.toUpperCase(), desc: '' };
    };

    // Burbujas por defecto SOLO en la primera sesión o en modo Práctica.
    // En cualquier momento se activan/desactivan con la tecla H.
    let seenTutorial = true;
    try { seenTutorial = !!localStorage.getItem('deckstiny_tutorial_done'); } catch (e) {}
    const bubblesOn = this.mode === 'test' || !seenTutorial;
    H.setEnabled(this, bubblesOn);

    H.register(this, { x: 460, y: 15 }, G('timer').title, G('timer').desc, { w: 64, h: 22, above: true });
    H.register(this, { x: 72, y: 176 }, G('mana').title, G('mana').desc, { w: 120, h: 20, above: false });
    H.register(this, { x: 72, y: 188 }, G('venom').title, G('venom').desc, { w: 120, h: 16, above: false });
    H.register(this, { x: 72, y: 212 }, G('hero-power').title, G('hero-power').desc, { w: 110, h: 22, above: false });
    H.register(this, { x: 564, y: 338 }, 'FIN DE TURNO', 'Termina tu turno con el botón FIN DE TURNO o la tecla E. Luego ataca la IA.', { w: 120, h: 32, above: false });
    H.register(this, { x: 320, y: 210 }, G('discard').title, 'Registro de todo lo que pasa en la batalla. Usa la rueda para desplazarte.', { w: 264, h: 66, above: false });
    H.register(this, { x: 320, y: 172 }, G('board-slots').title, G('board-slots').desc, { w: 264, h: 32, above: false });

    this.onHelpClosed = () => {
      if (this.state.phase === 'player' && !this.state.gameOver && this.mode !== 'test') {
        this.startTimer();
      }
    };

    const params = new URLSearchParams(window.location.search);
    if (params.get('tutorial') === '1') {
      this.time.delayedCall(400, () => this.openTutorialOverlay());
    }
  }

  openTutorialOverlay() {
    const H = window.HelpSystem;
    if (!H) return;
    if (this.state.timerEvent) { this.state.timerEvent.remove(); this.state.timerEvent = null; }
    this.hideCreatureCard();
    H.showOverlay(this, window.TUTORIAL_PAGES);
  }

  toggleHelpBubbles() {
    const H = window.HelpSystem;
    if (!H) return;
    const m = H.getManager(this);
    const nowOn = !m.isEnabled();
    m.setEnabled(nowOn);
    this.refreshHelpBtn();
    this.showBubbleToast(nowOn);
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
    if (this._menuHelpBtn) {
      this._menuHelpBtn.text.setText(on ? 'BURBUJAS: ON' : 'BURBUJAS: OFF');
      this._menuHelpBtn.text.setColor(on ? '#bdcd9c' : '#8892a0');
    }
  }

  showBubbleToast(on) {
    const msg = on ? 'AYUDA ACTIVA' : 'AYUDA DESACTIVADA';
    const color = on ? '#bdcd9c' : '#8892a0';
    const t = UI.text(this, this.W / 2, 40, msg, {
      fontFamily: '"Press Start 2P"', fontSize: '7px', color,
      backgroundColor: '#000000aa', padding: { x: 8, y: 4 }
    }).setOrigin(0.5);
    this.uiLayer.add(t);
    this.tweens.add({
      targets: t, alpha: 0, delay: 1400, duration: 400,
      onComplete: () => { if (t.active) t.destroy(); }
    });
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      try { document.documentElement.requestFullscreen(); } catch (e) {}
    } else {
      try { document.exitFullscreen(); } catch (e) {}
    }
  }

  handleFullscreenTap(pointer) {
    if (pointer.x > this.W - 40 && pointer.y < 26) {
      this.toggleFullscreen();
    }
  }

  update(time, delta) {
    if (this.pHero) this.pHero.update(time, delta);
    if (this.eHero) this.eHero.update(time, delta);
  }

  buildDeck() {
    const cardList = [];
    const classCards = ALL_CARDS[this.classId] || [];
    const allDecks = JSON.parse(localStorage.getItem('deckstiny_decks') || '{}');
    const classDecks = allDecks[this.classId] || [];
    const slotData = classDecks[this.slotIndex] || { cards: {} };
    const deckData = slotData.cards || {};
    for (const [id, count] of Object.entries(deckData)) {
      const card = classCards.find(c => c.id === id);
      if (card) for (let i = 0; i < count; i++)
        cardList.push({ ...card, uid: Math.random().toString(36).slice(2, 8) });
    }
    this.shuffle(cardList);
    this.playerDeck = cardList;
  }

  initState() {
    const isTest = this.mode === 'test';
    const isCampaign = this.mode === 'campaign';
    this.state = { turn: 1, phase: 'player', gameOver: false, log: [], timer: 60, timerEvent: null };

    this.player = {
      classId: this.cls.id, hp: this.cls.hp, maxHp: this.cls.hp, armor: this.cls.armor,
      mana: 1, maxMana: 1, deck: [...this.playerDeck], hand: [], board: [],
      venom: 0, inspiration: 0, discardPile: [], heroUsed: false, cardsPlayed: 0, costReduction: 0
    };

    // En campaña el jugador conserva el HP que trae de la etapa anterior (con curación aplicada)
    if (isCampaign && this.campaignHp !== null) {
      this.player.hp = Math.max(1, Math.min(this.campaignHp, this.cls.hp));
    }

    this.opponent = isTest ? {
      classId: 'dummy', hp: 100, maxHp: 100, armor: 100, mana: 0, maxMana: 0,
      deck: [], hand: [], board: [], venom: 0, inspiration: 0, discardPile: [],
      heroUsed: false, cardsPlayed: 0, isDummy: true
    } : (() => {
      const otherClasses = CLASSES.filter(c => c.id !== this.classId);
      const aiCls = isCampaign
        ? (CLASSES.find(c => c.id === (window.CAMPAIGN_STAGES[this.campaignStage] || {}).classId) || otherClasses[0])
        : otherClasses[Phaser.Math.Between(0, otherClasses.length - 1)];
      const aiCards = ALL_CARDS[aiCls.id] || [];
      const targetTotal = Phaser.Math.Between(20, 30);
      const maxPossible = aiCards.reduce((s, c) => s + (c.maxCopies || 2), 0);
      const finalTarget = Math.min(targetTotal, maxPossible);
      const counts = {};
      for (const card of aiCards) {
        if (card.maxCopies >= 1) counts[card.id] = 1;
      }
      let total = Object.keys(counts).length;
      while (total < finalTarget) {
        const eligible = aiCards.filter(c => (counts[c.id] || 0) < (c.maxCopies || 2));
        if (eligible.length === 0) break;
        const pick = eligible[Phaser.Math.Between(0, eligible.length - 1)];
        counts[pick.id] = (counts[pick.id] || 0) + 1;
        total++;
      }
      const aiDeckList = [];
      for (const card of aiCards) {
        const count = counts[card.id] || 0;
        for (let i = 0; i < count; i++)
          aiDeckList.push({ ...card, uid: Math.random().toString(36).slice(2, 8) });
      }
      this.shuffle(aiDeckList);
      const stageHp = isCampaign ? (window.CAMPAIGN_STAGES[this.campaignStage] || {}).hp : aiCls.hp;
      const stageArmor = isCampaign ? (window.CAMPAIGN_STAGES[this.campaignStage] || {}).armor || 0 : aiCls.armor;
      return {
        classId: aiCls.id, hp: stageHp, maxHp: stageHp, armor: stageArmor,
        mana: 1, maxMana: 1, deck: aiDeckList,
        hand: [], board: [], venom: 0, inspiration: 0, discardPile: [],
        heroUsed: false, cardsPlayed: 0, costReduction: 0, isDummy: false
      };
    })();

    this.player.hand = this.player.deck.splice(0, 4);
    if (!isTest) this.opponent.hand = this.opponent.deck.splice(0, 4);
  }

  // ===== LAYOUT =====
  renderLayout() {
    const W = 640, H = 360;
    const clsColor = this.cls ? this.cls.colorHex : '#9fcafd';

    VFX.stars(this, this.bgLayer, 20);
    VFX.header(this, this.uiLayer, 'COMBATE', clsColor, { width: W, height: 26, showFullscreen: true, fullscreenCallback: () => this.toggleFullscreen() });

    // --- STATUS BAR ---
    const barY = 15;
    this.menuBtn = this.add.rectangle(15, barY, 22, 22, 0x16213e)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor('#faba72').color)
      .setInteractive({ useHandCursor: true });
    this.uiLayer.add(this.menuBtn);
    const menuIcon = UI.text(this, 15, barY, '☰', {
      fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#faba72'
    }).setOrigin(0.5);
    this.uiLayer.add(menuIcon);
    this.menuBtn.on('pointerdown', () => this.toggleMenu());
    this.turnText = UI.text(this, 30, barY, 'Turno 1', {
      fontFamily: '"VT323"', fontSize: '16px', color: '#faba72'
    }).setOrigin(0, 0.5);
    this.uiLayer.add(this.turnText);
    this.phaseText = UI.text(this, 118, barY, 'Tu turno', {
      fontFamily: '"VT323"', fontSize: '16px', color: '#8892a0'
    }).setOrigin(0, 0.5);
    this.uiLayer.add(this.phaseText);
    this.timerText = UI.text(this, W - 180, barY, '60s', {
      fontFamily: '"VT323"', fontSize: '16px', color: '#ff6b6b'
    }).setOrigin(0, 0.5);
    this.uiLayer.add(this.timerText);

    // Hero power button (movido debajo del heroe del jugador, se crea en renderInfo)
    const heroName = this.cls.heroPower.name.toUpperCase();
    const heroCost = this.cls.heroPower.cost;
    const heroIcon = '⚡';
    this._heroPowerLabel = `${heroIcon} ${heroName} ${heroCost}M`;
    this._heroPowerDesc = `${heroCost}M — ${this.cls.heroPower.desc}`;

    // --- HERO ZONES ---
    this.pInfoContainer = this.add.container(0, 0);
    this.eInfoContainer = this.add.container(0, 0);
    this._createHeroSprites();

    // --- BATTLE LINE ---
    this.pBoardContainer = this.add.container(0, 0);
    this.eBoardContainer = this.add.container(0, 0);

    // --- BATTLE LOG PANEL ---
    this.logPanelX = Math.floor((W - 264) / 2);
    this.logPanelY = 210;
    this.logPanelW = 264;
    this.logPanelH = 66;
    this.logLineH = 14;
    this.logMaxLines = 30;

    const logBg = this.add.rectangle(
      this.logPanelX + this.logPanelW / 2,
      this.logPanelY + this.logPanelH / 2,
      this.logPanelW, this.logPanelH, 0x16213e, 0.6
    ).setStrokeStyle(1, Phaser.Display.Color.HexStringToColor('#9fcafd').color, 0.5);
    this.uiLayer.add(logBg);
    this.logBg = logBg;

    const logTitle = UI.text(this, this.logPanelX + 6, this.logPanelY - 4, 'LOG DE BATALLA', {
      fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#9fcafd'
    }).setOrigin(0, 0.5);
    this.uiLayer.add(logTitle);

    this.logList = this.add.container(this.logPanelX + 4, this.logPanelY);
    this.uiLayer.add(this.logList);

    this.logScrollY = 0;
    this.maxLogScroll = 0;
    this.logScrollZone = this.add.zone(
      this.logPanelX + this.logPanelW / 2,
      this.logPanelY + this.logPanelH / 2,
      this.logPanelW, this.logPanelH
    ).setInteractive({ useHandCursor: false });
    this.uiLayer.add(this.logScrollZone);

    // --- END TURN ---
    this.endTurnBtn = this.add.rectangle(W - 76, H - 22, 120, 32, 0x16213e)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor('#faba72').color)
      .setInteractive({ useHandCursor: true });
    this.uiLayer.add(this.endTurnBtn);
    this.endTurnText = UI.text(this, W - 76, H - 22, 'FIN DE TURNO', {
      fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#faba72'
    }).setOrigin(0.5);
    this.uiLayer.add(this.endTurnText);
    this.endTurnBtn.on('pointerdown', () => this.endTurn());

    // --- AYUDA (burbujas) ---
    this.helpBtn = this.add.rectangle(70, H - 22, 96, 20, 0x16213e)
      .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor('#8892a0').color)
      .setInteractive({ useHandCursor: true });
    this.uiLayer.add(this.helpBtn);
    this.helpBtnText = UI.text(this, 70, H - 22, 'AYUDA: OFF', {
      fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#8892a0'
    }).setOrigin(0.5);
    this.uiLayer.add(this.helpBtnText);
    this.helpBtn.on('pointerdown', () => this.toggleHelpBubbles());

    this.renderAll();
  }

  // ===== RENDER =====
  renderAll() { this.renderInfo(); this.renderBoards(); this.renderHand(); }

  _createHeroSprites() {
    const W = 640;
    const pClsId = this.player && this.player.classId;
    const eClsId = this.opponent && this.opponent.classId;
    const pCls = CLASSES.find(c => c.id === pClsId);
    const eCls = CLASSES.find(c => c.id === eClsId);
    const fallbackCls = { id: 'unknown', icon: '?', colorHex: '#8892a0' };
    const pCfgKey = (pCls ? 'HERO_SPRITE_' + pCls.id.toUpperCase() : (pClsId === 'dummy' ? 'HERO_SPRITE_DUMMY' : null));
    const eCfgKey = (eCls ? 'HERO_SPRITE_' + eCls.id.toUpperCase() : (eClsId === 'dummy' ? 'HERO_SPRITE_DUMMY' : null));
    const pCfg = pCfgKey && window[pCfgKey];
    const eCfg = eCfgKey && window[eCfgKey];
    const noTextureCfg = { key: '__none__', classId: 'dummy', defaultState: 'idle', states: { idle: [] }, frameSize: { w: 1, h: 1 }, scale: 1 };
    this.pHero = HeroSprite.create(this, {
      config: (pCfg && this.textures.exists(pCfg.key)) ? pCfg : noTextureCfg,
      side: 'left', x: 72, y: 130, icon: pCls ? pCls.icon : fallbackCls.icon
    });
    this.eHero = HeroSprite.create(this, {
      config: (eCfg && this.textures.exists(eCfg.key)) ? eCfg : noTextureCfg,
      side: 'right', x: W - 72, y: 130, icon: eCls ? eCls.icon : fallbackCls.icon
    });
  }

  renderInfo() {
    const W = 640;
    const p = this.player, e = this.opponent;
    this.pInfoContainer.removeAll(true);
    this.eInfoContainer.removeAll(true);

    const pCls = CLASSES.find(c => c.id === p.classId) || { name: 'Tu', icon: '🧙', colorHex: '#9fcafd' };
    const eCls = CLASSES.find(c => c.id === e.classId) || { name: 'Dummy', icon: '🤖', colorHex: '#8892a0' };

    this.pInfoContainer.add(UI.text(this, 72, 152, pCls.name.toUpperCase(), {
      fontFamily: '"VT323"', fontSize: '12px', color: pCls.colorHex
    }).setOrigin(0.5));
    this.renderHeroBar(this.pInfoContainer, 72, 164, 80, p.hp, p.maxHp, pCls.colorHex);
    this.pInfoContainer.add(UI.text(this, 72, 176, `HP ${Math.max(0, p.hp)}/${p.maxHp}  ARM ${p.armor}  MAN ${p.mana}/${p.maxMana}`, {
      fontFamily: '"VT323"', fontSize: '13px', color: '#e0e0e0'
    }).setOrigin(0.5));
    let pEx = '';
    if (p.venom > 0) pEx += ` VENENO ${p.venom}`;
    if (p.inspiration > 0) pEx += ` INSPIR ${p.inspiration}`;
    if (pEx) this.pInfoContainer.add(UI.text(this, 72, 188, pEx.trim(), {
      fontFamily: '"VT323"', fontSize: '10px', color: '#bdcd9c'
    }).setOrigin(0.5));

    this.heroPowerBtn = UI.button(this, 72, 212, this._heroPowerLabel, '#faba72',
      () => this.useHeroPower(), { layer: this.uiLayer, minWidth: 110, height: 22, fontSize: '7px' });
    this.uiLayer.add(this.heroPowerBtn.container);
    this.heroTooltip = UI.tooltip(this, 72, 256,
      this._heroPowerLabel.replace(/^⚡ /, '').replace(/\s\d+M$/, ''),
      this._heroPowerDesc,
      { width: 220, color: '#faba72', fontSize: '7px' });
    this.heroTooltip.container.setVisible(false);
    this.uiLayer.add(this.heroTooltip.container);
    this.heroPowerBtn.container.on('pointerover', () => {
      this.heroTooltip.container.setVisible(true);
    });
    this.heroPowerBtn.container.on('pointerout', () => {
      this.heroTooltip.container.setVisible(false);
    });

    this.eInfoContainer.add(UI.text(this, W - 72, 152, eCls.name.toUpperCase(), {
      fontFamily: '"VT323"', fontSize: '12px', color: eCls.colorHex
    }).setOrigin(0.5));
    this.renderHeroBar(this.eInfoContainer, W - 72, 164, 80, e.hp, e.maxHp, eCls.colorHex);
    this.eInfoContainer.add(UI.text(this, W - 72, 176, `HP ${Math.max(0, e.hp)}/${e.maxHp}  ARM ${e.armor}  MAN ${e.mana}/${e.maxMana}`, {
      fontFamily: '"VT323"', fontSize: '13px', color: '#e0e0e0'
    }).setOrigin(0.5));
    let eEx = '';
    if (e.venom > 0) eEx += ` VENENO ${e.venom}`;
    if (eEx) this.eInfoContainer.add(UI.text(this, W - 72, 188, eEx.trim(), {
      fontFamily: '"VT323"', fontSize: '10px', color: '#bdcd9c'
    }).setOrigin(0.5));
  }

  renderHeroBar(container, x, y, w, current, max, colorHex) {
    const pct = max > 0 ? Math.max(0, current) / max : 0;
    const color = Phaser.Display.Color.HexStringToColor(colorHex).color;
    const bg = this.add.rectangle(x, y, w, 4, 0x2a2a4a).setOrigin(0.5);
    const fill = this.add.rectangle(x - w / 2 + (w * pct) / 2, y, w * pct, 4, color).setOrigin(0.5);
    container.add([bg, fill]);
  }

  renderBoards() {
    const slotW = 32;
    const slotH = 32;
    const gap = 4;
    const cy = 172;
    const pStartX = 188;
    const eStartX = 452;

    const renderBoard = (container, board, isEnemy) => {
      container.removeAll(true);
      for (let i = 0; i < 4; i++) {
        const dir = isEnemy ? -1 : 1;
        const cx = (isEnemy ? eStartX : pStartX) + i * (slotW + gap) * dir;
        const c = board[i];
        const bg = this.add.rectangle(cx, cy, slotW, slotH, c ? 0x16213e : 0x0d0d1a)
          .setStrokeStyle(1, c ? 0x3a3a5e : 0x2a2a4a);
        container.add(bg);

        if (!c) continue;

        const icon = UI.text(this, cx, cy - 3, '🐾', { fontSize: '16px' }).setOrigin(0.5);
        const atk = UI.text(this, cx - 12, cy + 11, `${this.getAtk(c)}`, {
          fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#faba72'
        }).setOrigin(0.5);
        const hp = UI.text(this, cx + 12, cy + 11, `${this.getHp(c)}`, {
          fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#ff6b6b'
        }).setOrigin(0.5);

        let ind = '';
        if (c.guard) ind += '🛡️';
        if (c.evasive) ind += '💨';
        if (c.celerity) ind += '⚡';
        if (ind) container.add(UI.text(this, cx, cy - 14, ind, { fontSize: '7px' }).setOrigin(0.5));

        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => this.showCreatureCard(c, cx, cy));
        bg.on('pointerout', () => this.hideCreatureCard());

        const tm = this.state.targetingMode;
        if (tm && tm.side === 'player' && !isEnemy && tm.effectType === 'sacrifice') {
          bg.setFillStyle(0x4a1a1a);
          bg.setStrokeStyle(2, Phaser.Display.Color.HexStringToColor('#ff6b6b').color);
          bg.on('pointerdown', () => {
            if (this.handleTargetingClick(c, board)) {
              bg.removeAllListeners('pointerdown');
            }
          });
        }
        container.add([icon, atk, hp]);
      }
    };
    renderBoard(this.pBoardContainer, this.player.board, false);
    renderBoard(this.eBoardContainer, this.opponent.board, true);
  }

  getAtk(c) { return (c.atkBase || 0) + (c.atkBoost || 0); }
  getHp(c) { return (c.hpBase || 0) + (c.hpBoost || 0); }
  getMaxHp(c) { return (c.maxHpBase || 0) + (c.maxHpBoost || 0); }
  pickCreatureTarget(board) {
    if (!board || board.length === 0) return -1;
    return 0;
  }

  runAttacks(side) {
    const board = side === 'player' ? this.player.board : this.opponent.board;
    const enemyBoard = side === 'player' ? this.opponent.board : this.player.board;
    const enemySide = side === 'player' ? 'opponent' : 'player';

    for (let i = board.length - 1; i >= 0; i--) {
      const attacker = board[i];
      if (!attacker || !attacker.canAttack) continue;

      let target = null;
      const guards = enemyBoard.filter(c => c.guard);
      if (guards.length > 0) {
        target = guards[0];
      } else if (enemyBoard.length > 0) {
        target = enemyBoard[0];
      }

      if (target) {
        this.combat(attacker, target, side);
      } else {
        const atk = this.getAtk(attacker);
        this.applyDamage(enemySide, atk);
        this.addLog(`${attacker.name} ataca al héroe: ${atk}`, 'dmg');
      }
      attacker.canAttack = false;
    }
  }

  getCreatureCard(creature) {
    const classCards = ALL_CARDS[this.selectedClass] || [];
    if (creature.cardId) {
      const found = classCards.find(c => c.id === creature.cardId);
      if (found) return found;
    }
    return {
      id: creature.uid,
      name: creature.name,
      cost: 0,
      maxCopies: 1,
      effects: [],
      desc: `Criatura ${this.getAtk(creature)}/${this.getHp(creature)}`
    };
  }

  showCreatureCard(creature, x, y) {
    this.hideCreatureCard();
    const card = this.getCreatureCard(creature);
    const clsColor = this.cls.colorHex;
    const root = CardFactory.Card(this, {
      card, count: 1, inDeck: false, classColor: clsColor, mode: 'modal'
    });
    root.setPosition(x, y - 80).setScale(0).setDepth(1002);
    this.creatureCardPreview = root;
    this.fxContainer.add(root);
    this.tweens.add({
      targets: root, scale: 0.45, alpha: 1,
      duration: 150, ease: 'Back.easeOut'
    });
  }

  hideCreatureCard() {
    if (!this.creatureCardPreview) return;
    const root = this.creatureCardPreview;
    this.creatureCardPreview = null;
    this.tweens.add({
      targets: root, scale: 0, alpha: 0,
      duration: 120, ease: 'Cubic.easeIn',
      onComplete: () => root.destroy()
    });
  }

  renderHand() {
    this.handContainer.removeAll(true);
    this.handCards = [];
    this.handZones = [];
    this.handFocused = -1;
    const W = 640;
    const p = this.player;
    const cardW = 88;
    const cardH = 120;
    const compactY = 380;
    const focusY = 220;
    const fanGap = -60;
    const count = Math.min(p.hand.length, 8);
    const totalW = cardW + (count - 1) * (cardW + fanGap);
    const startX = (W - totalW) / 2 + cardW / 2;
    const clsColor = this.cls.colorHex;

    p.hand.forEach((card, i) => {
      if (i >= 8) return;
      const x = startX + i * (cardW + fanGap);
      const cost = Math.max(0, card.cost - (p.costReduction || 0));
      const canPlay = this.state.phase === 'player' && cost <= p.mana;

      const cardRoot = CardFactory.Card(this, {
        card, count: 1, inDeck: true, classColor: clsColor, mode: 'grid'
      });
      cardRoot.setPosition(x, compactY);
      if (!canPlay) cardRoot.setAlpha(0.55);

      this.handContainer.add(cardRoot);
      this.handCards.push({ root: cardRoot, baseX: x, canPlay, hoverZone: null });

      // Hitbox hija de la carta: alta y desplazada hacia abajo para mantener
      // el cursor dentro mientras la carta se levanta. Hereda el z-order del fan.
      const hoverZone = this.add.zone(0, 80, cardW, 320).setInteractive({ useHandCursor: canPlay });
      cardRoot.add(hoverZone);
      this.handZones.push(hoverZone);
      this.handCards[i].hoverZone = hoverZone;

      hoverZone.on('pointerover', () => this.onCardPointerOver(i, cardRoot));
      hoverZone.on('pointerout', () => this.onCardPointerOut(i));
      if (canPlay) hoverZone.on('pointerdown', () => this.playCard(i));
    });
  }

  onCardPointerOver(index, cardRoot) {
    if (this.menuOpen || this.state.gameOver) return;
    this.expandHand(index);
  }

  onCardPointerOut(index) {
    if (this.menuOpen || this.state.gameOver) return;
    this.time.delayedCall(30, () => {
      if (this.handFocused === index) this.collapseHand();
    });
  }

  expandHand(focusedIndex) {
    if (this.handFocused === focusedIndex) return;
    this.handFocused = focusedIndex;
    this.tweens.killTweensOf(this.handContainer.list);
    this.handCards.forEach((entry, i) => {
      const isFocused = i === focusedIndex;
      const offset = isFocused ? 0 : (i < focusedIndex ? -14 : 14);
      const liftY = entry.canPlay ? 220 : 300;
      const liftScale = entry.canPlay && isFocused ? 1.12 : 1;
      this.tweens.add({
        targets: entry.root,
        x: entry.baseX + offset,
        y: isFocused ? liftY : 360,
        scale: liftScale,
        duration: 180,
        ease: 'Sine.easeOut'
      });
    });
  }

  collapseHand() {
    if (this.handFocused === -1) return;
    this.handFocused = -1;
    this.tweens.killTweensOf(this.handContainer.list);
    this.handCards.forEach((entry, i) => {
      this.tweens.add({
        targets: entry.root,
        x: entry.baseX,
        y: 380,
        scale: 1,
        duration: 180,
        ease: 'Sine.easeOut'
      });
    });
    this.time.delayedCall(180, () => this.restoreHandOrder());
  }

  restoreHandOrder() {
    this.handCards.forEach((entry, i) => {
      if (this.handContainer.moveTo) this.handContainer.moveTo(entry.root, i);
    });
  }

  // ===== TURNO =====
  updateEndTurnBtn() {
    if (!this.endTurnBtn || !this.endTurnText) return;
    const enabled = this.state.phase === 'player' && !this.state.gameOver;
    this.endTurnBtn.setAlpha(enabled ? 1 : 0.45);
    this.endTurnText.setAlpha(enabled ? 1 : 0.45);
    if (enabled) this.endTurnBtn.setInteractive({ useHandCursor: true });
    else this.endTurnBtn.disableInteractive();
  }

  startPlayerTurn() {
    const p = this.player;
    if (p.venom > 0) {
      const dmg = p.venom;
      this.applyDamage('player', dmg);
      p.venom = Math.max(0, p.venom - 1);
      this.addLog(`Veneno: ${dmg} daño`, 'dmg');
    }
    if (this.checkGameOver()) return;
    for (let i = 0; i < 2; i++) this.drawCard('player');
    while (p.hand.length > 8) {
      const overflow = p.hand.pop();
      p.discardPile.push(overflow);
      this.addLog(`Mano llena — ${overflow.name} al descarte`, 'sys');
    }
    p.maxMana = Math.min(p.maxMana + 1, 7);
    p.mana = p.maxMana;
    p.heroUsed = false; p.cardsPlayed = 0; p.costReduction = 0;
    if (p.silencedTurns && p.silencedTurns > 0) {
      p.silencedTurns = Math.max(0, p.silencedTurns - 1);
    }
    p.board.forEach(c => {
      if (!c.buffs) c.buffs = [];
      c.buffs = c.buffs.filter(b => {
        if (b.duration === 'turn') {
          if (b.type === 'atk') c.atkBoost = Math.max(0, (c.atkBoost || 0) - b.amount);
          if (b.type === 'hp') c.hpBoost = Math.max(0, (c.hpBoost || 0) - b.amount);
          return false;
        }
        return true;
      });
    });
    p.board.forEach(c => { c.justSummoned = false; c.canAttack = true; });
    this.state.phase = 'player';
    this.turnText.setText(`Turno ${this.state.turn}`);
    this.phaseText.setText('Tu turno');
    this.addLog(`--- Turno ${this.state.turn} ---`, 'sys');
    this.updateEndTurnBtn();
    this.renderAll();
    if (this.mode !== 'test') this.startTimer();
    else this.timerText.setText('∞');
  }

  startTimer() {
    if (this.state.timerEvent) this.state.timerEvent.remove();
    this.state.timer = 60;
    this.timerText.setText('60s');
    this.state.timerEvent = this.time.addEvent({
      delay: 1000, repeat: 59,
      callback: () => {
        this.state.timer--;
        this.timerText.setText(`${this.state.timer}s`);
        if (this.state.timer <= 0) this.endTurn();
      }
    });
  }

  tryEndTurn() {
    if (this.state.phase !== 'player' || this.state.gameOver) return;
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    this.endTurn();
  }

  endTurn() {
    if (this.state.phase !== 'player' || this.state.gameOver) return;
    if (this.state.timerEvent) this.state.timerEvent.remove();
    const returned = this.player.discardPile.filter(c => c.returnAtEndOfTurn);
    if (returned.length > 0) {
      this.player.discardPile = this.player.discardPile.filter(c => !c.returnAtEndOfTurn);
      this.player.hand.push(...returned);
      returned.forEach(c => {
        c.returnAtEndOfTurn = false;
        this.addLog(`${c.name} vuelve a tu mano`, 'info');
      });
    }
    this.state.phase = 'opponent';
    this.phaseText.setText('Turno oponente');
    this.updateEndTurnBtn();
    this.runAttacks('player');
    if (this.checkGameOver()) return;
    this.renderAll();
    if (this.opponent.isDummy) {
      this.state.turn++;
      this.time.delayedCall(500, () => this.startPlayerTurn());
    } else {
      this.time.delayedCall(800, () => this.opponentTurn());
    }
  }

  opponentTurn() {
    if (this.state.gameOver) return;
    const e = this.opponent;
    this.drawCard('opponent');
    while (e.hand.length > 8) {
      const overflow = e.hand.pop();
      e.discardPile.push(overflow);
    }
    e.maxMana = Math.min(e.maxMana + 1, 7);
    e.mana = e.maxMana; e.heroUsed = false; e.cardsPlayed = 0;
    if (e.silencedTurns && e.silencedTurns > 0) {
      e.silencedTurns = Math.max(0, e.silencedTurns - 1);
    }
    e.board.forEach(c => {
      if (!c.buffs) c.buffs = [];
      c.buffs = c.buffs.filter(b => {
        if (b.duration === 'turn') {
          if (b.type === 'atk') c.atkBoost = Math.max(0, (c.atkBoost || 0) - b.amount);
          if (b.type === 'hp') c.hpBoost = Math.max(0, (c.hpBoost || 0) - b.amount);
          return false;
        }
        return true;
      });
    });
    e.board.forEach(c => { c.justSummoned = false; c.canAttack = true; });
    if (e.venom > 0) { this.applyDamage('opponent', e.venom); e.venom = Math.max(0, e.venom - 1); }
    if (this.checkGameOver()) return;

    let safety = 0;
    while (safety < 10) {
      safety++;
      const playable = e.hand.filter(c => c.cost <= e.mana);
      if (playable.length === 0) break;
      const card = playable[0];
      e.mana -= card.cost;
      e.hand = e.hand.filter(c => c.uid !== card.uid);
      e.cardsPlayed++; e.discardPile.push(card);
      this.resolveEffects(card, 'opponent');
      this.addLog(`Oponente: ${card.name}`, 'info');
      if (this.checkGameOver()) return;
    }
    if (!e.heroUsed && (!e.silencedTurns || e.silencedTurns <= 0) && e.mana >= 1) {
      e.mana -= 1; e.heroUsed = true;
      this.useHeroPowerFor('opponent');
      this.addLog('Oponente: poder de heroe', 'info');
    }
    this.runAttacks('opponent');
    if (this.checkGameOver()) return;
    this.state.turn++;
    this.startPlayerTurn();
  }

  // ===== MECANICAS =====
  drawCard(side) {
    const who = side === 'player' ? this.player : this.opponent;
    if (who.deck.length === 0) {
      if (who.discardPile.length === 0) return;
      who.deck = this.shuffle([...who.discardPile]); who.discardPile = [];
    }
    if (who.deck.length > 0) who.hand.push(who.deck.shift());
  }

  playCard(index) {
    if (this.state.phase !== 'player' || this.state.gameOver) return;
    const p = this.player;
    const card = p.hand[index];
    if (!card) return;

    if (card.resourceCost) {
      const rc = card.resourceCost;
      if (rc.type === 'blood') {
        if ((p.hp - rc.amount) < 1) {
          this.addLog('HP insuficiente para pagar sangre', 'sys');
          return;
        }
      } else if (rc.type === 'inspiration') {
        const required = rc.amount === 'all' ? p.inspiration : rc.amount;
        if (p.inspiration < required) {
          this.addLog('Inspiración insuficiente', 'sys');
          return;
        }
      }
    }

    const cost = Math.max(0, card.cost - (p.costReduction || 0));
    let discount = 0;
    if (card.costCondition) {
      const cond = this.checkCondition(card.costCondition, p, this.opponent);
      if (cond) discount = card.costCondition.discount || 0;
    }
    const finalCost = Math.max(0, cost - discount);
    if (finalCost > p.mana) return;

    const summonsNeeded = (card.effects || []).filter(e => e.type === 'summon').length;
    const freeSlots = 4 - p.board.length;
    if (summonsNeeded > 0 && freeSlots === 0) {
      this.addLog('Tablero lleno — no se puede invocar', 'sys');
      return;
    }
    if (summonsNeeded > 0 && freeSlots < summonsNeeded) {
      this.openSummonConfirm(card, index, freeSlots, summonsNeeded);
      return;
    }

    this.playCardAnimation(index);
    p.mana -= finalCost; p.hand.splice(index, 1); p.cardsPlayed++;
    if (card.effects && card.effects.some(e => e.type === 'swap_hands')) {
      card.returnAtEndOfTurn = true;
    }
    if (!card.consumable) p.discardPile.push(card);

    if (card.resourceCost) {
      const rc = card.resourceCost;
      if (rc.type === 'blood') {
        const before = p.hp;
        p.hp = Math.max(1, p.hp - rc.amount);
        const lost = before - p.hp;
        if (lost > 0) {
          this.showFloatingNumber(120, 72, `-${lost} HP`, '#ff6b6b');
          this.screenFlash('#ff6b6b');
        }
      }
    }

    const usesInspirationScale = (card.effects || []).some(e => e.scale === 'inspiration');
    if (card.resourceCost && card.resourceCost.type === 'inspiration' && !usesInspirationScale) {
      const amt = card.resourceCost.amount === 'all' ? p.inspiration : card.resourceCost.amount;
      p.inspiration = Math.max(0, p.inspiration - amt);
    }

    this.resolveEffects(card, 'player');

    if (card.resourceCost && card.resourceCost.type === 'inspiration' && usesInspirationScale) {
      const amt = card.resourceCost.amount === 'all' ? p.inspiration : card.resourceCost.amount;
      p.inspiration = Math.max(0, p.inspiration - amt);
    }

    this.addLog(`Juegas: ${card.name}`, 'info');
    p.costReduction = 0;
    if (this.checkGameOver()) return;
    this.renderAll();
  }

  openSummonConfirm(card, handIndex, freeSlots, summonsNeeded) {
    if (this.summonConfirmLayer) { this.summonConfirmLayer.destroy(true); this.summonConfirmLayer = null; }
    if (this.state.timerEvent) { this.state.timerEvent.remove(); this.state.timerEvent = null; }

    const W = 640, H = 360;
    const layer = this.add.container(0, 0).setDepth(5000);
    this.summonConfirmLayer = layer;

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7);
    layer.add(dim);

    const panel = this.add.rectangle(W / 2, H / 2, 280, 130, 0x16213e)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor('#faba72').color);
    layer.add(panel);

    layer.add(UI.text(this, W / 2, H / 2 - 40, 'TABLERO CASI LLENO', {
      fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#faba72'
    }).setOrigin(0.5));
    layer.add(UI.text(this, W / 2, H / 2 - 15, `Solo caben ${freeSlots} de ${summonsNeeded}`, {
      fontFamily: '"VT323"', fontSize: '16px', color: '#e0e0e0'
    }).setOrigin(0.5));
    layer.add(UI.text(this, W / 2, H / 2 + 5, 'invocaciones. ¿Continuar?', {
      fontFamily: '"VT323"', fontSize: '14px', color: '#9fcafd'
    }).setOrigin(0.5));

    const yesBtn = this.add.rectangle(W / 2 - 50, H / 2 + 40, 80, 24, 0x16213e)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor('#bdcd9c').color)
      .setInteractive({ useHandCursor: true });
    layer.add(yesBtn);
    layer.add(UI.text(this, W / 2 - 50, H / 2 + 40, 'INVOCAR', {
      fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#bdcd9c'
    }).setOrigin(0.5));

    const noBtn = this.add.rectangle(W / 2 + 50, H / 2 + 40, 80, 24, 0x16213e)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor('#ff6b6b').color)
      .setInteractive({ useHandCursor: true });
    layer.add(noBtn);
    layer.add(UI.text(this, W / 2 + 50, H / 2 + 40, 'CANCELAR', {
      fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#ff6b6b'
    }).setOrigin(0.5));

    yesBtn.on('pointerdown', () => {
      this.closeSummonConfirm();
      this.executePlayCardWithLimitedSummons(card, handIndex, freeSlots);
    });
    noBtn.on('pointerdown', () => {
      this.closeSummonConfirm();
      this.addLog('Carta cancelada', 'sys');
    });
  }

  closeSummonConfirm() {
    if (this.summonConfirmLayer) {
      this.summonConfirmLayer.destroy(true);
      this.summonConfirmLayer = null;
    }
    if (this.state.phase === 'player' && !this.state.gameOver && this.mode !== 'test') {
      this.startTimer();
    }
  }

  executePlayCardWithLimitedSummons(card, handIndex, freeSlots) {
    const p = this.player;
    const cost = Math.max(0, card.cost - (p.costReduction || 0));
    let discount = 0;
    if (card.costCondition) {
      const cond = this.checkCondition(card.costCondition, p, this.opponent);
      if (cond) discount = card.costCondition.discount || 0;
    }
    const finalCost = Math.max(0, cost - discount);
    if (finalCost > p.mana) return;

    this.playCardAnimation(handIndex);
    p.mana -= finalCost; p.hand.splice(handIndex, 1); p.cardsPlayed++;
    if (card.effects && card.effects.some(e => e.type === 'swap_hands')) {
      card.returnAtEndOfTurn = true;
    }
    if (!card.consumable) p.discardPile.push(card);

    if (card.resourceCost) {
      const rc = card.resourceCost;
      if (rc.type === 'blood') {
        const before = p.hp;
        p.hp = Math.max(1, p.hp - rc.amount);
        const lost = before - p.hp;
        if (lost > 0) {
          this.showFloatingNumber(120, 72, `-${lost} HP`, '#ff6b6b');
          this.screenFlash('#ff6b6b');
        }
      }
    }

    const usesInspirationScale = (card.effects || []).some(e => e.scale === 'inspiration');
    if (card.resourceCost && card.resourceCost.type === 'inspiration' && !usesInspirationScale) {
      const amt = card.resourceCost.amount === 'all' ? p.inspiration : card.resourceCost.amount;
      p.inspiration = Math.max(0, p.inspiration - amt);
    }

    let summonCount = 0;
    const limitedEffects = (card.effects || []).map(eff => {
      if (eff.type === 'summon' && summonCount < freeSlots) {
        summonCount++;
        return eff;
      }
      if (eff.type === 'summon' && summonCount >= freeSlots) {
        return null;
      }
      return eff;
    }).filter(x => x !== null);

    const limitedCard = { ...card, effects: limitedEffects };
    this.resolveEffects(limitedCard, 'player');
    this.addLog(`Juegas: ${card.name}`, 'info');
    p.costReduction = 0;
    if (this.checkGameOver()) return;
    this.renderAll();
  }

  resolveEffects(card, side) {
    const who = side === 'player' ? this.player : this.opponent;
    const enemy = side === 'player' ? this.opponent : this.player;
    if (!card.effects) return;
    let paused = false;
    for (let i = 0; i < card.effects.length; i++) {
      const eff = card.effects[i];
      if (eff.type === 'sacrifice' && who.board.length > 1 && side === 'player' && !this.state.targetingMode) {
        this.openSacrificeTargeting(card, side);
        paused = true;
        break;
      }
      this.applySingleEffect(eff, card, side);
    }
  }

  applySingleEffect(eff, card, side) {
    const who = side === 'player' ? this.player : this.opponent;
    const enemy = side === 'player' ? this.opponent : this.player;
    switch (eff.type) {
      case 'damage':
        if (eff.target === 'enemy_creature' || eff.target === 'any') {
          if (enemy.board.length > 0) {
            const tgtIdx = this.pickCreatureTarget(enemy.board);
            if (tgtIdx >= 0) {
              const target = enemy.board[tgtIdx];
              this.damageCreature(target, eff.amount);
              this.addLog(`${target.name}: -${eff.amount}`, 'dmg');
              if (this.getHp(target) <= 0) this.killCreature(enemy, tgtIdx);
              break;
            }
          }
          this.applyDamage(side === 'player' ? 'opponent' : 'player', eff.amount);
        } else if (eff.target === 'enemy_hero') {
          this.applyDamage(side === 'player' ? 'opponent' : 'player', eff.amount);
        }
        break;
      case 'heal':
        who.hp = Math.min(who.maxHp, who.hp + eff.amount);
        if (side === 'player') {
          this.showFloatingNumber(120, 72, `+${eff.amount} HP`, '#bdcd9c');
          this.screenFlash('#bdcd9c');
        }
        break;
      case 'armor':
        who.armor += eff.amount;
        if (side === 'player') {
          this.showFloatingNumber(120, 72, `+${eff.amount} ARM`, '#9fcafd');
          this.screenFlash('#9fcafd');
        }
        break;
      case 'draw': for (let i = 0; i < eff.amount; i++) this.drawCard(side); break;
      case 'venom': enemy.venom += eff.amount; break;
      case 'inspiration': who.inspiration += eff.amount; break;
      case 'summon':
        if (who.board.length < 4) {
          who.board.push({
            uid: Math.random().toString(36).slice(2, 8), cardId: card.id,
            name: card.name.replace('Invocar ', ''),
            atkBase: eff.atk, atkBoost: 0,
            hpBase: eff.hp, hpBoost: 0,
            maxHpBase: eff.hp, maxHpBoost: 0,
            canAttack: false, justSummoned: true,
            guard: !!eff.guard, evasive: !!eff.evasive, celerity: !!eff.celerity,
            deathrattle: eff.deathrattle || null,
            buffs: []
          });
          if (eff.celerity) who.board[who.board.length - 1].canAttack = true;
        }
        break;
      case 'damage_all_enemies':
        for (let i = enemy.board.length - 1; i >= 0; i--) {
          this.damageCreature(enemy.board[i], eff.amount);
          if (this.getHp(enemy.board[i]) <= 0) this.killCreature(enemy, i);
        }
        break;
      case 'freeze':
        const fIdx = this.pickCreatureTarget(enemy.board);
        if (fIdx >= 0) enemy.board[fIdx].canAttack = false;
        break;
      case 'weaken':
        const wIdx = this.pickCreatureTarget(enemy.board);
        if (wIdx >= 0) enemy.board[wIdx].atkBoost = Math.max(0, (enemy.board[wIdx].atkBoost || 0) - eff.amount);
        break;
      case 'fortify':
        const fortIdx = this.pickCreatureTarget(who.board);
        if (fortIdx >= 0) who.board[fortIdx].atkBoost = (who.board[fortIdx].atkBoost || 0) + eff.amount;
        break;
      case 'silence':
        const silTurns = eff.duration || 1;
        if (eff.target === 'self_hero') who.silencedTurns = (who.silencedTurns || 0) + silTurns;
        else if (eff.target === 'enemy_hero') enemy.silencedTurns = (enemy.silencedTurns || 0) + silTurns;
        break;
      case 'cost_reduction': who.costReduction = (who.costReduction || 0) + eff.amount; break;
      case 'board_buff':
        who.board.forEach(c => {
          c.atkBoost = (c.atkBoost || 0) + eff.atk;
          if (!c.buffs) c.buffs = [];
          c.buffs.push({ type: 'atk', amount: eff.atk, duration: eff.duration || 'turn', source: 'board_buff' });
        });
        break;
      case 'damage_conditional':
        let dmg = eff.base;
        if (eff.condition === 'enemy_venom' && enemy.venom > 0) dmg += eff.bonus;
        this.applyDamage(side === 'player' ? 'opponent' : 'player', dmg);
        break;
      case 'conditional':
        const cond = this.checkCondition(eff.condition, who, enemy);
        const effects = cond ? eff.trueEffects : (eff.falseEffects || []);
        effects.forEach(sub => this.applySingleEffect(sub, card, side));
        break;
      case 'sacrifice':
        if (who.board.length === 0) {
          this.addLog('Nada que sacrificar', 'sys');
        } else {
          this.killCreature(who, 0);
        }
        break;
      case 'discard_random':
        let count = 1;
        if (eff.scale === 'inspiration') count = who.inspiration;
        for (let i = 0; i < count && enemy.hand.length > 0; i++) {
          enemy.hand.splice(Math.floor(Math.random() * enemy.hand.length), 1);
        }
        break;
      case 'swap_hands': const tmp = who.hand; who.hand = enemy.hand; enemy.hand = tmp; break;
      case 'copy_card':
        if (enemy.discardPile.length > 0) {
          const last = enemy.discardPile[enemy.discardPile.length - 1];
          who.hand.push({ ...last, uid: Math.random().toString(36).slice(2, 8) });
          this.addLog(`Bis: copia ${last.name}`, 'info');
        } else {
          this.addLog('Bis: el oponente no tiene cartas', 'sys');
        }
        break;
    }
  }

  openSacrificeTargeting(card, side) {
    this.state.targetingMode = {
      card, side,
      effectType: 'sacrifice',
      remainingEffects: card.effects.slice(card.effects.findIndex(e => e.type === 'sacrifice') + 1)
    };
    if (this.state.timerEvent) { this.state.timerEvent.remove(); this.state.timerEvent = null; }
    if (this.menuOpen) return;
    this.renderBoards();
    this.renderTargetingPrompt();
  }

  renderTargetingPrompt() {
    if (this.targetingPrompt) { this.targetingPrompt.destroy(true); this.targetingPrompt = null; }
    this.targetingPrompt = UI.text(this, 320, 220, 'SELECCIONA CRIATURA A SACRIFICAR', {
      fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#ff6b6b',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(1500);
  }

  handleTargetingClick(creature, board) {
    if (!this.state.targetingMode) return false;
    const tm = this.state.targetingMode;
    if (tm.effectType === 'sacrifice') {
      const idx = board.indexOf(creature);
      if (idx < 0) return false;
      const who = tm.side === 'player' ? this.player : this.opponent;
      this.killCreature(who, idx);
      this.addLog(`Sacrificaste ${creature.name}`, 'info');
      const remaining = tm.remainingEffects || [];
      this.state.targetingMode = null;
      if (this.targetingPrompt) { this.targetingPrompt.destroy(true); this.targetingPrompt = null; }
      if (remaining.length > 0) {
        this.resolveEffects({ effects: remaining }, tm.side);
      }
      if (this.checkGameOver()) return true;
      this.renderAll();
      if (this.state.phase === 'player' && this.mode !== 'test') this.startTimer();
      return true;
    }
    return false;
  }

  cancelTargeting() {
    if (!this.state.targetingMode) return;
    const tm = this.state.targetingMode;
    const who = tm.side === 'player' ? this.player : this.opponent;
    const cardIdx = who.discardPile.indexOf(tm.card);
    if (cardIdx >= 0) who.discardPile.splice(cardIdx, 1);
    if (who.hand.length < 8) {
      who.hand.push(tm.card);
      this.addLog(`${tm.card.name} regresa a tu mano`, 'sys');
    } else {
      who.discardPile.push(tm.card);
      this.addLog(`${tm.card.name} al descarte (mano llena)`, 'sys');
    }
    this.state.targetingMode = null;
    if (this.targetingPrompt) { this.targetingPrompt.destroy(true); this.targetingPrompt = null; }
    this.renderAll();
    if (this.state.phase === 'player' && this.mode !== 'test') this.startTimer();
  }

  checkCondition(cond, who, enemy) {
    switch (cond.type) {
      case 'self_armor_gte': return who.armor >= cond.value;
      case 'enemy_venom': return enemy.venom > 0;
      case 'enemy_venom_gte': return enemy.venom >= cond.value;
      case 'self_inspiration_gte': return who.inspiration >= cond.value;
      case 'cards_played_gte': return who.cardsPlayed >= cond.value;
      default: return false;
    }
  }

  killCreature(owner, index) {
    const c = owner.board[index];
    if (!c) return;
    if (c.deathrattle === 'draw') this.drawCard(owner === this.player ? 'player' : 'opponent');
    owner.board.splice(index, 1);
  }

  applyDamage(side, amount) {
    const who = side === 'player' ? this.player : this.opponent;
    let armorAbsorbed = 0;
    if (who.armor > 0) {
      if (amount <= who.armor) { armorAbsorbed = amount; who.armor -= amount; amount = 0; }
      else { armorAbsorbed = who.armor; amount -= who.armor; who.armor = 0; }
    }
    who.hp -= amount;
    const isPlayer = side === 'player';
    const label = isPlayer ? 'Tú' : 'Oponente';
    if (armorAbsorbed > 0) {
      this.addLog(`${label}: -${armorAbsorbed} ARM`, 'sys');
    }
    if (amount > 0) {
      this.showFloatingNumber(isPlayer ? 120 : 520, 72, `-${amount}`, '#ff6b6b');
      this.screenFlash('#ff6b6b');
      this.shakeContainer(isPlayer ? this.pInfoContainer : this.eInfoContainer);
      this.addLog(`${label}: -${amount} HP`, 'dmg');
      const hero = isPlayer ? this.pHero : this.eHero;
      if (hero && hero.available) hero.setState('hurt');
    }
  }

  combat(attacker, defender, side) {
    const atkAttack = this.getAtk(attacker);
    const defAttack = this.getAtk(defender);
    this.damageCreature(defender, atkAttack);
    this.damageCreature(attacker, defAttack);
    this.addLog(`${attacker.name} vs ${defender.name}`, 'dmg');
    if (this.getHp(defender) <= 0) {
      const owner = side === 'player' ? this.opponent : this.player;
      const idx = owner.board.indexOf(defender);
      if (idx >= 0) this.killCreature(owner, idx);
    }
    if (this.getHp(attacker) <= 0) {
      const owner = side === 'player' ? this.player : this.opponent;
      const idx = owner.board.indexOf(attacker);
      if (idx >= 0) this.killCreature(owner, idx);
    }
  }

  damageCreature(c, amount) {
    if (amount <= 0) return;
    let remaining = amount;
    if (c.armor && c.armor > 0) {
      if (remaining <= c.armor) { c.armor -= remaining; remaining = 0; }
      else { remaining -= c.armor; c.armor = 0; }
    }
    if (remaining > 0) {
      c.hpBase = (c.hpBase || 0) - remaining;
    }
  }

  useHeroPower() {
    if (this.state.phase !== 'player' || this.state.gameOver) return;
    const p = this.player;
    if (p.heroUsed) { this.addLog('Poder ya usado', 'sys'); return; }
    if (p.silencedTurns && p.silencedTurns > 0) { this.addLog('Héroe silenciado', 'sys'); return; }
    if (p.mana < this.cls.heroPower.cost) { this.addLog('Maná insuficiente', 'sys'); return; }
    p.mana -= this.cls.heroPower.cost; p.heroUsed = true;
    this.useHeroPowerFor('player');
    this.addLog(`Poder de heroe: ${this.cls.heroPower.name}`, 'info');
    if (this.pHero && this.pHero.available) this.pHero.setState('attack');
    this.renderAll();
  }

  useHeroPowerFor(side) {
    const who = side === 'player' ? this.player : this.opponent;
    const enemy = side === 'player' ? this.opponent : this.player;
    const cls = CLASSES.find(c => c.id === who.classId);
    if (!cls) return;
    const isPlayer = side === 'player';
    this.showFloatingNumber(isPlayer ? 120 : 520, 100, cls.heroPower.name, '#faba72');
    switch (cls.id) {
      case 'mago': this.applyDamage(isPlayer ? 'opponent' : 'player', 2); break;
      case 'necromancer':
        if (who.board.length < 4)
          who.board.push({
            uid: Math.random().toString(36).slice(2, 8), cardId: 'n_esqueleto',
            name: 'Esqueleto',
            atkBase: 1, atkBoost: 0, hpBase: 1, hpBoost: 0,
            maxHpBase: 1, maxHpBoost: 0,
            canAttack: false, justSummoned: true, buffs: []
          });
        break;
      case 'guerrero':
        const gIdx = this.pickCreatureTarget(enemy.board);
        if (gIdx >= 0) {
          this.damageCreature(enemy.board[gIdx], 1);
          if (this.getHp(enemy.board[gIdx]) <= 0) this.killCreature(enemy, gIdx);
        }
        who.armor += 1;
        this.showFloatingNumber(isPlayer ? 120 : 520, 72, `+1 ARM`, '#9fcafd');
        this.screenFlash('#9fcafd');
        break;
      case 'asesino': this.applyDamage(isPlayer ? 'opponent' : 'player', 1 + (enemy.venom > 0 ? 1 : 0)); break;
      case 'bardo': this.applyDamage(isPlayer ? 'opponent' : 'player', 1); break;
    }
  }

  checkGameOver() {
    if (!this.state) return false;
    if (this.player.hp <= 0 || this.opponent.hp <= 0) {
      const playerWon = this.opponent.hp <= 0;
      this.state.gameOver = true;
      if (this.state.timerEvent) this.state.timerEvent.remove();
      if (this.pHero && this.pHero.available) this.pHero.setState(playerWon ? 'victory' : 'defeat');
      if (this.eHero && this.eHero.available) this.eHero.setState(playerWon ? 'defeat' : 'victory');
      const payload = {
        win: playerWon, turn: this.state.turn,
        damageTaken: this.player.maxHp - this.player.hp,
        cardsPlayed: this.player.cardsPlayed, hpLeft: Math.max(0, this.player.hp), mode: this.mode,
        classId: this.selectedClass, slotIndex: this.slotIndex || 0
      };
      if (this.mode === 'campaign') {
        const stages = window.CAMPAIGN_STAGES || [];
        const stage = stages[this.campaignStage] || {};
        payload.campaignStage = this.campaignStage;
        payload.campaignName = stage.name;
        payload.campaignTotal = stages.length;
        if (playerWon) {
          const isLast = this.campaignStage >= stages.length - 1;
          payload.campaignWon = true;
          payload.campaignLast = isLast;
          // curación entre etapas (nunca sobre el maxHp)
          const healed = Math.min(this.player.hp + (window.CAMPAIGN_HEAL || 5), this.player.maxHp);
          payload.campaignNextStage = this.campaignStage + 1;
          payload.campaignHp = healed;
        }
      }
      this.time.delayedCall(500, () => {
        this.scene.start('GameOverScene', payload);
      });
      return true;
    }
    return false;
  }

  addLog(msg, type) {
    this.state.log.push({ msg, type, turn: this.state.turn });
    this.pushLogLine(msg, type);
  }

  pushLogLine(msg, type) {
    if (!this.logList) return;
    const color = type === 'dmg' ? '#ff6b6b' : type === 'sys' ? '#faba72' : type === 'info' ? '#9fcafd' : '#bdcd9c';

    const line = UI.text(this, 0, 0, msg, {
      fontFamily: '"VT323"', fontSize: '12px', color: color,
      stroke: '#000000', strokeThickness: 1,
      wordWrap: { width: this.logPanelW - 8 }
    }).setOrigin(0, 0);
    this.logList.add(line);

    this.reflowLog();
  }

  reflowLog() {
    if (!this.logList) return;

    while (this.state.log.length > this.logMaxLines) {
      this.state.log.shift();
      const first = this.logList.list[0];
      if (first) { first.destroy(); this.logList.remove(first); }
    }

    const items = this.logList.list.slice();
    let y = 2;
    for (const item of items) {
      item.y = y;
      y += item.height + 2;
    }
    const totalH = y;
    const visibleH = this.logPanelH - 4;
    const maxScroll = Math.max(0, totalH - visibleH);

    if (this.logScrollY >= this.maxLogScroll - 0.5) {
      this.logScrollY = maxScroll;
    }
    this.logScrollY = Math.min(this.logScrollY, maxScroll);
    this.maxLogScroll = maxScroll;

    this.logList.y = this.logPanelY - this.logScrollY;

    const panelTop = this.logPanelY;
    const panelBottom = this.logPanelY + this.logPanelH;
    for (const item of items) {
      const worldY = this.logList.y + item.y;
      const visible = worldY >= panelTop && worldY < panelBottom;
      item.setVisible(visible);
    }
  }

  // ===== ANIMATIONS =====
  playCardAnimation(handIndex) {
    const children = this.handContainer.list;
    const source = children[handIndex];
    if (!source) return;
    const card = this.player.hand[handIndex];
    if (!card) return;
    const clone = CardFactory.Card(this, {
      card, count: 1, inDeck: true, classColor: this.cls.colorHex, mode: 'grid'
    });
    clone.setPosition(source.x, source.y);
    clone.setDepth(1001);
    this.fxContainer.add(clone);
    this.tweens.add({
      targets: clone,
      x: 320, y: 160, scale: 1.1,
      duration: 400, ease: 'Cubic.easeOut',
      onComplete: () => clone.destroy()
    });
  }

  showFloatingNumber(x, y, text, colorHex) {
    const t = UI.text(this, x, y, text, {
      fontFamily: '"VT323"', fontSize: '20px', color: colorHex,
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5).setDepth(1002);
    this.fxContainer.add(t);
    this.tweens.add({
      targets: t, y: y - 24, alpha: 0,
      duration: 800, ease: 'Cubic.easeIn',
      onComplete: () => t.destroy()
    });
  }

  screenFlash(colorHex) {
    const c = Phaser.Display.Color.HexStringToColor(colorHex).color;
    const r = this.add.rectangle(320, 180, 640, 360, c, 0.25).setDepth(1001);
    this.fxContainer.add(r);
    this.tweens.add({
      targets: r, alpha: 0,
      duration: 250, ease: 'Cubic.easeOut',
      onComplete: () => r.destroy()
    });
  }

  shakeContainer(container) {
    if (!container || container.list.length === 0) return;
    this.tweens.add({
      targets: container, x: container.x + 2,
      duration: 60, yoyo: true, repeat: 2,
      onComplete: () => { if (container.active) container.x -= 2; }
    });
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  toggleMenu() {
    if (this.state.gameOver) return;
    if (this.helpBusy) {
      const H = window.HelpSystem;
      if (H && H.getManager(this)) H.getManager(this).closeOverlay();
      return;
    }
    if (this.menuOpen) this.closeMenu();
    else this.openMenu();
  }

  openMenu() {
    if (this.menuOpen) return;
    this.menuOpen = true;
    if (this.state.timerEvent) { this.state.timerEvent.remove(); this.state.timerEvent = null; }
    if (window.HelpSystem) window.HelpSystem.getManager(this).setModal(true);
    this.hideCreatureCard();
    this.tweens.killTweensOf(this.handContainer.list);
    this.collapseHand();
    this.handZones.forEach(z => z.disableInteractive());

    const W = 640, H = 360;
    const layer = this.add.container(W / 2, H / 2);
    this.modalLayer.add(layer);
    this.menuOverlay = layer;

    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.6)
      .setInteractive({ useHandCursor: false });
    dim.on('pointerdown', () => this.closeMenu());
    layer.add(dim);

    const panel = this.add.rectangle(0, 0, 240, 200, 0x16213e)
      .setStrokeStyle(2, 0xfaba72);
    layer.add(panel);

    const titleTxt = UI.text(this, 0, -80, 'MENU', {
      fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#faba72'
    }).setOrigin(0.5);
    layer.add(titleTxt);

    const continueBtn = UI.button(this, 0, -34, 'CONTINUAR', '#bdcd9c',
      () => this.closeMenu(), { layer: this.uiLayer, minWidth: 160, height: 26, fontSize: '8px' });
    layer.add(continueBtn.container);

    const surrenderBtn = UI.button(this, 0, 6, 'RENDIRSE', '#ff6b6b',
      () => this.surrender(), { layer: this.uiLayer, minWidth: 160, height: 26, fontSize: '8px' });
    layer.add(surrenderBtn.container);

    // Botón de ayuda: alterna las burbujas de ayuda (también tecla H)
    const helpOn = window.HelpSystem ? window.HelpSystem.getManager(this).isEnabled() : true;
    const helpBtn = UI.button(this, 0, 48, helpOn ? 'BURBUJAS: ON' : 'BURBUJAS: OFF',
      helpOn ? '#bdcd9c' : '#8892a0',
      () => { this.toggleHelpBubbles(); this.refreshMenuHelpBtn(helpBtn); },
      { layer: this.uiLayer, minWidth: 160, height: 22, fontSize: '7px' });
    layer.add(helpBtn.container);
    this._menuHelpBtn = helpBtn;
  }

  refreshMenuHelpBtn(btn) {
    if (!btn) return;
    const on = window.HelpSystem ? window.HelpSystem.getManager(this).isEnabled() : true;
    btn.text.setText(on ? 'BURBUJAS: ON' : 'BURBUJAS: OFF');
    btn.bg.setFillStyle(on ? 0x16213e : 0x16213e);
    btn.text.setColor(on ? '#bdcd9c' : '#8892a0');
  }

  closeMenu() {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    if (this.menuOverlay) { this.menuOverlay.destroy(true); this.menuOverlay = null; }
    if (window.HelpSystem) window.HelpSystem.getManager(this).setModal(false);
    this.handZones.forEach((z, i) => {
      const entry = this.handCards[i];
      if (entry && entry.canPlay) z.setInteractive({ useHandCursor: true });
    });
    if (this.state.phase === 'player' && !this.state.gameOver && this.mode !== 'test') {
      this.startTimer();
    }
  }

  surrender() {
    if (this.state.timerEvent) { this.state.timerEvent.remove(); this.state.timerEvent = null; }
    if (this.menuOverlay) { this.menuOverlay.destroy(true); this.menuOverlay = null; }
    this.menuOpen = false;
    if (window.HelpSystem) window.HelpSystem.getManager(this).setModal(false);
    if (this.mode === 'test') {
      this.scene.start('MenuScene');
    } else {
      const payload = {
        win: false,
        turn: this.state.turn,
        damageTaken: this.player.maxHp - this.player.hp,
        cardsPlayed: this.player.cardsPlayed,
        hpLeft: 0,
        mode: this.mode,
        classId: this.selectedClass,
        slotIndex: this.slotIndex || 0
      };
      if (this.mode === 'campaign') {
        const stages = window.CAMPAIGN_STAGES || [];
        const stage = stages[this.campaignStage] || {};
        payload.campaignStage = this.campaignStage;
        payload.campaignName = stage.name;
        payload.campaignTotal = stages.length;
      }
      this.scene.start('GameOverScene', payload);
    }
  }
}

window.GameScene = GameScene;