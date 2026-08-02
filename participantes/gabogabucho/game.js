const {
  cameraSpeed,
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
  pistonYAt,
  rotorAngleAt,
  nextLevelId,
  campaignTotal,
  freshLevelState
} = LastreModel;

const COLORS = {
  sky: 0x111820,
  horizon: 0x253039,
  ground: 0x252b2d,
  asphalt: 0x31383a,
  stone: 0x535a59,
  stoneEdge: 0x8c9691,
  core: 0xf7fbff,
  glow: 0x6fe7ff,
  copper: 0xb86f43,
  steel: 0x87918f,
  rust: 0x8f4e32,
  danger: 0xff5263,
  sign: 0xf1c75b,
  scraper: 0xf29b38
};

class LastreScene extends Phaser.Scene {
  constructor() {
    super('LastreScene');
  }

  static sharedSound() {
    if (!LastreScene.soundInstance) LastreScene.soundInstance = new LastreSound();
    return LastreScene.soundInstance;
  }

  init(data) {
    const campaign = data || {};
    let levelId = campaign.levelId;
    if (!levelId) {
      const qs = new URLSearchParams(location.search);
      const levelParam = qs.get('level');
      levelId = levelParam === '2' ? 'level2' : 'level1';
    }
    this.levelId = levelId;
    this.campaignScore = campaign.campaignScore || 0;
    this.levelResults = campaign.levelResults || [];
    this.level = LastreModel.levelConfig(this.levelId);
  }

  create() {
    this.W = 800;
    this.H = 450;
    Object.assign(this, freshLevelState(), { collected: new Set() });
    this.ignoreJumpUntilRelease = false;
    this.boostRadius = 120;
    this.paused = false;
    this.pausedAt = 0;
    this.pauseLayer = [];
    this.sfx = LastreScene.sharedSound();
    this.trackLength = this.level.trackLength;
    this.destinationX = this.level.destinationX;
    this.scraperPositions = this.level.scrapers;

    this.makeBackdrop();
    this.dangerLine = this.add.rectangle(20, this.H / 2, 4, this.H, COLORS.danger, 0.72)
      .setScrollFactor(0).setDepth(90);
    this.makeTrack();
    this.makeWorldZones();
    this.makeBlob();
    this.makeSoftMatter();
    this.makeStoneGates();
    this.makeScrapers();
    this.mechanicalPistons = [];
    this.mechanicalRotors = [];
    this.mechanicalPaint = this.add.graphics().setDepth(16);
    if (this.levelId === 'level2') this.makeMechanicalDistrict();

    this.keys = this.input.keyboard.addKeys({
      leftA: Phaser.Input.Keyboard.KeyCodes.A,
      rightD: Phaser.Input.Keyboard.KeyCodes.D,
      leftArrow: Phaser.Input.Keyboard.KeyCodes.LEFT,
      rightArrow: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      jump: Phaser.Input.Keyboard.KeyCodes.SPACE
    });
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.input.keyboard.on('keydown-M', () => this.toggleMute());

    this.matter.world.on('collisionstart', event => this.onCollision(event, true));
    this.matter.world.on('collisionactive', event => this.onCollision(event, false));

    this.blobPaint = this.add.graphics().setDepth(20);
    this.boostAura = this.add.graphics().setDepth(18);
    this.fieldEffect = this.add.graphics().setDepth(17);
    this.hud = this.add.text(18, 16, '', {
      fontFamily: 'Courier New', fontSize: '14px', color: '#dbe8ed'
    }).setScrollFactor(0).setDepth(100);
    this.warning = this.add.text(18, 39, '', {
      fontFamily: 'Courier New', fontSize: '12px', color: '#ff5263'
    }).setScrollFactor(0).setDepth(100);
    this.zoneHud = this.add.text(18, 60, '', {
      fontFamily: 'Courier New', fontSize: '12px', color: '#6fe7ff', fontStyle: 'bold'
    }).setScrollFactor(0).setDepth(100);
    this.routeHud = this.add.text(782, 18, '', {
      fontFamily: 'Courier New', fontSize: '12px', color: '#f1c75b', align: 'right'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.showIntro();
    this.matter.world.pause();
    this.input.keyboard.on('keydown-ENTER', () => this.confirmMenu(false));
    this.input.keyboard.on('keydown-SPACE', () => this.confirmMenu(true));
    this.input.keyboard.on('keydown-UP', () => this.moveMenu(-1));
    this.input.keyboard.on('keydown-W', () => this.moveMenu(-1));
    this.input.keyboard.on('keydown-DOWN', () => this.moveMenu(1));
    this.input.keyboard.on('keydown-S', () => this.moveMenu(1));
    this.input.on('pointerdown', () => this.confirmMenu(false));

    const qs = new URLSearchParams(location.search);
    this.debugMode = qs.has('debug');
    if (this.debugMode) window.__lastre = this;
    const forcedGrowth = Math.min(12, Math.max(0, Number(qs.get('grow')) || 0));
    for (let i = 0; i < forcedGrowth; i++) {
      const angle = -1.15 + i * 0.63;
      const distance = 20 + (i % 3) * 5;
      this.addBlobPart(
        this.blob.position.x + Math.cos(angle) * distance,
        this.blob.position.y + Math.sin(angle) * distance,
        scrapSpecForIndex(i)
      );
    }
    if (qs.has('shed')) {
      const side = qs.get('shed') === 'left' ? -1 : 1;
      this.shedAt({ x: this.blob.position.x + side * 100, y: this.blob.position.y });
    }
    const qa = qs.get('qa');
    if (qa) {
      const targets = this.level.qa;
      const target = targets[qa];
      if (target) {
        this.matter.body.setPosition(this.blob, { x: target[0], y: 330 });
        this.cameras.main.scrollX = target[1];
        this.startGame(false);
      }
    }
    if (qs.has('autostart')) this.startGame(false);
  }

  showIntro() {
    this.menuIndex = 0;
    const panel = this.add.rectangle(400, 225, 800, 450, 0x05090d, 0.9)
      .setScrollFactor(0).setDepth(200);
    const isLevel2 = this.levelId === 'level2';
    const title = this.add.text(400, 70, isLevel2 ? 'DISTRITO MECANICO' : 'MR. LASTRE', {
      fontFamily: 'Courier New', fontSize: isLevel2 ? '30px' : '34px', color: '#f7fbff', fontStyle: 'bold',
      stroke: '#17323b', strokeThickness: 6
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    const story = this.add.text(400, 130,
      isLevel2
        ? 'CRUZA LA FABRICA\nLEE EL RITMO DE LAS MAQUINAS'
        : 'SOS UN IMÁN PERDIDO EN LA CIUDAD\nLLEVA LA CHATARRA AL BASURERO', {
        fontFamily: 'Courier New', fontSize: '17px', color: '#f1c75b', align: 'center',
        lineSpacing: 7
      }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    const rules = this.add.text(400, 218,
      'A / D   INCLINARTE\nESPACIO   PULSO\n\nEL METAL SE PEGA  ·  LA PIEDRA TE ALIGERA\nNO DEJES QUE EL BORDE ROJO TE ALCANCE', {
        fontFamily: 'Courier New', fontSize: '14px', color: '#dbe8ed', align: 'center',
        lineSpacing: 8
      }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    if (isLevel2) {
      const start = this.add.text(400, 377, 'ESPACIO / ENTER / CLICK PARA EMPEZAR', {
        fontFamily: 'Courier New', fontSize: '14px', color: '#6fe7ff'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
      this.tweens.add({ targets: start, alpha: 0.35, yoyo: true, repeat: -1, duration: 620 });
      this.introLayer = [panel, title, story, rules, start];
      return;
    }

    this.menuOptions = [
      { label: 'CAMPAÑA COMPLETA', sub: 'CIUDAD  →  DISTRITO MECANICO', color: '#6fe7ff' },
      { label: 'NIVEL 2 DIRECTO', sub: 'ENTRENAMIENTO EN LA FABRICA', color: '#f1c75b' }
    ];
    this.menuCursor = this.add.text(0, 0, '▶', {
      fontFamily: 'Courier New', fontSize: '18px', color: '#6fe7ff', fontStyle: 'bold'
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(203);
    this.menuTexts = [];
    this.menuOptions.forEach((option, index) => {
      const y = 300 + index * 46;
      const text = this.add.text(400, y, `${option.label}\n${option.sub}`, {
        fontFamily: 'Courier New', fontSize: '14px', color: '#69808b', align: 'center',
        lineSpacing: 5, fontStyle: 'bold'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(202);
      this.menuTexts.push(text);
    });
    this.menuHint = this.add.text(400, 412, '↑↓ ELEGIR   ·   ENTER / ESPACIO / CLICK PARA EMPEZAR', {
      fontFamily: 'Courier New', fontSize: '13px', color: '#6fe7ff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.tweens.add({ targets: this.menuHint, alpha: 0.35, yoyo: true, repeat: -1, duration: 620 });
    this.introLayer = [panel, title, story, rules, this.menuCursor, ...this.menuTexts, this.menuHint];
    this.renderMenu();
  }

  renderMenu() {
    if (this.levelId === 'level2' || !this.menuTexts) return;
    this.menuOptions.forEach((option, index) => {
      const active = index === this.menuIndex;
      const text = this.menuTexts[index];
      text.setColor(active ? option.color : '#69808b');
      text.setScale(active ? 1.04 : 1);
    });
    const y = 300 + this.menuIndex * 46 + 6;
    this.menuCursor.setPosition(268, y);
    this.menuCursor.setColor(this.menuOptions[this.menuIndex].color);
  }

  moveMenu(delta) {
    if (this.started || this.levelId === 'level2') return;
    const next = (this.menuIndex + delta + this.menuOptions.length) % this.menuOptions.length;
    if (next === this.menuIndex) return;
    this.menuIndex = next;
    this.renderMenu();
  }

  confirmMenu(startedWithSpace) {
    if (this.started) return;
    if (this.levelId === 'level1' && this.menuIndex === 1) {
      this.scene.start('LastreScene', { levelId: 'level2', campaignScore: 0, levelResults: [] });
      return;
    }
    this.startGame(startedWithSpace);
  }

  startGame(startedWithSpace) {
    if (this.started) return;
    this.started = true;
    this.startedAt = this.time.now;
    this.ignoreJumpUntilRelease = startedWithSpace;
    this.sfx.ensure();
    this.sfx.menu();
    this.matter.world.resume();
    for (const item of this.introLayer) item.destroy();
    this.introLayer = [];
  }

  togglePause() {
    if (!this.started || this.dead || this.finished) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.pausedAt = this.time.now;
      this.matter.world.pause();
      this.showPauseOverlay();
      return;
    }
    this.startedAt += this.time.now - this.pausedAt;
    this.matter.world.resume();
    this.hidePauseOverlay();
  }

  showPauseOverlay() {
    const veil = this.add.rectangle(400, 225, 800, 450, 0x05070b, 0.66)
      .setScrollFactor(0).setDepth(210);
    const title = this.add.text(400, 202, 'PAUSA', {
      fontFamily: 'Courier New', fontSize: '32px', color: '#6fe7ff', fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(211);
    const hint = this.add.text(400, 250, 'P CONTINUA  ·  M SONIDO  ·  R REINICIA', {
      fontFamily: 'Courier New', fontSize: '14px', color: '#dbe8ed'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(211);
    this.pauseLayer = [veil, title, hint];
  }

  hidePauseOverlay() {
    for (const item of this.pauseLayer) item.destroy();
    this.pauseLayer = [];
  }

  toggleMute() {
    const muted = this.sfx.toggleMute();
    const notice = this.add.text(400, 96, muted ? 'SONIDO APAGADO' : 'SONIDO ENCENDIDO', {
      fontFamily: 'Courier New', fontSize: '15px', color: '#6fe7ff', fontStyle: 'bold',
      stroke: '#05090d', strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(212);
    this.tweens.add({
      targets: notice, alpha: 0, duration: 1100, ease: 'Cubic.easeIn',
      onComplete: () => notice.destroy()
    });
    if (!muted) this.sfx.menu();
  }

  makeBackdrop() {
    if (this.levelId === 'level2') {
      this.makeFactoryBackdrop();
      return;
    }
    this.add.rectangle(400, 225, 800, 450, COLORS.sky).setScrollFactor(0);
    this.add.circle(650, 92, 54, 0xe8c787, 0.16).setScrollFactor(0);

    const far = this.add.graphics().setScrollFactor(0.12).setDepth(0);
    far.fillStyle(0x1a252d, 1);
    for (let x = -400; x < this.trackLength + 800; x += 180) {
      const h = 80 + ((x / 180) % 4) * 20;
      far.fillRect(x, 315 - h, 145, h);
      far.fillRect(x + 28, 195 - h, 12, 36);
      far.fillStyle(0x8ba29e, 0.16);
      for (let wy = 252 - h; wy < 300; wy += 22) far.fillRect(x + 16, wy, 12, 7);
      far.fillStyle(0x1a252d, 1);
    }

    const near = this.add.graphics().setScrollFactor(0.38).setDepth(1);
    near.fillStyle(0x202b30, 1);
    for (let x = -250; x < this.trackLength + 900; x += 430) {
      near.fillRect(x, 270, 260, 110);
      near.fillRect(x + 35, 235, 26, 35);
      near.fillStyle(0xc18249, 0.22);
      near.fillRect(x + 28, 292, 45, 28);
      near.fillRect(x + 96, 292, 45, 28);
      near.fillStyle(0x202b30, 1);
    }
  }

  makeFactoryBackdrop() {
    this.add.rectangle(400, 225, 800, 450, 0x16161a).setScrollFactor(0);

    const far = this.add.graphics().setScrollFactor(0.12).setDepth(0);
    far.fillStyle(0x1c1a20, 1);
    for (let x = -400; x < this.trackLength + 800; x += 160) {
      far.fillRect(x, 130, 130, 185);
      far.fillRect(x + 26, 96, 24, 34);
      far.fillStyle(0x2b2329, 1);
      far.fillCircle(x + 52, 92, 18);
      far.fillStyle(0x1c1a20, 1);
    }

    const beams = this.add.graphics().setScrollFactor(0.5).setDepth(1);
    beams.fillStyle(0x2a252b, 1);
    for (let x = -200; x < this.trackLength + 500; x += 260) {
      beams.fillRect(x, 118, 200, 16);
      beams.fillRect(x + 84, 134, 10, 180);
    }

    const pipes = this.add.graphics().setScrollFactor(0.7).setDepth(1);
    pipes.lineStyle(7, 0x4a3f47, 1);
    pipes.lineBetween(0, 86, this.trackLength, 86);
    pipes.lineStyle(5, 0x8f5a48, 0.9);
    pipes.lineBetween(0, 74, this.trackLength, 74);

    this.add.rectangle(400, 200, 800, 240, 0x1d181c, 0.35).setScrollFactor(0).setDepth(0);
  }

  makeTrack() {
    this.add.rectangle(this.trackLength / 2, 420, this.trackLength, 80, COLORS.ground).setDepth(2);
    this.add.rectangle(this.trackLength / 2, 395, this.trackLength, 30, COLORS.asphalt).setDepth(2);
    const groundBody = this.matter.bodies.rectangle(this.trackLength / 2, 420, this.trackLength, 80, {
      isStatic: true, label: 'ground', friction: 0.95
    });
    groundBody.plugin.isGround = true;
    this.matter.world.add(groundBody);

    const edge = this.add.graphics().setDepth(3);
    edge.lineStyle(2, 0x52636c, 0.9);
    edge.lineBetween(0, 380, this.trackLength, 380);
    edge.lineStyle(3, 0xd9b957, 0.28);
    for (let x = 80; x < this.trackLength; x += 140) edge.lineBetween(x, 402, x + 62, 402);

    if (this.levelId === 'level1') {
      for (let x = 700; x < this.destinationX; x += 1180) this.makeStreetSign(x);
    }
    this.makeLandfill(this.destinationX, this.level.destinationLabel);
  }

  makeWorldZones() {
    if (this.levelId === 'level1') {
      this.makeConstructionZone();
      this.makeElectromagneticZone();
      this.makeBoostPickup(this.level.boostPickupX);
    }
  }

  makeZoneSign(x, title, subtitle, color) {
    const sign = this.add.graphics().setDepth(10);
    sign.fillStyle(0x41494a, 1);
    sign.fillRect(x - 4, 292, 8, 88);
    sign.fillStyle(color, 1);
    sign.fillRoundedRect(x - 88, 252, 176, 60, 5);
    sign.lineStyle(4, 0x222829, 1);
    sign.strokeRoundedRect(x - 88, 252, 176, 60, 5);
    this.add.text(x, 268, `${title}\n${subtitle}`, {
      fontFamily: 'Courier New', fontSize: '12px', color: '#202526', align: 'center',
      fontStyle: 'bold', lineSpacing: 3
    }).setOrigin(0.5).setDepth(11);
  }

  makeConstructionZone() {
    this.makeZoneSign(5050, 'ZONA DE OBRA', 'PELIGRO: CARGA MÓVIL', 0xf1c75b);
    const scenery = this.add.graphics().setDepth(4);
    scenery.lineStyle(7, 0xb68146, 0.92);
    for (const x of [5220, 5480, 6320, 6640]) {
      scenery.lineBetween(x, 200, x, 380);
      scenery.lineBetween(x + 105, 200, x + 105, 380);
      for (let y = 220; y < 370; y += 42) {
        scenery.lineBetween(x, y, x + 105, y);
        scenery.lineBetween(x, y, x + 105, y + 34);
      }
    }
    scenery.lineStyle(12, 0xe0a54f, 1);
    scenery.lineBetween(5840, 84, 6170, 84);
    scenery.lineBetween(5900, 84, 5900, 380);
    scenery.lineStyle(4, 0x32393a, 1);
    scenery.lineBetween(5915, 110, 6170, 110);
    for (let x = 5120; x < 6900; x += 120) {
      scenery.fillStyle(x % 240 === 0 ? 0x1e2425 : 0xe0a54f, 1);
      scenery.fillRect(x, 372, 58, 8);
    }

    const anchor = this.matter.bodies.circle(6070, 105, 5, { isStatic: true, label: 'craneAnchor' });
    const bob = this.matter.bodies.circle(6070, 265, 31, {
      label: 'craneBob', density: 0.0045, friction: 0.55, restitution: 0.52
    });
    bob.plugin.isCraneBob = true;
    this.matter.world.add([anchor, bob]);
    this.craneConstraint = this.matter.add.constraint(anchor, bob, 160, 0.985, { damping: 0.008 });
    this.matter.body.setVelocity(bob, { x: -5.2, y: 0 });
    this.crane = { anchor, bob };
    this.cranePaint = this.add.graphics().setDepth(15);

    const threat = this.add.graphics().setDepth(6);
    threat.lineStyle(2, COLORS.danger, 0.42);
    threat.beginPath();
    for (let i = 0; i <= 18; i++) {
      const angle = -0.82 + i * (1.64 / 18);
      const x = anchor.position.x + Math.sin(angle) * 160;
      const y = anchor.position.y + Math.cos(angle) * 160;
      if (i === 0) threat.moveTo(x, y); else threat.lineTo(x, y);
    }
    threat.strokePath();
    this.add.text(6070, 304, 'TRAYECTORIA DE CARGA', {
      fontFamily: 'Courier New', fontSize: '10px', color: '#ff8792'
    }).setOrigin(0.5).setDepth(7);
  }

  makeElectromagneticZone() {
    const field = this.level.field;
    this.fieldZone = { start: field.start, end: field.end, ramp: field.ramp };
    this.makeZoneSign(field.start + 20, 'CAMPO ELECTROMAGNÉTICO', 'ATRACCIÓN VERTICAL', 0x6fe7ff);
    const fieldGfx = this.add.graphics().setDepth(5);
    for (let x = field.start + 180; x < field.end - 50; x += 260) {
      fieldGfx.fillStyle(0x273b43, 1);
      fieldGfx.fillRoundedRect(x - 92, 72, 184, 34, 6);
      fieldGfx.lineStyle(3, COLORS.glow, 0.8);
      fieldGfx.strokeRoundedRect(x - 92, 72, 184, 34, 6);
      fieldGfx.lineStyle(2, COLORS.glow, 0.2);
      fieldGfx.lineBetween(x - 72, 108, x - 28, 365);
      fieldGfx.lineBetween(x, 108, x, 365);
      fieldGfx.lineBetween(x + 72, 108, x + 28, 365);
      for (let y = 145; y < 350; y += 54) {
        fieldGfx.fillStyle(COLORS.glow, 0.32);
        fieldGfx.fillTriangle(x - 5, y, x + 5, y, x, y - 12);
      }
    }
    this.add.text(field.start + 750, 122, '↑  EL TECHO TE ATRAE  ↑', {
      fontFamily: 'Courier New', fontSize: '13px', color: '#6fe7ff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(7);
  }

  makeBoostPickup(x) {
    const body = this.matter.bodies.circle(x, 342, 18, {
      isStatic: true, isSensor: true, label: 'boost'
    });
    body.plugin.isBoost = true;
    this.matter.world.add(body);
    const view = this.add.graphics().setDepth(14);
    view.fillStyle(0x173942, 1);
    view.fillCircle(x, 342, 18);
    view.lineStyle(4, COLORS.glow, 1);
    view.strokeCircle(x, 342, 18);
    view.lineStyle(3, COLORS.core, 1);
    view.lineBetween(x - 8, 336, x - 8, 348);
    view.lineBetween(x + 8, 336, x + 8, 348);
    view.lineStyle(5, COLORS.danger, 1);
    view.lineBetween(x - 8, 336, x + 8, 336);
    view.lineStyle(5, 0x4dbbd4, 1);
    view.lineBetween(x - 8, 348, x + 8, 348);
    const label = this.add.text(x, 305, 'SUPERIMÁN\n6 SEGUNDOS', {
      fontFamily: 'Courier New', fontSize: '11px', color: '#6fe7ff', align: 'center', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(14);
    this.boostPickup = { body, view, label, active: true };
  }

  makeStreetSign(x) {
    const sign = this.add.graphics().setDepth(5);
    sign.fillStyle(0x55605e, 1);
    sign.fillRect(x, 284, 7, 96);
    sign.fillStyle(COLORS.sign, 1);
    sign.fillRoundedRect(x - 42, 278, 92, 38, 4);
    sign.lineStyle(3, 0x3e3c32, 1);
    sign.strokeRoundedRect(x - 42, 278, 92, 38, 4);
    sign.fillStyle(0x3e3c32, 1);
    sign.fillTriangle(x + 34, 287, x + 44, 297, x + 34, 307);
    this.add.text(x - 31, 288, 'BASURA', {
      fontFamily: 'Courier New', fontSize: '11px', color: '#34352f', fontStyle: 'bold'
    }).setDepth(6);
  }

  makeLandfill(x, label) {
    const plant = this.add.graphics().setDepth(4);
    plant.fillStyle(0x35413e, 1);
    plant.fillRect(x - 120, 220, 430, 160);
    plant.fillStyle(0x232c2b, 1);
    plant.fillTriangle(x - 150, 220, x + 95, 132, x + 340, 220);
    plant.fillStyle(0x111817, 1);
    plant.fillRect(x + 25, 286, 140, 94);
    plant.lineStyle(8, COLORS.sign, 0.9);
    for (let sx = x + 35; sx < x + 165; sx += 34) plant.lineBetween(sx, 291, sx + 55, 365);
    this.add.text(x + 95, 190, label.split(' ').join('\n'), {
      fontFamily: 'Courier New', fontSize: '17px', color: '#f1c75b', align: 'center', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(6);
    this.add.circle(x - 55, 345, 30, COLORS.rust).setDepth(6);
    this.add.circle(x - 18, 353, 23, COLORS.steel).setDepth(6);
    this.add.circle(x - 92, 357, 19, 0x6c4938).setDepth(6);
  }

  makeBlob() {
    const core = this.matter.bodies.rectangle(190, 330, 22, 22, {
      label: 'blobPart', density: 0.0028, friction: 0.92, restitution: 0.05
    });
    core.plugin.isBlobPart = true;
    core.plugin.isCore = true;
    core.plugin.radius = 15;
    core.plugin.shape = 'magnet';

    this.blob = this.matter.body.create({
      label: 'blob',
      parts: [core],
      friction: 0.92,
      frictionAir: 0.018,
      restitution: 0.04
    });
    this.matter.world.add(this.blob);
    this.coreMass = this.blob.mass;
    this.matter.body.setVelocity(this.blob, { x: 2.05, y: 0 });
  }

  makeSoftMatter() {
    this.soft = [];
    let id = 0;
    for (let x = 480; x < this.level.softEnd; x += 145) {
      if (x % 870 < 120) continue;
      if (this.scraperPositions.some(stationX => x >= stationX - 80 && x <= stationX + 350)) continue;
      const y = 352 - ((id * 29) % 48);
      const spec = scrapSpecForIndex(id);
      const body = this.createScrapBody(x, y, spec, true);
      body.plugin.softId = id;
      this.matter.world.add(body);
      const view = this.add.graphics().setDepth(8);
      this.paintScrap(view, body, 0.92);
      const value = scrapValue(spec);
      const valueView = this.add.text(x, y - (body.plugin.radius + 10), `$${value}`, {
        fontFamily: 'Courier New', fontSize: '10px', color: '#f1c75b', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(9);
      this.soft.push({ id, body, view, valueView, spec, value });
      id++;
    }
  }

  createScrapBody(x, y, spec, sensor = false) {
    const options = {
      isStatic: sensor,
      isSensor: sensor,
      label: sensor ? 'soft' : 'blobPart',
      density: 0.0028,
      friction: 0.92,
      restitution: 0.03,
      angle: spec.kind === 'plate' ? (x % 11) * 0.11 : 0
    };
    let body;
    if (spec.kind === 'plate') body = this.matter.bodies.rectangle(x, y, spec.width, spec.height, options);
    else if (spec.kind === 'nut') body = this.matter.bodies.polygon(x, y, spec.sides, spec.radius, options);
    else body = this.matter.bodies.circle(x, y, spec.radius, options);
    body.plugin.isBlobPart = !sensor;
    body.plugin.scrap = spec;
    body.plugin.radius = spec.radius || Math.max(spec.width, spec.height) / 2;
    body.plugin.value = scrapValue(spec);
    return body;
  }

  makeStoneGates() {
    this.stones = [];
    const gates = this.level.stoneGates;
    gates.forEach((x, i) => {
      const gap = Math.max(52, 105 - i * 5);
      const height = 380 - gap;
      this.add.rectangle(x, height / 2, 70, height, COLORS.stone).setDepth(7)
        .setStrokeStyle(3, COLORS.stoneEdge, 0.9);
      const body = this.matter.bodies.rectangle(x, height / 2, 70, height, {
        isStatic: true, label: 'stone', friction: 0.85
      });
      body.plugin.isStone = true;
      this.matter.world.add(body);
      this.stones.push(body);

      if (i % 2 === 1) {
        this.add.rectangle(x + 260, 358, 130, 44, COLORS.stone).setDepth(7)
          .setStrokeStyle(3, COLORS.stoneEdge, 0.9);
        const low = this.matter.bodies.rectangle(x + 260, 358, 130, 44, {
          isStatic: true, label: 'stone', friction: 0.9
        });
        low.plugin.isStone = true;
        this.matter.world.add(low);
        this.stones.push(low);
      }
    });
  }

  makeScrapers() {
    this.scrapers = [];
    this.scraperPositions.forEach((x, index) => {
      const y = index % 2 === 0 ? 300 : 292;
      const radius = 26;
      const body = this.matter.bodies.circle(x, y, radius, {
        isStatic: true, label: 'scraper', friction: 0.98, restitution: 0.08
      });
      body.plugin.isScraper = true;
      this.matter.world.add(body);

      const frame = this.add.graphics().setDepth(10);
      frame.fillStyle(0x343b3d, 1);
      frame.fillRect(x - 5, 212, 10, y - radius - 212);
      frame.fillRect(x - 42, 208, 84, 9);
      frame.lineStyle(3, COLORS.scraper, 0.9);
      frame.lineBetween(x - 44, 219, x - 44, 345);
      frame.lineBetween(x - 44, 345, x - 34, 335);

      const view = this.add.graphics().setPosition(x, y).setDepth(12);
      view.fillStyle(0x3e4849, 1);
      view.fillCircle(0, 0, radius);
      view.lineStyle(4, COLORS.scraper, 1);
      view.strokeCircle(0, 0, radius - 2);
      view.lineStyle(5, 0x1d2426, 1);
      for (let spoke = 0; spoke < 8; spoke++) {
        const angle = spoke * Math.PI / 4;
        view.lineBetween(
          Math.cos(angle) * 8, Math.sin(angle) * 8,
          Math.cos(angle) * 20, Math.sin(angle) * 20
        );
      }
      view.fillStyle(COLORS.scraper, 1);
      view.fillCircle(0, 0, 7);

      this.add.text(x - 74, 238, 'RASPADOR\nVOLUNTARIO', {
        fontFamily: 'Courier New', fontSize: '11px', color: '#f29b38', align: 'center', fontStyle: 'bold',
        backgroundColor: '#202728', padding: { x: 6, y: 4 }
      }).setOrigin(0.5).setDepth(13);
      this.add.text(x + 82, 342, 'RECUPERACION  →', {
        fontFamily: 'Courier New', fontSize: '10px', color: '#99aaa9', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(9);
      this.add.rectangle(x + 185, 374, 270, 3, COLORS.scraper, 0.42).setDepth(6);
      this.scrapers.push({ body, view });
    });
  }

  makeMechanicalDistrict() {
    this.makeZoneSign(520, 'DISTRITO MECANICO', 'NIVEL 2 · MIRA EL RITMO', 0xff775f);

    const decor = this.add.graphics().setDepth(5);
    decor.fillStyle(0x2e292c, 0.95);
    decor.fillRect(300, 365, 3900, 15);
    decor.lineStyle(3, 0xff775f, 0.28);
    for (let x = 420; x < 4100; x += 160) {
      decor.lineBetween(x, 368, x + 44, 368);
      decor.lineBetween(x + 56, 368, x + 100, 368);
    }

    this.add.text(1230, 196, '1 · PRENSA\nESPERA LA APERTURA', {
      fontFamily: 'Courier New', fontSize: '11px', color: '#ff9b88', align: 'center', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(9);
    this.addPiston(1230, 205, 120, 2400, 0);

    this.add.text(2280, 182, '2 · BARREDOR\nLEE UNA VUELTA', {
      fontFamily: 'Courier New', fontSize: '11px', color: '#ffd26f', align: 'center', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(9);
    this.addRotor(2280, 286, 2600, 0.12);

    this.add.text(3320, 124, '3 · CADENA DE MAQUINAS', {
      fontFamily: 'Courier New', fontSize: '12px', color: '#f7fbff', fontStyle: 'bold',
      backgroundColor: '#39292d', padding: { x: 8, y: 5 }
    }).setOrigin(0.5).setDepth(9);
    this.addPiston(3260, 202, 112, 2200, 0.5);
    this.addRotor(3460, 286, 2300, 0.58);

    for (const x of [1700, 2820, 4080]) {
      this.add.text(x, 350, 'RECUPERA  →', {
        fontFamily: 'Courier New', fontSize: '10px', color: '#93a4a5', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(8);
    }
  }

  addPiston(x, centerY, amplitude, period, phase) {
    const body = this.matter.bodies.rectangle(x, centerY, 104, 34, {
      isStatic: true, label: 'mechanicalPiston', friction: 0.72, restitution: 0.34
    });
    body.plugin.isMechanical = true;
    this.matter.world.add(body);
    this.mechanicalPistons.push({ body, x, centerY, amplitude, period, phase });

    const guide = this.add.graphics().setDepth(7);
    guide.lineStyle(2, 0xff775f, 0.42);
    guide.lineBetween(x, centerY - amplitude - 22, x, centerY + amplitude + 22);
    guide.strokeRect(x - 58, centerY - amplitude - 20, 116, amplitude * 2 + 40);
    for (let y = centerY - amplitude; y <= centerY + amplitude; y += 30) {
      guide.fillStyle(0xff775f, 0.55);
      guide.fillTriangle(x - 66, y - 5, x - 66, y + 5, x - 58, y);
    }
  }

  addRotor(x, y, period, phase) {
    const body = this.matter.bodies.rectangle(x, y, 150, 18, {
      isStatic: true, label: 'mechanicalRotor', friction: 0.68, restitution: 0.48
    });
    body.plugin.isMechanical = true;
    this.matter.world.add(body);
    this.mechanicalRotors.push({ body, x, y, period, phase });

    const guide = this.add.graphics().setDepth(7);
    guide.lineStyle(2, 0xf1c75b, 0.38);
    guide.strokeCircle(x, y, 75);
    guide.fillStyle(0xf1c75b, 0.7);
    guide.fillTriangle(x + 68, y - 30, x + 82, y - 27, x + 73, y - 17);
  }

  drawMechanicalBody(graphics, body, fill, edge) {
    const vertices = body.vertices;
    graphics.fillStyle(fill, 1);
    graphics.lineStyle(3, edge, 1);
    graphics.beginPath();
    graphics.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) graphics.lineTo(vertices[i].x, vertices[i].y);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }

  updateMechanicalDistrict(time) {
    this.mechanicalPaint.clear();
    for (const piston of this.mechanicalPistons) {
      const y = pistonYAt(time, piston.centerY, piston.amplitude, piston.period, piston.phase);
      this.matter.body.setPosition(piston.body, { x: piston.x, y });
      this.drawMechanicalBody(this.mechanicalPaint, piston.body, 0x713d3d, 0xff9b88);
      this.mechanicalPaint.fillStyle(0x2a3032, 1);
      this.mechanicalPaint.fillRect(piston.x - 34, y - 10, 68, 20);
      this.mechanicalPaint.lineStyle(3, 0xffc0b4, 0.8);
      this.mechanicalPaint.lineBetween(piston.x - 24, y, piston.x + 24, y);
    }
    for (const rotor of this.mechanicalRotors) {
      const angle = rotorAngleAt(time, rotor.period, rotor.phase);
      this.matter.body.setAngle(rotor.body, angle);
      this.drawMechanicalBody(this.mechanicalPaint, rotor.body, 0x6c5830, 0xffd26f);
      this.mechanicalPaint.fillStyle(0x242a2c, 1);
      this.mechanicalPaint.fillCircle(rotor.x, rotor.y, 13);
      this.mechanicalPaint.lineStyle(3, 0xffd26f, 1);
      this.mechanicalPaint.strokeCircle(rotor.x, rotor.y, 13);
    }
  }

  onCollision(event, allowStone) {
    for (const pair of event.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;
      const aIsBlob = belongsToCompound(a, this.blob);
      const bIsBlob = belongsToCompound(b, this.blob);
      if (!aIsBlob && !bIsBlob) continue;
      const otherBody = aIsBlob ? b : a;
      const other = otherBody.parent || otherBody;
      const contact = pair.collision && pair.collision.supports && pair.collision.supports[0]
        ? pair.collision.supports[0]
        : other.position;

      if (other.plugin && other.plugin.softId !== undefined) this.collectSoft(other.plugin.softId, contact);
      if (other.plugin && other.plugin.isBoost) this.activateBoost();
      if (allowStone && other.plugin && other.plugin.isStone && this.shedCooldown <= 0) {
        this.shedAt(contact, 'stone');
      }
      if (other.plugin && other.plugin.isScraper && this.scraperCooldown <= 0) {
        this.shedAt(contact, 'scraper');
      }
      if (allowStone && other.plugin && other.plugin.isMechanical && this.mechanicalHitCooldown <= 0) {
        this.mechanicalHitCooldown = 650;
        this.mechanicalNoticeMs = 950;
        this.sfx.impact();
        this.matter.body.setVelocity(this.blob, {
          x: Math.max(0.3, this.blob.velocity.x * 0.58),
          y: this.blob.velocity.y
        });
        const side = this.blob.position.x < other.position.x ? -1 : 1;
        this.matter.body.setAngularVelocity(this.blob, this.blob.angularVelocity + side * 0.085);
      }
    }
  }

  collectSoft(id, contact) {
    if (this.collected.has(id)) return;
    const item = this.soft.find(entry => entry.id === id);
    if (!item) return;
    this.collected.add(id);
    const point = { x: item.body.position.x, y: item.body.position.y };
    this.matter.world.remove(item.body);
    item.view.destroy();
    item.valueView.destroy();
    this.addBlobPart(point.x, point.y, item.spec);
    this.sfx.pickup(this.blob.parts.length - 2);
    const spark = this.add.circle(point.x, point.y, 5, COLORS.glow, 0.85).setDepth(25);
    this.tweens.add({ targets: spark, scale: 2.6, alpha: 0, duration: 260, onComplete: () => spark.destroy() });
    const arc = this.add.graphics().setDepth(24);
    arc.lineStyle(3, COLORS.glow, 0.9);
    arc.lineBetween(this.blob.position.x, this.blob.position.y, contact.x, contact.y);
    arc.strokeCircle(contact.x, contact.y, 10);
    this.tweens.add({ targets: arc, alpha: 0, duration: 320, onComplete: () => arc.destroy() });
    const points = this.add.text(point.x, point.y - 24, `+$${item.value}`, {
      fontFamily: 'Courier New', fontSize: '14px', color: '#f1c75b', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(26);
    this.tweens.add({
      targets: points, y: points.y - 22, alpha: 0, duration: 700,
      ease: 'Cubic.easeOut', onComplete: () => points.destroy()
    });
  }

  activateBoost() {
    if (!this.boostPickup || !this.boostPickup.active) return;
    this.boostPickup.active = false;
    this.matter.world.remove(this.boostPickup.body);
    this.boostPickup.view.destroy();
    this.boostPickup.label.destroy();
    this.boostMs = boostDurationAfterPickup(this.boostMs, 6000);
    this.sfx.boost();
    const text = this.add.text(this.blob.position.x, this.blob.position.y - 52, '¡SUPERIMÁN!', {
      fontFamily: 'Courier New', fontSize: '17px', color: '#6fe7ff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(27);
    this.tweens.add({
      targets: text, y: text.y - 28, alpha: 0, duration: 900,
      ease: 'Cubic.easeOut', onComplete: () => text.destroy()
    });
  }

  updateBoost(delta, time) {
    this.boostAura.clear();
    if (this.boostMs <= 0) return;
    this.boostMs = Math.max(0, this.boostMs - delta);
    const pulse = 0.35 + Math.abs(Math.sin(time / 120)) * 0.28;
    this.boostAura.lineStyle(2, COLORS.glow, pulse);
    this.boostAura.strokeCircle(this.blob.position.x, this.blob.position.y, this.boostRadius);
    this.boostAura.lineStyle(1, COLORS.core, pulse * 0.8);
    for (let ray = 0; ray < 8; ray++) {
      const angle = ray * Math.PI / 4 + time / 850;
      this.boostAura.lineBetween(
        this.blob.position.x + Math.cos(angle) * 72,
        this.blob.position.y + Math.sin(angle) * 72,
        this.blob.position.x + Math.cos(angle) * 108,
        this.blob.position.y + Math.sin(angle) * 108
      );
    }

    for (const item of this.soft) {
      if (this.collected.has(item.id)) continue;
      let nearest = null;
      let nearestDistance = Infinity;
      for (const part of this.blob.parts.slice(1)) {
        const dx = part.position.x - item.body.position.x;
        const dy = part.position.y - item.body.position.y;
        const distance = Math.hypot(dx, dy);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = part;
        }
      }
      if (!nearest || nearestDistance >= this.boostRadius) continue;
      const strength = attractionStrength(nearestDistance, this.boostRadius);
      const dx = nearest.position.x - item.body.position.x;
      const dy = nearest.position.y - item.body.position.y;
      const step = Math.min(nearestDistance, (90 + strength * 250) * delta / 1000);
      if (nearestDistance > 0) {
        this.matter.body.setPosition(item.body, {
          x: item.body.position.x + dx / nearestDistance * step,
          y: item.body.position.y + dy / nearestDistance * step
        });
      }
      item.view.clear();
      this.paintScrap(item.view, item.body, 0.92);
      item.valueView.setPosition(item.body.position.x, item.body.position.y - item.body.plugin.radius - 10);
      const touchDistance = (nearest.plugin.radius || 12) + item.body.plugin.radius + 3;
      if (nearestDistance <= touchDistance) this.collectSoft(item.id, item.body.position);
    }
  }

  updateWorldZones(time) {
    let influence = 0;
    if (this.crane) {
      this.cranePaint.clear();
      const { anchor, bob } = this.crane;
      bob.force.x += Math.sin(time / 760) * 0.00011 * bob.mass;
      this.cranePaint.lineStyle(5, 0x252c2e, 1);
      this.cranePaint.lineBetween(anchor.position.x, anchor.position.y, bob.position.x, bob.position.y);
      this.cranePaint.fillStyle(0x4e5555, 1);
      this.cranePaint.fillCircle(bob.position.x, bob.position.y, 31);
      this.cranePaint.lineStyle(4, 0xaab1ad, 0.9);
      this.cranePaint.strokeCircle(bob.position.x, bob.position.y, 31);
      this.cranePaint.lineStyle(2, 0x313738, 0.8);
      this.cranePaint.lineBetween(bob.position.x - 20, bob.position.y - 18, bob.position.x + 20, bob.position.y + 18);
      this.cranePaint.lineBetween(bob.position.x + 20, bob.position.y - 18, bob.position.x - 20, bob.position.y + 18);
    }

    if (this.fieldZone) {
      this.fieldEffect.clear();
      influence = zoneInfluence(
        this.blob.position.x,
        this.fieldZone.start,
        this.fieldZone.end,
        this.fieldZone.ramp
      );
      if (influence > 0) {
        const force = magneticFieldForce(this.blob.mass, this.coreMass, 0.00148, influence);
        this.matter.body.applyForce(this.blob, this.blob.position, { x: 0, y: -force });
        this.fieldEffect.lineStyle(2, COLORS.glow, 0.35 + influence * 0.45);
        for (let x = this.blob.bounds.min.x; x <= this.blob.bounds.max.x; x += 12) {
          const wobble = Math.sin(time / 100 + x) * 4;
          this.fieldEffect.lineBetween(x, this.blob.bounds.min.y - 4, x + wobble, this.blob.bounds.min.y - 35);
        }
      }
    }
    return influence;
  }

  rebuildBlob(parts) {
    const velocity = { x: this.blob.velocity.x, y: this.blob.velocity.y };
    const angularVelocity = this.blob.angularVelocity;
    this.matter.body.setParts(this.blob, parts, false);
    this.matter.body.setVelocity(this.blob, velocity);
    this.matter.body.setAngularVelocity(this.blob, angularVelocity);
  }

  addBlobPart(x, y, spec) {
    const part = this.createScrapBody(x, y, spec, false);
    this.rebuildBlob([...this.blob.parts.slice(1), part]);
  }

  shedAt(contact, source = 'stone') {
    const children = this.blob.parts.slice(1);
    const candidates = children.map(part => ({
      id: part.id,
      x: part.position.x,
      y: part.position.y,
      isCore: Boolean(part.plugin && part.plugin.isCore)
    }));
    const shedId = choosePartToShed(candidates, contact.x, contact.y);
    if (shedId === null) return false;
    const shed = children.find(part => part.id === shedId);
    const lostValue = (shed.plugin && shed.plugin.value) || 0;
    this.rebuildBlob(children.filter(part => part.id !== shedId));
    if (source === 'scraper') {
      this.scraperCooldown = 460;
      this.scrapeNoticeMs = 900;
      this.scrapeLostValue = lostValue;
      this.sfx.scrape();
    } else {
      this.shedCooldown = 320;
      this.sfx.stone();
    }
    this.matter.body.setVelocity(this.blob, {
      x: Math.max(0.35, this.blob.velocity.x * (source === 'scraper' ? 0.76 : 0.68)),
      y: this.blob.velocity.y
    });
    const fragment = this.add.graphics().setDepth(24);
    this.paintScrap(fragment, shed, 0.95);
    this.tweens.add({ targets: fragment, y: fragment.y - 24, alpha: 0, scale: 0.45, duration: 650, onComplete: () => fragment.destroy() });
    if (source === 'scraper') this.showScrapeFeedback(contact, lostValue);
    return true;
  }

  showScrapeFeedback(contact, lostValue) {
    const cost = this.add.text(contact.x, contact.y - 24, `DESCARGA -$${lostValue}`, {
      fontFamily: 'Courier New', fontSize: '13px', color: '#f29b38', fontStyle: 'bold',
      stroke: '#111820', strokeThickness: 4
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: cost, y: cost.y - 30, alpha: 0, duration: 850, onComplete: () => cost.destroy() });
    for (let i = 0; i < 7; i++) {
      const angle = -Math.PI * 0.8 + i * 0.27;
      const spark = this.add.circle(contact.x, contact.y, 2 + i % 2, i % 2 ? COLORS.sign : COLORS.scraper)
        .setDepth(29);
      this.tweens.add({
        targets: spark,
        x: contact.x + Math.cos(angle) * (24 + i * 3),
        y: contact.y + Math.sin(angle) * (18 + i * 2),
        alpha: 0,
        duration: 300 + i * 35,
        onComplete: () => spark.destroy()
      });
    }
  }

  polygonPath(graphics, vertices) {
    graphics.beginPath();
    graphics.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) graphics.lineTo(vertices[i].x, vertices[i].y);
    graphics.closePath();
  }

  localPoint(part, x, y) {
    const cosine = Math.cos(part.angle);
    const sine = Math.sin(part.angle);
    return {
      x: part.position.x + x * cosine - y * sine,
      y: part.position.y + x * sine + y * cosine
    };
  }

  paintScrap(graphics, part, alpha = 1) {
    const spec = part.plugin.scrap;
    const fill = spec.kind === 'gear' ? COLORS.rust : spec.kind === 'plate' ? COLORS.steel : COLORS.copper;
    graphics.fillStyle(fill, alpha);
    graphics.lineStyle(2, 0xd5d9d4, alpha * 0.62);
    if (spec.kind === 'gear') {
      graphics.fillCircle(part.position.x, part.position.y, spec.radius);
      graphics.strokeCircle(part.position.x, part.position.y, spec.radius);
      graphics.lineStyle(2, 0x54352b, alpha);
      graphics.strokeCircle(part.position.x, part.position.y, Math.max(2, spec.radius * 0.32));
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        graphics.lineBetween(
          part.position.x + Math.cos(a) * spec.radius * 0.48,
          part.position.y + Math.sin(a) * spec.radius * 0.48,
          part.position.x + Math.cos(a) * spec.radius * 0.82,
          part.position.y + Math.sin(a) * spec.radius * 0.82
        );
      }
    } else {
      this.polygonPath(graphics, part.vertices);
      graphics.fillPath();
      graphics.strokePath();
      if (spec.kind === 'nut') {
        graphics.fillStyle(0x273034, 0.9);
        graphics.fillCircle(part.position.x, part.position.y, spec.radius * 0.34);
      } else {
        const left = this.localPoint(part, -spec.width * 0.3, 0);
        const right = this.localPoint(part, spec.width * 0.3, 0);
        graphics.fillStyle(0x46504f, 0.9);
        graphics.fillCircle(left.x, left.y, Math.max(1.5, spec.height * 0.16));
        graphics.fillCircle(right.x, right.y, Math.max(1.5, spec.height * 0.16));
      }
    }
  }

  paintCore(graphics, part, pulse) {
    graphics.fillStyle(COLORS.core, 1);
    graphics.lineStyle(3, COLORS.glow, pulse);
    this.polygonPath(graphics, part.vertices);
    graphics.fillPath();
    graphics.strokePath();

    const leftTop = this.localPoint(part, -9, -8);
    const leftBottom = this.localPoint(part, -9, 8);
    const rightTop = this.localPoint(part, 9, -8);
    const rightBottom = this.localPoint(part, 9, 8);
    graphics.lineStyle(4, 0xe45b56, 1);
    graphics.lineBetween(leftTop.x, leftTop.y, leftBottom.x, leftBottom.y);
    graphics.lineStyle(4, 0x4dbbd4, 1);
    graphics.lineBetween(rightTop.x, rightTop.y, rightBottom.x, rightBottom.y);
    const eyeA = this.localPoint(part, -4, -2);
    const eyeB = this.localPoint(part, 4, -2);
    graphics.fillStyle(0x16262d, 1);
    graphics.fillCircle(eyeA.x, eyeA.y, 1.8);
    graphics.fillCircle(eyeB.x, eyeB.y, 1.8);
    const mouthA = this.localPoint(part, -4, 5);
    const mouthB = this.localPoint(part, 4, 5);
    graphics.lineStyle(1.5, 0x52666c, 1);
    graphics.lineBetween(mouthA.x, mouthA.y, mouthB.x, mouthB.y);
  }

  drawBlob(time) {
    this.blobPaint.clear();
    const pulse = 0.82 + Math.sin(time / 90) * 0.12;
    for (const part of this.blob.parts.slice(1)) {
      if (part.plugin.isCore) this.paintCore(this.blobPaint, part, pulse);
      else this.paintScrap(this.blobPaint, part, 0.96);
    }
  }

  deliveredValue() {
    return this.blob.parts.slice(1).reduce((total, part) => {
      if (part.plugin && part.plugin.isCore) return total;
      return total + ((part.plugin && part.plugin.value) || 0);
    }, 0);
  }

  hop() {
    if (!canHop(this.blob.bounds.max.y, 380, this.jumpCooldown)) return;
    const force = jumpForceForMass(this.blob.mass, this.coreMass, 0.038);
    this.matter.body.applyForce(this.blob, this.blob.position, { x: 0, y: -force });
    this.jumpCooldown = 520;
    this.sfx.hop();
    const pulse = this.add.circle(this.blob.position.x, this.blob.bounds.max.y, 12, 0x000000, 0)
      .setStrokeStyle(3, COLORS.glow, 0.9).setDepth(19);
    this.tweens.add({
      targets: pulse,
      scaleX: 3.2,
      scaleY: 0.65,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => pulse.destroy()
    });
  }

  lose() {
    if (this.dead) return;
    this.dead = true;
    this.hidePauseOverlay();
    this.sfx.lose();
    this.matter.body.setStatic(this.blob, true);
    this.add.rectangle(400, 225, 800, 450, 0x05070b, 0.72).setScrollFactor(0).setDepth(200);
    this.add.text(400, 200, 'TE ALCANZÓ EL BORDE', {
      fontFamily: 'Courier New', fontSize: '28px', color: '#ff5263'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.add.text(400, 242, `${Math.floor(this.cameras.main.scrollX / 10)} m · ${this.blob.parts.length - 1} piezas · R para volver`, {
      fontFamily: 'Courier New', fontSize: '14px', color: '#dbe8ed'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.hidePauseOverlay();
    this.sfx.finish();
    this.matter.body.setStatic(this.blob, true);
    const result = scoreDelivery(this.deliveredValue(), (this.time.now - this.startedAt) / 1000);
    this.levelResults.push({ levelId: this.levelId, ...result });
    const isLevel2 = this.levelId === 'level2';
    const campaignScore = isLevel2 ? this.campaignScore + result.total : result.total;
    this.add.rectangle(400, 225, 800, 450, 0x071012, 0.7).setScrollFactor(0).setDepth(200);
    this.add.text(400, 175, isLevel2 ? 'NIVEL 2 COMPLETADO' : 'NIVEL 1 COMPLETADO', {
      fontFamily: 'Courier New', fontSize: '28px', color: '#f1c75b', fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    const lines =
      `TIEMPO              ${result.elapsedSeconds} s\n` +
      `BONUS DE TIEMPO    $${result.timeBonus}\n` +
      `CHATARRA ENTREGADA $${result.deliveredValue}\n` +
      `-------------------------\n` +
      `PUNTUACIÓN DEL NIVEL   $${result.total}\n` +
      (isLevel2 ? `TOTAL DE LA CAMPAÑA   $${campaignScore}\n\n` : `\n`) +
      (isLevel2 ? 'R para volver a empezar' : 'ENTER para el DISTRITO MECANICO · R repite');
    this.add.text(400, 265, lines, {
      fontFamily: 'Courier New', fontSize: '14px', color: '#dbe8ed', align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    if (!isLevel2) {
      this.input.keyboard.once('keydown-ENTER', () => this.startNextLevel());
      this.input.once('pointerdown', () => this.startNextLevel());
    }
  }

  startNextLevel() {
    const next = nextLevelId(this.levelId);
    if (!next) return;
    this.scene.start('LastreScene', {
      levelId: next,
      campaignScore: campaignTotal(this.levelResults),
      levelResults: this.levelResults
    });
  }

  update(time, delta) {
    if (!this.started) return;
    if (this.dead || this.finished || this.paused) return;
    this.shedCooldown = Math.max(0, this.shedCooldown - delta);
    this.scraperCooldown = Math.max(0, this.scraperCooldown - delta);
    this.scrapeNoticeMs = Math.max(0, this.scrapeNoticeMs - delta);
    this.mechanicalHitCooldown = Math.max(0, this.mechanicalHitCooldown - delta);
    this.mechanicalNoticeMs = Math.max(0, this.mechanicalNoticeMs - delta);
    this.jumpCooldown = Math.max(0, this.jumpCooldown - delta);
    for (const scraper of this.scrapers) scraper.view.rotation += delta * 0.0045;

    const left = this.keys.leftA.isDown || this.keys.leftArrow.isDown;
    const right = this.keys.rightD.isDown || this.keys.rightArrow.isDown;
    this.blob.torque += torqueForInput(left, right, 0.018) * this.blob.mass;
    if (this.ignoreJumpUntilRelease) {
      if (!this.keys.jump.isDown) this.ignoreJumpUntilRelease = false;
    } else if (Phaser.Input.Keyboard.JustDown(this.keys.jump)) {
      this.hop();
    }

    this.blob.force.x += 0.00042;
    if (this.blob.velocity.x > 4.2) this.matter.body.setVelocity(this.blob, { x: 4.2, y: this.blob.velocity.y });
    const fieldInfluence = this.updateWorldZones(time);
    this.updateMechanicalDistrict(time);
    this.updateBoost(delta, time);

    const elapsed = (time - this.startedAt) / 1000;
    this.cameras.main.scrollX += cameraSpeed(elapsed) * delta / 1000;
    this.dangerLine.setAlpha(0.45 + Math.abs(Math.sin(time / 180)) * 0.45);
    this.drawBlob(time);

    const rightEdge = this.blob.bounds.max.x;
    const relative = rightEdge - this.cameras.main.scrollX;
    if (isCaughtByCamera(rightEdge, this.cameras.main.scrollX, 24)) this.lose();
    if (rightEdge >= this.destinationX) this.finish();

    const pieces = this.blob.parts.length - 1;
    const value = this.deliveredValue();
    const distance = Math.floor(this.cameras.main.scrollX / 10);
    const hopState = this.jumpCooldown > 0 ? 'RECARGA' : 'LISTO';
    this.hud.setText(`${this.levelId === 'level2' ? 'NIVEL 2' : 'LASTRE'}  ·  ${distance} m  ·  piezas ${pieces}  ·  chatarra $${value}  ·  pulso ${hopState}`);
    this.routeHud.setText(routeMessage(Math.floor(this.blob.position.x), this.destinationX, this.level.destinationLabel));
    this.warning.setText(relative < 130 ? '◀ EL BORDE TE ESTÁ ALCANZANDO' : '');
    const zone = zoneAt(this.blob.position.x);
    const zoneMessage = this.levelId === 'level2'
      ? '⚙ DISTRITO MECANICO · NIVEL 2 · LEE EL RITMO'
      : zone === 'construction'
        ? '⚠ ZONA DE OBRA · EVITÁ LA CARGA'
        : zone === 'electromagnetic'
          ? `↑ CAMPO ACTIVO ${Math.round(fieldInfluence * 100)}%`
          : '';
    const boostMessage = this.boostMs > 0
      ? `SUPERIMÁN ${Math.ceil(this.boostMs / 1000)} s · RADIO ${this.boostRadius}`
      : '';
    const scrapeMessage = this.scrapeNoticeMs > 0
      ? `DESCARGA VOLUNTARIA -$${this.scrapeLostValue} · PERDISTE VELOCIDAD`
      : '';
    const mechanicalMessage = this.mechanicalNoticeMs > 0
      ? 'IMPACTO MECANICO · PERDISTE VELOCIDAD'
      : '';
    this.zoneHud.setText([zoneMessage, boostMessage, scrapeMessage, mechanicalMessage].filter(Boolean).join('  ·  '));
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 800,
  height: 450,
  backgroundColor: '#070b12',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 1.05 },
      enableSleeping: false,
      debug: false
    }
  },
  scene: [LastreScene]
});
