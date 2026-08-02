/**
 * Estallido neón breve al reclamar una caja.
 * Solo crea nodos temporales sobre la capa de cajas y los retira al terminar.
 */

/**
 * @param {{parent: SVGElement, x: number, y: number, color: string, chainIndex?: number}} options
 */
function playClaimBurst(options) {
  const { parent, x, y, color } = options;

  if (!parent || typeof Element === 'undefined'
    || typeof Element.prototype.animate !== 'function'
    || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)) {
    return;
  }

  const chainIndex = Math.min(6, Math.max(0, Math.floor(options.chainIndex ?? 0)));
  // La cadena sube la intensidad, pero el tope evita enterrar el tablero en confeti.
  const count = Math.min(CLAIM_BURST.maxCount, CLAIM_BURST.baseCount + chainIndex * CLAIM_BURST.countPerChain);
  const radius = CLAIM_BURST.radius + chainIndex * CLAIM_BURST.radiusPerChain;

  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.dataset.claimBurst = 'temporary';
  group.style.pointerEvents = 'none';
  parent.appendChild(group);

  const animations = [];
  for (let index = 0; index < count; index += 1) {
    // Reparto radial con un desvío pequeño para que no se lea como un patrón fijo.
    const angle = (index / count) * Math.PI * 2 + Math.random() * 0.6;
    const distance = radius * (0.55 + Math.random() * 0.45);
    const particle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    particle.setAttribute('cx', x);
    particle.setAttribute('cy', y);
    particle.setAttribute('r', CLAIM_BURST.particleRadius);
    particle.setAttribute('fill', color);
    particle.style.transformBox = 'fill-box';
    particle.style.transformOrigin = 'center';
    particle.style.filter = `drop-shadow(0 0 4px ${color})`;
    group.appendChild(particle);
    animations.push(particle.animate([
      { transform: 'translate(0px, 0px) scale(1)', opacity: 0.95 },
      {
        transform: `translate(${(Math.cos(angle) * distance).toFixed(2)}px, ${(Math.sin(angle) * distance).toFixed(2)}px) scale(0.2)`,
        opacity: 0,
      },
    ], {
      duration: CLAIM_BURST.duration + Math.random() * CLAIM_BURST.durationJitter,
      easing: 'cubic-bezier(0.15, 0.75, 0.3, 1)',
      fill: 'both',
    }));
  }

  Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)))
    .then(() => group.remove());
}
