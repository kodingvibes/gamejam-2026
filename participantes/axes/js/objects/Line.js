/**
 * Línea visual e interactiva entre dos puntos.
 *
 * La línea visible es fina, pero el rectángulo transparente recibe el input
 * con una zona mayor para que sea cómoda de seleccionar en el futuro.
 */
class Line {
  /**
   * @param {SVGElement} svg
   * @param {{ id: string, type: string, x1: number, y1: number, x2: number, y2: number }} data
   */
  constructor(svg, data, onClick, getHoverColor, onHover) {
    this.id = data.id;
    this.owner = null;
    this.getHoverColor = getHoverColor ?? (() => SVG_COLORS.hoverLine);
    this.onHover = onHover;
    this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.group.dataset.lineId = this.id;
    this.group.setAttribute('role', 'button');
    this.group.setAttribute('aria-label', `Línea ${this.id}`);

    // Dos mitades permiten revelar la línea desde el centro hacia ambos extremos.
    this.visible = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.visible.classList.add('line-visible');
    this.visible.style.setProperty('--line-reveal-duration', `${BOARD_STYLE.lineRevealDuration}ms`);
    const midpointX = (data.x1 + data.x2) / 2;
    const midpointY = (data.y1 + data.y2) / 2;
    const segmentLength = Math.hypot(data.x2 - data.x1, data.y2 - data.y1) / 2;
    this.visibleSegments = [
      this.createVisibleSegment(midpointX, midpointY, data.x1, data.y1, segmentLength),
      this.createVisibleSegment(midpointX, midpointY, data.x2, data.y2, segmentLength),
    ];
    this.visible.append(...this.visibleSegments);
    this.visible.style.pointerEvents = 'none';

    this.hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.hitbox.classList.add('board-line-hitbox');
    this.hitbox.setAttribute('x1', data.x1);
    this.hitbox.setAttribute('y1', data.y1);
    this.hitbox.setAttribute('x2', data.x2);
    this.hitbox.setAttribute('y2', data.y2);
    this.hitbox.setAttribute('stroke', 'transparent');
    this.hitbox.setAttribute('stroke-width', BOARD_STYLE.hitboxWidth);
    this.hitbox.setAttribute('stroke-linecap', 'round');
    this.hitbox.style.cursor = 'pointer';
    this.hitbox.style.pointerEvents = 'stroke';

    this.group.append(this.visible, this.hitbox);
    svg.appendChild(this.group);

    this.hitbox.addEventListener('pointerover', (event) => {
      if (this.owner !== null) return;
      this.setHovered(true);
      this.onHover?.(this.id, true);
      // En táctil el pointerover llega junto al pointerdown: sonarían dos notas.
      if (event.pointerType === 'touch') return;
      // playHover solo suena si el audio ya está activo y se limita por sí mismo.
      AudioManager.instance?.playHover();
    });
    this.hitbox.addEventListener('pointerout', () => {
      if (this.owner !== null) return;
      this.setHovered(false);
      this.onHover?.(this.id, false);
    });
    this.hitbox.addEventListener('pointerdown', () => onClick?.(this.id));
  }

  /** @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {number} length */
  createVisibleSegment(x1, y1, x2, y2, length) {
    const segment = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    segment.classList.add('line-segment');
    segment.setAttribute('x1', x1);
    segment.setAttribute('y1', y1);
    segment.setAttribute('x2', x2);
    segment.setAttribute('y2', y2);
    segment.setAttribute('stroke', SVG_COLORS.emptyLine);
    segment.setAttribute('stroke-width', BOARD_STYLE.lineWidth);
    segment.setAttribute('stroke-linecap', 'round');
    segment.style.setProperty('--line-segment-length', `${length}`);
    return segment;
  }

  /** @param {boolean} hovered */
  setHovered(hovered) {
    if (this.owner !== null) return;
    const hoverColor = this.getHoverColor();
    // La regla .is-hovered usa currentColor para su halo: por eso se escribe color.
    this.visible.classList.toggle('is-hovered', hovered);
    this.visibleSegments.forEach((segment) => {
      segment.setAttribute('stroke', hovered ? hoverColor : SVG_COLORS.emptyLine);
      segment.setAttribute('stroke-width', hovered ? BOARD_STYLE.lineHoverWidth : BOARD_STYLE.lineWidth);
      segment.style.color = hovered ? hoverColor : SVG_COLORS.emptyLine;
    });
  }

  /** @param {number|null} owner */
  setOwner(owner) {
    const wasEmpty = this.owner === null;
    this.owner = owner;
    const color = owner === 0 ? SVG_COLORS.playerOne : SVG_COLORS.playerTwo;
    this.visibleSegments.forEach((segment) => {
      segment.setAttribute('stroke', owner === null ? SVG_COLORS.emptyLine : color);
      segment.setAttribute('stroke-width', BOARD_STYLE.lineWidth);
      segment.style.color = owner === null ? SVG_COLORS.emptyLine : color;
    });
    this.hitbox.style.cursor = owner === null ? 'pointer' : 'default';
    this.visible.classList.toggle('line-drawn', owner !== null);
    if (owner !== null) {
      // Sin esto, una previsualización quedaría huérfana al empezar el turno de la IA.
      this.visible.classList.remove('is-hovered');
      this.onHover?.(this.id, false);
    }
    if (owner === null) this.resetReveal();
    else if (wasEmpty) this.revealFromCenter();
  }

  revealFromCenter() {
    this.visibleSegments.forEach((segment) => {
      const length = segment.style.getPropertyValue('--line-segment-length');
      segment.setAttribute('stroke-dasharray', length);
      segment.setAttribute('stroke-dashoffset', length);
      segment.classList.remove('line-reveal-segment');
      // Reflow forces a fresh animation when the line changes owner visually.
      void segment.getBoundingClientRect();
      segment.classList.add('line-reveal-segment');
    });
  }

  resetReveal() {
    this.visibleSegments.forEach((segment) => {
      segment.classList.remove('line-reveal-segment');
      segment.removeAttribute('stroke-dasharray');
      segment.removeAttribute('stroke-dashoffset');
    });
  }

  /** @param {boolean} enabled */
  setInteractive(enabled) {
    this.hitbox.style.pointerEvents = enabled ? 'stroke' : 'none';
    this.hitbox.style.cursor = enabled && this.owner === null ? 'pointer' : 'default';
    if (enabled) return;
    // Al apagar el input no llega pointerout: hay que soltar el hover a mano.
    if (this.owner === null) this.setHovered(false);
    this.onHover?.(this.id, false);
  }

  destroy() {
    this.group.remove();
  }
}
