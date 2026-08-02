// ─── Icon Row Helper: renders a row of filled/empty icons ────────────────────

export function renderIconRow(container: HTMLElement, total: number, filled: number, baseClass: string): void {
  container.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const icon = document.createElement('div');
    icon.className = `${baseClass}${i >= filled ? ' empty' : ''}`;
    container.appendChild(icon);
  }
}
