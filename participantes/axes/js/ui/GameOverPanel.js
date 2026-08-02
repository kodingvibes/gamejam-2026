/**
 * Panel final que representa un resultado ya calculado por GameLogic.
 *
 * Es lo último que ve el jugador, así que se revela por partes: scrim, apertura
 * del panel, título, resultado, marcadores contando y por último el sello de rango.
 * Todo el escalonado vive detrás de this.motion: con movimiento reducido la misma
 * información aparece completa en un solo frame, sin perder ninguna fila.
 *
 * El audio de victoria y derrota lo dispara GameScene.finishGame(): aquí no se
 * vuelve a sonar nada para no doblar el remate.
 */
class GameOverPanel {
  /** @param {Phaser.Scene} scene @param {() => void} onRestart @param {() => void} onMenu */
  constructor(scene, onRestart, onMenu) {
    this.scene = scene;
    this.onRestart = onRestart;
    this.onMenu = onMenu;

    // Handles vivos del revelado. hide() los mata todos: una tween sobre un objeto
    // destruido durante scene.start es un crash, no un detalle estético.
    this.timers = [];
    this.revealTweens = [];
    this.pulseTween = null;
    this.skipHandler = null;
    this.confettiLayer = null;
    this.confettiFired = false;
    this.motion = true;
    this.view = null;

    // Mismo overlay que ConfirmModal, pero SIN setInteractive: el botón de sonido
    // en y=750 queda debajo del scrim y debe seguir siendo clicable.
    this.scrim = scene.add.rectangle(
      GAME_OVER_STYLE.centerX,
      GAME_OVER_STYLE.centerY,
      GAME_WIDTH,
      GAME_HEIGHT,
      COLORS.black,
      GAME_OVER_FEEL.scrimAlpha,
    ).setDepth(DEPTH.overlay);

    this.panel = scene.add.rectangle(GAME_OVER_STYLE.centerX, GAME_OVER_STYLE.centerY, GAME_OVER_STYLE.panelWidth, GAME_OVER_STYLE.panelHeight, COLORS.panelBg, 0.98)
      .setStrokeStyle(2, COLORS.playerOne, 0.8);
    this.title = new GlitchText(scene, GAME_OVER_STYLE.centerX, GAME_OVER_STYLE.titleY, 'GAME OVER', {
      color: SVG_COLORS.textPrimary,
      fontFamily: FONTS.TITLE,
      fontSize: '32px',
      fontStyle: 'bold',
    });
    this.result = new GlitchText(scene, GAME_OVER_STYLE.centerX, GAME_OVER_STYLE.resultY, '', {
      color: SVG_COLORS.playerOne,
      fontFamily: FONTS.TITLE,
      fontSize: '25px',
      fontStyle: 'bold',
      letterSpacing: 1,
    });
    this.grade = scene.add.text(GAME_OVER_STYLE.centerX, GAME_OVER_STYLE.gradeY, '', {
      color: SVG_COLORS.sugar,
      fontFamily: FONTS.TITLE,
      fontSize: GAME_OVER_FEEL.gradeFontSize,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.gradeCaption = scene.add.text(GAME_OVER_STYLE.centerX, GAME_OVER_STYLE.gradeCaptionY, '', {
      color: SVG_COLORS.textMuted,
      fontFamily: FONTS.GAME,
      fontSize: GAME_OVER_FEEL.captionFontSize,
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5);
    this.score = scene.add.text(GAME_OVER_STYLE.centerX, GAME_OVER_STYLE.scoreY, '', {
      color: SVG_COLORS.textPrimary,
      fontFamily: FONTS.GAME,
      fontSize: '19px',
      fontStyle: 'bold',
      align: 'center',
      lineSpacing: 7,
    }).setOrigin(0.5);
    this.record = scene.add.text(GAME_OVER_STYLE.centerX, GAME_OVER_STYLE.recordY, '', {
      color: SVG_COLORS.textMuted,
      fontFamily: FONTS.GAME,
      fontSize: '15px',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.hook = scene.add.text(GAME_OVER_STYLE.centerX, GAME_OVER_STYLE.hookY, '', {
      color: SVG_COLORS.textMuted,
      fontFamily: FONTS.GAME,
      fontSize: '14px',
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.restartButton = new GlitchButton(scene, GAME_OVER_STYLE.leftButtonX, GAME_OVER_STYLE.buttonsY, GAME_OVER_STYLE.buttonWidth, GAME_OVER_STYLE.buttonHeight, 'VOLVER A JUGAR', () => this.onRestart(), {
      baseColor: COLORS.buttonActive,
      hoverColor: COLORS.buttonPrimaryHover,
      pressedColor: COLORS.buttonPrimaryPressed,
      activeColor: COLORS.playerOne,
      textColor: SVG_COLORS.buttonActiveText,
      fontSize: '16px',
    });
    this.menuButton = new GlitchButton(scene, GAME_OVER_STYLE.rightButtonX, GAME_OVER_STYLE.buttonsY, GAME_OVER_STYLE.buttonWidth, GAME_OVER_STYLE.buttonHeight, 'VOLVER AL MENÚ', () => this.onMenu(), {
      fontSize: '16px',
    });

    this.panel.setDepth(DEPTH.modal);
    this.contentObjects = [this.title.container, this.result.container, this.grade, this.gradeCaption, this.score, this.record, this.hook];
    this.contentObjects.forEach((object) => object.setDepth(DEPTH.modalContent));
    this.restartButton.setDepth(DEPTH.modalContent);
    this.menuButton.setDepth(DEPTH.modalContent);

    this.objects = [this.scrim, this.panel, ...this.contentObjects];
    // Reiniciar la escena no pasa por hide(): sin esto la capa de confeti sobrevive.
    scene.events.once('shutdown', () => this.teardown());
    this.hide();
  }

  // Escalera de rango calibrada con partidas reales: un jugador casual ronda 0.29
  // (D), ganar es una B y una paliza es una S. El orden es descendente a propósito.
  static GRADES = Object.freeze([
    Object.freeze({ letter: 'S', min: 0.75, caption: 'PERFECTO', color: SVG_COLORS.sugar }),
    Object.freeze({ letter: 'A', min: 0.6, caption: 'DOMINANTE', color: SVG_COLORS.playerOne }),
    Object.freeze({ letter: 'B', min: 0.5, caption: 'SOLIDO', color: SVG_COLORS.textPrimary }),
    Object.freeze({ letter: 'C', min: 0.375, caption: 'AJUSTADO', color: SVG_COLORS.textMuted }),
    Object.freeze({ letter: 'D', min: 0.25, caption: 'CASI', color: SVG_COLORS.textMuted }),
    Object.freeze({ letter: 'E', min: 0, caption: 'A ENTRENAR', color: SVG_COLORS.textMuted }),
  ]);

  /** @param {number} share cajas propias / cajas totales @returns {{letter: string, min: number, caption: string, color: string}} */
  static gradeFor(share) {
    const value = Number.isFinite(share) ? share : 0;
    const grades = GameOverPanel.GRADES;
    return grades.find((grade) => value >= grade.min) ?? grades[grades.length - 1];
  }

  /** Rango inmediatamente superior, o null si ya está en el tope. */
  static nextGradeFor(letter) {
    const index = GameOverPanel.GRADES.findIndex((grade) => grade.letter === letter);
    return index > 0 ? GameOverPanel.GRADES[index - 1] : null;
  }

  /**
   * Mismo patrón que HUD.readStoredMute: un almacenamiento bloqueado no puede
   * romper la partida, solo dejar de recordar entre sesiones.
   * @param {string} key
   */
  static readRecord(key) {
    try {
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored);
    } catch (error) {
      // Sin acceso o con JSON corrupto manda la copia en memoria.
    }
    return GameOverPanel.memoryRecords[key] ?? null;
  }

  /** @param {string} key @param {{score: number, streak: number, grade: string}} value */
  static writeRecord(key, value) {
    // Memoria primero: con localStorage bloqueado el récord sigue vivo esta sesión.
    GameOverPanel.memoryRecords[key] = value;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Sin persistencia el récord dura lo que dure la pestaña. No es un fallo del juego.
    }
  }

  /** @param {string} mode @param {number} gridSize */
  static recordKey(mode, gridSize) {
    // Una sola clave global haría que un récord de 6x6 fuese imbatible en 3x3.
    return `${GAME_OVER_FEEL.storageKey}:${mode}:${gridSize}`;
  }

  /**
   * Traduce el resultado a todo lo que el panel muestra. Sin efectos secundarios
   * salvo el registro del récord, que debe ocurrir aunque el jugador salte el revelado.
   * @param {{winner: number|null, isDraw: boolean, scores: number[]}} result
   */
  buildView(result) {
    const matchConfig = this.scene.matchConfig;
    const gridSize = matchConfig?.gridSize ?? 5;
    const mode = matchConfig?.mode ?? GAME_MODES.LOCAL;
    const versusAi = mode === GAME_MODES.VS_AI;
    const difficulty = (matchConfig?.players?.[1]?.difficulty ?? '').toUpperCase();
    const scores = result.scores ?? [0, 0];
    const totalBoxes = (gridSize - 1) ** 2;
    const humanLost = versusAi && result.winner === 1;
    const isWin = !result.isDraw && !humanLost;

    // En VS IA siempre se califica al humano: una derrota también deja un objetivo.
    const gradedPlayer = versusAi ? 0 : (result.winner ?? 0);
    const ownScore = scores[gradedPlayer] ?? 0;
    const grade = GameOverPanel.gradeFor(totalBoxes > 0 ? ownScore / totalBoxes : 0);
    const nextGrade = GameOverPanel.nextGradeFor(grade.letter);

    const labels = versusAi
      ? ['TÚ', `LA IA (${difficulty})`]
      : ['JUGADOR CYAN', 'JUGADOR MAGENTA'];
    const resultLabel = result.isDraw
      ? 'EMPATE'
      : versusAi
        ? (humanLost ? `LA IA (${difficulty}) GANA` : `GANASTE A LA IA (${difficulty})`)
        : (result.winner === 0 ? 'JUGADOR CYAN GANA' : 'JUGADOR MAGENTA GANA');
    const resultColor = result.isDraw
      ? SVG_COLORS.textPrimary
      : result.winner === 0 ? SVG_COLORS.playerOne : SVG_COLORS.playerTwo;

    const margin = Math.abs((scores[0] ?? 0) - (scores[1] ?? 0));
    let hook = 'DESEMPATE';
    if (!result.isDraw && isWin) {
      hook = nextGrade
        ? `TU RANGO: ${grade.letter} · FALTAN ${Math.max(1, Math.ceil(nextGrade.min * totalBoxes) - ownScore)} CAJAS PARA LA ${nextGrade.letter}`
        : `TU RANGO: ${grade.letter} · NADA QUE MEJORAR`;
    } else if (!result.isDraw) {
      hook = margin <= 2 ? `TE FALTARON ${margin} CAJAS` : 'PROXIMA VEZ';
    }

    // La racha máxima la publica GameScene; ?? 0 mantiene el panel correcto si llega tarde.
    const streak = this.scene.bestStreak ?? 0;
    const key = GameOverPanel.recordKey(mode, gridSize);
    const previous = GameOverPanel.readRecord(key);
    const isRecord = (ownScore > 0 || streak > 0)
      && (ownScore > (previous?.score ?? 0) || streak > (previous?.streak ?? 0));
    const bestScore = Math.max(ownScore, previous?.score ?? 0);
    const bestStreak = Math.max(streak, previous?.streak ?? 0);
    GameOverPanel.writeRecord(key, {
      score: bestScore,
      streak: bestStreak,
      grade: GameOverPanel.gradeFor(totalBoxes > 0 ? bestScore / totalBoxes : 0).letter,
    });

    let recordText = '';
    if (isRecord) recordText = 'NUEVO RECORD';
    else if (previous) recordText = `RECORD: ${previous.score} CAJAS · RACHA x${previous.streak ?? 0} · RANGO ${previous.grade ?? '-'}`;

    // Barrida completa: la línea del ganador lo dice, no hace falta una fila extra.
    const loserScore = Math.min(scores[0] ?? 0, scores[1] ?? 0);
    const perfectPlayer = !result.isDraw && loserScore === 0 ? result.winner : null;

    return {
      scores, labels, resultLabel, resultColor, grade, hook, recordText,
      isRecord, isWin, isDraw: result.isDraw, winner: result.winner,
      humanWin: isWin && !result.isDraw, perfectPlayer,
      title: result.isDraw ? 'EMPATE' : (isWin ? 'VICTORIA' : 'DERROTA'),
      titleColor: result.isDraw ? SVG_COLORS.textPrimary : (isWin ? SVG_COLORS.sugar : SVG_COLORS.textMuted),
    };
  }

  /** @param {{winner: number|null, isDraw: boolean, scores: number[]}} result */
  show(result) {
    this.motion = effectsAllowed();
    const view = this.buildView(result);
    this.view = view;
    this.scoreValues = [0, 0];

    this.title.setText(view.title);
    this.title.setColor(view.titleColor);
    this.result.setText(view.resultLabel);
    this.result.setColor(view.resultColor);
    this.grade.setText(view.grade.letter);
    this.grade.setColor(view.grade.color);
    this.gradeCaption.setText(view.grade.caption);
    this.gradeCaption.setColor(view.grade.color);
    this.record.setText(view.recordText);
    this.record.setColor(view.isRecord ? SVG_COLORS.sugar : SVG_COLORS.textMuted);
    this.hook.setText(view.hook);
    // El borde adopta el color del ganador; el oro solo aparece si ganó el humano.
    const strokeColor = view.isDraw
      ? COLORS.textMuted
      : view.isWin
        ? (view.winner === 0 ? COLORS.playerOne : COLORS.playerTwo)
        : COLORS.textDim;
    this.panel.setStrokeStyle(view.humanWin ? 3 : 2, view.humanWin ? 0xffd166 : strokeColor, view.isWin ? 0.9 : 0.7);
    // REVANCHA es una promesa distinta a VOLVER A JUGAR.
    this.restartButton.setLabel(view.isWin || view.isDraw ? 'VOLVER A JUGAR' : 'REVANCHA');
    this.renderScore();

    this.objects.forEach((object) => {
      object.setActive(true);
      object.setVisible(true);
    });

    if (!this.motion) {
      this.finalize();
      return;
    }

    this.scrim.setAlpha(0);
    this.panel.setScale(1.04, GAME_OVER_FEEL.panelOpenScaleY);
    this.contentObjects.forEach((object) => object.setAlpha(0));
    this.grade.setScale(3);
    this.restartButton.setVisible(false);
    this.menuButton.setVisible(false);
    this.restartButton.setEnabled(false);
    this.menuButton.setEnabled(false);

    // Un cinematic no saltable es peor que el panel estático en la quinta revancha.
    this.skipHandler = () => {
      this.skipHandler = null;
      this.finalize();
    };
    this.scene.input.once('pointerdown', this.skipHandler);

    this.addTween({ targets: this.scrim, alpha: GAME_OVER_FEEL.scrimAlpha, duration: GAME_OVER_FEEL.scrimDuration, ease: 'Quad.out' });
    this.addTween({
      targets: this.panel,
      scaleX: 1,
      scaleY: 1,
      // Una derrota entra sin rebote: el mismo gesto, sin celebración.
      duration: view.isWin ? GAME_OVER_FEEL.panelOpenDuration : 420,
      ease: view.isWin ? 'Back.out' : 'Quad.out',
    });
    this.addTimer(GAME_OVER_FEEL.titleDelay, () => {
      this.title.container.setAlpha(1);
      this.title.pulse();
    });
    this.addTimer(GAME_OVER_FEEL.resultDelay, () => {
      this.result.container.setAlpha(1);
      this.result.pulse();
    });
    this.addTimer(GAME_OVER_FEEL.scoreDelay, () => {
      this.score.setAlpha(1);
      view.scores.forEach((target, index) => this.countScore(index, target));
    });
    this.addTimer(GAME_OVER_FEEL.gradeDelay, () => this.stampGrade(view));
    this.addTimer(GAME_OVER_FEEL.buttonsDelay, () => this.enableButtons(view));
  }

  /** @param {object} config */
  addTween(config) {
    const tween = this.scene.tweens.add(config);
    this.revealTweens.push(tween);
    return tween;
  }

  /** @param {number} delay @param {() => void} callback */
  addTimer(delay, callback) {
    this.timers.push(this.scene.time.delayedCall(delay, callback));
  }

  /**
   * Cuenta un marcador desde 0. Solo repinta cuando el entero cambia: reconstruir
   * el texto en cada frame es un coste real, no un detalle.
   * @param {number} index @param {number} target
   */
  countScore(index, target) {
    if (target <= 0) return;
    let lastValue = 0;
    const counter = this.scene.tweens.addCounter({
      from: 0,
      to: target,
      duration: GAME_OVER_FEEL.countDuration,
      ease: 'Cubic.out',
      onUpdate: (tween, value) => {
        const raw = typeof value === 'number' ? value : (value?.value ?? tween.getValue?.() ?? target);
        const rounded = Math.round(raw);
        if (rounded === lastValue) return;
        lastValue = rounded;
        this.scoreValues[index] = rounded;
        this.renderScore();
      },
      onComplete: () => {
        this.scoreValues[index] = target;
        this.renderScore();
      },
    });
    this.revealTweens.push(counter);
  }

  renderScore() {
    const view = this.view;
    if (!view) return;
    const lines = view.labels.map((label, index) => {
      const perfect = view.perfectPlayer === index ? ' · PERFECTO' : '';
      return `${label}: ${this.scoreValues[index] ?? 0} PUNTOS${perfect}`;
    });
    this.score.setText(lines.join('\n'));
  }

  /** Sello de rango: el golpe que remata el revelado. @param {object} view */
  stampGrade(view) {
    this.grade.setAlpha(0).setScale(3);
    this.gradeCaption.setAlpha(0);
    this.addTween({
      targets: this.grade,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: GAME_OVER_FEEL.stampDuration,
      ease: 'Back.in',
      onComplete: () => {
        this.gradeCaption.setAlpha(1);
        this.record.setAlpha(1);
        this.hook.setAlpha(1);
        // Fin real del revelado: ya no hay nada que saltar.
        this.disarmSkip();
      },
    });
    // El golpe más fuerte del panel no puede ser mudo.
    this.scene.audioManager?.playStamp?.(view.isRecord);
    // shakeStage ya respeta movimiento reducido por su cuenta.
    this.scene.shakeStage?.(GAME_FEEL.shakeDuration, GAME_FEEL.shakeIntensity * (view.isRecord ? 2 : 1));
    this.fireConfetti(view);
  }

  /** Solo en victoria humana y una sola vez, aunque se salte el revelado. @param {object} view */
  fireConfetti(view) {
    if (!this.motion || !view?.humanWin || this.confettiFired) return;
    const layer = this.ensureConfettiLayer();
    if (!layer) return;
    this.confettiFired = true;
    // playConfetti ya se autoprotege con effectsAllowed().
    playConfetti({
      parent: layer,
      count: view.isRecord ? CONFETTI.recordCount : CONFETTI.count,
      originY: CONFETTI.originY,
    });
  }

  /** @param {object} view */
  enableButtons(view) {
    this.restartButton.setVisible(true);
    this.menuButton.setVisible(true);
    this.restartButton.setEnabled(true);
    this.menuButton.setEnabled(true);
    if (this.motion && !view.isWin && !this.pulseTween) {
      // Latido lento solo en derrota: la revancha tiene que llamar sola.
      this.pulseTween = this.scene.tweens.add({
        targets: this.restartButton.container,
        scale: 1.03,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
  }

  /** Estado final exacto, saltando cualquier etapa pendiente. */
  finalize() {
    this.clearReveal();
    const view = this.view;
    this.scrim.setAlpha(GAME_OVER_FEEL.scrimAlpha);
    this.panel.setScale(1, 1);
    this.contentObjects.forEach((object) => object.setAlpha(1));
    this.grade.setScale(1);
    if (view) {
      this.scoreValues = [...view.scores];
      this.renderScore();
      this.fireConfetti(view);
      this.enableButtons(view);
    }
  }

  /** Capa propia de confeti: en el final el SVG del tablero está en display:none. */
  ensureConfettiLayer() {
    if (this.confettiLayer) return this.confettiLayer;
    const parent = this.scene.game?.canvas?.parentElement;
    if (!parent) return null;
    const layer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    layer.setAttribute('viewBox', `0 0 ${GAME_WIDTH} ${GAME_HEIGHT}`);
    // Misma receta que #board-svg: cuadra con el canvas FIT + CENTER_BOTH sin tocar el CSS.
    layer.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none; z-index:130;';
    parent.appendChild(layer);
    this.confettiLayer = layer;
    return layer;
  }

  disarmSkip() {
    if (!this.skipHandler) return;
    this.scene.input?.off('pointerdown', this.skipHandler);
    this.skipHandler = null;
  }

  /** Mata temporizadores, tweens y el atajo de salto. No toca la capa de confeti. */
  clearReveal() {
    this.timers.forEach((timer) => timer?.remove(false));
    this.timers = [];
    this.revealTweens.forEach((tween) => tween?.stop?.());
    this.revealTweens = [];
    this.disarmSkip();
  }

  teardown() {
    this.clearReveal();
    this.pulseTween?.stop?.();
    this.pulseTween = null;
    this.restartButton?.container?.setScale?.(1);
    this.confettiLayer?.remove();
    this.confettiLayer = null;
  }

  hide() {
    this.teardown();
    this.restartButton.setVisible(false);
    this.menuButton.setVisible(false);
    this.restartButton.setEnabled(false);
    this.menuButton.setEnabled(false);
    this.objects?.forEach((object) => {
      object.setActive(false);
      object.setVisible(false);
    });
  }
}

// Respaldo en memoria de los récords cuando localStorage está bloqueado.
GameOverPanel.memoryRecords = {};
