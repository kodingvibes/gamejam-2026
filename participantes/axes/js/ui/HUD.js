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
    // El dígito nunca queda viejo; el rebote lo dispara el +1 al aterrizar.
    [this.playerOneCard, this.playerTwoCard].forEach((card, index) => {
      card.score.setText(String(state.scores[index]));
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

  /**
   * El +1 viaja de la caja al marcador y solo al llegar rebota el dígito.
   * Va en el SVG del tablero, no en el lienzo: el lienzo queda DEBAJO del SVG y el
   * marco opaco del tablero taparía el viaje entero. Ambos comparten el viewBox
   * 0 0 GAME_WIDTH GAME_HEIGHT, así que las coordenadas de Phaser valen tal cual.
   * @param {number} fromX @param {number} fromY @param {number} player
   */
  flingScore(fromX, fromY, player) {
    const card = player === 0 ? this.playerOneCard : this.playerTwoCard;
    const svg = this.scene.board?.svg;
    // Con movimiento reducido, sin WAAPI o sin tablero, el marcador solo rebota.
    if (!this.scene.reactiveEnabled || !svg || !effectsAllowed()) {
      this.popScore(card.score);
      return;
    }
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', fromX);
    text.setAttribute('y', fromY);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('fill', player === 0 ? SVG_COLORS.playerOne : SVG_COLORS.playerTwo);
    text.style.font = `bold ${GAME_FEEL.flingFontSize} ${FONTS.GAME}`;
    text.style.pointerEvents = 'none';
    text.style.transformBox = 'fill-box';
    text.style.transformOrigin = 'center';
    text.textContent = '+1';
    svg.appendChild(text);
    const total = GAME_FEEL.flingRiseDuration + GAME_FEEL.flingTravelDuration;
    const dx = card.score.x - fromX;
    const dy = card.score.y - fromY;
    // El easing de un fotograma rige el tramo que EMPIEZA en él: rebote al salir,
    // aceleración al viajar. La opacidad se mantiene hasta el 86% o el +1 se apaga
    // a mitad de camino y el viaje no se lee.
    const animation = text.animate([
      { transform: 'translate(0px, 0px) scale(0.4)', opacity: 0.9, easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)' },
      {
        transform: 'translate(0px, -16px) scale(1.4)',
        opacity: 1,
        offset: GAME_FEEL.flingRiseDuration / total,
        easing: 'cubic-bezier(0.5, 0, 0.6, 1)',
      },
      {
        transform: `translate(${(dx * 0.9).toFixed(1)}px, ${(dy * 0.9).toFixed(1)}px) scale(0.6)`,
        opacity: 1,
        offset: 0.86,
        easing: 'linear',
      },
      { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(0.45)`, opacity: 0 },
    ], { duration: total, fill: 'both' });
    animation.finished.then(() => {
      text.remove();
      // Al reiniciar la escena el marcador ya está destruido: no se rebota un muerto.
      if (card.score.scene) this.popScore(card.score);
    }, () => text.remove());
  }

  /** @param {number} count cajas seguidas del mismo jugador */
  showStreak(count) {
    const value = Math.max(2, Math.floor(count));
    const label = value >= 6 ? `IMPARABLE x${value}` : (value >= 3 ? `RACHA x${value}` : 'DOBLE');
    // El dorado marca el salto de nivel; el doble se queda con el color del turno.
    const color = value >= 3 ? SVG_COLORS.sugar : this.turnColor;
    this.scene.tweens.killTweensOf(this.chainText);
    this.chainText.setText(label);
    this.chainText.setColor(color);
    // Con movimiento reducido el aviso aparece ya a tamaño final y solo se desvanece.
    this.chainText.setAlpha(1).setScale(this.scene.reactiveEnabled ? 0.55 : 1);
    if (this.scene.reactiveEnabled) {
      this.scene.tweens.add({
        targets: this.chainText,
        scale: 1 + Math.min(4, value - 2) * GAME_FEEL.streakScaleStep,
        duration: GAME_FEEL.chainPopDuration,
        ease: 'Back.out',
      });
    }
    this.scene.tweens.add({
      targets: this.chainText,
      alpha: 0,
      delay: GAME_FEEL.chainHoldDuration + value * 60,
      duration: GAME_FEEL.chainFadeDuration,
    });
  }

  /**
   * Respiración del borde del lienzo y de la rejilla de fondo.
   * @param {number} pulse 0..1 ya suavizado por la escena
   * @param {number} boxOpacity opacidad de relleno de las cajas reclamadas
   * @param {number} heat 0..1 de partida avanzada; se pliega en las mismas expresiones
   */
  setReactive(pulse, boxOpacity, heat = 0) {
    // Cada escritura repinta: se cuantizan los valores y solo se aplica lo que cambió.
    const glow = Math.round(AUDIO_REACTIVE.glowFloor + AUDIO_REACTIVE.glowRange * pulse + AUDIO_REACTIVE.heatRange * heat);
    const alpha = heat > 0.6 ? '77' : AUDIO_REACTIVE.glowAlpha;
    const shadow = `0 0 ${glow}px ${this.turnColor}${alpha}`;
    const gridOpacity = (AUDIO_REACTIVE.gridOpacityFloor + AUDIO_REACTIVE.gridOpacityRange * pulse).toFixed(2);
    const nextBoxOpacity = (boxOpacity + AUDIO_REACTIVE.heatOpacityRange * heat).toFixed(2);
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
