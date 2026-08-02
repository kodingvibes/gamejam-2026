/**
 * Botón Phaser reutilizable con estados y esquinas cromáticas glitch.
 *
 * La prioridad visual es: disabled > pressed > selected > hover > normal.
 * Solo el fondo recibe input; las capas gráficas y el texto nunca bloquean el click.
 */
class GlitchButton {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @param {string} label
   * @param {() => void} onClick
   * @param {{enabled?: boolean, selected?: boolean, variant?: string, style?: object, fontFamily?: string, fontSize?: string|number}} options
   */
  constructor(scene, x, y, width, height, label, onClick, options = {}) {
    this.scene = scene;
    this.width = width;
    this.height = height;
    this.variant = options.variant ?? 'default';
    this.style = options.style ?? {};
    this.callback = onClick;
    this.enabled = options.enabled ?? true;
    this.visible = true;
    this.selected = options.selected ?? false;
    this.hovered = false;
    this.pressed = false;
    this.pressStarted = false;
    this.actionLock = false;
    this.lastActionAt = -Infinity;
    this.visualState = null;
    this.activeCornerTweens = [];
    this.destroyed = false;

    this.baseColor = this.style.baseColor ?? options.baseColor ?? BUTTON_STYLE.background;
    this.hoverColor = this.style.hoverColor ?? options.hoverColor ?? BUTTON_STYLE.backgroundHover;
    this.pressedColor = this.style.pressedColor ?? options.pressedColor ?? BUTTON_STYLE.backgroundPressed;
    this.disabledColor = this.style.disabledColor ?? options.disabledColor ?? BUTTON_STYLE.backgroundDisabled;
    this.borderColor = this.style.borderColor ?? options.borderColor ?? BUTTON_STYLE.border;
    this.activeColor = this.style.activeColor ?? options.activeColor ?? BUTTON_STYLE.borderActive;
    this.textColor = this.style.textColor ?? options.textColor ?? BUTTON_STYLE.text;
    this.disabledTextColor = this.style.disabledTextColor ?? BUTTON_STYLE.textDisabled;

    this.container = scene.add.container(x, y);
    this.background = scene.add.rectangle(0, 0, width, height, this.baseColor, 1)
      .setStrokeStyle(BUTTON_STYLE.borderWidth, this.borderColor, 1);
    this.label = scene.add.text(0, 0, label, {
      color: this.textColor,
      fontFamily: options.fontFamily ?? this.style.fontFamily ?? BUTTON_STYLE.fontFamily,
      fontSize: options.fontSize ?? this.style.fontSize ?? BUTTON_STYLE.fontSize,
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5);
    // Icono opcional: se dibuja a la izquierda y el texto cede la mitad de ese hueco,
    // así el conjunto sigue pareciendo centrado sin recolocar cada botón a mano.
    this.icon = null;
    if (options.icon) {
      const inset = options.iconInset ?? Math.min(30, width * 0.2);
      this.icon = scene.add.graphics().setPosition(-width / 2 + inset, 0);
      options.icon(this.icon, this);
      this.label.setX(inset / 2);
    }
    this.corners = this.createChromaticCorners();
    this.container.add([this.background, ...Object.values(this.corners), ...(this.icon ? [this.icon] : []), this.label]);
    if (options.depth !== undefined) this.container.setDepth(options.depth);

    this.bindInput();
    this.setEnabled(this.enabled);
    this.refreshVisualState(false);
  }

  /** Crea los tres canales desplazados de las esquinas. */
  createChromaticCorners() {
    return {
      magenta: this.createCornerLayer(BUTTON_STYLE.glitchMagenta, -BUTTON_STYLE.channelOffset, 0),
      green: this.createCornerLayer(BUTTON_STYLE.glitchGreen, 0, 0),
      cyan: this.createCornerLayer(BUTTON_STYLE.glitchCyan, BUTTON_STYLE.channelOffset, 0),
    };
  }

  /** @param {number} color @param {number} offsetX @param {number} offsetY */
  createCornerLayer(color, offsetX, offsetY) {
    const graphics = this.scene.add.graphics();
    graphics.baseX = offsetX;
    graphics.baseY = offsetY;
    graphics.setPosition(offsetX, offsetY);
    graphics.setAlpha(0);
    this.drawCorners(graphics, color);
    return graphics;
  }

  /** @param {Phaser.GameObjects.Graphics} graphics @param {number} color */
  drawCorners(graphics, color) {
    const halfWidth = this.width / 2;
    const halfHeight = this.height / 2;
    const length = BUTTON_STYLE.cornerLength;
    const inset = BUTTON_STYLE.cornerInset;
    const left = -halfWidth + inset;
    const right = halfWidth - inset;
    const top = -halfHeight + inset;
    const bottom = halfHeight - inset;

    graphics.clear();
    graphics.lineStyle(BUTTON_STYLE.cornerThickness, color, 1);
    graphics.beginPath();
    graphics.moveTo(right - length, top);
    graphics.lineTo(right, top);
    graphics.lineTo(right, top + length);
    graphics.moveTo(left, bottom - length);
    graphics.lineTo(left, bottom);
    graphics.lineTo(left + length, bottom);
    graphics.strokePath();
  }

  bindInput() {
    this.background.setInteractive({ useHandCursor: true });
    this.background.input.cursor = 'pointer';
    this.onPointerOver = () => {
      if (this.destroyed || !this.enabled || !this.visible) return;
      this.hovered = true;
      this.refreshVisualState(true);
    };
    this.onPointerOut = () => {
      if (this.destroyed) return;
      this.hovered = false;
      // Salir durante una pulsación cancela la acción y evita un callback
      // accidental cuando el puntero se suelta fuera del botón.
      if (this.pressed) {
        this.pressed = false;
        this.pressStarted = false;
        this.actionLock = false;
      }
      this.refreshVisualState(true);
    };
    this.onPointerDown = () => {
      if (this.destroyed || !this.enabled || this.actionLock) return;
      const now = performance.now();
      if (now - this.lastActionAt < BUTTON_STYLE.actionCooldown) return;
      this.lastActionAt = now;
      this.actionLock = true;
      this.pressed = true;
      this.pressStarted = true;
      this.refreshVisualState(true);
    };
    this.onPointerUp = () => {
      if (this.destroyed) return;
      const shouldActivate = this.pressStarted && this.enabled && this.hovered && this.actionLock;
      this.pressed = false;
      this.pressStarted = false;
      this.actionLock = false;
      const callback = shouldActivate ? this.callback : null;

      // El callback puede cambiar de escena y destruir este botón. No toques
      // Phaser después de ejecutarlo si el componente ya no sigue vivo.
      callback?.();
      if (this.destroyed) return;
      this.refreshVisualState(true);
    };
    this.onPointerUpOutside = () => {
      if (this.destroyed) return;
      this.pressed = false;
      this.pressStarted = false;
      this.actionLock = false;
      this.refreshVisualState(true);
    };

    this.background.on('pointerover', this.onPointerOver);
    this.background.on('pointerout', this.onPointerOut);
    this.background.on('pointerdown', this.onPointerDown);
    this.background.on('pointerup', this.onPointerUp);
    this.background.on('pointerupoutside', this.onPointerUpOutside);
  }

  getVisualState() {
    if (!this.enabled || !this.visible) return 'disabled';
    if (this.pressed) return 'pressed';
    if (this.selected) return 'selected';
    if (this.hovered) return 'hover';
    return 'normal';
  }

  refreshVisualState(animate = true) {
    if (this.destroyed || !this.background || !this.label || !this.container) return;
    const state = this.getVisualState();
    const stateChanged = state !== this.visualState;
    if (!stateChanged) return;
    this.visualState = state;
    const isActive = state === 'hover' || state === 'pressed' || state === 'selected';
    const backgroundColor = {
      normal: this.baseColor,
      hover: this.hoverColor,
      pressed: this.pressedColor,
      selected: this.baseColor,
      disabled: this.disabledColor,
    }[state];
    const borderColor = isActive ? this.activeColor : this.borderColor;
    const borderWidth = state === 'pressed' || state === 'selected'
      ? BUTTON_STYLE.activeBorderWidth
      : BUTTON_STYLE.borderWidth;

    this.background.setFillStyle(backgroundColor);
    this.background.setStrokeStyle(borderWidth, borderColor, 1);
    this.background.setAlpha(state === 'disabled' ? BUTTON_STYLE.disabledAlpha : 1);
    this.label.setColor(state === 'disabled' ? this.disabledTextColor : this.textColor);
    this.icon?.setAlpha(state === 'disabled' ? BUTTON_STYLE.disabledAlpha : 1);
    this.container.setScale(state === 'pressed' ? BUTTON_STYLE.pressScale : 1);
    if (this.background.input) {
      this.background.input.enabled = this.enabled && this.visible;
      this.background.input.cursor = this.enabled && this.visible ? 'pointer' : 'default';
    }

    if (state === 'disabled') {
      this.glitchOut(false);
    } else if (state === 'normal') {
      this.glitchOut(animate);
    } else if (state === 'selected') {
      this.showSelectedCorners();
    } else {
      this.glitchIn(state === 'pressed');
    }
  }

  killCornerTweens() {
    this.activeCornerTweens.forEach((tween) => tween.stop?.());
    this.activeCornerTweens = [];
    const tweens = this.scene?.tweens;
    Object.values(this.corners ?? {}).forEach((layer) => {
      if (!layer) return;
      tweens?.killTweensOf(layer);
      layer.setPosition?.(layer.baseX, layer.baseY);
    });
  }

  glitchIn(pressed = false) {
    this.killCornerTweens();
    const layers = Object.values(this.corners);
    layers.forEach((layer, index) => {
      layer.setAlpha(0);
      const tween = index === 0
        ? this.scene.tweens.chain({
          targets: layer,
          tweens: [
            { alpha: 1, duration: 30 },
            { alpha: 0.2, duration: 35 },
            { alpha: 1, duration: 30 },
            { alpha: 0.4, duration: 35 },
            { alpha: pressed ? BUTTON_STYLE.pressedAlpha : BUTTON_STYLE.hoverAlpha, duration: 35 },
          ],
        })
        : this.scene.tweens.add({
          targets: layer,
          alpha: pressed ? BUTTON_STYLE.pressedAlpha : BUTTON_STYLE.hoverAlpha,
          duration: pressed ? BUTTON_STYLE.pressDuration : 55,
          delay: index === 1 ? 42 : 78,
          ease: 'Quad.out',
        });
      this.activeCornerTweens.push(tween);
    });
  }

  showSelectedCorners() {
    this.killCornerTweens();
    Object.values(this.corners).forEach((layer) => layer.setAlpha(BUTTON_STYLE.selectedAlpha));
  }

  glitchOut(animate = true) {
    this.killCornerTweens();
    Object.values(this.corners).forEach((layer) => {
      layer.setPosition(layer.baseX, layer.baseY);
      if (!animate) {
        layer.setAlpha(0);
        return;
      }
      this.scene.tweens.add({
        targets: layer,
        alpha: 0,
        duration: BUTTON_STYLE.hoverDuration,
        ease: 'Quad.out',
      });
    });
  }

  hideCorners(animate) {
    this.glitchOut(animate);
  }

  setEnabled(value) {
    if (this.destroyed) return;
    this.enabled = Boolean(value);
    if (!this.enabled) {
      this.hovered = false;
      this.pressed = false;
      this.pressStarted = false;
      this.actionLock = false;
    }
    // El input se crea una sola vez en bindInput(); aquí solo se cambia su estado.
    if (!this.background.input) this.background.setInteractive({ useHandCursor: true });
    this.refreshVisualState(true);
  }

  setSelected(value) {
    if (this.destroyed) return;
    this.selected = Boolean(value);
    this.refreshVisualState(true);
  }

  setLabel(value) {
    if (this.destroyed || !this.label) return;
    this.label.setText(value);
  }

  setVisible(value) {
    if (this.destroyed || !this.container) return;
    this.visible = Boolean(value);
    if (!this.visible) {
      this.hovered = false;
      this.pressed = false;
      this.pressStarted = false;
      this.actionLock = false;
    }
    this.container.setVisible(this.visible);
    this.refreshVisualState(true);
  }

  setAlpha(value) {
    if (this.destroyed || !this.container) return;
    this.container.setAlpha(value);
  }

  setPosition(x, y) {
    if (this.destroyed || !this.container) return;
    this.container.setPosition(x, y);
  }

  /** Permite integrar el botón en una jerarquía visual común. */
  setDepth(depth) {
    if (this.destroyed || !this.container) return;
    this.container.setDepth(depth);
  }

  setCallback(callback) {
    if (this.destroyed) return;
    this.callback = callback;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.killCornerTweens();

    const background = this.background;
    if (background?.off) {
      background.off('pointerover', this.onPointerOver);
      background.off('pointerout', this.onPointerOut);
      background.off('pointerdown', this.onPointerDown);
      background.off('pointerup', this.onPointerUp);
      background.off('pointerupoutside', this.onPointerUpOutside);
    }
    if (background?.scene && background.input) background.disableInteractive();
    this.container?.destroy?.(true);

    this.background = null;
    this.label = null;
    this.icon = null;
    this.corners = null;
    this.container = null;
    this.scene = null;
    this.callback = null;
  }
}
