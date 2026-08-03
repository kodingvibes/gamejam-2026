// HelpSystem — burbujas de ayuda y overlay "¿CÓMO JUGAR?"
// Patrón: facade global window.HelpSystem + HelpManager por escena (scene.__helpManager).

window.HelpSystem = {
  getManager(scene) {
    if (!scene.__helpManager) {
      scene.__helpManager = new HelpManager(scene);
    }
    return scene.__helpManager;
  },

  register(scene, target, title, desc, opts) {
    return this.getManager(scene).register(target, title, desc, opts);
  },

  showOverlay(scene, pages, opts) {
    return this.getManager(scene).showOverlay(pages, opts);
  },

  clearZones(scene) {
    const m = scene.__helpManager;
    if (m) m.clearZones();
  },

  setEnabled(scene, v) {
    const m = scene.__helpManager;
    if (m) m.setEnabled(v);
  },

  setModal(scene, v) {
    const m = scene.__helpManager;
    if (m) m.setModal(v);
  }
};

class HelpManager {
  constructor(scene) {
    this.scene = scene;
    this.zones = [];
    this.bubble = null;
    this.bubbleTimer = null;
    this.overlay = null;
    this.enabled = true;
    this.modal = false;
  }

  setEnabled(v) {
    this.enabled = !!v;
    if (!this.enabled) this.hideBubble();
  }

  isEnabled() { return this.enabled; }

  // Bloquea las burbujas mientras hay un modal/overlay abierto (menú pausa, tutorial).
  // No toca la preferencia del usuario (enabled). Contador para anidamientos.
  setModal(v) {
    this.modal = Math.max(0, this.modal + (v ? 1 : -1));
    if (this.modal > 0) this.hideBubble();
  }

  isModal() { return this.modal > 0; }

  // ===== BURBUJA =====
  register(target, title, desc, opts = {}) {
    // Si el target es un objeto interactivo real (carta, botón, etc.),
    // adjuntar el hover directamente (no añade bloqueo extra: el objeto ya era interactivo).
    if (target && target.setInteractive) {
      const show = () => this.showBubble(target, title, desc, opts);
      const hide = () => this.hideBubble();
      target.on('pointerover', show);
      target.on('pointerout', hide);
      let tapHandler = null;
      if (opts.tap) {
        tapHandler = () => {
          if (this.bubble && this.bubble.active && this.bubble._title === title) {
            this.hideBubble();
          } else {
            show();
          }
        };
        target.on('pointerdown', tapHandler);
      }
      this.zones.push({ obj: target, show, hide, tap: tapHandler });
      return target;
    }

    // Target de coordenadas {x,y}: NO se crea ninguna zona Phaser interactiva
    // (bloquearía los clics de botones/cartas debajo por topOnly).
    // Se registra como dato y se comprueba con pointermove de la escena.
    if (target && typeof target === 'object' && target.x !== undefined) {
      const hit = {
        x: target.x, y: target.y,
        w: opts.w || 60, h: opts.h || 30,
        title, desc, opts,
        above: opts.above !== false,
        width: opts.width || 200
      };
      if (!this._pointerMoveBound) {
        this._pointerMoveBound = true;
        this._pointerMoveHandler = (p) => this._onPointerMove(p);
        this.scene.input.on('pointermove', this._pointerMoveHandler);
      }
      this.zones.push(hit);
      return hit;
    }

    return null;
  }

  _onPointerMove(p) {
    if (!this.enabled || this.modal > 0) return;
    const px = (p.worldX !== undefined) ? p.worldX : p.x;
    const py = (p.worldY !== undefined) ? p.worldY : p.y;
    let over = null;
    for (const z of this.zones) {
      if (!z.x || z.obj) continue; // solo targets de coordenadas
      if (px >= z.x - z.w / 2 && px <= z.x + z.w / 2
        && py >= z.y - z.h / 2 && py <= z.y + z.h / 2) {
        over = z;
        break;
      }
    }
    if (over && (!this.bubble || this.bubble._title !== over.title)) {
      this.showBubble(over, over.title, over.desc, over.opts);
    } else if (!over) {
      this.hideBubble();
    }
  }

  showBubble(zone, title, desc, opts) {
    const scene = this.scene;
    this.hideBubble();

    const x = (zone.x !== undefined) ? zone.x : zone.x;
    const y = (zone.y !== undefined) ? zone.y : zone.y;
    const above = opts.above !== false;
    const bx = Math.max(80, Math.min(560, x));
    const by = above ? Math.max(40, y - 20) : Math.min(320, y + 30);

    const tooltip = UI.tooltip(scene, bx, by, title, desc, {
      width: opts.width || 200,
      color: opts.color || '#9fcafd',
      fontSize: opts.fontSize || '7px',
      minHeight: 56,
      maxWidth: opts.width || 200,
      layer: scene.modalLayer || scene.uiLayer
    });

    this.bubble = tooltip.container;
    this.bubble._title = title;
    this.bubble.setDepth(4000);
    this.bubble.setScale(0.9).setAlpha(0);
    scene.tweens.add({
      targets: this.bubble, scale: 1, alpha: 1,
      duration: 120, ease: 'Back.easeOut'
    });
  }

  hideBubble() {
    if (!this.bubble) return;
    const b = this.bubble;
    this.bubble = null;
    this.scene.tweens.add({
      targets: b, alpha: 0, scale: 0.9,
      duration: 100, ease: 'Cubic.easeIn',
      onComplete: () => { if (b && b.active) b.destroy(); }
    });
  }

  clearZones() {
    this.zones.forEach(z => {
      if (z.obj) {
        // entrada de objeto real: desvincular SOLO nuestros handlers
        z.obj.off('pointerover', z.show);
        z.obj.off('pointerout', z.hide);
        if (z.tap) z.obj.off('pointerdown', z.tap);
      }
      // entradas de coordenadas son datos planos; nada que destruir
    });
    this.zones = [];
    if (this._pointerMoveBound) {
      this._pointerMoveBound = false;
      this.scene.input.off('pointermove', this._pointerMoveHandler);
      this._pointerMoveHandler = null;
    }
    this.hideBubble();
  }

  // ===== OVERLAY "¿CÓMO JUGAR?" =====
  showOverlay(pages, opts = {}) {
    const scene = this.scene;
    this.closeOverlay();
    const list = pages || (window.TUTORIAL_PAGES || []);
    let index = 0;

    scene.helpBusy = true;
    this.setModal(true);

    const W = 640, H = 360;
    const layer = scene.add.container(W / 2, H / 2).setDepth(6000);
    this.overlay = layer;

    const dim = scene.add.rectangle(0, 0, W, H, 0x000000, 0.78).setInteractive();
    layer.add(dim);

    const panel = scene.add.rectangle(0, 0, 520, 300, 0x16213e)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor('#faba72').color);
    layer.add(panel);

    const titleTxt = UI.text(scene, 0, -120, '', {
      fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#faba72',
      align: 'center', wordWrap: { width: 480 }
    }).setOrigin(0.5);
    layer.add(titleTxt);

    const bodyTxt = UI.text(scene, 0, -10, '', {
      fontFamily: '"VT323"', fontSize: '17px', color: '#e0e0e0',
      align: 'center', lineSpacing: 4, wordWrap: { width: 460 }
    }).setOrigin(0.5);
    layer.add(bodyTxt);

    const footerTxt = UI.text(scene, 0, 118, '', {
      fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#8892a0'
    }).setOrigin(0.5);
    layer.add(footerTxt);

    const renderPage = () => {
      const p = list[index] || list[0];
      titleTxt.setText(p.title);
      bodyTxt.setText(Array.isArray(p.body) ? p.body.join('\n') : p.body);
      footerTxt.setText(p.footer || ((index + 1) + ' / ' + list.length));
      prevBtn.container.setAlpha(index > 0 ? 1 : 0.35);
      prevBtn.container.setInteractive(index > 0);
      nextBtn.text.setText(index < list.length - 1 ? 'SIGUIENTE' : 'JUGAR');
    };

    const prevBtn = UI.button(scene, -150, 128, 'ATRÁS', '#8892a0',
      () => { if (index > 0) { index--; renderPage(); } },
      { minWidth: 120, height: 26, fontSize: '7px' });
    layer.add(prevBtn.container);

    const nextBtn = UI.button(scene, 150, 128, 'SIGUIENTE', '#faba72',
      () => {
        if (index < list.length - 1) { index++; renderPage(); }
        else this.closeOverlay();
      },
      { minWidth: 140, height: 26, fontSize: '7px' });
    layer.add(nextBtn.container);

    const skipBtn = UI.button(scene, 0, 128, 'SALTAR', '#bdcd9c',
      () => this.closeOverlay(),
      { minWidth: 100, height: 26, fontSize: '7px' });
    layer.add(skipBtn.container);

    // Cerrar con ESC o clic fuera del panel
    const keyEsc = scene.input.keyboard && scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    const escHandler = () => this.closeOverlay();
    if (keyEsc) {
      this._escKey = keyEsc;
      this._escHandler = escHandler;
      keyEsc.on('down', escHandler);
    }
    dim.on('pointerdown', escHandler);

    renderPage();
    return {
      close: () => this.closeOverlay()
    };
  }

  closeOverlay() {
    if (!this.overlay) return;
    const layer = this.overlay;
    const scene = this.scene;
    this.overlay = null;
    if (this._escKey && this._escHandler) {
      this._escKey.off('down', this._escHandler);
      this._escKey = null; this._escHandler = null;
    }
    layer.destroy(true);
    this.setModal(false);
    if (scene.helpBusy) scene.helpBusy = false;
    if (scene.onHelpClosed) scene.onHelpClosed();
  }

  destroy() {
    this.clearZones();
    this.closeOverlay();
    const scene = this.scene;
    if (scene.__helpManager === this) scene.__helpManager = null;
  }
}

window.HelpManager = HelpManager;
