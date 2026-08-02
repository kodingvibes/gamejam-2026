/** Cuadro SVG que muestra qué jugador lo completó. */
class Box {
  /** @param {SVGElement} svg @param {string} id @param {number} x @param {number} y @param {number} size @param {string} baseColor */
  constructor(svg, id, x, y, size, baseColor) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.width = size;
    this.height = size;
    this.centerX = x + size / 2;
    this.centerY = y + size / 2;
    this.baseColor = baseColor;
    this.activeGlitch = null;
    this.activePulse = null;
    this.element = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    this.element.classList.add('board-box-fill');
    this.element.setAttribute('x', x);
    this.element.setAttribute('y', y);
    this.element.setAttribute('width', size);
    this.element.setAttribute('height', size);
    this.element.setAttribute('fill', baseColor);
    this.element.setAttribute('fill-opacity', BOARD_STYLE.cellOpacity);
    this.element.setAttribute('rx', BOARD_STYLE.cellRadius);
    // El atributo queda como respaldo sin variables CSS; el estilo en línea hace
    // que la celda LIBRE también respire con la música. En el suelo de la
    // variable (0.28) esto vale exactamente 0.92: idéntico a antes.
    this.applyFreeOpacity();
    // En SVG, fill-box hace que el origen sea el centro de esta celda,
    // no el centro del viewport completo.
    this.element.style.transformBox = 'fill-box';
    this.element.style.transformOrigin = 'center';
    this.element.style.setProperty('--box-reveal-duration', `${BOARD_STYLE.boxRevealDuration}ms`);
    this.element.style.setProperty('--box-reveal-initial-scale', BOARD_STYLE.boxRevealInitialScale);
    this.element.style.pointerEvents = 'none';
    svg.appendChild(this.element);

    // Marca de caja caliente: un trazo dorado punteado hacia dentro. Se discrimina
    // del dueño en tres canales a la vez: sin relleno, punteado y nunca color de jugador.
    const inset = size * HOT_BOX.inset;
    this.hotElement = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    this.hotElement.classList.add('board-box-hot');
    this.hotElement.setAttribute('x', x + inset);
    this.hotElement.setAttribute('y', y + inset);
    this.hotElement.setAttribute('width', size - inset * 2);
    this.hotElement.setAttribute('height', size - inset * 2);
    this.hotElement.setAttribute('fill', 'none');
    this.hotElement.setAttribute('stroke', SVG_COLORS.sugar);
    this.hotElement.setAttribute('stroke-width', HOT_BOX.strokeWidth);
    this.hotElement.setAttribute('stroke-dasharray', HOT_BOX.dash);
    this.hotElement.setAttribute('stroke-linecap', 'round');
    this.hotElement.style.pointerEvents = 'none';
    this.hotElement.style.filter = `drop-shadow(0 0 6px ${SVG_COLORS.sugar})`;
    // La fase se escribe UNA vez al construir: con muchas cajas calientes a la vez
    // el tablero late en diagonal en vez de parpadear todo junto.
    const cell = String(id).split('-');
    this.hotElement.style.setProperty('--hot-delay', `${(Number(cell[1]) + Number(cell[2])) * HOT_BOX.delayStep}ms`);
    svg.appendChild(this.hotElement);
  }

  /** Opacidad de la celda libre: base fija más la variable que ya escribe el HUD. */
  applyFreeOpacity() {
    this.element.style.fillOpacity = 'calc(0.64 + var(--box-owner-opacity, 0.28))';
  }

  /** @param {number|null} owner */
  setOwner(owner) {
    const wasEmpty = this.element.dataset.owner === undefined;
    const color = owner === 0 ? SVG_COLORS.playerOne : SVG_COLORS.playerTwo;
    // El degradado radial separa dos celdas vecinas del mismo dueño: sin él, un
    // bloque ganado es una sola mancha plana.
    const fill = owner === 0 ? 'url(#box-fill-p0)' : 'url(#box-fill-p1)';
    this.element.setAttribute('fill', owner === null ? this.baseColor : fill);
    if (owner === null) {
      // La opacidad de las cajas reclamadas la manda la regla CSS, no el atributo.
      this.element.setAttribute('fill-opacity', BOARD_STYLE.cellOpacity);
      this.applyFreeOpacity();
      this.element.removeAttribute('stroke');
      this.element.removeAttribute('stroke-opacity');
      this.element.removeAttribute('stroke-width');
      this.activeGlitch?.cancel();
      this.activeGlitch = null;
      this.activePulse?.cancel();
      this.activePulse = null;
      this.element.classList.remove('box-filled');
      delete this.element.dataset.owner;
      return;
    }

    // OBLIGATORIO: un estilo en línea gana a la regla .board-box-fill[data-owner],
    // así que sin esto la caja reclamada se congelaría en 0.92 y no se leería el dueño.
    this.element.style.removeProperty('fill-opacity');
    // Trazo interior del dueño: dos celdas contiguas siguen leyéndose como dos celdas.
    this.element.setAttribute('stroke', color);
    this.element.setAttribute('stroke-opacity', 0.55);
    this.element.setAttribute('stroke-width', 1.5);
    this.setHot(false);
    this.element.dataset.owner = String(owner);
    // Solo se agrega la clase al pasar de libre a reclamada. Las siguientes
    // actualizaciones de estado no reinician la animación.
    if (wasEmpty) {
      this.element.classList.remove('box-filled');
      void this.element.getBoundingClientRect();
      this.element.classList.add('box-filled');
      if (BOX_CLAIM_GLITCH.enabled) {
        try {
          this.activeGlitch = playBoxClaimGlitch({
            parent: this.element.parentNode,
            playerColor: color,
            bounds: {
              x: this.x,
              y: this.y,
              width: this.width,
              height: this.height,
            },
          });
          const currentGlitch = this.activeGlitch;
          currentGlitch.finished.then(() => {
            if (this.activeGlitch === currentGlitch) this.activeGlitch = null;
          });
        } catch (error) {
          // El efecto es opcional: la caja ya quedó reclamada y el juego continúa.
          this.activeGlitch = null;
          console.warn('BoxClaimGlitch no pudo ejecutarse.', error);
        }
      }
    }
  }

  /**
   * Latido breve sobre su propio centro. transform-box: fill-box ya está puesto.
   * @param {number} delay @param {number} scale @param {number} duration
   */
  pulse(delay, scale, duration) {
    if (typeof this.element.animate !== 'function') return;
    this.activePulse?.cancel();
    this.activePulse = this.element.animate([
      { transform: 'scale(1)' },
      { transform: `scale(${scale})`, offset: 0.4 },
      { transform: 'scale(1)' },
    ], { duration, delay, easing: 'ease-out' });
  }

  /** Telegrafía de 3 de 4 lados. Nunca se activa sobre una caja con dueño. */
  setHot(active) {
    this.hotElement.classList.toggle('box-hot', Boolean(active));
  }

  destroy() {
    this.activeGlitch?.cancel();
    this.activeGlitch = null;
    this.activePulse?.cancel();
    this.activePulse = null;
    this.element.remove();
    this.hotElement.remove();
  }
}
