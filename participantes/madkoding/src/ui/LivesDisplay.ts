// ─── Lives Display: fade overlay + ENGAGE text + lives icons (DOM only) ──────

import { renderIconRow } from './iconRow';

export class LivesDisplay {
  private fadeEl: HTMLElement;
  private engageEl: HTMLElement;
  private livesEl: HTMLElement;

  constructor() {
    this.fadeEl = document.getElementById('fade-overlay') as HTMLElement;
    this.engageEl = document.getElementById('engage-text') as HTMLElement;
    this.livesEl = document.getElementById('lives-display') as HTMLElement;
  }

  setPhase(phase: string): void {
    this.fadeEl.classList.toggle('visible', phase === 'fading');
    this.engageEl.classList.toggle('visible', phase === 'spawning');
  }

  setLives(lives: number): void {
    renderIconRow(this.livesEl, 3, lives, 'life-icon');
  }
}
