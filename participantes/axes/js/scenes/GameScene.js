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
    // Racha viva: turnos consecutivos del mismo jugador. init() corre en cada reinicio.
    this.streakPlayer = null;
    this.streakCount = 0;
    this.lastClaimedBoxId = null;
    this.heat = 0;
  }

  create() {
    // El AudioManager es singleton: reiniciar la escena no crea otro AudioContext.
    this.audioManager = new AudioManager();
    this.audioManager.setDifficulty(this.matchConfig.players[1]?.difficulty);
    this.audioManager.setProgress(0);
    // Tonalidad sorteada por partida: silenciar y volver no vuelve a sortearla.
    this.audioManager.newMatch();
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
      this.heat,
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
    // El arreglo se enciende por capas: contar cajas lo deja en cero media partida.
    const drawn = this.state.lines.filter((line) => line.owner !== null).length;
    this.audioManager.setProgress(drawn / this.state.lines.length);
    // Las cajas reclamadas siguen valiendo, pero solo como temperatura visual.
    this.heat = (this.state.scores[0] + this.state.scores[1]) / this.state.boxes.length;
    this.audioManager.playMove(result.lineId, this.gridSize);
    this.audioManager.vibrate(HAPTICS.move);

    if (result.completedBoxIds.length > 0) {
      // Una racha son turnos consecutivos del mismo jugador, no cajas de una misma línea.
      if (this.streakPlayer !== previousPlayer) {
        this.streakPlayer = previousPlayer;
        this.streakCount = 0;
      }
      const runStart = this.streakCount;
      this.streakCount += result.completedBoxIds.length;
      this.celebrateBoxes(result.completedBoxIds, previousPlayer, runStart);
    } else {
      this.streakPlayer = null;
      this.streakCount = 0;
      if (this.state.currentPlayer !== previousPlayer) this.audioManager.playTurnChange(this.state.currentPlayer);
    }

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
    // En móvil el wrapper ocupa todo el ancho: moverlo de lado abriría scroll horizontal.
    // Una medida por sacudida, no por frame.
    const slack = Math.max(0, (document.documentElement.clientWidth - stage.getBoundingClientRect().width) / 2);
    const amplitudeX = Math.min(amplitude, slack);
    try {
      this.stageShake?.cancel();
      this.stageShake = stage.animate([
        { transform: 'translate(0, 0)' },
        { transform: `translate(${-amplitudeX}px, ${amplitude * 0.6}px)`, offset: 0.25 },
        { transform: `translate(${amplitudeX}px, ${-amplitude * 0.5}px)`, offset: 0.55 },
        { transform: `translate(${-amplitudeX * 0.45}px, 0)`, offset: 0.8 },
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

  /** @param {string[]} boxIds cajas de una misma jugada @param {number} player @param {number} runStart cajas ya comidas en la racha */
  celebrateBoxes(boxIds, player, runStart = 0) {
    const color = player === 0 ? SVG_COLORS.playerOne : SVG_COLORS.playerTwo;
    boxIds.forEach((boxId, chainIndex) => {
      const step = Math.min(GAME_FEEL.streakCap, runStart + chainIndex);
      const view = this.board.boxes.find((box) => box.id === boxId);
      if (view) this.lastClaimedBoxId = boxId;
      const fire = () => {
        if (!this.board || !this.hud) return;
        // Suena aquí y no en el forEach: el escalonado de la jugada ya separa los golpes,
        // y el índice de racha solo debe elegir la nota, nunca retrasarla.
        this.audioManager.playBoxClaim(step, player);
        if (!view) return;
        try {
          playClaimBurst({
            // Sobre líneas y puntos: el estallido debe leerse por encima del tablero.
            parent: this.board.svg,
            x: view.centerX,
            y: view.centerY,
            color,
            chainIndex: step,
            size: view.width,
          });
        } catch (error) {
          // El estallido es decorativo: la caja ya quedó reclamada y la partida sigue.
          console.warn('ClaimBurst no pudo ejecutarse.', error);
        }
        this.hud.flingScore(view.centerX, view.centerY, player);
        this.board.pulseOwned(boxId, {
          radius: 1,
          scale: BOARD_PULSE.neighborScale,
          duration: BOARD_PULSE.neighborDuration,
          stagger: BOARD_PULSE.neighborStagger,
          exclude: boxIds,
        });
      };
      // Un doble se lee como DOS golpes solo si no caen en el mismo frame.
      if (chainIndex === 0) fire();
      else this.time.delayedCall(chainIndex * GAME_FEEL.streakStagger, fire);
    });

    // shakeStage y vibrate son los únicos consumidores sin tope propio.
    const peak = Math.min(GAME_FEEL.streakCap, runStart + boxIds.length - 1);
    this.shakeStage(
      GAME_FEEL.shakeDuration,
      GAME_FEEL.shakeIntensity + peak * GAME_FEEL.shakePerChain,
    );
    // Un solo pulso: la cadena solo lo alarga.
    this.audioManager.vibrate(HAPTICS.box + peak * HAPTICS.boxPerChain);
    const total = runStart + boxIds.length;
    if (total > 1) this.hud.showStreak(total);
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

    // El tablero hace una reverencia y la última racha alcanza a terminar en pantalla.
    this.board.pulseOwned(this.lastClaimedBoxId, {
      scale: BOARD_PULSE.waveScale,
      duration: BOARD_PULSE.waveDuration,
      stagger: BOARD_PULSE.waveStagger,
      maxDelay: BOARD_PULSE.waveMaxDelay,
    });

    const closingDelay = GAME_TIMING.gameOverDelay
      + Math.min(GAME_FEEL.streakCap, this.streakCount) * GAME_TIMING.gameOverStreakDelay;
    this.gameOverTimer = this.time.delayedCall(closingDelay, () => {
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
    // Si la IA viene de reclamar, sigue comiendo: la pausa de "pensar" sobra.
    const delay = this.streakPlayer === 1 && this.streakCount > 0 ? AI_CONFIG.claimDelay : AI_CONFIG.turnDelay;
    this.aiTurnTimer = this.time.delayedCall(delay, () => {
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
