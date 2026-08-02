/**
 * Fondo de rejilla neón con parallax. Varias capas de distinto tamaño de celda y
 * velocidad: al moverse a ritmos distintos dan profundidad sin dibujar nada nuevo.
 *
 * Cada capa se dibuja UNA vez, un celda más grande que el mundo, y después solo se
 * mueve dentro de [-celda, 0]. Redibujar 60 veces por segundo daría lo mismo en
 * pantalla y costaría reconstruir la geometría en cada frame.
 */
class NeonGrid {
  /** @param {Phaser.Scene} scene @param {{intensity?: number, depth?: number}} options */
  constructor(scene, options = {}) {
    this.scene = scene;
    // Sin movimiento la rejilla se queda quieta, pero se dibuja: es decorado, no efecto.
    this.motion = effectsAllowed();
    this.intensity = options.intensity ?? 1;
    const depth = options.depth ?? NEON_GRID.depth;

    this.layers = NEON_GRID.layers.map((config) => {
      const graphics = scene.add.graphics().setDepth(depth).setAlpha(config.alpha * this.intensity);
      this.drawLayer(graphics, config);
      graphics.setPosition(-config.cell, -config.cell);
      return { config, graphics, offsetX: 0, offsetY: 0 };
    });

    // El latido de opacidad es lo que la hace parecer neón y no una hoja de cuaderno.
    this.pulseTweens = this.motion
      ? this.layers.map(({ config, graphics }, index) => scene.tweens.add({
        targets: graphics,
        alpha: config.alpha * this.intensity * NEON_GRID.pulseDepth,
        duration: NEON_GRID.pulseDuration + index * 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      }))
      : [];

    this.sweep = this.motion ? this.createSweep(depth) : null;

    if (this.motion) {
      this.onUpdate = (_time, delta) => this.advance(delta);
      scene.events.on('update', this.onUpdate);
    }
    scene.events.once('shutdown', () => this.destroy());
  }

  /** @param {Phaser.GameObjects.Graphics} graphics @param {{cell: number, color: number}} config */
  drawLayer(graphics, config) {
    const { cell, color } = config;
    // Dos pasadas sobre la misma geometría: halo ancho y tenue, y núcleo fino y pleno.
    [[NEON_GRID.glowWidth, NEON_GRID.glowAlpha], [NEON_GRID.lineWidth, 1]].forEach(([width, alpha]) => {
      graphics.lineStyle(width, color, alpha);
      graphics.beginPath();
      // Un celda de margen por cada lado: es el recorrido que después se desplaza.
      for (let x = 0; x <= GAME_WIDTH + cell * 2; x += cell) {
        graphics.moveTo(x, 0);
        graphics.lineTo(x, GAME_HEIGHT + cell * 2);
      }
      for (let y = 0; y <= GAME_HEIGHT + cell * 2; y += cell) {
        graphics.moveTo(0, y);
        graphics.lineTo(GAME_WIDTH + cell * 2, y);
      }
      graphics.strokePath();
    });
  }

  /**
   * Barrido de tubo de rayos: banda difusa con una línea brillante dentro. Va en un
   * contenedor para animar una sola posición en vez de dos rectángulos en paralelo.
   * @param {number} depth
   */
  createSweep(depth) {
    const band = this.scene.add.rectangle(0, 0, GAME_WIDTH, NEON_GRID.sweepBandHeight, COLORS.playerOne, NEON_GRID.sweepBandAlpha);
    const line = this.scene.add.rectangle(0, 0, GAME_WIDTH, NEON_GRID.sweepHeight, COLORS.playerOne, NEON_GRID.sweepAlpha);
    const container = this.scene.add.container(GAME_WIDTH / 2, -NEON_GRID.sweepBandHeight, [band, line]);
    container.setDepth(depth).setAlpha(this.intensity);
    this.sweepTween = this.scene.tweens.add({
      targets: container,
      y: GAME_HEIGHT + NEON_GRID.sweepBandHeight,
      duration: NEON_GRID.sweepDuration,
      repeat: -1,
      repeatDelay: NEON_GRID.sweepDelay,
      ease: 'Sine.inOut',
    });
    return container;
  }

  /** @param {number} delta milisegundos desde el frame anterior */
  advance(delta) {
    const step = delta / 1000;
    this.layers.forEach((layer) => {
      const { cell, speedX, speedY } = layer.config;
      // El módulo mantiene el desplazamiento dentro de una celda: la rejilla es
      // periódica, así que moverse una celda es indistinguible de no moverse.
      layer.offsetX = (layer.offsetX + speedX * step) % cell;
      layer.offsetY = (layer.offsetY + speedY * step) % cell;
      layer.graphics.setPosition(-cell + layer.offsetX, -cell + layer.offsetY);
    });
  }

  destroy() {
    if (this.onUpdate) {
      this.scene?.events?.off('update', this.onUpdate);
      this.onUpdate = null;
    }
    this.pulseTweens.forEach((tween) => tween?.stop?.());
    this.pulseTweens = [];
    this.sweepTween?.stop?.();
    this.sweepTween = null;
    this.sweep?.destroy?.();
    this.sweep = null;
    this.layers.forEach((layer) => layer.graphics?.destroy?.());
    this.layers = [];
    this.scene = null;
  }
}
