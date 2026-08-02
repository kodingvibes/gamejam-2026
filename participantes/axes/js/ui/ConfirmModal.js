/**
 * Modal reutilizable para confirmar acciones destructivas o irreversibles.
 * El overlay captura el input fuera del panel; los botones son GlitchButton.
 */
class ConfirmModal {
  /** @param {Phaser.Scene} scene @param {{title?: string, message?: string, confirmLabel?: string, cancelLabel?: string, menuLabel?: string, onConfirm?: () => void, onCancel?: () => void, onMenu?: () => void}} options */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.onConfirm = options.onConfirm;
    this.onCancel = options.onCancel;
    this.onMenu = options.onMenu;
    this.isClosing = false;
    this.resolved = false;
    this.destroyed = false;

    this.overlay = scene.add.rectangle(
      CONFIRM_MODAL_STYLE.centerX,
      CONFIRM_MODAL_STYLE.centerY,
      GAME_WIDTH,
      GAME_HEIGHT,
      COLORS.black,
      CONFIRM_MODAL_STYLE.overlayAlpha,
    ).setInteractive();
    this.panel = scene.add.rectangle(
      CONFIRM_MODAL_STYLE.centerX,
      CONFIRM_MODAL_STYLE.centerY,
      CONFIRM_MODAL_STYLE.panelWidth,
      CONFIRM_MODAL_STYLE.panelHeight,
      COLORS.panelBg,
      CONFIRM_MODAL_STYLE.panelAlpha,
    ).setStrokeStyle(UI_STYLE.borderWidth, COLORS.panelBorder, 1);
    this.title = scene.add.text(CONFIRM_MODAL_STYLE.centerX, CONFIRM_MODAL_STYLE.titleY, options.title ?? '¿CONFIRMAR ACCIÓN?', {
      color: SVG_COLORS.textPrimary,
      fontFamily: FONTS.TITLE,
      fontSize: CONFIRM_MODAL_STYLE.titleSize,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.message = scene.add.text(CONFIRM_MODAL_STYLE.centerX, CONFIRM_MODAL_STYLE.messageY, options.message ?? '', {
      color: SVG_COLORS.textMuted,
      fontFamily: FONTS.BODY,
      fontSize: UI_STYLE.bodySize,
      align: 'center',
    }).setOrigin(0.5);

    const buttonOffset = (CONFIRM_MODAL_STYLE.buttonWidth + CONFIRM_MODAL_STYLE.buttonGap) / 2;
    // El botón lleno y luminoso es el que NO destruye nada. Antes el relleno magenta
    // empujaba hacia perder la partida, que es justo lo que hay que costar de pulsar.
    this.confirmButton = new GlitchButton(
      scene,
      CONFIRM_MODAL_STYLE.centerX - buttonOffset,
      CONFIRM_MODAL_STYLE.buttonsY,
      CONFIRM_MODAL_STYLE.buttonWidth,
      CONFIRM_MODAL_STYLE.buttonHeight,
      options.confirmLabel ?? 'CONFIRMAR',
      () => this.resolve('confirm'),
      {
        baseColor: COLORS.buttonBase,
        hoverColor: COLORS.confirmDangerHover,
        pressedColor: COLORS.confirmDangerPressed,
        borderColor: COLORS.playerTwo,
        activeColor: COLORS.playerTwo,
        textColor: SVG_COLORS.playerTwo,
        fontSize: CONFIRM_MODAL_STYLE.buttonFontSize,
      },
    );
    this.cancelButton = new GlitchButton(
      scene,
      CONFIRM_MODAL_STYLE.centerX + buttonOffset,
      CONFIRM_MODAL_STYLE.buttonsY,
      CONFIRM_MODAL_STYLE.buttonWidth,
      CONFIRM_MODAL_STYLE.buttonHeight,
      options.cancelLabel ?? 'CANCELAR',
      () => this.resolve('cancel'),
      {
        baseColor: COLORS.playerOne,
        hoverColor: COLORS.buttonPrimaryHover,
        pressedColor: COLORS.buttonPrimaryPressed,
        activeColor: COLORS.playerOne,
        textColor: SVG_COLORS.buttonActiveText,
        fontSize: CONFIRM_MODAL_STYLE.buttonFontSize,
      },
    );
    // La tercera salida no responde a la pregunta del título: va debajo de la línea.
    this.divider = scene.add.rectangle(
      CONFIRM_MODAL_STYLE.centerX,
      CONFIRM_MODAL_STYLE.dividerY,
      CONFIRM_MODAL_STYLE.dividerWidth,
      1,
      COLORS.textDim,
      0.35,
    );
    this.menuButton = new GlitchButton(
      scene,
      CONFIRM_MODAL_STYLE.centerX,
      CONFIRM_MODAL_STYLE.menuButtonY,
      CONFIRM_MODAL_STYLE.menuButtonWidth,
      CONFIRM_MODAL_STYLE.menuButtonHeight,
      options.menuLabel ?? 'SALIR AL MENÚ',
      () => this.resolve('menu'),
      {
        fontSize: CONFIRM_MODAL_STYLE.menuFontSize,
        baseColor: COLORS.buttonBase,
        hoverColor: COLORS.buttonHover,
        pressedColor: BUTTON_STYLE.backgroundPressed,
        activeColor: COLORS.panelBorder,
        textColor: SVG_COLORS.textMuted,
      },
    );

    this.overlay.setDepth(DEPTH.overlay);
    [this.panel, this.title, this.message, this.divider].forEach((object) => object.setDepth(DEPTH.modal));
    this.confirmButton.setDepth(DEPTH.modalContent);
    this.cancelButton.setDepth(DEPTH.modalContent);
    this.menuButton.setDepth(DEPTH.modalContent);
    this.objects = [
      this.overlay,
      this.panel,
      this.title,
      this.message,
      this.divider,
      this.confirmButton.container,
      this.cancelButton.container,
      this.menuButton.container,
    ];
    this.escapeKey = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.onEscape = () => this.resolve(false);
    this.escapeKey?.on('down', this.onEscape);
  }

  /** Resuelve el modal una sola vez y ejecuta el callback correspondiente. */
  resolve(action) {
    if (this.resolved || this.destroyed) return;
    this.resolved = true;
    this.isClosing = true;
    const callback = action === 'confirm' ? this.onConfirm : action === 'menu' ? this.onMenu : this.onCancel;
    this.destroy();
    callback?.();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.escapeKey) {
      this.escapeKey.off('down', this.onEscape);
      this.scene.input.keyboard?.removeKey(this.escapeKey);
      this.escapeKey = null;
    }
    this.confirmButton?.destroy();
    this.cancelButton?.destroy();
    this.menuButton?.destroy();
    this.overlay?.disableInteractive();
    this.overlay?.destroy();
    this.panel?.destroy();
    this.title?.destroy();
    this.message?.destroy();
    this.divider?.destroy();
    this.onConfirm = null;
    this.onCancel = null;
    this.onMenu = null;
    this.objects = [];
    this.scene = null;
  }
}
