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
    this.element = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    this.element.classList.add('board-box-fill');
    this.element.setAttribute('x', x);
    this.element.setAttribute('y', y);
    this.element.setAttribute('width', size);
    this.element.setAttribute('height', size);
    this.element.setAttribute('fill', baseColor);
    this.element.setAttribute('fill-opacity', BOARD_STYLE.cellOpacity);
    this.element.setAttribute('rx', BOARD_STYLE.cellRadius);
    // En SVG, fill-box hace que el origen sea el centro de esta celda,
    // no el centro del viewport completo.
    this.element.style.transformBox = 'fill-box';
    this.element.style.transformOrigin = 'center';
    this.element.style.setProperty('--box-reveal-duration', `${BOARD_STYLE.boxRevealDuration}ms`);
    this.element.style.setProperty('--box-reveal-initial-scale', BOARD_STYLE.boxRevealInitialScale);
    this.element.style.pointerEvents = 'none';
    svg.appendChild(this.element);
  }

  /** @param {number|null} owner */
  setOwner(owner) {
    const wasEmpty = this.element.dataset.owner === undefined;
    const color = owner === 0 ? SVG_COLORS.playerOne : SVG_COLORS.playerTwo;
    this.element.setAttribute('fill', owner === null ? this.baseColor : color);
    if (owner === null) {
      // La opacidad de las cajas reclamadas la manda la regla CSS, no el atributo.
      this.element.setAttribute('fill-opacity', BOARD_STYLE.cellOpacity);
      this.activeGlitch?.cancel();
      this.activeGlitch = null;
      this.element.classList.remove('box-filled');
      delete this.element.dataset.owner;
      return;
    }

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

  destroy() {
    this.activeGlitch?.cancel();
    this.activeGlitch = null;
    this.element.remove();
  }
}
