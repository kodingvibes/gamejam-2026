// ─── Game Over Screen ──────────────────────────────────────────────────────

import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';
import { submitScore } from './bestScore';
import { countUp } from './countUp';

export class GameOverScreen {
  private element: HTMLElement;
  private continueButton: HTMLElement;
  private menuButton: HTMLElement;
  private finalScoreElement: HTMLElement;
  private finalWaveElement: HTMLElement;
  private recordElement: HTMLElement | null;
  private eventBus: EventBus;
  private onGameOver: (p: { score: number; wave: number }) => void;
  private onKeyDown: (e: KeyboardEvent) => void;

  constructor(
    private onRestart: () => void,
    private onMenu: () => void,
  ) {
    this.eventBus = EventBus.getInstance();
    this.element = document.getElementById('gameover-screen') as HTMLElement;
    this.continueButton = document.getElementById('continue-button') as HTMLElement;
    this.menuButton = document.getElementById('gameover-menu-button') as HTMLElement;
    this.finalScoreElement = document.getElementById('final-score') as HTMLElement;
    this.finalWaveElement = document.getElementById('final-wave') as HTMLElement;
    this.recordElement = document.getElementById('gameover-record');

    // (The old constructor *called* both callbacks here by mistake.)
    this.continueButton.addEventListener('click', this.onRestartRef);
    this.menuButton.addEventListener('click', this.onMenuRef);

    this.onGameOver = (p) => {
      this.show();
      countUp(this.finalScoreElement, p.score, 1400, 'Puntuación: ');
      this.finalWaveElement.textContent = `Oleada: ${p.wave + 1}`;
      const record = submitScore(p.score);
      if (this.recordElement) this.recordElement.classList.toggle('visible', record);
    };
    this.eventBus.on(GameEvent.GAME_OVER, this.onGameOver);

    this.onKeyDown = (e: KeyboardEvent) => {
      if (this.element.classList.contains('hidden')) return;
      if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); this.onRestart(); }
      else if (e.code === 'Escape') { e.preventDefault(); this.onMenu(); }
    };
    window.addEventListener('keydown', this.onKeyDown);
  }

  private onRestartRef = () => this.onRestart();
  private onMenuRef = () => this.onMenu();

  show(): void {
    this.element.classList.remove('hidden');
  }

  hide(): void {
    this.element.classList.add('hidden');
  }

  dispose(): void {
    this.continueButton.removeEventListener('click', this.onRestartRef);
    this.menuButton.removeEventListener('click', this.onMenuRef);
    this.eventBus.off(GameEvent.GAME_OVER, this.onGameOver);
    window.removeEventListener('keydown', this.onKeyDown);
  }
}
