// ─── Count-up tween for numeric labels ──────────────────────────────────────

export function countUp(el: HTMLElement, to: number, durationMs: number, prefix = ''): void {
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    const eased = 1 - Math.pow(1 - t, 4);
    el.textContent = `${prefix}${Math.round(to * eased).toLocaleString()}`;
    if (t < 1 && el.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
