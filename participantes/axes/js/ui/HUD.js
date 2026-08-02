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
    // Un solo hueco de aviso: mientras una racha esté viva, nada la pisa.
    this.streakUntil = -Infinity;
    this.aiTurnIndex = 0;
    this.ellipsisTimer = null;
    this.safePulse = null;
    // El dorado solo existe como string CSS: Phaser necesita el entero equivalente.
    this.sugarColor = Phaser.Display.Color.HexStringToColor(SVG_COLORS.sugar).color;

    this.playerOneCard = this.createCard(HUD_LAYOUT.leftCardX, HUD_LAYOUT.cardY, HUD_LAYOUT.cardWidth, COLORS.playerOne, 'JUGADOR 1', SVG_COLORS.playerOne);
    this.playerTwoCard = this.createCard(HUD_LAYOUT.rightCardX, HUD_LAYOUT.cardY, HUD_LAYOUT.cardWidth, COLORS.playerTwo, 'JUGADOR 2', SVG_COLORS.playerTwo);
    this.turnPill = scene.add.rectangle(400, HUD_LAYOUT.turnY, HUD_LAYOUT.turnWidth, HUD_LAYOUT.turnHeight, COLORS.panelBg, 0.92)
      .setStrokeStyle(1, COLORS.panelBorder, 1);
    this.turnText = scene.add.text(400, HUD_LAYOUT.turnY, '', {
      color: SVG_COLORS.textPrimary,
      fontFamily: FONTS.GAME,
      fontSize: HUD_LAYOUT.turnFontSize,
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.thinkingText = scene.add.text(400, HUD_LAYOUT.thinkingY, '', {
      color: SVG_COLORS.playerTwo,
      fontFamily: FONTS.GAME,
      fontSize: HUD_LAYOUT.thinkingFontSize,
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5);

    // Aviso de cadena: en escritorio 34px centrados en 66 ocupan 49..83, libres del texto
    // de la IA (96) y del marco del tablero (106). En vertical vive justo sobre el marco.
    this.chainPlate = scene.add.rectangle(400, HUD_LAYOUT.chainY, 10, 10, COLORS.panelBg, 0.9).setAlpha(0);
    this.chainText = scene.add.text(400, HUD_LAYOUT.chainY, '', {
      color: SVG_COLORS.playerOne,
      fontFamily: FONTS.GAME,
      fontSize: HUD_LAYOUT.chainFontSize,
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0);

    // Mecha del terreno seguro: bajo el marco del tablero y lejos de los botones.
    this.safeLabel = scene.add.text(400, SAFE_METER.labelY, '', {
      color: SVG_COLORS.textMuted,
      fontFamily: FONTS.GAME,
      fontSize: SAFE_METER.labelFontSize,
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0);
    this.safeTrack = scene.add.rectangle(400, SAFE_METER.barY, SAFE_METER.width, SAFE_METER.height, COLORS.buttonBase, 0.9)
      .setStrokeStyle(1, COLORS.panelBorder, 1)
      .setAlpha(0);
    this.safeFill = scene.add.rectangle(400 - SAFE_METER.width / 2, SAFE_METER.barY, 0, SAFE_METER.height, COLORS.textMuted)
      .setOrigin(0, 0.5)
      .setAlpha(0);

    this.restartButton = new GlitchButton(
      this.scene, HUD_LAYOUT.restartX, HUD_LAYOUT.buttonY,
      HUD_LAYOUT.buttonWidth, HUD_LAYOUT.buttonHeight, 'REINICIAR', () => this.onRestart(),
      { fontSize: HUD_LAYOUT.buttonFontSize },
    );
    this.soundButton = new GlitchButton(
      this.scene, AUDIO_TOGGLE.x, AUDIO_TOGGLE.y, AUDIO_TOGGLE.width, AUDIO_TOGGLE.height,
      this.muted ? AUDIO_TOGGLE.labelOff : AUDIO_TOGGLE.labelOn, () => this.toggleSound(),
      { fontSize: AUDIO_TOGGLE.fontSize },
    );
    [this.playerOneCard.card, this.playerOneCard.label, this.playerOneCard.score,
      this.playerOneCard.track, this.playerOneCard.progress,
      this.playerTwoCard.card, this.playerTwoCard.label, this.playerTwoCard.score,
      this.playerTwoCard.track, this.playerTwoCard.progress,
      this.turnPill, this.turnText, this.thinkingText, this.chainText,
      this.safeLabel, this.safeTrack, this.safeFill].forEach((object) => object.setDepth(DEPTH.hud));
    // La placa vive justo debajo del texto de cadena, nunca encima.
    this.chainPlate.setDepth(DEPTH.hud - 1);
    this.restartButton.setDepth(DEPTH.controls);
    this.soundButton.setDepth(DEPTH.controls);

    // Los eventos temporizados del HUD no pueden sobrevivir a la escena.
    const cleanup = () => this.destroy();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
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
    // Las tres filas se miden desde los bordes de la tarjeta, no con offsets fijos:
    // en vertical la tarjeta es más alta y los valores de escritorio salen idénticos.
    const height = HUD_LAYOUT.cardHeight;
    const barY = y + height / 2 - 5;
    const card = this.scene.add.rectangle(x, y, width, height, COLORS.panelBg, UI_STYLE.panelAlpha)
      .setStrokeStyle(1, COLORS.panelBorder, 1);
    const labelText = this.scene.add.text(x - width / 2 + 14, y - height / 2 + 14, label, {
      color: SVG_COLORS.textMuted,
      fontFamily: FONTS.GAME,
      fontSize: UI_STYLE.hudLabelSize,
      fontStyle: 'bold',
      letterSpacing: 1,
    });
    const score = this.scene.add.text(x + width / 2 - 16, y + height * 0.05, '0', {
      color: cssColor,
      fontFamily: FONTS.GAME,
      fontSize: UI_STYLE.scoreSize,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    // Barra de avance pegada al borde inferior: la carrera se lee sin leer dígitos.
    const barWidth = width - 28;
    const track = this.scene.add.rectangle(x, barY, barWidth, 3, COLORS.textDim, 0.35);
    const progress = this.scene.add.rectangle(x - width / 2 + 14, barY, 0, 3, color, 1)
      .setOrigin(0, 0.5);
    return { card, label: labelText, score, color, track, progress, barWidth };
  }

  /** @param {{currentPlayer: number, scores: number[]}} state */
  update(state) {
    // El dígito nunca queda viejo; el rebote lo dispara el +1 al aterrizar.
    const totalBoxes = Math.max(1, state.boxes?.length ?? 1);
    [this.playerOneCard, this.playerTwoCard].forEach((card, index) => {
      card.score.setText(String(state.scores[index]));
      // Una vez por jugada, nunca por frame.
      card.progress.setSize(card.barWidth * Math.min(1, state.scores[index] / totalBoxes), 3);
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

  /** @param {Phaser.GameObjects.Text} scoreText @param {number} chainIndex peldaño de la cadena */
  popScore(scoreText, chainIndex = 0) {
    this.scene.tweens.killTweensOf(scoreText);
    scoreText.setScale(1);
    // Con movimiento reducido el marcador ya quedó escrito: solo se salta el rebote.
    if (!this.scene.reactiveEnabled) return;
    this.scene.tweens.add({
      targets: scoreText,
      scale: chainIndex >= GAME_FEEL.scorePopBigFrom ? GAME_FEEL.scorePopScaleBig : GAME_FEEL.scorePopScale,
      duration: GAME_FEEL.scorePopDuration,
      ease: 'Back.out',
      yoyo: true,
    });
  }

  /** Destello de la tarjeta al recibir el punto: el color del dueño lava el panel. */
  flashCard(card) {
    if (!card.card.scene) return;
    card.card.setFillStyle(card.color, 0.35);
    this.scene.time.delayedCall(120, () => {
      if (card.card.scene) card.card.setFillStyle(COLORS.panelBg, UI_STYLE.panelAlpha);
    });
  }

  /**
   * El +1 viaja de la caja al marcador y solo al llegar rebota el dígito.
   * Va en el SVG del tablero, no en el lienzo: el lienzo queda DEBAJO del SVG y el
   * marco opaco del tablero taparía el viaje entero. Ambos comparten el viewBox
   * 0 0 GAME_WIDTH GAME_HEIGHT, así que las coordenadas de Phaser valen tal cual.
   * @param {number} fromX @param {number} fromY @param {number} player @param {number} chainIndex
   */
  flingScore(fromX, fromY, player, chainIndex = 0) {
    const card = player === 0 ? this.playerOneCard : this.playerTwoCard;
    const svg = this.scene.board?.svg;
    // Con movimiento reducido, sin WAAPI o sin tablero, el marcador solo rebota.
    if (!this.scene.reactiveEnabled || !svg || !effectsAllowed()) {
      this.popScore(card.score, chainIndex);
      return;
    }
    const ownerColor = player === 0 ? SVG_COLORS.playerOne : SVG_COLORS.playerTwo;
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', fromX);
    text.setAttribute('y', fromY);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    // Dorado con filo del dueño: sobre una tarjeta del mismo color seguiría leyéndose.
    text.setAttribute('fill', SVG_COLORS.sugar);
    text.setAttribute('stroke', ownerColor);
    text.setAttribute('stroke-width', 2);
    text.setAttribute('paint-order', 'stroke');
    const size = chainIndex >= GAME_FEEL.flingBigFrom ? GAME_FEEL.flingFontSizeBig : GAME_FEEL.flingFontSize;
    text.style.font = `bold ${size} ${FONTS.GAME}`;
    text.style.pointerEvents = 'none';
    text.style.transformBox = 'fill-box';
    text.style.transformOrigin = 'center';
    // Pasado cierto peldaño la ficha deja de contar cajas y canta el multiplicador.
    text.textContent = chainIndex >= GAME_FEEL.flingMultiplierFrom ? `x${chainIndex + 1}` : '+1';
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
      // Muere POR ENCIMA del dígito: aterrizar sobre él anulaba los dos a la vez.
      {
        transform: `translate(${dx.toFixed(1)}px, ${(dy + GAME_FEEL.flingLandOffset).toFixed(1)}px) scale(0.45)`,
        opacity: 0,
      },
    ], { duration: total, fill: 'both' });
    animation.finished.then(() => {
      text.remove();
      // Al reiniciar la escena el marcador ya está destruido: no se rebota un muerto.
      if (card.score.scene) {
        this.popScore(card.score, chainIndex);
        this.flashCard(card);
      }
    }, () => text.remove());
  }

  /**
   * Único hueco de aviso del HUD: racha, cambio de mando y match point comparten
   * objeto. No cabe un segundo texto entre la píldora de turno y el marco.
   * @param {string} label @param {string} color @param {number} fontSize px
   * @param {number} hold ms antes del desvanecido @param {boolean} wobble
   */
  popBanner(label, color, fontSize, hold, wobble = false) {
    const targets = [this.chainText, this.chainPlate];
    this.scene.tweens.killTweensOf(targets);
    this.chainText.setFontSize(fontSize);
    this.chainText.setText(label);
    this.chainText.setColor(color);
    // La placa oscura mantiene legible el dorado grande sobre el fondo del juego.
    // El alto se ciñe al texto: con 34px la placa ya roza la línea de la IA (96).
    this.chainPlate.setSize(this.chainText.width + 26, this.chainText.height + 6);
    targets.forEach((object) => object.setAngle(0));
    // Con movimiento reducido el aviso aparece ya a tamaño final y solo se desvanece.
    const animated = Boolean(this.scene.reactiveEnabled);
    targets.forEach((object) => object.setAlpha(1).setScale(animated ? 0.55 : 1));
    if (animated) {
      this.scene.tweens.add({
        targets,
        scale: 1,
        duration: GAME_FEEL.chainPopDuration,
        ease: 'Back.out',
      });
      if (wobble) {
        this.scene.tweens.add({
          targets,
          angle: { from: -3, to: 3 },
          duration: 90,
          yoyo: true,
          repeat: 2,
          onComplete: () => targets.forEach((object) => object.setAngle(0)),
        });
      }
    }
    this.scene.tweens.add({
      targets,
      alpha: 0,
      delay: hold,
      duration: GAME_FEEL.chainFadeDuration,
    });
  }

  /** @param {number} count cajas seguidas del mismo jugador */
  showStreak(count) {
    const value = Math.max(2, Math.floor(count));
    let label = 'DOBLE';
    if (value >= 10) label = `PERFECTO x${value}`;
    else if (value >= 7) label = `DEVASTADOR x${value}`;
    else if (value >= 6) label = `IMPARABLE x${value}`;
    else if (value >= 3) label = `RACHA x${value}`;
    // El tamaño sube con la racha: a x8 el aviso era más pequeño que la etiqueta TURNO.
    const sizes = { 2: 15, 3: 22, 4: 26, 5: 30 };
    const fontSize = `${sizes[value] ?? 34}px`;
    // El dorado marca el salto de nivel; el doble se queda con el color del turno.
    const color = value >= 3 ? SVG_COLORS.sugar : this.turnColor;
    const hold = GAME_FEEL.chainHoldDuration + value * 60;
    // La racha manda: mientras esté viva ningún otro aviso ocupa el hueco.
    this.streakUntil = this.scene.time.now + hold;
    this.popBanner(label, color, fontSize, hold, value >= 5);
  }

  /** @param {string} text @param {string} [color] */
  showBanner(text, color) {
    if (this.scene.time.now < this.streakUntil) return;
    this.popBanner(text, color ?? SVG_COLORS.textPrimary, '20px', GAME_FEEL.chainHoldDuration);
  }

  /**
   * Medidor de terreno seguro. Nunca se confunde con un marcador: es una barra
   * en su propia familia de color y vive bajo el tablero.
   * @param {number} value jugadas seguras restantes @param {number} denominator primera lectura
   */
  setSafeMeter(value, denominator) {
    const ratio = Math.max(0, Math.min(1, value / Math.max(1, denominator)));
    const isWarning = value <= SAFE_METER.warnAt;
    const isCritical = value <= SAFE_METER.criticalAt;
    this.safeLabel.setText(value <= 0 ? SAFE_METER.labelEmpty : `${SAFE_METER.labelIdle} · ${value}`);
    this.safeLabel.setColor(isWarning ? SVG_COLORS.sugar : SVG_COLORS.textMuted);
    this.safeFill.setFillStyle(isWarning ? this.sugarColor : COLORS.textMuted, 1);
    this.safeFill.setSize(SAFE_METER.width * ratio, SAFE_METER.height);
    this.safeLabel.setAlpha(1);
    this.safeTrack.setAlpha(1);
    if (!isCritical || !this.scene.reactiveEnabled) {
      if (this.safePulse) this.scene.tweens.killTweensOf([this.safeFill, this.safeLabel]);
      this.safePulse = null;
      this.safeFill.setAlpha(1);
      return;
    }
    // Ya en zona crítica: el latido no se relanza en cada jugada.
    if (this.safePulse) return;
    this.safePulse = this.scene.tweens.add({
      targets: [this.safeFill, this.safeLabel],
      alpha: 0.45,
      duration: 520,
      yoyo: true,
      repeat: -1,
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
    // El tinte del bando ganador no puede sobrevivir hasta el menú.
    document.documentElement.style.removeProperty('--grid-border');
    this.scene?.board?.svg?.style.removeProperty('--box-owner-opacity');
  }

  /**
   * Partida terminada: el HUD deja de anunciar un turno pendiente y el lienzo
   * pierde el color del jugador de turno.
   */
  setFinished() {
    this.turnText.setText('');
    this.turnPill.setStrokeStyle(1, COLORS.panelBorder, 1);
    [this.playerOneCard, this.playerTwoCard].forEach((card) => {
      card.card.setStrokeStyle(1, COLORS.panelBorder, 1);
      card.card.setAlpha(1);
      card.score.setAlpha(1);
    });
    this.scene.game.canvas.style.borderColor = SVG_COLORS.grayBorder;
    this.setAiThinking(false);
    if (this.safePulse) this.scene.tweens.killTweensOf([this.safeFill, this.safeLabel]);
    this.safePulse = null;
    [this.safeLabel, this.safeTrack, this.safeFill].forEach((object) => object.setVisible(false));
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

  /**
   * Feedback del turno automático, con la voz de cada dificultad.
   * La frase se elige por índice de turno, no al azar: no parpadea entre frames.
   * @param {boolean} isThinking @param {string} [difficulty] @param {boolean} [chainTell]
   */
  setAiThinking(isThinking, difficulty, chainTell = false) {
    this.stopEllipsis();
    if (!isThinking) {
      this.thinkingText.setText('');
      this.thinkingText.setVisible(false);
      return;
    }
    const lines = AI_THINKING[difficulty];
    const base = chainTell
      ? AI_THINKING.chainTell
      : (Array.isArray(lines) && lines.length > 0
        ? lines[this.aiTurnIndex % lines.length]
        : AI_CONFIG.thinkingText.replace(/\.+$/, ''));
    this.aiTurnIndex += 1;
    this.thinkingText.setVisible(true);
    // Con movimiento reducido los puntos quedan quietos: es texto, no animación.
    if (!this.scene.reactiveEnabled) {
      this.thinkingText.setText(`${base}...`);
      return;
    }
    this.thinkingText.setText(base);
    let step = 0;
    this.ellipsisTimer = this.scene.time.addEvent({
      delay: AI_THINKING.ellipsisPeriod,
      loop: true,
      callback: () => {
        step = (step + 1) % 4;
        this.thinkingText.setText(base + '.'.repeat(step));
      },
    });
  }

  stopEllipsis() {
    this.ellipsisTimer?.remove(false);
    this.ellipsisTimer = null;
  }

  destroy() {
    // La escena destruye automáticamente sus GameObjects, pero no sus temporizadores.
    this.stopEllipsis();
    this.safePulse = null;
  }
}
