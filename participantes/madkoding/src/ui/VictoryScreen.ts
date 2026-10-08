// ─── Victory Screen ─────────────────────────────────────────────────────────

import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';
import { submitScore } from './bestScore';
import { countUp } from './countUp';

export class VictoryScreen {
  private element: HTMLElement;
  private continueButton: HTMLElement;
  private scoreElement: HTMLElement;
  private eventBus: EventBus;
  private onContinueRef: () => void;
  private onVictory: (p: { score: number }) => void;
  private onKeyDown: (e: KeyboardEvent) => void;

  constructor(private onContinue: () => void) {
    this.eventBus = EventBus.getInstance();
    this.element = document.getElementById('victory-screen') as HTMLElement;
    this.continueButton = document.getElementById('victory-continue-button') as HTMLElement;
    this.scoreElement = document.getElementById('victory-score') as HTMLElement;

    this.onContinueRef = () => this.onContinue();
    this.continueButton.addEventListener('click', this.onContinueRef);

    this.onVictory = (p) => {
      this.show();
      countUp(this.scoreElement, p.score, 2000, 'Puntuación: ');
      submitScore(p.score);
    };
    this.eventBus.on(GameEvent.VICTORY, this.onVictory);

    this.onKeyDown = (e: KeyboardEvent) => {
      if (this.element.classList.contains('hidden')) return;
      if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); this.onContinue(); }
    };
    window.addEventListener('keydown', this.onKeyDown);
  }

  show(): void {
    this.element.classList.remove('hidden');
  }

  hide(): void {
    this.element.classList.add('hidden');
  }

  dispose(): void {
    this.continueButton.removeEventListener('click', this.onContinueRef);
    this.eventBus.off(GameEvent.VICTORY, this.onVictory);
    window.removeEventListener('keydown', this.onKeyDown);
  }
}
