// ─── Menu Screen ────────────────────────────────────────────────────────────
// Title letters are split into spans so CSS can stagger a drop-in + shine
// sweep. The live 3D scene (ship orbit) shows through the translucent panel.

import { getBestScore } from './bestScore';

export class MenuScreen {
  private element: HTMLElement;
  private startButton: HTMLElement;
  private bestEl: HTMLElement | null;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onClick: () => void;

  constructor(private onStart: () => void) {
    this.element = document.getElementById('menu-screen') as HTMLElement;
    this.startButton = document.getElementById('start-button') as HTMLElement;
    this.bestEl = document.getElementById('menu-best');

    const title = this.element.querySelector('.game-title') as HTMLElement | null;
    if (title && !title.dataset.split) {
      const text = title.textContent ?? '';
      title.dataset.split = '1';
      title.setAttribute('aria-label', text);
      title.innerHTML = [...text].map((ch, i) =>
        `<span class="title-ch" style="--i:${i}">${ch}</span>`).join('');
    }

    this.onClick = () => this.onStart();
    this.startButton.addEventListener('click', this.onClick);
    this.onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (!this.element.classList.contains('hidden')) {
          e.preventDefault();
          this.onStart();
        }
      }
    };
    window.addEventListener('keydown', this.onKeyDown);
  }

  show(): void {
    const best = getBestScore();
    if (this.bestEl) this.bestEl.textContent = best > 0 ? `RÉCORD ${best.toLocaleString()}` : '';
    this.element.classList.remove('hidden');
  }

  hide(): void {
    this.element.classList.add('hidden');
  }

  dispose(): void {
    this.startButton.removeEventListener('click', this.onClick);
    window.removeEventListener('keydown', this.onKeyDown);
  }
}
