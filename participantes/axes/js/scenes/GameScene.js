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
    // Máximo de la partida: streakCount se reinicia en cada cambio de turno.
    this.bestStreak = 0;
    // Caja anterior de la cadena viva: el hilo que une una cascada.
    this.chainPrevBoxId = null;
    this.lastLeader = 0;
    this.clinched = false;
    this.matchPointShown = false;
    this.safeMovesLeft = null;
    this.safeDenominator = null;
    this.safeMeterHandle = null;
    this.aiScan = null;
  }

  /** @param {string} hex color de jugador @param {number} alpha @returns {string} */
  static toRgba(hex, alpha) {
    const value = Number.parseInt(hex.slice(1), 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
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

    // La misma rejilla del menú, a media intensidad: aquí compite con el tablero.
    this.grid = new NeonGrid(this, { intensity: 0.5 });

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
    // Primera lectura del terreno seguro: la mecha ya se ve en el movimiento 0.
    this.updateSafeMeter();
    this.updateArenaTint();
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
    this.cleanupAiTimer = () => {
      this.cancelAiTurn();
      // El hueco libre pendiente no puede despertar sobre una escena ya cerrada.
      if (this.safeMeterHandle !== null) window.cancelIdleCallback?.(this.safeMeterHandle);
      this.safeMeterHandle = null;
    };
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
    const previousScores = [...this.state.scores];
    this.state = result.state;
    this.hud.update(this.state);
    this.scheduleSafeMeter();
    // Las cajas reclamadas siguen valiendo, pero solo como temperatura visual.
    // Se calcula ANTES del tinte: leerlo después lo dejaba una jugada atrás.
    this.heat = (this.state.scores[0] + this.state.scores[1]) / this.state.boxes.length;
    this.updateArenaTint();
    // El arreglo se enciende por capas: contar cajas lo deja en cero media partida.
    const drawn = this.state.lines.filter((line) => line.owner !== null).length;
    this.audioManager.setProgress(drawn / this.state.lines.length);
    this.audioManager.playMove(result.lineId, this.gridSize);
    this.audioManager.vibrate(HAPTICS.move);

    if (result.completedBoxIds.length > 0) {
      // Una racha son turnos consecutivos del mismo jugador, no cajas de una misma línea.
      if (this.streakPlayer !== previousPlayer) {
        this.streakPlayer = previousPlayer;
        this.streakCount = 0;
        this.chainPrevBoxId = null;
      }
      const runStart = this.streakCount;
      this.streakCount += result.completedBoxIds.length;
      this.celebrateBoxes(result.completedBoxIds, previousPlayer, runStart);
    } else {
      this.streakPlayer = null;
      this.streakCount = 0;
      this.chainPrevBoxId = null;
      if (this.state.currentPlayer !== previousPlayer) this.audioManager.playTurnChange(this.state.currentPlayer);
    }

    // Después de la racha, no antes: el HUD prioriza el aviso de racha sobre estos,
    // y esa prioridad solo funciona si la racha ya ocupó el hueco.
    this.reportMomentum(previousScores);

    if (this.state.gameOver || isGameOver(this.state)) this.finishGame();
    else this.updateTurnController();
  }

  /**
   * Cambio de mando, remontada, partida decidida y match point.
   * Un solo hueco de aviso: el HUD ya prioriza la racha sobre estos mensajes.
   * @param {number[]} previousScores marcador antes de la jugada
   */
  reportMomentum(previousScores) {
    const [scoreOne, scoreTwo] = this.state.scores;
    const total = this.state.boxes.length;
    const remaining = total - (scoreOne + scoreTwo);
    const diff = Math.abs(scoreOne - scoreTwo);

    // La partida ya está resuelta matemáticamente: se avisa una sola vez.
    if (!this.clinched && remaining > 0 && diff > remaining) {
      this.clinched = true;
      this.hud.showBanner('PARTIDA DECIDIDA', SVG_COLORS.sugar);
      this.audioManager.playClinch?.();
      return;
    }

    // Se vigila el SIGNO, no la diferencia: una cadena larga no dispara un aviso por caja.
    const nextLeader = Math.sign(scoreOne - scoreTwo);
    if (nextLeader !== this.lastLeader) {
      this.lastLeader = nextLeader;
      if (nextLeader === 0) {
        this.hud.showBanner('EMPATE', SVG_COLORS.textPrimary);
      } else {
        const leader = nextLeader > 0 ? 0 : 1;
        // Remontada de verdad: se venía perdiendo por tres o más antes de la jugada.
        const isComeback = previousScores[1 - leader] - previousScores[leader] >= 3;
        this.hud.showBanner(
          isComeback ? 'REMONTADA' : `J${leader + 1} TOMA LA VENTAJA`,
          leader === 0 ? SVG_COLORS.playerOne : SVG_COLORS.playerTwo,
        );
        this.audioManager.playLeadChange?.(leader, isComeback);
      }
      return;
    }

    // Un reclamo más y se pasa de la mitad: ya no hay vuelta atrás posible.
    if (!this.matchPointShown && remaining > 0 && Math.max(scoreOne, scoreTwo) === Math.floor(total / 2)) {
      this.matchPointShown = true;
      this.hud.showBanner('MATCH POINT', SVG_COLORS.sugar);
    }
  }

  /**
   * El conteo cuesta hasta 4.3ms medidos en 6x6 y el reclamo ya gasta 4ms: sumados
   * en el mismo frame se pasan de 20ms. El hueco libre del navegador es justo el
   * sitio para un dato que no es jugable; el timeout garantiza que llega igual.
   */
  scheduleSafeMeter() {
    const run = () => {
      this.safeMeterHandle = null;
      // El hueco libre cae fuera del reloj de Phaser: la escena pudo cerrarse antes.
      if (this.sys?.isActive() && !this.gameFinished) this.updateSafeMeter();
    };
    if (typeof window.requestIdleCallback === 'function') {
      this.safeMeterHandle = window.requestIdleCallback(run, { timeout: 240 });
      return;
    }
    this.time.delayedCall(0, run);
  }

  /**
   * Mecha del terreno seguro: la tensión del medio juego, hasta ahora invisible.
   * Medido: 1.34ms en 5x5 y 1.10ms en 6x6, una vez por jugada. Al llegar a cero
   * se congela: la cuenta no vuelve a subir y la fase ya cambió.
   */
  updateSafeMeter() {
    if (this.safeMovesLeft === 0 || !this.hud || !this.state) return;
    const count = findSafeMoves(this.state).length;
    if (this.safeDenominator === null && count > 0) this.safeDenominator = count;
    this.safeMovesLeft = count;
    this.hud.setSafeMeter(count, this.safeDenominator ?? 1);
    if (count !== 0) return;
    this.shakeStage(GAME_FEEL.invalidShakeDuration, GAME_FEEL.invalidShakeIntensity);
    // La música cambia de marcha aquí y no en una proporción fija de líneas.
    this.audioManager.setNoSafeMoves?.(true);
  }

  /**
   * La rejilla del fondo toma el color de quien va ganando y se satura con el avance.
   * Una escritura por jugada: nunca desde update() ni desde setReactive().
   */
  updateArenaTint() {
    const leaderColor = this.state.scores[1] > this.state.scores[0] ? SVG_COLORS.playerTwo : SVG_COLORS.playerOne;
    const alpha = (0.08 + 0.06 * this.heat).toFixed(3);
    document.documentElement.style.setProperty('--grid-border', GameScene.toRgba(leaderColor, alpha));
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
    // La última caja de la partida siempre estalla en el peldaño más alto.
    const isFinalMove = Boolean(this.state.gameOver) || isGameOver(this.state);
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
            chainIndex: isFinalMove ? GAME_FEEL.streakCap : step,
            size: view.width,
          });
        } catch (error) {
          // El estallido es decorativo: la caja ya quedó reclamada y la partida sigue.
          console.warn('ClaimBurst no pudo ejecutarse.', error);
        }
        // El hilo con la caja anterior convierte N reclamos sueltos en una cascada.
        this.board.linkClaim?.(this.chainPrevBoxId, boxId, color, step);
        this.chainPrevBoxId = boxId;
        this.hud.flingScore(view.centerX, view.centerY, player, step);
        this.board.pulseOwned(boxId, {
          radius: 1,
          scale: BOARD_PULSE.neighborScale,
          duration: BOARD_PULSE.neighborDuration,
          stagger: BOARD_PULSE.neighborStagger,
          exclude: boxIds,
        });
        // Las vacías también reaccionan: solo trazo, un relleno parecería dueño.
        this.board.rippleEmpty?.(boxId, {
          color,
          radius: EMPTY_RIPPLE.radius,
          exclude: boxIds,
        });
      };
      // Un doble se lee como DOS golpes solo si no caen en el mismo frame.
      // Pasado cierto peldaño la cadena se comprime: una racha larga acelera.
      const stagger = step >= GAME_FEEL.streakStaggerFastFrom
        ? GAME_FEEL.streakStaggerFast
        : GAME_FEEL.streakStagger;
      if (chainIndex === 0) fire();
      else this.time.delayedCall(chainIndex * stagger, fire);
    });

    // shakeStage y vibrate son los únicos consumidores sin tope propio, y NO siguen
    // al tope visual: diez peldaños de sacudida marean y 98ms de vibración es un zumbido.
    const peak = Math.min(GAME_FEEL.streakCap, runStart + boxIds.length - 1);
    const feelPeak = Math.min(GAME_FEEL.shakeChainCap, peak);
    this.shakeStage(
      GAME_FEEL.shakeDuration,
      GAME_FEEL.shakeIntensity + feelPeak * GAME_FEEL.shakePerChain,
    );
    // Un solo pulso: la cadena solo lo alarga.
    this.audioManager.vibrate(Math.min(HAPTICS.boxMax, HAPTICS.box + feelPeak * HAPTICS.boxPerChain));
    const total = runStart + boxIds.length;
    // Un destello por jugada, no por caja: trae su propio retraso tras el estallido.
    playStreakFlash({ parent: this.board.svg, streak: total });
    if (total > 1) this.hud.showStreak(total);
    this.bestStreak = Math.max(this.bestStreak, this.streakCount);
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
    // Sin esto el HUD sigue anunciando el turno del perdedor con su color encendido.
    this.hud.setFinished();
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
      const finish = () => {
        if (!this.board || !this.gameOverPanel) return;
        this.board.setModalLayer(true);
        this.board.setVisible(false);
        this.gameOverPanel.show(this.finalResult);
      };
      // ORDEN: setModalLayer baja el SVG bajo el lienzo al instante, así que la
      // disolución tiene que correr ANTES o nadie la ve.
      if (effectsAllowed()) {
        this.board.svg.animate([
          { opacity: 1, transform: 'scale(1)' },
          { opacity: 0, transform: 'scale(1.06)' },
        ], { duration: GAME_OVER_FEEL.dissolveDuration, easing: 'ease-in', fill: 'both' })
          .finished.then(finish, finish);
      } else {
        finish();
      }
    });
  }

  openRestartConfirmation() {
    if (!this.isReady || this.gameFinished || this.confirmModal) return;

    this.cancelAiTurn();
    this.hud.setAiThinking(false);
    this.board.setInteractive(false);
    this.board.setModalLayer(true);
    this.hud.setRestartEnabled(false);
    // El SÍ/NO obligaba a releer el título para saber qué se estaba respondiendo.
    // Las etiquetas dicen el verbo, y el mensaje pone en juego el marcador de verdad.
    const [scoreOne, scoreTwo] = this.state.scores;
    const claimed = scoreOne + scoreTwo;
    this.confirmModal = new ConfirmModal(this, {
      title: '¿REINICIAR LA PARTIDA?',
      message: claimed > 0
        ? `Vas ${scoreOne}-${scoreTwo}. El tablero vuelve a cero.`
        : 'El tablero vuelve a cero.',
      confirmLabel: 'REINICIAR',
      cancelLabel: 'SEGUIR JUGANDO',
      menuLabel: 'SALIR AL MENÚ',
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
      const difficulty = this.matchConfig.players[1]?.difficulty;
      // El chivatazo solo en HARD y solo si viene comiendo: una búsqueda ya hecha basta.
      const chainTell = difficulty === AI_DIFFICULTY.HARD
        && this.streakPlayer === 1
        && findScoringMoves(this.state).length > 0;
      this.hud.setAiThinking(true, difficulty, chainTell);
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
    const isClaiming = this.streakPlayer === 1 && this.streakCount > 0;
    const delay = isClaiming ? AI_CONFIG.claimDelay : AI_CONFIG.turnDelay;
    // El barrido llena los 550ms de pensar; durante una cadena estorbaría.
    if (!isClaiming && this.board) {
      this.aiScan?.cancel();
      this.aiScan = playAiScan({ parent: this.board.svg, color: SVG_COLORS.playerTwo });
    }
    this.aiTurnTimer = this.time.delayedCall(delay, () => {
      this.aiTurnTimer = null;
      this.executeAiTurn();
    });
  }

  executeAiTurn() {
    this.aiScan?.cancel();
    this.aiScan = null;
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
    // Un barrido superviviente en la siguiente partida es un fallo de lectura del tablero.
    this.aiScan?.cancel();
    this.aiScan = null;
  }
}
