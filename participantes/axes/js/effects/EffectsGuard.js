/** Un solo interruptor para todos los efectos: sin WAAPI o con movimiento reducido, no se anima nada. */
function effectsAllowed() {
  return typeof Element !== 'undefined'
    && typeof Element.prototype.animate === 'function'
    && !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}
