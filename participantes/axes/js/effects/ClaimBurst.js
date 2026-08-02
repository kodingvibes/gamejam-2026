/**
 * Estallido neón breve al reclamar una caja.
 * Solo crea nodos temporales sobre la capa de cajas y los retira al terminar.
 */

const CLAIM_BURST_NS = 'http://www.w3.org/2000/svg';

/**
 * @param {{parent: SVGElement, x: number, y: number, color: string, chainIndex?: number, size?: number}} options
 */
function playClaimBurst(options) {
  const { parent, x, y, color } = options;

  if (!parent || !effectsAllowed()) {
    return;
  }

  const chainIndex = Math.min(GAME_FEEL.streakCap, Math.max(0, Math.floor(options.chainIndex ?? 0)));
  // Lado de la caja en unidades del viewBox. Con 5x5 ronda 130.
  const size = options.size ?? BOARD_STYLE.width / 4;
  // La cadena sube la intensidad, pero el tope evita enterrar el tablero en confeti.
  const count = Math.min(CLAIM_BURST.maxCount, CLAIM_BURST.baseCount + chainIndex * CLAIM_BURST.countPerChain);
  const radius = CLAIM_BURST.radius + chainIndex * CLAIM_BURST.radiusPerChain;

  const group = document.createElementNS(CLAIM_BURST_NS, 'g');
  group.dataset.claimBurst = 'temporary';
  group.style.pointerEvents = 'none';
  parent.appendChild(group);

  const animations = [];

  // Onda de choque: el aro se abre y su trazo adelgaza sin depender de la escala.
  const ring = document.createElementNS(CLAIM_BURST_NS, 'circle');
  ring.setAttribute('cx', x);
  ring.setAttribute('cy', y);
  ring.setAttribute('r', size * 0.5);
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', CLAIM_BURST.ringColor);
  ring.style.strokeWidth = '5px';
  ring.style.vectorEffect = 'non-scaling-stroke';
  ring.style.transformBox = 'fill-box';
  ring.style.transformOrigin = 'center';
  group.appendChild(ring);
  animations.push(ring.animate([
    { transform: 'scale(0.25)', strokeWidth: '5px', opacity: 0.9 },
    { transform: 'scale(1.35)', strokeWidth: '0.5px', opacity: 0 },
  ], {
    duration: CLAIM_BURST.ringDuration,
    easing: 'cubic-bezier(0.1, 0.8, 0.25, 1)',
    fill: 'both',
  }));

  // Segundo aro dorado con retraso: blanco + oro es lo que hace que la onda se lea
  // como luz y no como humo sobre un tablero casi negro.
  const ringTwo = document.createElementNS(CLAIM_BURST_NS, 'circle');
  ringTwo.setAttribute('cx', x);
  ringTwo.setAttribute('cy', y);
  ringTwo.setAttribute('r', size * 0.5);
  ringTwo.setAttribute('fill', 'none');
  ringTwo.setAttribute('stroke', SVG_COLORS.sugar);
  ringTwo.style.strokeWidth = '5px';
  ringTwo.style.vectorEffect = 'non-scaling-stroke';
  ringTwo.style.transformBox = 'fill-box';
  ringTwo.style.transformOrigin = 'center';
  group.appendChild(ringTwo);
  animations.push(ringTwo.animate([
    { transform: 'scale(0.25)', strokeWidth: '5px', opacity: 0.9 },
    { transform: `scale(${CLAIM_BURST.ringTwoScale})`, strokeWidth: '0.5px', opacity: 0 },
  ], {
    duration: CLAIM_BURST.ringDuration,
    delay: CLAIM_BURST.ringTwoDelay,
    easing: 'cubic-bezier(0.1, 0.8, 0.25, 1)',
    fill: 'both',
  }));

  // La franja dorada se ensancha con la cadena: una racha larga se vuelve de oro.
  const goldLimit = 2 + CLAIM_BURST.goldBand + chainIndex * CLAIM_BURST.goldBandPerChain;
  const particleRadius = CLAIM_BURST.particleRadius + chainIndex * CLAIM_BURST.particleRadiusPerChain;

  for (let index = 0; index < count; index += 1) {
    // Reparto radial con un desvío pequeño para que no se lea como un patrón fijo.
    const angle = (index / count) * Math.PI * 2 + Math.random() * 0.6;
    const distance = radius * (0.55 + Math.random() * 0.45);
    // Núcleo blanco, capa dorada y dueño por fuera: lectura de caramelo, dura 400ms.
    const particleColor = index < 2
      ? CLAIM_BURST.coreColor
      : (index < goldLimit ? SVG_COLORS.sugar : color);
    const particle = document.createElementNS(CLAIM_BURST_NS, 'circle');
    particle.setAttribute('cx', x);
    particle.setAttribute('cy', y);
    particle.setAttribute('r', particleRadius);
    particle.setAttribute('fill', particleColor);
    particle.style.transformBox = 'fill-box';
    particle.style.transformOrigin = 'center';
    particle.style.filter = `drop-shadow(0 0 4px ${particleColor})`;
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

  // Polvo de azúcar: sobrevive al golpe y es lo que se lee como dulce, no solo ruidoso.
  for (let index = 0; index < CLAIM_BURST.sparkleCount; index += 1) {
    const drift = Math.random() * 28 - 14;
    const rise = -(34 + Math.random() * 22);
    const sparkle = document.createElementNS(CLAIM_BURST_NS, 'circle');
    sparkle.setAttribute('cx', x);
    sparkle.setAttribute('cy', y);
    sparkle.setAttribute('r', 2);
    sparkle.setAttribute('fill', SVG_COLORS.sugar);
    sparkle.style.transformBox = 'fill-box';
    sparkle.style.transformOrigin = 'center';
    group.appendChild(sparkle);
    animations.push(sparkle.animate([
      { transform: 'translate(0px, 0px) scale(1)', opacity: 0 },
      { transform: `translate(${(drift * 0.5).toFixed(2)}px, ${(rise * 0.45).toFixed(2)}px) scale(0.8)`, opacity: 0.9, offset: 0.35 },
      { transform: `translate(${drift.toFixed(2)}px, ${rise.toFixed(2)}px) scale(0.35)`, opacity: 0 },
    ], {
      duration: CLAIM_BURST.sparkleDuration + Math.random() * CLAIM_BURST.sparkleJitter,
      delay: index * 90,
      easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
      fill: 'both',
    }));
  }

  Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)))
    .then(() => group.remove());
}
