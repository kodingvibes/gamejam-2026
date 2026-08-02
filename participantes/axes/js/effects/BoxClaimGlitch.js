/**
 * Glitch puntual para una caja reclamada.
 * Solo crea nodos temporales: la geometría y el relleno principal pertenecen a Box.
 */
let boxClaimGlitchId = 0;

/**
 * @param {{parent: SVGElement, bounds: {x: number, y: number, width: number, height: number}, playerColor: string, duration?: number, onComplete?: () => void}} options
 * @returns {{cancel: () => void, finished: Promise<void>}}
 */
function playBoxClaimGlitch(options) {
  const { parent, bounds, playerColor, onComplete } = options;
  const duration = options.duration ?? BOX_CLAIM_GLITCH.duration;
  const finishedImmediately = Promise.resolve();

  if (!BOX_CLAIM_GLITCH.enabled || !parent || !bounds || !effectsAllowed()) {
    onComplete?.();
    return { cancel() {}, finished: finishedImmediately };
  }

  const svg = parent.ownerSVGElement || parent;
  const clipId = `box-claim-glitch-clip-${boxClaimGlitchId += 1}`;
  const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
  const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  clipPath.setAttribute('id', clipId);
  clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');
  clipRect.setAttribute('x', bounds.x);
  clipRect.setAttribute('y', bounds.y);
  clipRect.setAttribute('width', bounds.width);
  clipRect.setAttribute('height', bounds.height);
  clipPath.appendChild(clipRect);

  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }
  defs.appendChild(clipPath);

  const colors = playerColor === BOX_CLAIM_GLITCH.cyan
    ? [BOX_CLAIM_GLITCH.magenta, BOX_CLAIM_GLITCH.cyan]
    : [BOX_CLAIM_GLITCH.cyan, BOX_CLAIM_GLITCH.magenta];
  const clones = colors.map((color, index) => {
    const clone = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    clone.setAttribute('x', bounds.x);
    clone.setAttribute('y', bounds.y);
    clone.setAttribute('width', bounds.width);
    clone.setAttribute('height', bounds.height);
    clone.setAttribute('fill', color);
    clone.setAttribute('fill-opacity', BOX_CLAIM_GLITCH.cloneAlpha);
    clone.setAttribute('clip-path', `url(#${clipId})`);
    clone.classList.add('box-claim-glitch');
    clone.dataset.boxClaimGlitch = 'temporary';
    clone.style.pointerEvents = 'none';
    clone.style.transformBox = 'fill-box';
    clone.style.transformOrigin = 'center';
    parent.appendChild(clone);
    return { clone, direction: index === 0 ? -1 : 1 };
  });

  let cleaned = false;
  let resolveFinished;
  const finished = new Promise((resolve) => { resolveFinished = resolve; });
  let animations;
  try {
    animations = clones.map(({ clone, direction }) => clone.animate([
      {
        opacity: 0,
        transform: `translate(${direction * BOX_CLAIM_GLITCH.channelOffset}px, 0) scale(${BOX_CLAIM_GLITCH.scaleX}, ${BOX_CLAIM_GLITCH.scaleY})`,
      },
      {
        opacity: BOX_CLAIM_GLITCH.cloneAlpha,
        transform: `translate(${direction * (BOX_CLAIM_GLITCH.channelOffset + BOX_CLAIM_GLITCH.jitter)}px, 0) scale(${BOX_CLAIM_GLITCH.scaleX}, ${BOX_CLAIM_GLITCH.scaleY})`,
        offset: 0.2,
      },
      {
        opacity: BOX_CLAIM_GLITCH.cloneAlpha * 0.15,
        transform: `translate(${direction * BOX_CLAIM_GLITCH.channelOffset}px, 0) scale(1, 1)`,
        offset: 0.46,
      },
      {
        opacity: BOX_CLAIM_GLITCH.cloneAlpha,
        transform: `translate(${direction * (BOX_CLAIM_GLITCH.channelOffset + 1)}px, 0) scale(1, 1)`,
        offset: 0.62,
      },
      { opacity: 0, transform: 'translate(0, 0) scale(1, 1)' },
    ], { duration, easing: `steps(${BOX_CLAIM_GLITCH.flickerSteps}, end)`, fill: 'both' }));
  } catch (error) {
    clones.forEach(({ clone }) => clone.remove());
    clipPath.remove();
    throw error;
  }

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    animations.forEach((animation) => animation.cancel());
    clones.forEach(({ clone }) => clone.remove());
    clipPath.remove();
    resolveFinished();
    onComplete?.();
  };

  Promise.all(animations.map((animation) => animation.finished.catch(() => undefined))).then(cleanup);

  return {
    cancel: cleanup,
    finished,
  };
}
