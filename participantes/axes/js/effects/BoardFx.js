/**
 * Efectos SVG compartidos del tablero.
 *
 * El marco del tablero es opaco y está sobre el canvas Phaser: cualquier efecto
 * dentro de la región jugable tiene que ser un nodo SVG añadido a board.svg.
 * Todos los nodos que crea este módulo son temporales y se retiran solos.
 */

const BOARD_FX_NS = 'http://www.w3.org/2000/svg';

// Un punto de esquina recibe dos golpes seguidos durante una cadena rápida de la IA.
// Guardamos la animación viva por elemento para cancelarla antes de relanzarla.
const BOARD_FX_PUNCHES = new WeakMap();

/** Geometría exacta del marco del tablero, derivada de las constantes. */
function boardFxFrame() {
  const size = BOARD_STYLE.width + BOARD_STYLE.framePadding * 2;
  return {
    x: (GAME_WIDTH - BOARD_STYLE.width) / 2 - BOARD_STYLE.framePadding,
    y: BOARD_STYLE.top - BOARD_STYLE.framePadding,
    width: size,
    height: size,
  };
}

/**
 * Golpe de un punto cuando una línea aterriza en él.
 * @param {SVGElement} element círculo del punto
 * @param {string} color color del jugador que trazó la línea
 * @param {{delay?: number, scale?: number, ring?: boolean, parent?: SVGElement}} [options]
 */
function punchDot(element, color, options = {}) {
  if (!element || !effectsAllowed()) {
    return;
  }

  const {
    delay = DOT_IMPACT.delay,
    scale = DOT_IMPACT.punchScale,
    ring = true,
    parent = element.parentNode,
  } = options;

  // Sin fill-box la escala se toma del origen del viewport y el punto sale de pantalla.
  element.style.transformBox = 'fill-box';
  element.style.transformOrigin = 'center';

  BOARD_FX_PUNCHES.get(element)?.cancel();
  element.style.filter = `drop-shadow(0 0 7px ${color})`;
  const punch = element.animate([
    { transform: 'scale(1)' },
    { transform: `scale(${scale})`, offset: 0.35 },
    { transform: 'scale(1)' },
  ], { duration: DOT_IMPACT.punchDuration, delay, easing: 'ease-out' });
  BOARD_FX_PUNCHES.set(element, punch);
  punch.finished
    .catch(() => undefined)
    .then(() => {
      // El punto en reposo es mate: el brillo solo existe durante el golpe.
      if (BOARD_FX_PUNCHES.get(element) === punch) {
        element.style.removeProperty('filter');
        BOARD_FX_PUNCHES.delete(element);
      }
    });

  if (!ring || !parent) {
    return;
  }

  const halo = document.createElementNS(BOARD_FX_NS, 'circle');
  halo.setAttribute('cx', element.getAttribute('cx'));
  halo.setAttribute('cy', element.getAttribute('cy'));
  halo.setAttribute('r', DOT_IMPACT.ringRadius);
  halo.setAttribute('fill', 'none');
  halo.setAttribute('stroke', color);
  halo.style.strokeWidth = `${DOT_IMPACT.ringWidth}px`;
  halo.style.vectorEffect = 'non-scaling-stroke';
  halo.style.transformBox = 'fill-box';
  halo.style.transformOrigin = 'center';
  halo.style.pointerEvents = 'none';
  parent.appendChild(halo);

  const expand = halo.animate([
    { transform: 'scale(0.4)', strokeWidth: `${DOT_IMPACT.ringWidth}px`, opacity: 0.9 },
    { transform: `scale(${DOT_IMPACT.ringScale})`, strokeWidth: '0.5px', opacity: 0 },
  ], {
    duration: DOT_IMPACT.ringDuration,
    delay,
    easing: 'cubic-bezier(0.1, 0.8, 0.25, 1)',
    fill: 'both',
  });
  expand.finished.catch(() => undefined).then(() => halo.remove());
}

/**
 * Latido de reposo de toda la rejilla de puntos.
 * Un único animate infinito por punto con retraso NEGATIVO: cada uno arranca en
 * otro instante de su ciclo, así que la onda cruza el tablero sin timers ni JS.
 * El llamador DEBE guardar el mando y llamar cancel() al destruir el tablero.
 * @param {SVGElement[]} elements
 * @returns {{cancel: function(): void}}
 */
function startDotIdle(elements) {
  if (!effectsAllowed()) {
    return { cancel() {} };
  }

  const animations = [];
  (elements ?? []).forEach((element, index) => {
    if (!element) return;
    element.style.transformBox = 'fill-box';
    element.style.transformOrigin = 'center';
    animations.push(element.animate([
      { transform: 'scale(1)' },
      { transform: `scale(${DOT_IDLE.scale})`, offset: 0.5 },
      { transform: 'scale(1)' },
    ], {
      duration: DOT_IDLE.duration,
      iterations: Infinity,
      easing: 'ease-in-out',
      delay: -((index * DOT_IDLE.delayStep) % DOT_IDLE.duration),
    }));
  });

  return {
    cancel() {
      animations.forEach((animation) => animation.cancel());
      animations.length = 0;
    },
  };
}

/**
 * Hilo luminoso entre la caja anterior de la cadena y la nueva: una cascada se
 * lee como una sola jugada encadenada en vez de N reclamos sueltos.
 * @param {{parent: SVGElement, fromX: number, fromY: number, toX: number, toY: number, color: string, step?: number}} options
 */
function playChainLink(options) {
  const { parent, fromX, fromY, toX, toY, color } = options ?? {};

  if (!parent || !effectsAllowed()) {
    return;
  }

  const step = Math.max(0, Math.floor(options.step ?? 0));
  const strokeColor = step >= CHAIN_LINK.goldFromStep ? SVG_COLORS.sugar : color;
  const length = Math.hypot(toX - fromX, toY - fromY);

  const wire = document.createElementNS(BOARD_FX_NS, 'line');
  wire.setAttribute('x1', fromX);
  wire.setAttribute('y1', fromY);
  wire.setAttribute('x2', toX);
  wire.setAttribute('y2', toY);
  wire.setAttribute('stroke', strokeColor);
  wire.setAttribute('stroke-linecap', 'round');
  wire.style.strokeWidth = `${Math.min(CHAIN_LINK.maxWidth, CHAIN_LINK.width + step * CHAIN_LINK.widthPerStep)}px`;
  wire.style.pointerEvents = 'none';
  wire.style.filter = `drop-shadow(0 0 8px ${strokeColor})`;
  // stroke-dashoffset se pinta en el hilo principal: vale para UN nodo corto por
  // reclamo y para nada persistente ni repetido.
  wire.setAttribute('stroke-dasharray', length);
  wire.setAttribute('stroke-dashoffset', length);
  parent.appendChild(wire);

  const animations = [
    wire.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], {
      duration: CHAIN_LINK.revealDuration,
      easing: 'cubic-bezier(0.22, 0.8, 0.3, 1)',
      fill: 'both',
    }),
    wire.animate([{ opacity: 1 }, { opacity: 0 }], {
      delay: CHAIN_LINK.revealDuration + CHAIN_LINK.holdDuration,
      duration: CHAIN_LINK.fadeDuration,
      fill: 'both',
    }),
  ];

  Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)))
    .then(() => wire.remove());
}

/**
 * Destello dorado sobre el marco entero: hace que una racha larga sea lo más
 * ruidoso de la pantalla sin tocar la superficie de juego.
 * @param {{parent: SVGElement, streak?: number}} options
 */
function playStreakFlash(options) {
  const { parent } = options ?? {};
  const streak = Math.max(0, Math.floor(options?.streak ?? 0));

  if (!parent || !effectsAllowed() || streak < STREAK_FLASH.minStreak) {
    return;
  }

  const frame = boardFxFrame();
  const flash = document.createElementNS(BOARD_FX_NS, 'rect');
  flash.setAttribute('x', frame.x);
  flash.setAttribute('y', frame.y);
  flash.setAttribute('width', frame.width);
  flash.setAttribute('height', frame.height);
  flash.setAttribute('fill', SVG_COLORS.sugar);
  // Medido: el screen de un solo rect no aparece en el frame peor. Si algún día
  // costara, se cambia por relleno plano a 0.10 y se pierde solo el brillo.
  flash.style.mixBlendMode = 'screen';
  flash.style.pointerEvents = 'none';
  parent.appendChild(flash);

  const peak = Math.min(
    STREAK_FLASH.maxPeak,
    STREAK_FLASH.peak + (streak - STREAK_FLASH.minStreak) * STREAK_FLASH.peakPerStep,
  );

  // El retraso deja leer primero el estallido del reclamo: si no, se emborronan.
  const animation = flash.animate([
    { opacity: 0 },
    { opacity: peak, offset: 0.35 },
    { opacity: 0 },
  ], {
    duration: STREAK_FLASH.duration,
    delay: STREAK_FLASH.delay,
    easing: 'ease-out',
  });
  animation.finished.catch(() => undefined).then(() => flash.remove());
}

/**
 * Barrido vertical mientras la IA piensa: el compás de 550ms deja de ser silencio.
 * El llamador cancela cuando el turno acaba antes de tiempo.
 * @param {{parent: SVGElement, color: string}} options
 * @returns {{cancel: function(): void}}
 */
function playAiScan(options) {
  const { parent, color } = options ?? {};

  if (!parent || !effectsAllowed()) {
    return { cancel() {} };
  }

  const frame = boardFxFrame();
  const beam = document.createElementNS(BOARD_FX_NS, 'line');
  beam.setAttribute('x1', frame.x);
  beam.setAttribute('y1', frame.y);
  beam.setAttribute('x2', frame.x);
  beam.setAttribute('y2', frame.y + frame.height);
  beam.setAttribute('stroke', color ?? SVG_COLORS.playerTwo);
  beam.style.strokeWidth = `${AI_SCAN.width}px`;
  beam.style.opacity = AI_SCAN.opacity;
  beam.style.pointerEvents = 'none';
  parent.appendChild(beam);

  const animation = beam.animate([
    { transform: 'translateX(0px)' },
    { transform: `translateX(${frame.width}px)` },
  ], { duration: AI_SCAN.duration, easing: 'ease-in-out', fill: 'both' });
  animation.finished.catch(() => undefined).then(() => beam.remove());

  return {
    cancel() {
      animation.cancel();
      beam.remove();
    },
  };
}
