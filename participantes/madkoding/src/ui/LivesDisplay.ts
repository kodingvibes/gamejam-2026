// ─── Lives Display: fade overlay + ENGAGE text + lives icons (DOM only) ──────

import { renderIconRow } from './iconRow';

export class LivesDisplay {
  private fadeEl: HTMLElement;
  private engageEl: HTMLElement;
  private livesEl: HTMLElement;
  private _lives = 3;

  constructor() {
    this.fadeEl = document.getElementById('fade-overlay') as HTMLElement;
    this.engageEl = document.getElementById('engage-text') as HTMLElement;
    this.livesEl = document.getElementById('lives-display') as HTMLElement;
    if (!this.engageEl.dataset.split) {
      this.engageEl.dataset.split = '1';
      this.engageEl.innerHTML = [...(this.engageEl.textContent ?? 'ENGAGE')]
        .map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join('');
    }
  }

  setPhase(phase: string): void {
    this.fadeEl.classList.toggle('visible', phase === 'fading');
    const engage = phase === 'spawning';
    if (engage && !this.engageEl.classList.contains('visible')) {
      // Restart the slam-in animation every time ENGAGE appears.
      this.engageEl.classList.remove('visible');
      void this.engageEl.offsetWidth;
    }
    this.engageEl.classList.toggle('visible', engage);
  }

  setLives(lives: number): void {
    const lost = lives < this._lives;
    this._lives = lives;
    renderIconRow(this.livesEl, 3, lives, 'life-icon');
    if (lost) {
      this.livesEl.classList.remove('life-lost');
      void this.livesEl.offsetWidth;
      this.livesEl.classList.add('life-lost');
    }
  }

  setVisible(v: boolean): void {
    this.livesEl.style.display = v ? '' : 'none';
  }
}
