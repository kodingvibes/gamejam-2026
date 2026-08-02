// ─── Screen Effects: damage flash overlay ───────────────────────────────────

import { SCREEN } from '../types/config';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';

export class ScreenEffects {
  private eventBus = EventBus.getInstance();
  private damageFlashEl: HTMLElement;

  constructor() {
    this.damageFlashEl = document.getElementById('damage-overlay') as HTMLElement;

    // Listen for events
    this.eventBus.on(GameEvent.PLAYER_DAMAGED, () => this.flashDamage());
    this.eventBus.on(GameEvent.PLAYER_SHIELD_LOST, () => this.flashDamage());
  }

  flashDamage(): void {
    this.damageFlashEl.classList.remove('hidden');
    this.damageFlashEl.classList.add('visible');

    setTimeout(() => {
      this.damageFlashEl.classList.remove('visible');
      this.damageFlashEl.classList.add('hidden');
    }, SCREEN.DAMAGE_FLASH_DURATION * 1000);
  }

  reset(): void {
    this.damageFlashEl.classList.remove('visible');
    this.damageFlashEl.classList.add('hidden');
  }

  dispose(): void {
    this.reset();
  }
}
