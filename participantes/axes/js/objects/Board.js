/**
 * Construye la representación SVG de una cuadrícula de Timbiriche.
 *
 * Esta fase solo conoce geometría y presentación. La ocupación de líneas y
 * cuadros se incorporará después mediante una capa de lógica independiente.
 */
class Board {
  /** @param {HTMLElement} parent @param {number} size @param {(result: object) => void} onMove */
  constructor(parent, size, onMove) {
    this.parent = parent;
    this.size = size;
    this.onMove = onMove;
    this.state = initBoard(size);
    this.lines = [];
    this.dots = [];
    this.boxes = [];
    this.lineById = new Map();
    this.boxById = new Map();
    this.previewAnimations = [];
    this.dotIdle = null;
    this.inputEnabled = true;
    this.moveEnabled = true;
    this.activePlayer = this.state.currentPlayer;
    this.svg = this.createSvg();
    this.render();
  }

  createSvg() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'board-svg';
    svg.setAttribute('viewBox', `0 0 ${GAME_WIDTH} ${GAME_HEIGHT}`);
    svg.setAttribute('aria-label', `Tablero de ${this.size} por ${this.size} puntos`);
    // El SVG ocupa todo el layout visual, pero no debe bloquear el canvas.
    // Solo las hitboxes de Line habilitan pointer-events explícitamente.
    svg.style.pointerEvents = 'none';
    this.parent.appendChild(svg);
    return svg;
  }

  render() {
    const spacing = BOARD_STYLE.width / (this.size - 1);
    const left = (GAME_WIDTH - BOARD_STYLE.width) / 2;
    const top = BOARD_STYLE.top;

    // Los degradados van primero para no alterar el orden de pintado.
    this.svg.appendChild(this.createFillDefs());

    const frame = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    frame.setAttribute('x', left - BOARD_STYLE.framePadding);
    frame.setAttribute('y', top - BOARD_STYLE.framePadding);
    frame.setAttribute('width', BOARD_STYLE.width + BOARD_STYLE.framePadding * 2);
    frame.setAttribute('height', BOARD_STYLE.width + BOARD_STYLE.framePadding * 2);
    frame.setAttribute('rx', BOARD_STYLE.cellRadius);
    frame.setAttribute('fill', SVG_COLORS.boardCellA);
    frame.setAttribute('stroke', SVG_COLORS.boardGridBorder);
    frame.setAttribute('stroke-width', 1);
    frame.style.pointerEvents = 'none';
    this.svg.appendChild(frame);

    // Los rellenos y sus glitches temporales quedan debajo de líneas y puntos.
    this.boxesLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.boxesLayer.setAttribute('id', 'boxes-layer');
    this.svg.appendChild(this.boxesLayer);

    // Primero los cuadros, después líneas y puntos para respetar las capas SVG.
    for (let row = 0; row < this.size - 1; row += 1) {
      for (let column = 0; column < this.size - 1; column += 1) {
        const cellColor = (row + column) % 2 === 0 ? SVG_COLORS.boardCellA : SVG_COLORS.boardCellB;
        const box = new Box(this.boxesLayer, `box-${row}-${column}`, left + column * spacing, top + row * spacing, spacing, cellColor);
        this.boxes.push(box);
        this.boxById.set(box.id, box);
      }
    }

    for (let row = 0; row < this.size; row += 1) {
      for (let column = 0; column < this.size - 1; column += 1) {
        const x1 = left + column * spacing;
        const x2 = x1 + spacing;
        const y = top + row * spacing;
        const line = new Line(this.svg, {
          id: `h-${row}-${column}`,
          type: 'h', x1, y1: y, x2, y2: y,
        }, (lineId) => this.handleLineClick(lineId), () => this.getActivePlayerColor(), (lineId, hovered) => this.handleLineHover(lineId, hovered));
        this.lines.push(line);
        this.lineById.set(line.id, line);
      }
    }

    for (let row = 0; row < this.size - 1; row += 1) {
      for (let column = 0; column < this.size; column += 1) {
        const x = left + column * spacing;
        const y1 = top + row * spacing;
        const y2 = y1 + spacing;
        const line = new Line(this.svg, {
          id: `v-${row}-${column}`,
          type: 'v', x1: x, y1, x2: x, y2,
        }, (lineId) => this.handleLineClick(lineId), () => this.getActivePlayerColor(), (lineId, hovered) => this.handleLineHover(lineId, hovered));
        this.lines.push(line);
        this.lineById.set(line.id, line);
      }
    }

    for (let row = 0; row < this.size; row += 1) {
      for (let column = 0; column < this.size; column += 1) {
        const dot = new Dot(this.svg, left + column * spacing, top + row * spacing);
        // En reposo los puntos parecían taladros negros: un borde apenas encendido
        // los devuelve al mismo idioma neón que las líneas.
        dot.element.setAttribute('stroke', SVG_COLORS.dotStroke);
        dot.element.setAttribute('stroke-width', 2);
        this.dots.push(dot);
      }
    }

    this.dotIdle = startDotIdle(this.dots.map((dot) => dot.element));
  }

  /** Un degradado por jugador; objectBoundingBox permite reutilizarlo en toda celda. */
  createFillDefs() {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    [['box-fill-p0', SVG_COLORS.playerOne], ['box-fill-p1', SVG_COLORS.playerTwo]].forEach(([id, color]) => {
      const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
      gradient.setAttribute('id', id);
      [[0, 1], [0.7, 0.55], [1, 0.34]].forEach(([offset, opacity]) => {
        const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop.setAttribute('offset', offset);
        stop.setAttribute('stop-color', color);
        stop.setAttribute('stop-opacity', opacity);
        gradient.appendChild(stop);
      });
      defs.appendChild(gradient);
    });
    return defs;
  }

  /**
   * Índices de los dos puntos que toca una línea. Los puntos se apilan por filas,
   * así que la posición es pura aritmética y no hace falta ninguna estructura extra.
   * @param {string} lineId @returns {number[]}
   */
  getLineDotIndexes(lineId) {
    const parts = String(lineId).split('-');
    const row = Number(parts[1]);
    const column = Number(parts[2]);
    if (!Number.isFinite(row) || !Number.isFinite(column)) return [];
    const base = row * this.size + column;
    return parts[0] === 'h' ? [base, base + 1] : [base, base + this.size];
  }

  /** @param {string} lineId @param {string} color @param {object} [options] */
  punchLineDots(lineId, color, options) {
    this.getLineDotIndexes(lineId).forEach((index) => {
      const dot = this.dots[index];
      if (dot) punchDot(dot.element, color, { parent: this.svg, ...options });
    });
  }

  handleLineClick(lineId) {
    if (!this.inputEnabled) return;
    return this.playMove(lineId);
  }

  /**
   * Entrada única para movimientos humanos y de IA.
   * @param {string} lineId
   * @returns {{state: object, accepted: boolean, completedBoxIds: string[], lineId: string}}
   */
  playMove(lineId) {
    if (!this.moveEnabled) return { state: this.state, accepted: false, completedBoxIds: [], lineId };
    const result = drawLine(this.state, lineId, this.state.currentPlayer);
    result.lineId = lineId;
    // Un rechazo también se notifica: la escena responde el click con feedback.
    if (!result.accepted) {
      this.onMove?.(result);
      return result;
    }
    this.state = result.state;
    this.activePlayer = result.state.currentPlayer;
    this.renderState();
    this.onMove?.(result);
    return result;
  }

  renderState() {
    this.clearHoverPreview();

    const drawn = new Set();
    this.state.lines.forEach((line) => {
      if (line.owner !== null) drawn.add(line.id);
      const view = this.lineById.get(line.id);
      if (!view) return;
      const wasEmpty = view.owner === null;
      view.setOwner(line.owner);
      // El retraso por defecto está calculado para que el aro salga cuando la
      // punta del trazo llega al punto, no antes.
      if (wasEmpty && line.owner !== null) {
        this.punchLineDots(line.id, line.owner === 0 ? SVG_COLORS.playerOne : SVG_COLORS.playerTwo);
      }
    });

    let hotCount = 0;
    this.state.boxes.forEach((box) => {
      const view = this.boxById.get(box.id);
      if (!view) return;
      view.setOwner(box.owner);
      const hot = box.owner === null && box.edges.filter((edgeId) => drawn.has(edgeId)).length === 3;
      if (hot) hotCount += 1;
      view.setHot(hot);
    });

    // Una sola escritura por jugada, nunca por frame: con medio tablero caliente la
    // marca baja de intensidad en vez de desaparecer, que es cuando más se necesita.
    const dense = hotCount / this.state.boxes.length > HOT_BOX.densityThreshold;
    this.svg.style.setProperty('--hot-peak', dense ? HOT_BOX.densePeak : HOT_BOX.peak);
    this.svg.style.setProperty('--hot-period', `${dense ? HOT_BOX.densePeriod : HOT_BOX.period}ms`);
    this.svg.style.setProperty('--hot-rest', HOT_BOX.rest);
  }

  /**
   * Vista previa al pasar por una línea libre: SOLO el premio. Nunca las cajas que
   * quedarían a tres lados, que es consejo estratégico y cambia la dificultad.
   * @param {string} lineId @param {boolean} hovered
   */
  handleLineHover(lineId, hovered) {
    if (!hovered) {
      this.clearHoverPreview();
      return;
    }
    if (!this.inputEnabled) return;

    const color = this.getActivePlayerColor();
    this.punchLineDots(lineId, color, { ring: false, scale: DOT_IMPACT.hoverScale, delay: 0 });
    if (!effectsAllowed()) return;

    getCompletedBoxesForMove(this.state, lineId).forEach((boxId) => {
      const box = this.boxById.get(boxId);
      if (!box) return;
      // fill: 'both' mantiene el tinte mientras dure el hover; cancel() devuelve la
      // celda EXACTAMENTE a su reposo sin tener que reconstruir ningún estilo.
      this.previewAnimations.push(box.element.animate(
        [{ fill: color, fillOpacity: HOVER_PREVIEW.fillOpacity }],
        { duration: HOVER_PREVIEW.duration, easing: 'ease-out', fill: 'both' },
      ));
    });
  }

  clearHoverPreview() {
    this.previewAnimations.forEach((animation) => animation.cancel());
    this.previewAnimations.length = 0;
  }

  /**
   * Reacción de las cajas VACÍAS vecinas a un reclamo. Solo trazo: escalar o rellenar
   * una caja libre se lee como un reclamo falso.
   * @param {string|null} originId @param {{color: string, exclude?: string[], radius?: number}} options
   */
  rippleEmpty(originId, options) {
    if (!effectsAllowed() || !originId) return;
    const origin = this.parseCell(originId);
    if (!Number.isFinite(origin.row) || !Number.isFinite(origin.column)) return;
    const radius = options?.radius ?? EMPTY_RIPPLE.radius;
    this.boxes.forEach((box) => {
      if (box.id === originId || options?.exclude?.includes(box.id)) return;
      if (box.element.dataset.owner !== undefined) return;
      const cell = this.parseCell(box.id);
      const distance = Math.hypot(cell.row - origin.row, cell.column - origin.column);
      // Con radius 1 las diagonales (1.41) quedan fuera: máximo 4 nodos por reclamo.
      if (distance > radius) return;
      // Sin fill-mode: al terminar, la caja libre vuelve sola a no tener trazo.
      box.element.animate([
        { stroke: options.color, strokeWidth: EMPTY_RIPPLE.strokeWidth, strokeOpacity: EMPTY_RIPPLE.strokeOpacity },
        { stroke: options.color, strokeWidth: EMPTY_RIPPLE.strokeWidth, strokeOpacity: 0 },
      ], {
        duration: EMPTY_RIPPLE.duration,
        delay: distance * EMPTY_RIPPLE.stagger,
        easing: 'ease-out',
      });
    });
  }

  /** Hilo entre dos cajas consecutivas de una cadena. La escena decide cuándo. */
  linkClaim(fromBoxId, toBoxId, color, step) {
    const from = this.boxById.get(fromBoxId);
    const to = this.boxById.get(toBoxId);
    if (!from || !to || fromBoxId === toBoxId) return;
    playChainLink({
      parent: this.svg,
      fromX: from.centerX,
      fromY: from.centerY,
      toX: to.centerX,
      toY: to.centerY,
      color,
      step,
    });
  }

  /** @param {string} id @returns {{row: number, column: number}} */
  parseCell(id) {
    const parts = String(id).split('-');
    return { row: Number(parts[1]), column: Number(parts[2]) };
  }

  /**
   * Pulso sobre cajas YA reclamadas. Nunca sobre vacías: una caja vacía que escala
   * parece recién ganada.
   * @param {string|null} originId @param {{radius?: number, scale: number, duration: number, stagger: number, maxDelay?: number, exclude?: string[]}} options
   */
  pulseOwned(originId, options) {
    if (!effectsAllowed() || !originId) return;
    const origin = this.parseCell(originId);
    if (!Number.isFinite(origin.row) || !Number.isFinite(origin.column)) return;
    this.boxes.forEach((box) => {
      if (box.id === originId || options.exclude?.includes(box.id)) return;
      if (box.element.dataset.owner === undefined) return;
      const cell = this.parseCell(box.id);
      const distance = Math.hypot(cell.row - origin.row, cell.column - origin.column);
      // Con radius 1 las diagonales (1.41) quedan fuera: solo vecinas ortogonales.
      if (options.radius && distance > options.radius) return;
      // maxDelay solo acota: sin él manda el escalonado, no un cero que lo anulaba.
      box.pulse(Math.min(options.maxDelay ?? Infinity, distance * options.stagger), options.scale, options.duration);
    });
  }

  getActivePlayerColor() {
    return this.activePlayer === 0 ? SVG_COLORS.playerOne : SVG_COLORS.playerTwo;
  }

  /** @param {boolean} visible */
  setVisible(visible) {
    this.svg.style.display = visible ? 'block' : 'none';
  }

  /** @param {boolean} enabled */
  setInteractive(enabled) {
    this.inputEnabled = enabled;
    this.lines.forEach((line) => line.setInteractive(enabled));
  }

  /** Bloquea o permite movimientos de cualquier origen, incluido el turno IA. */
  setMoveEnabled(enabled) {
    this.moveEnabled = Boolean(enabled);
  }

  /** Baja el SVG bajo el canvas para que los modales Phaser queden encima. */
  setModalLayer(isModalOpen) {
    this.svg.classList.toggle('is-behind-modal', isModalOpen);
    this.svg.style.pointerEvents = 'none';
  }

  destroy() {
    this.moveEnabled = false;
    this.setInteractive(false);
    this.onMove = null;
    this.setInteractive(false);
    this.onMove = null;
    this.clearHoverPreview();
    // Sin esto quedan tantas animaciones infinitas vivas como puntos por reinicio.
    this.dotIdle?.cancel();
    this.dotIdle = null;
    this.lines.forEach((line) => line.destroy());
    this.boxes.forEach((box) => box.destroy());
    this.dots.forEach((dot) => dot.element.remove());
    this.svg.remove();
  }
}
