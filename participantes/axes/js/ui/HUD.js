/**
 * Interfaz persistente durante la partida.
 * La lógica vive en GameLogic; este objeto solo refleja el estado recibido.
 */
class HUD {
  /** @param {Phaser.Scene} scene @param {() => void} onRestart */
  constructor(scene, onRestart) {
    this.scene = scene;
    this.onRestart = onRestart;
    this.audio = new AudioManager();
    this.turnColor = SVG_COLORS.playerOne;
    this.scores = [0, 0];
    // Sin almacenamiento (iframe con sandbox, modo privado) manda el estado vivo del
    // singleton: reiniciar la escena no debe devolver el sonido contra la elección del jugador.
    const storedMute = HUD.readStoredMute();
    this.muted = storedMute === null ? this.audio.muted : storedMute;
    this.audio.setMuted(this.muted);
    // Últimos valores escritos por setReactive: evitan repintar sin cambio real.
    this.lastGlow = '';
    this.lastGridOpacity = '';
    this.lastBoxOpacity = '';

    this.playerOneCard = this.createCard(150, 36, 220, COLORS.playerOne, 'JUGADOR 1', SVG_COLORS.playerOne);
    this.playerTwoCard = this.createCard(650, 36, 220, COLORS.playerTwo, 'JUGADOR 2', SVG_COLORS.playerTwo);
    this.turnPill = scene.add.rectangle(400, 36, 150, 42, COLORS.panelBg, 0.92)
      .setStrokeStyle(1, COLORS.panelBorder, 1);
    this.turnText = scene.add.text(400, 36, '', {
      color: SVG_COLORS.textPrimary,
      fontFamily: FONTS.GAME,
      fontSize: '17px',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.thinkingText = scene.add.text(400, 90, '', {
      color: SVG_COLORS.playerTwo,
      fontFamily: FONTS.GAME,
      fontSize: '14px',
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5);

    // Aviso de cadena: encaja entre la píldora de turno y el texto de la IA.
    this.chainText = scene.add.text(400, 68, '', {
      color: SVG_COLORS.playerOne,
      fontFamily: FONTS.GAME,
      fontSize: '15px',
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0);

    this.restartButton = new GlitchButton(this.scene, 680, 750, 150, 42, 'REINICIAR', () => this.onRestart(), {
      fontSize: '15px',
    });
    this.soundButton = new GlitchButton(
      this.scene, AUDIO_TOGGLE.x, AUDIO_TOGGLE.y, AUDIO_TOGGLE.width, AUDIO_TOGGLE.height,
      this.muted ? AUDIO_TOGGLE.labelOff : AUDIO_TOGGLE.labelOn, () => this.toggleSound(),
      { fontSize: AUDIO_TOGGLE.fontSize },
    );
    [this.playerOneCard.card, this.playerOneCard.label, this.playerOneCard.score,
      this.playerTwoCard.card, this.playerTwoCard.label, this.playerTwoCard.score,
      this.turnPill, this.turnText, this.thinkingText, this.chainText].forEach((object) => object.setDepth(DEPTH.hud));
    this.restartButton.setDepth(DEPTH.controls);
    this.soundButton.setDepth(DEPTH.controls);
  }

  /** @returns {boolean|null} preferencia guardada; null si el almacenamiento no está disponible */
  static readStoredMute() {
    try {
      const stored = localStorage.getItem(AUDIO_TOGGLE.storageKey);
      // Sin clave guardada también manda el singleton: escribir pudo fallar en silencio.
      return stored === null ? null : stored === '1';
    } catch (error) {
      return null;
    }
  }

  /** Silencia a la vez música, efectos y vibración, y recuerda la elección. */
  toggleSound() {
    this.muted = this.audio.toggleMute();
    this.soundButton.setLabel(this.muted ? AUDIO_TOGGLE.labelOff : AUDIO_TOGGLE.labelOn);
    // Con la partida terminada el bed ya se detuvo a propósito: no se relanza.
    if (this.muted) this.audio.stopMusic();
    else if (!this.scene.gameFinished) this.audio.startMusic();
    try {
      localStorage.setItem(AUDIO_TOGGLE.storageKey, this.muted ? '1' : '0');
    } catch (error) {
      // Modo privado o cuota llena: la elección solo vale para esta sesión.
    }
  }

  /** @param {number} x @param {number} y @param {number} width @param {number} color @param {string} label @param {string} cssColor */
  createCard(x, y, width, color, label, cssColor) {
    const card = this.scene.add.rectangle(x, y, width, 58, COLORS.panelBg, UI_STYLE.panelAlpha)
      .setStrokeStyle(1, COLORS.panelBorder, 1);
    const labelText = this.scene.add.text(x - width / 2 + 14, y - 15, label, {
      color: SVG_COLORS.textMuted,
      fontFamily: FONTS.GAME,
      fontSize: UI_STYLE.hudLabelSize,
      fontStyle: 'bold',
      letterSpacing: 1,
    });
    const score = this.scene.add.text(x + width / 2 - 16, y + 3, '0', {
      color: cssColor,
      fontFamily: FONTS.GAME,
      fontSize: UI_STYLE.scoreSize,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    return { card, label: labelText, score, color };
  }

  /** @param {{currentPlayer: number, scores: number[]}} state */
  update(state) {
    [this.playerOneCard, this.playerTwoCard].forEach((card, index) => {
      card.score.setText(String(state.scores[index]));
      if (state.scores[index] !== this.scores[index]) this.popScore(card.score);
    });
    this.scores = [...state.scores];
    this.turnColor = state.currentPlayer === 0 ? SVG_COLORS.playerOne : SVG_COLORS.playerTwo;
    this.turnText.setText(`TURNO  //  J${state.currentPlayer + 1}`);
    this.turnText.setColor(state.currentPlayer === 0 ? SVG_COLORS.playerOne : SVG_COLORS.playerTwo);
    this.turnPill.setStrokeStyle(UI_STYLE.borderWidth, state.currentPlayer === 0 ? COLORS.playerOne : COLORS.playerTwo, 1);

    this.playerOneCard.card.setStrokeStyle(state.currentPlayer === 0 ? 2 : 1, state.currentPlayer === 0 ? COLORS.playerOne : COLORS.panelBorder, 1);
    this.playerTwoCard.card.setStrokeStyle(state.currentPlayer === 1 ? 2 : 1, state.currentPlayer === 1 ? COLORS.playerTwo : COLORS.panelBorder, 1);
    this.playerOneCard.card.setAlpha(state.currentPlayer === 0 ? 1 : UI_STYLE.inactivePlayerAlpha);
    this.playerTwoCard.card.setAlpha(state.currentPlayer === 1 ? 1 : UI_STYLE.inactivePlayerAlpha);
    this.playerOneCard.score.setAlpha(state.currentPlayer === 0 ? 1 : UI_STYLE.inactivePlayerAlpha);
    this.playerTwoCard.score.setAlpha(state.currentPlayer === 1 ? 1 : UI_STYLE.inactivePlayerAlpha);
    this.scene.game.canvas.style.borderColor = this.turnColor;
    this.scene.game.canvas.style.borderWidth = `${UI_STYLE.activePlayerBorderWidth}px`;
  }

  /** @param {Phaser.GameObjects.Text} scoreText */
  popScore(scoreText) {
    this.scene.tweens.killTweensOf(scoreText);
    scoreText.setScale(1);
    // Con movimiento reducido el marcador ya quedó escrito: solo se salta el rebote.
    if (!this.scene.reactiveEnabled) return;
    this.scene.tweens.add({
      targets: scoreText,
      scale: GAME_FEEL.scorePopScale,
      duration: GAME_FEEL.scorePopDuration,
      ease: 'Back.out',
      yoyo: true,
    });
  }

  /** Una línea toca como mucho dos cajas: el aviso solo puede ser un doble. */
  showChain() {
    this.scene.tweens.killTweensOf(this.chainText);
    this.chainText.setText('DOBLE');
    this.chainText.setColor(this.turnColor);
    // Con movimiento reducido el aviso aparece ya a tamaño final y solo se desvanece.
    this.chainText.setAlpha(1).setScale(this.scene.reactiveEnabled ? 0.7 : 1);
    if (this.scene.reactiveEnabled) {
      this.scene.tweens.add({
        targets: this.chainText,
        scale: 1,
        duration: GAME_FEEL.chainPopDuration,
        ease: 'Back.out',
      });
    }
    this.scene.tweens.add({
      targets: this.chainText,
      alpha: 0,
      delay: GAME_FEEL.chainHoldDuration,
      duration: GAME_FEEL.chainFadeDuration,
    });
  }

  /**
   * Respiración del borde del lienzo y de la rejilla de fondo.
   * @param {number} pulse 0..1 ya suavizado por la escena
   * @param {number} boxOpacity opacidad de relleno de las cajas reclamadas
   */
  setReactive(pulse, boxOpacity) {
    // Cada escritura repinta: se cuantizan los valores y solo se aplica lo que cambió.
    const glow = Math.round(AUDIO_REACTIVE.glowFloor + AUDIO_REACTIVE.glowRange * pulse);
    const shadow = `0 0 ${glow}px ${this.turnColor}${AUDIO_REACTIVE.glowAlpha}`;
    const gridOpacity = (AUDIO_REACTIVE.gridOpacityFloor + AUDIO_REACTIVE.gridOpacityRange * pulse).toFixed(2);
    const nextBoxOpacity = boxOpacity.toFixed(2);
    if (shadow !== this.lastGlow) {
      this.lastGlow = shadow;
      this.scene.game.canvas.style.boxShadow = shadow;
    }
    if (gridOpacity !== this.lastGridOpacity) {
      this.lastGridOpacity = gridOpacity;
      document.documentElement.style.setProperty('--grid-opacity', gridOpacity);
    }
    // La variable vive en el SVG del tablero: en :root invalidaría todo el documento.
    if (nextBoxOpacity !== this.lastBoxOpacity && this.scene.board) {
      this.lastBoxOpacity = nextBoxOpacity;
      this.scene.board.svg.style.setProperty('--box-owner-opacity', nextBoxOpacity);
    }
  }

  /** Devuelve lienzo y rejilla a su aspecto neutro al abandonar la partida. */
  resetReactive() {
    const canvas = this.scene?.game?.canvas;
    if (canvas) canvas.style.boxShadow = 'none';
    this.lastGlow = '';
    this.lastGridOpacity = '';
    this.lastBoxOpacity = '';
    document.documentElement.style.removeProperty('--grid-opacity');
    this.scene?.board?.svg?.style.removeProperty('--box-owner-opacity');
  }

  /** Oculta o muestra la acción persistente durante la partida. */
  setRestartVisible(visible) {
    this.restartButton.setVisible(visible);
    this.restartButton.setEnabled(visible);
  }

  /** Habilita o bloquea REINICIAR sin cambiar su visibilidad. */
  setRestartEnabled(enabled) {
    this.restartButton.setEnabled(enabled);
  }

  /** Muestra feedback durante el turno automático sin cambiar las reglas. */
  setAiThinking(isThinking) {
    this.thinkingText.setText(isThinking ? AI_CONFIG.thinkingText : '');
    this.thinkingText.setVisible(isThinking);
  }

  destroy() {
    // La escena destruye automáticamente sus GameObjects.
  }
}
