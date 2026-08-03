// ─── Screen Effects: damage flash + glitch overlay on hit ──────────────────

import { SCREEN } from '../types/config';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';

export class ScreenEffects {
  private eventBus = EventBus.getInstance();
  private damageFlashEl: HTMLElement;
  private glitchEl: HTMLElement;
  private enemyFlashEl: HTMLElement;
  private glitchTimer: number | null = null;

  constructor() {
    this.damageFlashEl = document.getElementById('damage-overlay') as HTMLElement;
    this.glitchEl = document.getElementById('glitch-overlay') as HTMLElement;
    this.enemyFlashEl = document.getElementById('enemy-fire-flash') as HTMLElement;

    this.eventBus.on(GameEvent.PLAYER_DAMAGED, () => this.flashDamage());
    this.eventBus.on(GameEvent.PLAYER_SHIELD_LOST, () => this.flashDamage());
    this.eventBus.on(GameEvent.ENEMY_FIRED, () => this.flashEnemyFire());
  }

  flashDamage(): void {
    this.damageFlashEl.classList.remove('hidden');
    this.damageFlashEl.classList.add('visible');

    setTimeout(() => {
      this.damageFlashEl.classList.remove('visible');
      this.damageFlashEl.classList.add('hidden');
    }, SCREEN.DAMAGE_FLASH_DURATION * 1000);
  }

  // Quick subtle blue pulse when any enemy fires. Uses the Web Animations API
  // so it never touches the class list or forces a layout reflow.
  flashEnemyFire(): void {
    if (!this.enemyFlashEl) return;
    this.enemyFlashEl.animate(
      [{ opacity: 0.9 }, { opacity: 0 }],
      { duration: 120, easing: 'ease-out' },
    );
  }

  // RGB-split + scanline glitch burst. Toggles the .glitch-active class for
  // a short window (CSS handles the animation), then clears it. Re-triggering
  // while still active restarts the animation cleanly.
  triggerGlitch(durationMs = 220): void {
    if (!this.glitchEl) return;
    this.glitchEl.classList.remove('glitch-active');
    // Force reflow so the animation re-fires when re-added immediately.
    void this.glitchEl.offsetWidth;
    this.glitchEl.classList.add('glitch-active');
    if (this.glitchTimer !== null) clearTimeout(this.glitchTimer);
    this.glitchTimer = window.setTimeout(() => {
      this.glitchEl.classList.remove('glitch-active');
      this.glitchTimer = null;
    }, durationMs);
  }

  reset(): void {
    this.damageFlashEl.classList.remove('visible');
    this.damageFlashEl.classList.add('hidden');
    if (this.glitchEl) this.glitchEl.classList.remove('glitch-active');
    if (this.glitchTimer !== null) { clearTimeout(this.glitchTimer); this.glitchTimer = null; }
  }

  dispose(): void {
    this.reset();
    if (this.glitchTimer !== null) { clearTimeout(this.glitchTimer); this.glitchTimer = null; }
  }
}
