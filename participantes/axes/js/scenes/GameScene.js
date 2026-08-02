// Escena que compone tablero, HUD y panel final sin mezclar sus responsabilidades.
class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.gameFinished = false;
    this.isReady = false;
  }

  init(data) {
    const incomingConfig = data?.matchConfig ?? data;
    this.matchConfig = validateMatchConfig(incomingConfig)
      ? cloneMatchConfig(incomingConfig)
      : createMatchConfig(Number.isInteger(data?.gridSize) ? data.gridSize : 5, data?.mode);
    this.gridSize = this.matchConfig.gridSize;
    this.gameFinished = false;
    this.isReady = false;
    this.state = null;
    this.confirmModal = null;
    this.gameOverTimer = null;
    this.aiTurnTimer = null;
    this.finalResult = null;
    this.isNavigating = false;
    this.lastRejectTime = -Infinity;
    this.stageShake = null;
  }

  create() {
    // El AudioManager es singleton: reiniciar la escena no crea otro AudioContext.
    this.audioManager = new AudioManager();
    this.audioManager.setDifficulty(this.matchConfig.players[1]?.difficulty);
    this.audioManager.setProgress(0);
    this.reactivePulse = 0;
    this.reactiveMid = 0;
    // Con movimiento reducido el tablero se queda en los valores base, sin latido.
    this.reactiveEnabled = !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

    // Crear la UI antes del tablero evita callbacks con referencias incompletas.
    this.hud = new HUD(this, () => this.openRestartConfirmation());
    this.gameOverPanel = new GameOverPanel(
      this,
      () => this.restartGame(),
      () => this.goToMenu(),
    );
    this.board = new Board(this.game.canvas.parentElement, this.gridSize, (result) => this.handleMove(result));
    this.state = this.board.state;
    this.hud.update(this.state);
    this.hud.setAiThinking(false);
    this.isReady = true;
    // El HUD ya aplicó la preferencia guardada de silencio.
    if (!this.audioManager.muted) this.audioManager.startMusic();
    this.updateTurnController();

    this.cleanupAudio = () => {
      this.audioManager?.stopMusic();
      this.hud?.resetReactive();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupAudio);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupAudio);
    this.cleanupBoard = () => {
      if (!this.board) return;
      this.board.setInteractive(false);
      this.board.destroy();
      this.board = null;
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupBoard);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupBoard);
    this.cleanupModal = () => {
      this.confirmModal?.destroy();
      this.confirmModal = null;
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupModal);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupModal);
    this.cleanupGameOverTimer = () => {
      this.gameOverTimer?.remove(false);
      this.gameOverTimer = null;
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupGameOverTimer);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupGameOverTimer);
    this.cleanupAiTimer = () => this.cancelAiTurn();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupAiTimer);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupAiTimer);
  }

  /**
   * Una sola lectura del audio por frame; el resto de la escena usa estos valores.
   */
  update() {
    if (!this.audioManager || !this.hud || !this.reactiveEnabled) return;
    const pulse = this.audioManager.getBeat();
    const bands = this.audioManager.getBands();
    // Sin audio todo llega en cero y los "floor" dejan el tablero con su aspecto normal.
    const target = Math.min(1, pulse * 0.7 + bands.low * 0.6);
    this.reactivePulse += (target - this.reactivePulse) * AUDIO_REACTIVE.smoothing;
    this.reactiveMid += (bands.mid - this.reactiveMid) * AUDIO_REACTIVE.smoothing;
    this.hud.setReactive(
      this.reactivePulse,
      AUDIO_REACTIVE.boxOpacityFloor + AUDIO_REACTIVE.boxOpacityRange * this.reactiveMid,
    );
  }

  /** @param {{state: object, accepted: boolean, completedBoxIds: string[], lineId: string}} result */
  handleMove(result) {
    if (!this.isReady || this.gameFinished || !this.hud || !this.board) return;
    if (!result || !result.state || !Array.isArray(result.state.scores)) return;
    if (!result.accepted) {
      this.rejectMove();
      return;
    }

    const previousPlayer = this.state.currentPlayer;
    this.state = result.state;
    this.hud.update(this.state);
    this.audioManager.setProgress((this.state.scores[0] + this.state.scores[1]) / this.state.boxes.length);
    this.audioManager.playMove(result.lineId, this.gridSize);
    this.audioManager.vibrate(HAPTICS.move);

    if (result.completedBoxIds.length > 0) this.celebrateBoxes(result.completedBoxIds, previousPlayer);
    else if (this.state.currentPlayer !== previousPlayer) this.audioManager.playTurnChange(this.state.currentPlayer);

    if (this.state.gameOver || isGameOver(this.state)) this.finishGame();
    else this.updateTurnController();
  }

  /**
   * Sacude el contenedor del juego. El canvas de Phaser y el SVG del tablero son
   * hermanos absolutos dentro de #game: mover el padre los desplaza como una pieza.
   * @param {number} duration ms @param {number} intensity misma unidad que Phaser: fracción del ancho
   */
  shakeStage(duration, intensity) {
    // Mismo interruptor de movimiento reducido que el resto de la escena.
    if (!this.reactiveEnabled) return;
    const stage = this.game.canvas?.parentElement;
    if (!stage || typeof stage.animate !== 'function') return;
    const amplitude = intensity * GAME_WIDTH;
    try {
      this.stageShake?.cancel();
      this.stageShake = stage.animate([
        { transform: 'translate(0, 0)' },
        { transform: `translate(${-amplitude}px, ${amplitude * 0.6}px)`, offset: 0.25 },
        { transform: `translate(${amplitude}px, ${-amplitude * 0.5}px)`, offset: 0.55 },
        { transform: `translate(${-amplitude * 0.45}px, 0)`, offset: 0.8 },
        { transform: 'translate(0, 0)' },
      ], { duration, easing: 'ease-out' });
      // Phaser cachea el rect del canvas cada 500ms: si lo mide desplazado, los
      // botones quedan desalineados hasta el siguiente sondeo. Se recalibra al final.
      this.stageShake.finished.then(() => this.scale?.updateBounds(), () => {});
    } catch (error) {
      // Decorativo: sin sacudida la jugada ya quedó aplicada y el tablero sigue visible.
      console.warn('Shake no pudo ejecutarse.', error);
    }
  }

  /** Click sobre una línea ya trazada: antes era un click muerto y silencioso. */
  rejectMove() {
    // Un solo guardián para sonido, háptico y sacudida: el clickeo rápido no los acumula.
    const now = this.time.now;
    if (now - this.lastRejectTime < GAME_FEEL.invalidCooldown) return;
    this.lastRejectTime = now;
    this.audioManager.playInvalid();
    this.audioManager.vibrate(HAPTICS.invalid);
    this.shakeStage(GAME_FEEL.invalidShakeDuration, GAME_FEEL.invalidShakeIntensity);
  }

  /** @param {string[]} boxIds cajas de una misma jugada @param {number} player */
  celebrateBoxes(boxIds, player) {
    const color = player === 0 ? SVG_COLORS.playerOne : SVG_COLORS.playerTwo;
    const lastIndex = boxIds.length - 1;
    boxIds.forEach((boxId, chainIndex) => {
      this.audioManager.playBoxClaim(chainIndex);
      const view = this.board.boxes.find((box) => box.id === boxId);
      if (!view) return;
      try {
        playClaimBurst({
          // Sobre líneas y puntos: el estallido debe leerse por encima del tablero.
          parent: this.board.svg,
          x: view.centerX,
          y: view.centerY,
          color,
          chainIndex,
        });
      } catch (error) {
        // El estallido es decorativo: la caja ya quedó reclamada y la partida sigue.
        console.warn('ClaimBurst no pudo ejecutarse.', error);
      }
    });

    this.shakeStage(
      GAME_FEEL.shakeDuration,
      GAME_FEEL.shakeIntensity + lastIndex * GAME_FEEL.shakePerChain,
    );
    // Un solo pulso: la cadena solo lo alarga.
    this.audioManager.vibrate(HAPTICS.box + lastIndex * HAPTICS.boxPerChain);
    if (boxIds.length > 1) this.hud.showChain();
  }

  finishGame() {
    if (this.gameFinished || !this.state || !this.board) return;
    this.gameFinished = true;
    this.cancelAiTurn();
    this.hud.setAiThinking(false);
    this.board.setInteractive(false);
    this.board.setMoveEnabled(false);
    this.hud.setRestartVisible(false);
    this.hud.update(this.state);
    this.finalResult = Object.freeze(getGameResult(this.state));
    // El bed se detiene para que el remate final quede limpio.
    this.audioManager.stopMusic();
    const humanDefeated = this.matchConfig.mode === GAME_MODES.VS_AI && this.finalResult.winner === 1;
    if (humanDefeated) {
      this.audioManager.playDefeat();
    } else {
      this.audioManager.playVictory();
      this.audioManager.vibrate(HAPTICS.victory);
    }

    this.gameOverTimer = this.time.delayedCall(GAME_TIMING.gameOverDelay, () => {
      this.gameOverTimer = null;
      if (!this.gameFinished || !this.finalResult || !this.board || !this.gameOverPanel) return;
      this.board.setModalLayer(true);
      this.board.setVisible(false);
      this.gameOverPanel.show(this.finalResult);
    });
  }

  openRestartConfirmation() {
    if (!this.isReady || this.gameFinished || this.confirmModal) return;

    this.cancelAiTurn();
    this.hud.setAiThinking(false);
    this.board.setInteractive(false);
    this.board.setModalLayer(true);
    this.hud.setRestartEnabled(false);
    this.confirmModal = new ConfirmModal(this, {
      title: '¿DESEAS REINICIAR LA PARTIDA?',
      message: 'Se perderá el progreso actual.',
      confirmLabel: 'SÍ',
      cancelLabel: 'NO',
      menuLabel: 'VOLVER AL MENÚ PRINCIPAL',
      onConfirm: () => {
        this.confirmModal = null;
        this.restartGame();
      },
      onCancel: () => {
        this.confirmModal = null;
        // Se bloqueó al abrir la confirmación: sin esto REINICIAR queda muerto tras un NO.
        this.hud.setRestartEnabled(true);
        if (!this.gameFinished) this.updateTurnController();
      },
      onMenu: () => this.goToMenu(),
    });
  }

  restartGame() {
    if (!this.matchConfig) return;
    this.cancelAiTurn();
    this.scene.restart({ matchConfig: cloneMatchConfig(this.matchConfig) });
  }

  goToMenu() {
    if (this.isNavigating) return;
    this.isNavigating = true;
    this.cancelAiTurn();
    this.gameOverTimer?.remove(false);
    this.gameOverTimer = null;
    const modal = this.confirmModal;
    this.confirmModal = null;
    if (modal && !modal.destroyed) modal.destroy();
    this.isReady = false;
    this.gameFinished = true;
    this.gameOverPanel?.hide();
    if (this.board) {
      this.board.setInteractive(false);
      this.board.setMoveEnabled(false);
      this.board.setModalLayer(false);
    }
    this.scene.start('MenuScene');
  }

  updateTurnController() {
    if (!this.isReady || this.gameFinished || !this.board || this.confirmModal) return;
    this.board.setModalLayer(false);

    if (isAITurn(this.matchConfig, this.state)) {
      this.board.setInteractive(false);
      this.hud.setAiThinking(true);
      this.scheduleAiTurn();
      return;
    }

    this.cancelAiTurn();
    this.hud.setAiThinking(false);
    this.board.setInteractive(true);
  }

  scheduleAiTurn() {
    if (this.aiTurnTimer || !isAITurn(this.matchConfig, this.state)) return;
    this.aiTurnTimer = this.time.delayedCall(AI_CONFIG.turnDelay, () => {
      this.aiTurnTimer = null;
      this.executeAiTurn();
    });
  }

  executeAiTurn() {
    const sceneActive = this.sys.isActive();
    const aiConfig = getCurrentPlayerConfig(this.matchConfig, this.state);
    if (!sceneActive || this.gameFinished || !this.isReady || !this.board || this.confirmModal
      || !this.board.moveEnabled || aiConfig?.type !== 'ai') return;

    const availableMoves = getAvailableMoves(this.state);
    if (availableMoves.length === 0) return;
    const lineId = chooseMove(this.state, aiConfig.difficulty);
    if (!lineId || !availableMoves.includes(lineId)) return;
    this.board.playMove(lineId);
  }

  cancelAiTurn() {
    this.aiTurnTimer?.remove(false);
    this.aiTurnTimer = null;
  }
}
