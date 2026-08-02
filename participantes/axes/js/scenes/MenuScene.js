class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.audio = new AudioManager();
    // El singleton nace sin silenciar: sin esto un menú con sonido ignoraría la
    // preferencia guardada hasta que el HUD la leyese, ya dentro de la partida.
    const storedMute = HUD.readStoredMute();
    this.audio.setMuted(storedMute === null ? this.audio.muted : storedMute);
    // Un solo interruptor: con movimiento reducido el menú se dibuja como siempre.
    this.motion = effectsAllowed();
    this.isLaunching = false;
    this.menuButtons = [];
    this.breathTweens = [];
    this.idleTween = null;
    // El registry sobrevive al cambio de escena: volver del final conserva la
    // elección anterior, así el récord que se muestra es el de lo que se acaba de jugar.
    const saved = this.registry.get('menuSelection');
    this.selectedMode = saved?.mode === GAME_MODES.VS_AI ? GAME_MODES.VS_AI : GAME_MODES.LOCAL;
    this.selectedDifficulty = Object.values(AI_DIFFICULTY).includes(saved?.difficulty)
      ? saved.difficulty
      : AI_CONFIG.defaultDifficulty;
    this.selectedBoardSize = [3, 4, 5, 6].includes(saved?.size) ? saved.size : 5;
    this.grid = new NeonGrid(this);
    this.title = new GlitchText(this, GAME_WIDTH / 2, MENU_LAYOUT.titleY, 'TIMBIRICHE', {
      color: SVG_COLORS.textPrimary,
      fontFamily: FONTS.TITLE,
      fontSize: UI_STYLE.titleSize,
      fontStyle: 'bold',
    });

    this.subtitle = this.add.text(GAME_WIDTH / 2, MENU_LAYOUT.subtitleY, 'DOTS AND BOXES', {
      color: SVG_COLORS.textMuted,
      fontFamily: FONTS.GAME,
      fontSize: UI_STYLE.subtitleSize,
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5);

    const menuPanel = this.add.rectangle(
      MENU_LAYOUT.panelX,
      MENU_LAYOUT.panelY,
      MENU_LAYOUT.panelWidth,
      MENU_LAYOUT.panelHeight,
      COLORS.menuPanelBg,
      0.92,
    )
      .setStrokeStyle(1, COLORS.panelBorder, 0.9);
    menuPanel.setDepth(DEPTH.background);
    this.menuPanel = menuPanel;

    this.add.text(GAME_WIDTH / 2, MENU_LAYOUT.modeTitleY, 'MODO DE JUEGO', {
      color: SVG_COLORS.playerOne,
      fontFamily: FONTS.GAME,
      fontSize: MENU_LAYOUT.sectionTitleSize,
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5);

    this.localModeButton = this.createMenuButton(
      GAME_WIDTH / 2,
      MENU_LAYOUT.hotSeatY,
      MENU_LAYOUT.hotSeatWidth,
      MENU_LAYOUT.hotSeatHeight,
      'HOT-SEAT',
      () => this.selectMode(GAME_MODES.LOCAL),
      { fontSize: MENU_LAYOUT.hotSeatFontSize, icon: (g) => this.drawSeatsIcon(g) },
    );

    const aiButtonCenters = this.getRowCenters(3, MENU_LAYOUT.aiButtonWidth, MENU_LAYOUT.aiButtonGap);
    // El prefijo "VS IA ·" se repetía tres veces bajo un título que ya dice qué es esto.
    // Quitarlo deja sitio al icono, y las barras dicen la dificultad antes que la palabra.
    this.easyModeButton = this.createMenuButton(
      aiButtonCenters[0], MENU_LAYOUT.aiRowY, MENU_LAYOUT.aiButtonWidth, MENU_LAYOUT.aiButtonHeight,
      'IA · EASY', () => this.selectMode(GAME_MODES.VS_AI, AI_DIFFICULTY.EASY),
      { fontSize: MENU_LAYOUT.aiFontSize, icon: (g) => this.drawDifficultyIcon(g, 1) },
    );
    this.mediumModeButton = this.createMenuButton(
      aiButtonCenters[1], MENU_LAYOUT.aiRowY, MENU_LAYOUT.aiButtonWidth, MENU_LAYOUT.aiButtonHeight,
      'IA · MEDIUM', () => this.selectMode(GAME_MODES.VS_AI, AI_DIFFICULTY.MEDIUM),
      { fontSize: MENU_LAYOUT.aiFontSizeLong, icon: (g) => this.drawDifficultyIcon(g, 2) },
    );
    this.hardModeButton = this.createMenuButton(
      aiButtonCenters[2], MENU_LAYOUT.aiRowY, MENU_LAYOUT.aiButtonWidth, MENU_LAYOUT.aiButtonHeight,
      'IA · HARD', () => this.selectMode(GAME_MODES.VS_AI, AI_DIFFICULTY.HARD),
      { fontSize: MENU_LAYOUT.aiFontSize, icon: (g) => this.drawDifficultyIcon(g, 3) },
    );

    this.add.text(GAME_WIDTH / 2, MENU_LAYOUT.boardTitleY, 'SELECCIONA EL TABLERO', {
      color: SVG_COLORS.textPrimary,
      fontFamily: FONTS.GAME,
      fontSize: MENU_LAYOUT.boardTitleSize,
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5);

    const boardColumnCenters = this.getRowCenters(2, MENU_LAYOUT.boardButtonWidth, MENU_LAYOUT.boardColumnGap);
    [3, 4, 5, 6].forEach((gridSize, index) => {
      const rowY = index < 2 ? MENU_LAYOUT.boardFirstRowY : MENU_LAYOUT.boardSecondRowY;
      const column = index % 2;
      const button = this.createMenuButton(
        boardColumnCenters[column],
        rowY,
        MENU_LAYOUT.boardButtonWidth,
        MENU_LAYOUT.boardButtonHeight,
        `${gridSize}x${gridSize}`,
        () => this.selectBoardSize(gridSize),
        {
          fontSize: MENU_LAYOUT.boardFontSize,
          selected: gridSize === this.selectedBoardSize,
          icon: (g) => this.drawBoardIcon(g, gridSize),
        },
      );
      this.boardButtons ??= {};
      this.boardButtons[gridSize] = button;
    });

    this.startButton = this.createMenuButton(
      GAME_WIDTH / 2,
      MENU_LAYOUT.startY,
      MENU_LAYOUT.startWidth,
      MENU_LAYOUT.startHeight,
      'EMPEZAR',
      () => this.startGame(),
      {
        fontSize: MENU_LAYOUT.startFontSize,
        baseColor: COLORS.playerOne,
        hoverColor: COLORS.buttonPrimaryHover,
        pressedColor: COLORS.buttonPrimaryPressed,
        activeColor: COLORS.playerOne,
        textColor: SVG_COLORS.buttonActiveText,
        icon: (g) => this.drawPlayIcon(g),
      },
    );
    // Teclado: si ya está todo elegido, ENTER o espacio no deberían obligar a apuntar.
    this.input.keyboard?.on('keydown-ENTER', () => this.startGame());
    this.input.keyboard?.on('keydown-SPACE', () => this.startGame());

    // La banda inferior estaba vacía: el récord solo tira si se recuerda antes de jugar.
    this.recordText = this.add.text(GAME_WIDTH / 2, MENU_LAYOUT.recordY, '', {
      color: SVG_COLORS.textMuted,
      fontFamily: FONTS.GAME,
      fontSize: MENU_LAYOUT.recordSize,
      letterSpacing: 1,
    }).setOrigin(0.5);

    this.events.once('shutdown', () => this.stopIdleMotion());
    this.syncSelectionButtons();
    this.playEntrance();
    this.refreshRecord();

    // Señal de arranque: el loader HTML se retira solo después de crear el menú.
    window.dispatchEvent(new Event('timbiriche:menu-ready'));
  }

  /** Entrada escalonada. Solo transforms de contenedor: cero escrituras de estilo. */
  playEntrance() {
    if (!this.motion) return;
    this.title.container.setScale(1.25).setAlpha(0);
    this.subtitle.setAlpha(0);
    this.menuPanel.setScale(1, 0.04);
    // Deshabilitados hasta terminar el escalonado: un botón a alpha 0 no debe ser clicable.
    this.menuButtons.forEach((button) => {
      button.container.setAlpha(0);
      button.setEnabled(false);
    });

    this.tweens.add({
      targets: this.title.container,
      scale: 1,
      alpha: 1,
      duration: MENU_FEEL.titleDuration,
      ease: 'Back.out',
      onComplete: () => this.startIdleMotion(),
    });
    const subtitleY = this.subtitle.y;
    this.subtitle.y = subtitleY + 14;
    this.tweens.add({
      targets: this.subtitle,
      y: subtitleY,
      alpha: 1,
      duration: MENU_FEEL.subtitleDuration,
      delay: MENU_FEEL.subtitleDelay,
      ease: 'Quad.out',
    });
    this.tweens.add({
      targets: this.menuPanel,
      scaleY: 1,
      duration: MENU_FEEL.panelDuration,
      delay: MENU_FEEL.panelDelay,
      ease: 'Back.out',
    });
    this.menuButtons.forEach((button, index) => {
      const finalY = button.container.y;
      button.container.y = finalY + 10;
      this.tweens.add({
        targets: button.container,
        y: finalY,
        alpha: 1,
        duration: MENU_FEEL.buttonDuration,
        delay: MENU_FEEL.buttonDelay + index * MENU_FEEL.buttonStagger,
        ease: 'Quad.out',
        onComplete: () => {
          if (this.isLaunching) return;
          button.setEnabled(true);
          // El latido de lo seleccionado empieza cuando termina de entrar el último.
          if (index === this.menuButtons.length - 1) this.applyBreathing();
        },
      });
    });
  }

  startIdleMotion() {
    if (!this.motion || this.idleTween) return;
    this.idleTween = this.tweens.add({
      targets: this.title.container,
      scale: MENU_FEEL.idleScale,
      duration: MENU_FEEL.idleDuration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  /** Un repeat -1 vivo tras cambiar de escena es una fuga: se mata explícitamente. */
  stopIdleMotion() {
    this.idleTween?.stop?.();
    this.idleTween = null;
    this.breathTweens.forEach((tween) => tween?.stop?.());
    this.breathTweens = [];
    // El latido deja el botón a media escala si se corta a mitad de ciclo.
    this.startButton?.container?.setScale(1);
  }

  /** Latido suave en lo seleccionado. Va sobre el contenedor: GlitchButton no lo toca. */
  applyBreathing() {
    if (!this.motion) return;
    this.breathTweens.forEach((tween) => tween?.stop?.());
    this.breathTweens = [];
    const selected = [this.currentModeButton(), this.boardButtons?.[this.selectedBoardSize]];
    this.menuButtons.forEach((button) => {
      if (!selected.includes(button)) button.container.setAlpha(1);
    });
    selected.forEach((button) => {
      if (!button) return;
      this.breathTweens.push(this.tweens.add({
        targets: button.container,
        alpha: 0.78,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      }));
    });
    // EMPEZAR late en escala, no en opacidad: entre botones que parpadean, el que
    // crece es el que se lee como "pulsa aquí" y no como "esto está seleccionado".
    if (this.startButton?.container) {
      this.startButton.container.setScale(1);
      this.breathTweens.push(this.tweens.add({
        targets: this.startButton.container,
        scale: MENU_FEEL.startPulseScale,
        duration: MENU_FEEL.startPulseDuration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      }));
    }
  }

  currentModeButton() {
    if (this.selectedMode !== GAME_MODES.VS_AI) return this.localModeButton;
    return {
      [AI_DIFFICULTY.EASY]: this.easyModeButton,
      [AI_DIFFICULTY.MEDIUM]: this.mediumModeButton,
      [AI_DIFFICULTY.HARD]: this.hardModeButton,
    }[this.selectedDifficulty] ?? this.mediumModeButton;
  }

  createMenuButton(x, y, width, height, label, onClick, options = {}) {
    // Único momento en que el navegador permite crear el AudioContext: un click real.
    const button = new GlitchButton(this, x, y, width, height, label, () => {
      this.audio.unlock();
      onClick();
    }, options);
    // playHover se autoprotege: sin contexto de audio o en silencio no cuesta nada.
    button.background.on('pointerover', () => this.audio.playHover());
    this.menuButtons.push(button);
    return button;
  }

  getRowCenters(count, width, gap) {
    const totalWidth = count * width + (count - 1) * gap;
    const firstCenter = GAME_WIDTH / 2 - totalWidth / 2 + width / 2;
    return Array.from({ length: count }, (_, index) => firstCenter + index * (width + gap));
  }

  /** Único punto que traduce la selección a estados de botón. */
  syncSelectionButtons() {
    const versusAi = this.selectedMode === GAME_MODES.VS_AI;
    this.localModeButton.setSelected(!versusAi);
    this.easyModeButton.setSelected(versusAi && this.selectedDifficulty === AI_DIFFICULTY.EASY);
    this.mediumModeButton.setSelected(versusAi && this.selectedDifficulty === AI_DIFFICULTY.MEDIUM);
    this.hardModeButton.setSelected(versusAi && this.selectedDifficulty === AI_DIFFICULTY.HARD);
    Object.entries(this.boardButtons ?? {}).forEach(([size, button]) => {
      button.setSelected(Number(size) === this.selectedBoardSize);
    });
  }

  selectMode(mode, difficulty = this.selectedDifficulty) {
    if (this.isLaunching) return;
    this.selectedMode = mode;
    this.selectedDifficulty = difficulty;
    const versusAi = mode === GAME_MODES.VS_AI;
    this.syncSelectionButtons();
    // La variante descendente es la de la IA: el modo se oye, no solo se ve.
    this.audio.playTurnChange(versusAi ? 1 : 0);
    this.applyBreathing();
    this.refreshRecord();
  }

  selectBoardSize(gridSize) {
    if (this.isLaunching) return;
    this.selectedBoardSize = gridSize;
    this.syncSelectionButtons();
    this.refreshRecord();
    this.applyBreathing();
    // Elegir tamaño ya no arranca la partida: eso lo hace EMPEZAR, que sí se ve.
    this.audio.playTurnChange(0);
  }

  /** Dos asientos enfrentados: el modo por turnos en la misma pantalla. */
  drawSeatsIcon(graphics) {
    const k = MENU_LAYOUT.iconScale;
    [[-5, COLORS.playerOne], [5, COLORS.playerTwo]].forEach(([side, color]) => {
      graphics.fillStyle(color, 1);
      graphics.fillCircle(side * k, -4 * k, 3 * k);
      graphics.fillRect((side - 3.5) * k, 0, 7 * k, 5 * k);
    });
  }

  /** Barras de señal: una llena por nivel. Se lee antes que la palabra. */
  drawDifficultyIcon(graphics, level) {
    const k = MENU_LAYOUT.iconScale;
    for (let index = 0; index < 3; index += 1) {
      const height = (4 + index * 3.5) * k;
      graphics.fillStyle(index < level ? COLORS.playerOne : COLORS.textDim, index < level ? 1 : 0.45);
      graphics.fillRect((index * 4 - 6) * k, height / -2 + 5 * k, 2.6 * k, height);
    }
  }

  /** Retícula de puntos del tamaño real del tablero: el botón enseña lo que da. */
  drawBoardIcon(graphics, gridSize) {
    const k = MENU_LAYOUT.iconScale;
    const step = 4.5 * k;
    const origin = -((gridSize - 1) * step) / 2;
    graphics.fillStyle(COLORS.playerOne, 0.85);
    for (let row = 0; row < gridSize; row += 1) {
      for (let column = 0; column < gridSize; column += 1) {
        graphics.fillCircle(origin + column * step, origin + row * step, 1.1 * k);
      }
    }
  }

  /** Triángulo de play. Es el icono que nadie tiene que aprender. */
  drawPlayIcon(graphics) {
    const k = MENU_LAYOUT.iconScale;
    graphics.fillStyle(COLORS.background, 1);
    graphics.fillTriangle(-4 * k, -7 * k, -4 * k, 7 * k, 7 * k, 0);
  }

  /** Récord de la combinación seleccionada, con la misma clave que escribe el panel final. */
  refreshRecord() {
    if (!this.recordText) return;
    const record = GameOverPanel.readRecord(GameOverPanel.recordKey(this.selectedMode, this.selectedBoardSize));
    if (!record) {
      this.recordText.setText('');
      return;
    }
    const modeLabel = this.selectedMode === GAME_MODES.VS_AI ? 'VS IA' : 'HOT-SEAT';
    const size = this.selectedBoardSize;
    this.recordText.setText(`MEJOR ${size}x${size} ${modeLabel} · RANGO ${record.grade ?? '-'} · ${record.score ?? 0} CAJAS · RACHA x${record.streak ?? 0}`);
  }

  startGame(gridSize = this.selectedBoardSize) {
    // El flag impide que un doble click arranque dos escenas durante el fundido.
    if (this.isLaunching) return;
    this.isLaunching = true;
    this.registry.set('menuSelection', { mode: this.selectedMode, difficulty: this.selectedDifficulty, size: gridSize });
    this.stopIdleMotion();
    this.menuButtons.forEach((button) => button.setEnabled(false));
    // Remate de lanzamiento: el corte seco al bed de la partida era lo peor del menú.
    this.audio.playBoxClaim(0, 0);
    let launched = false;
    const launch = () => {
      if (launched) return;
      launched = true;
      this.scene.start('GameScene', createMatchConfig(gridSize, this.selectedMode, this.selectedDifficulty));
    };
    if (!this.motion) {
      launch();
      return;
    }
    this.cameras.main.once('camerafadeoutcomplete', launch);
    // Red de seguridad: si el evento nunca llega, la partida arranca igual.
    this.time.delayedCall(MENU_FEEL.fadeOutDuration + 120, launch);
    this.cameras.main.fadeOut(MENU_FEEL.fadeOutDuration, 10, 11, 16);
  }
}
