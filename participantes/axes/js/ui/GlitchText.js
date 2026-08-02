/**
 * Texto con aberración cromática breve y controlada.
 * Las copias desplazadas solo se usan en títulos y mensajes destacados.
 */
class GlitchText {
  /** @param {Phaser.Scene} scene @param {number} x @param {number} y @param {string} value @param {object} style */
  constructor(scene, x, y, value, style = {}) {
    this.container = scene.add.container(x, y);
    this.cyan = scene.add.text(UI_STYLE.glitchOffset, 0, value, { ...style, color: SVG_COLORS.glitchCyan }).setOrigin(0.5);
    this.magenta = scene.add.text(-UI_STYLE.glitchOffset, 0, value, { ...style, color: SVG_COLORS.glitchMagenta }).setOrigin(0.5);
    this.main = scene.add.text(0, 0, value, style).setOrigin(0.5);
    this.container.add([this.cyan, this.magenta, this.main]);

    this.scene = scene;
    this.pulse();
  }

  /** Un solo pulso corto: legible y sin movimiento permanente. Re-disparable al reaparecer. */
  pulse() {
    this.scene.tweens.add({
      targets: [this.cyan, this.magenta],
      alpha: 0.08,
      duration: 110,
      yoyo: true,
      repeat: 2,
      hold: 120,
    });
  }

  setText(value) {
    this.cyan.setText(value);
    this.magenta.setText(value);
    this.main.setText(value);
  }

  setColor(color) {
    this.main.setColor(color);
  }

  setVisible(visible) {
    this.container.setVisible(visible);
  }
}
