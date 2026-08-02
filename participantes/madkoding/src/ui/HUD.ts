// ─── HUD ─────────────────────────────────────────────────────────────────────

import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';
import { PLAYER } from '../types/config';
import { renderIconRow } from './iconRow';

const MAX_BOMBS = 5;

export class HUD {
  private eventBus: EventBus;
  private container: HTMLElement;
  private healthBar: HTMLElement;
  private shieldContainer: HTMLElement;
  private scoreElement: HTMLElement;
  private comboElement: HTMLElement;
  private bombContainer: HTMLElement;
  private waveElement: HTMLElement;
  private bossContainer: HTMLElement;
  private bossNameElement: HTMLElement;
  private bossHealthBar: HTMLElement;
  private _crosshair: HTMLElement;

  constructor() {
    this.eventBus = EventBus.getInstance();
    this.container = document.getElementById('hud') as HTMLElement;

    this.container.innerHTML = `
      <div class="hud-top">
        <div class="hud-top-left">
          <div class="hud-health">
            <span class="hud-health-label">HULL</span>
            <div class="hud-health-bar-bg">
              <div id="health-bar" class="hud-health-bar"></div>
            </div>
          </div>
          <div id="shield-container" class="hud-shields"></div>
        </div>
        <div class="hud-top-right">
          <div id="score-display" class="hud-score">0</div>
          <div id="combo-display" class="hud-combo"></div>
        </div>
      </div>
      <div class="hud-bottom">
        <div id="wave-display" class="hud-wave">WAVE 1/30</div>
        <div id="bomb-container" class="hud-bombs">
          <span class="hud-bomb-label">BOMBS</span>
          <div class="hud-bomb-icons" id="bomb-icons"></div>
        </div>
      </div>
      <div id="boss-container" class="hud-boss-bar hidden">
        <div id="boss-name" class="hud-boss-name">BOSS</div>
        <div class="hud-boss-health-bg">
          <div id="boss-health-bar" class="hud-boss-health"></div>
        </div>
      </div>
      <div id="crosshair">
        <div class="crosshair-dot"></div>
        <div class="crosshair-ring"></div>
        <div class="crosshair-line top"></div>
        <div class="crosshair-line bottom"></div>
        <div class="crosshair-line left"></div>
        <div class="crosshair-line right"></div>
      </div>
    `;

    this.healthBar = document.getElementById('health-bar') as HTMLElement;
    this.shieldContainer = document.getElementById('shield-container') as HTMLElement;
    this.scoreElement = document.getElementById('score-display') as HTMLElement;
    this.comboElement = document.getElementById('combo-display') as HTMLElement;
    this.bombContainer = document.getElementById('bomb-icons') as HTMLElement;
    this.waveElement = document.getElementById('wave-display') as HTMLElement;
    this.bossContainer = document.getElementById('boss-container') as HTMLElement;
    this.bossNameElement = document.getElementById('boss-name') as HTMLElement;
    this.bossHealthBar = document.getElementById('boss-health-bar') as HTMLElement;
    this._crosshair = document.getElementById('crosshair') as HTMLElement;

    // Events
    this.eventBus.on(GameEvent.PLAYER_DAMAGED, (p) => this.updateHealth(p.health));
    this.eventBus.on(GameEvent.PLAYER_SHIELD_LOST, (p) => this.updateShields(p.shields));
    this.eventBus.on(GameEvent.SCORE_CHANGED, (p) => this.updateScore(p.score));
    this.eventBus.on(GameEvent.COMBO_CHANGED, (p) => this.updateCombo(p.combo));
    this.eventBus.on(GameEvent.BOMB_COUNT_CHANGED, (p) => this.updateBombs(p.count));
    this.eventBus.on(GameEvent.WAVE_START, (p) => this.updateWave(p.wave, p.totalWaves));
    this.eventBus.on(GameEvent.BOSS_SPAWNED, (p) => this.showBossBar(p.name, p.maxHealth));
    this.eventBus.on(GameEvent.BOSS_DAMAGED, (p) => this.updateBossHealth(p.health, p.maxHealth));
    this.eventBus.on(GameEvent.BOSS_DESTROYED, () => this.hideBossBar());
    this.eventBus.on(GameEvent.PLAYER_DEATH, () => this.hideBossBar());

    // Init
    this.updateHealth(PLAYER.STARTING_HEALTH);
    this.updateShields(PLAYER.STARTING_SHIELDS);
    this.updateScore(0);
    this.updateBombs(MAX_BOMBS);
    this.updateWave(1, 30);
  }

  private updateHealth(health: number): void {
    const percent = (health / PLAYER.MAX_HEALTH) * 100;
    this.healthBar.style.width = `${percent}%`;
  }

  private updateShields(shields: number): void {
    renderIconRow(this.shieldContainer, PLAYER.MAX_SHIELDS, shields, 'hud-shield-icon');
  }

  private updateScore(score: number): void {
    this.scoreElement.textContent = score.toLocaleString();
    // Trigger glitch animation on score change
    this.scoreElement.classList.remove('score-glitch');
    void this.scoreElement.offsetWidth; // force reflow to restart animation
    this.scoreElement.classList.add('score-glitch');
  }

  private updateCombo(combo: number): void {
    if (combo > 1) {
      this.comboElement.textContent = `x${combo}`;
    } else {
      this.comboElement.textContent = '';
    }
  }

  private updateBombs(count: number): void {
    renderIconRow(this.bombContainer, MAX_BOMBS, count, 'hud-bomb-icon');
  }

  private updateWave(wave: number, total: number): void {
    this.waveElement.textContent = `WAVE ${wave}/${total}`;
  }

  private showBossBar(name: string, _maxHealth: number): void {
    this.bossNameElement.textContent = name;
    this.bossHealthBar.style.width = '100%';
    this.bossContainer.classList.remove('hidden');
  }

  private updateBossHealth(health: number, maxHealth: number): void {
    this.bossHealthBar.style.width = `${(health / maxHealth) * 100}%`;
  }

  private hideBossBar(): void {
    this.bossContainer.classList.add('hidden');
  }

  setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'block' : 'none';
  }

  // Move crosshair to the mouse position in screen coords (NDC -1..1)
  updateCrosshair(aimX: number, aimY: number): void {
    if (!this._crosshair) return;
    const px = (aimX * 0.5 + 0.5) * 100;
    const py = (-aimY * 0.5 + 0.5) * 100;
    this._crosshair.style.left = `${px}%`;
    this._crosshair.style.top = `${py}%`;
  }

  reset(): void {
    this.updateHealth(PLAYER.STARTING_HEALTH);
    this.updateShields(PLAYER.STARTING_SHIELDS);
    this.updateScore(0);
    this.updateBombs(MAX_BOMBS);
    this.hideBossBar();
  }

  dispose(): void {
    this.container.innerHTML = '';
  }
}