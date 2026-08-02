// ─── Game Over Screen ──────────────────────────────────────────────────────

import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';

export class GameOverScreen {
  private element: HTMLElement;
  private continueButton: HTMLElement;
  private finalScoreElement: HTMLElement;
  private finalWaveElement: HTMLElement;
  private eventBus: EventBus;

  constructor(private onRestart: () => void) {
    this.eventBus = EventBus.getInstance();
    this.element = document.getElementById('gameover-screen') as HTMLElement;
    this.continueButton = document.getElementById('continue-button') as HTMLElement;
    this.finalScoreElement = document.getElementById('final-score') as HTMLElement;
    this.finalWaveElement = document.getElementById('final-wave') as HTMLElement;

    this.continueButton.addEventListener('click', () => this.onRestart());

    this.eventBus.on(GameEvent.GAME_OVER, (p) => {
      this.finalScoreElement.textContent = `Puntuación: ${p.score.toLocaleString()}`;
      this.finalWaveElement.textContent = `Oleada: ${p.wave}`;
      this.show();
    });
  }

  show(): void {
    this.element.classList.remove('hidden');
  }

  hide(): void {
    this.element.classList.add('hidden');
  }

  dispose(): void {
    // Clean up
  }
}
