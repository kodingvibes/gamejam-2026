// ─── Victory Screen ─────────────────────────────────────────────────────────

import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';

export class VictoryScreen {
  private element: HTMLElement;
  private continueButton: HTMLElement;
  private scoreElement: HTMLElement;
  private eventBus: EventBus;

  constructor(private onContinue: () => void) {
    this.eventBus = EventBus.getInstance();
    this.element = document.getElementById('victory-screen') as HTMLElement;
    this.continueButton = document.getElementById('victory-continue-button') as HTMLElement;
    this.scoreElement = document.getElementById('victory-score') as HTMLElement;

    this.continueButton.addEventListener('click', () => this.onContinue());

    this.eventBus.on(GameEvent.VICTORY, (p) => {
      this.scoreElement.textContent = `Puntuación: ${p.score.toLocaleString()}`;
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
