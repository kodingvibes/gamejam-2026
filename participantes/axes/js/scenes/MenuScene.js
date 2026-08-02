class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.audio = new AudioManager();
    this.selectedMode = GAME_MODES.LOCAL;
    this.selectedDifficulty = AI_CONFIG.defaultDifficulty;
    this.selectedBoardSize = 5;
    this.title = new GlitchText(this, GAME_WIDTH / 2, 108, 'TIMBIRICHE', {
      color: SVG_COLORS.textPrimary,
      fontFamily: FONTS.TITLE,
      fontSize: UI_STYLE.titleSize,
      fontStyle: 'bold',
    });

    this.add.text(GAME_WIDTH / 2, 172, 'DOTS AND BOXES', {
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

    this.add.text(GAME_WIDTH / 2, MENU_LAYOUT.modeTitleY, 'MODO DE JUEGO', {
      color: SVG_COLORS.playerOne,
      fontFamily: FONTS.GAME,
      fontSize: '18px',
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
      { fontSize: '15px', selected: true },
    );

    const aiButtonCenters = this.getRowCenters(3, MENU_LAYOUT.aiButtonWidth, MENU_LAYOUT.aiButtonGap);
    this.easyModeButton = this.createMenuButton(
      aiButtonCenters[0], MENU_LAYOUT.aiRowY, MENU_LAYOUT.aiButtonWidth, MENU_LAYOUT.aiButtonHeight,
      'VS IA · EASY', () => this.selectMode(GAME_MODES.VS_AI, AI_DIFFICULTY.EASY), { fontSize: '12px' },
    );
    this.mediumModeButton = this.createMenuButton(
      aiButtonCenters[1], MENU_LAYOUT.aiRowY, MENU_LAYOUT.aiButtonWidth, MENU_LAYOUT.aiButtonHeight,
      'VS IA · MEDIUM', () => this.selectMode(GAME_MODES.VS_AI, AI_DIFFICULTY.MEDIUM), { fontSize: '11px' },
    );
    this.hardModeButton = this.createMenuButton(
      aiButtonCenters[2], MENU_LAYOUT.aiRowY, MENU_LAYOUT.aiButtonWidth, MENU_LAYOUT.aiButtonHeight,
      'VS IA · HARD', () => this.selectMode(GAME_MODES.VS_AI, AI_DIFFICULTY.HARD), {
        fontSize: '12px',
      },
    );

    this.add.text(GAME_WIDTH / 2, MENU_LAYOUT.boardTitleY, 'SELECCIONA EL TABLERO', {
      color: SVG_COLORS.textPrimary,
      fontFamily: FONTS.GAME,
      fontSize: '17px',
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5);

    // this.add.text(GAME_WIDTH / 2, 282, 'CADA LÍNEA CAMBIA EL CONTROL', {
    //   color: SVG_COLORS.textMuted,
    //   fontFamily: FONTS.BODY,
    //   fontSize: '11px',
    //   letterSpacing: 1,
    // }).setOrigin(0.5);

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
        { fontSize: '16px', selected: gridSize === this.selectedBoardSize },
      );
      this.boardButtons ??= {};
      this.boardButtons[gridSize] = button;
    });

    this.add.text(GAME_WIDTH / 2, MENU_LAYOUT.helpY, '(mouse) NAVEGA   ·   (left click) CONFIRMA', {
      color: SVG_COLORS.textMuted,
      fontFamily: FONTS.GAME,
      fontSize: '14px',
      letterSpacing: 1,
    }).setOrigin(0.5);

    // Señal de arranque: el loader HTML se retira solo después de crear el menú.
    window.dispatchEvent(new Event('timbiriche:menu-ready'));
  }

  createMenuButton(x, y, width, height, label, onClick, options = {}) {
    // Único momento en que el navegador permite crear el AudioContext: un click real.
    return new GlitchButton(this, x, y, width, height, label, () => {
      this.audio.unlock();
      onClick();
    }, options);
  }

  getRowCenters(count, width, gap) {
    const totalWidth = count * width + (count - 1) * gap;
    const firstCenter = GAME_WIDTH / 2 - totalWidth / 2 + width / 2;
    return Array.from({ length: count }, (_, index) => firstCenter + index * (width + gap));
  }

  selectMode(mode, difficulty = this.selectedDifficulty) {
    this.selectedMode = mode;
    this.selectedDifficulty = difficulty;
    const versusAi = mode === GAME_MODES.VS_AI;
    this.localModeButton.setSelected(!versusAi);
    this.easyModeButton.setSelected(versusAi && difficulty === AI_DIFFICULTY.EASY);
    this.mediumModeButton.setSelected(versusAi && difficulty === AI_DIFFICULTY.MEDIUM);
    this.hardModeButton.setSelected(versusAi && difficulty === AI_DIFFICULTY.HARD);
  }

  selectBoardSize(gridSize) {
    this.selectedBoardSize = gridSize;
    Object.entries(this.boardButtons).forEach(([size, button]) => {
      button.setSelected(Number(size) === gridSize);
    });
    // Se conserva el flujo existente: elegir tamaño inicia la partida.
    this.startGame(gridSize);
  }

  startGame(gridSize = this.selectedBoardSize) {
    this.scene.start('GameScene', createMatchConfig(gridSize, this.selectedMode, this.selectedDifficulty));
  }
}
