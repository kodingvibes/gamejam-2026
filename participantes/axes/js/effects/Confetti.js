/**
 * Confeti del panel final.
 *
 * Corre sobre la capa SVG de resultado que aporta el llamador, nunca sobre un
 * tablero visible. Medido en esta máquina con 110 y 140 piezas: la construcción
 * cuesta 0.8-2.8ms y el vuelo no empeora el peor frame, así que el único gasto
 * real es el DOM de una sola vez: se arma en un fragmento y se añade de golpe.
 */

const CONFETTI_NS = 'http://www.w3.org/2000/svg';

/**
 * @param {{parent: SVGElement, count?: number, colors?: string[], originY?: number}} options
 */
function playConfetti(options) {
  const { parent } = options ?? {};

  if (!parent || !effectsAllowed()) {
    return;
  }

  const count = Math.max(0, Math.floor(options.count ?? CONFETTI.count));
  const originY = options.originY ?? CONFETTI.originY;
  const colors = options.colors?.length
    ? options.colors
    : [SVG_COLORS.playerOne, SVG_COLORS.playerTwo, SVG_COLORS.sugar, '#ffffff'];

  const group = document.createElementNS(CONFETTI_NS, 'g');
  group.dataset.confetti = 'temporary';
  group.style.pointerEvents = 'none';

  const fragment = document.createDocumentFragment();
  const pieces = [];
  for (let index = 0; index < count; index += 1) {
    const width = CONFETTI.minWidth + Math.random() * (CONFETTI.maxWidth - CONFETTI.minWidth);
    const piece = document.createElementNS(CONFETTI_NS, 'rect');
    piece.setAttribute('x', (Math.random() * GAME_WIDTH).toFixed(1));
    piece.setAttribute('y', originY);
    piece.setAttribute('width', width.toFixed(1));
    piece.setAttribute('height', (width * CONFETTI.aspect).toFixed(1));
    piece.setAttribute('fill', colors[index % colors.length]);
    piece.style.transformBox = 'fill-box';
    piece.style.transformOrigin = 'center';
    fragment.appendChild(piece);
    pieces.push(piece);
  }
  group.appendChild(fragment);
  parent.appendChild(group);

  const animations = pieces.map((piece, index) => {
    const drift = (Math.random() * 2 - 1) * CONFETTI.driftRange;
    const spin = (Math.random() * 2 - 1) * CONFETTI.spinRange;
    return piece.animate([
      { transform: 'translate(0px, 0px) rotate(0deg)', opacity: 1 },
      {
        transform: `translate(${drift.toFixed(1)}px, ${CONFETTI.fallDistance}px) rotate(${spin.toFixed(0)}deg)`,
        opacity: 0.85,
      },
    ], {
      duration: CONFETTI.duration + Math.random() * CONFETTI.durationJitter,
      delay: index * CONFETTI.stagger,
      easing: 'cubic-bezier(0.3, 0.6, 0.5, 1)',
      fill: 'both',
    });
  });

  Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)))
    .then(() => group.remove());
}
