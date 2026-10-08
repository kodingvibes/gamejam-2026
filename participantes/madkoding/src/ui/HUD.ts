// ─── HUD ─────────────────────────────────────────────────────────────────────
// Event-driven for discrete changes (score, bombs, wave, boss) and polled every
// frame for continuous values (hull, shields, boost, combo timer) — the old HUD
// only listened to damage events, so respawns and health pickups left the hull
// bar showing a stale value.
//
// Motion: rolling score counter with pop, hull/boss bars with a lagging white
// "damage trail", combo multiplier with a draining timer, crosshair hit-marker
// and lock-on state.

import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';
import { PLAYER } from '../types/config';
import { renderIconRow } from './iconRow';

const MAX_BOMBS = 5;

export interface HudFrame {
  health: number;
  shields: number;
  boost: number;     // 0..1 meter
  boosting: boolean;
  comboRatio: number;
  locked: boolean;
}

export class HUD {
  private eventBus: EventBus;
  private container: HTMLElement;
  private healthBar: HTMLElement;
  private healthTrail: HTMLElement;
  private healthWrap: HTMLElement;
  private shieldContainer: HTMLElement;
  private scoreElement: HTMLElement;
  private comboElement: HTMLElement;
  private comboValue: HTMLElement;
  private comboTimer: HTMLElement;
  private bombContainer: HTMLElement;
  private waveElement: HTMLElement;
  private bossContainer: HTMLElement;
  private bossNameElement: HTMLElement;
  private bossHealthBar: HTMLElement;
  private bossTrail: HTMLElement;
  private boostBar: HTMLElement;
  private boostWrap: HTMLElement;
  private _crosshair: HTMLElement;

  private _shownScore = 0;
  private _targetScore = 0;
  private _health: number = PLAYER.STARTING_HEALTH;
  private _healthTrail: number = PLAYER.STARTING_HEALTH;
  private _trailDelay = 0;
  private _shields = -1;
  private _bossRatio = 1;
  private _bossTrail = 1;
  private _bossTrailDelay = 0;
  private _combo = 0;
  private _hitTimer: number | null = null;

  constructor() {
    this.eventBus = EventBus.getInstance();
    this.container = document.getElementById('hud') as HTMLElement;

    this.container.innerHTML = `
      <div class="hud-top">
        <div class="hud-top-left hud-slide-left">
          <div class="hud-health" id="hud-health">
            <span class="hud-health-label">HULL</span>
            <div class="hud-health-bar-bg">
              <div id="health-trail" class="hud-health-trail"></div>
              <div id="health-bar" class="hud-health-bar"></div>
            </div>
          </div>
          <div id="shield-container" class="hud-shields"></div>
        </div>
        <div class="hud-top-right hud-slide-right">
          <div id="score-display" class="hud-score">0</div>
          <div id="combo-display" class="hud-combo">
            <span class="hud-combo-x">×</span><span id="combo-value">1</span>
            <div class="hud-combo-timer"><div id="combo-timer"></div></div>
          </div>
        </div>
      </div>
      <div class="hud-bottom hud-slide-up">
        <div id="wave-display" class="hud-wave">WAVE 1/3</div>
        <div id="boost-wrap" class="hud-boost">
          <span class="hud-bomb-label">BOOST</span>
          <div class="hud-boost-bg"><div id="boost-bar" class="hud-boost-bar"></div></div>
        </div>
        <div id="bomb-container" class="hud-bombs">
          <span class="hud-bomb-label">BOMBS</span>
          <div class="hud-bomb-icons" id="bomb-icons"></div>
        </div>
      </div>
      <div id="boss-container" class="hud-boss-bar hidden">
        <div id="boss-name" class="hud-boss-name">BOSS</div>
        <div class="hud-boss-health-bg">
          <div id="boss-trail" class="hud-boss-trail"></div>
          <div id="boss-health-bar" class="hud-boss-health"></div>
          <div class="hud-boss-tick" style="left:33.3%"></div>
          <div class="hud-boss-tick" style="left:66.6%"></div>
        </div>
      </div>
      <div id="crosshair">
        <div class="crosshair-dot"></div>
        <div class="crosshair-ring"></div>
        <div class="crosshair-line top"></div>
        <div class="crosshair-line bottom"></div>
        <div class="crosshair-line left"></div>
        <div class="crosshair-line right"></div>
        <div class="crosshair-hit"><i></i><i></i><i></i><i></i></div>
      </div>
    `;

    const $ = (id: string) => document.getElementById(id) as HTMLElement;
    this.healthBar = $('health-bar');
    this.healthTrail = $('health-trail');
    this.healthWrap = $('hud-health');
    this.shieldContainer = $('shield-container');
    this.scoreElement = $('score-display');
    this.comboElement = $('combo-display');
    this.comboValue = $('combo-value');
    this.comboTimer = $('combo-timer');
    this.bombContainer = $('bomb-icons');
    this.waveElement = $('wave-display');
    this.bossContainer = $('boss-container');
    this.bossNameElement = $('boss-name');
    this.bossHealthBar = $('boss-health-bar');
    this.bossTrail = $('boss-trail');
    this.boostBar = $('boost-bar');
    this.boostWrap = $('boost-wrap');
    this._crosshair = $('crosshair');

    // Events
    this.eventBus.on(GameEvent.PLAYER_DAMAGED, () => this.kick(this.healthWrap, 'hud-kick'));
    this.eventBus.on(GameEvent.PLAYER_SHIELD_LOST, () => this.kick(this.shieldContainer, 'hud-kick'));
    this.eventBus.on(GameEvent.SCORE_CHANGED, (p) => this.updateScore(p.score));
    this.eventBus.on(GameEvent.COMBO_CHANGED, (p) => this.updateCombo(p.combo));
    this.eventBus.on(GameEvent.BOMB_COUNT_CHANGED, (p) => this.updateBombs(p.count));
    this.eventBus.on(GameEvent.WAVE_START, (p) => this.updateWave(p.wave, p.totalWaves));
    this.eventBus.on(GameEvent.BOSS_SPAWNED, (p) => this.showBossBar(p.name, p.maxHealth));
    this.eventBus.on(GameEvent.BOSS_DAMAGED, (p) => this.updateBossHealth(p.health, p.maxHealth));
    this.eventBus.on(GameEvent.BOSS_DESTROYED, () => this.hideBossBar());
    this.eventBus.on(GameEvent.PLAYER_DEATH, () => this.hideBossBar());

    this.reset();
  }

  private kick(el: HTMLElement, cls: string): void {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  private updateScore(score: number): void {
    this._targetScore = score;
    if (score === 0) { this._shownScore = 0; this.scoreElement.textContent = '0'; return; }
    this.kick(this.scoreElement, 'score-pop-anim');
  }

  private updateCombo(combo: number): void {
    const prev = this._combo;
    this._combo = combo;
    if (combo > 1) {
      this.comboValue.textContent = String(Math.min(combo, 10));
      this.comboElement.classList.add('active');
      this.comboElement.dataset.tier = combo >= 8 ? '3' : combo >= 4 ? '2' : '1';
      if (combo > prev) this.kick(this.comboElement, 'combo-bump');
    } else {
      if (prev > 1) this.kick(this.comboElement, 'combo-break');
      this.comboElement.classList.remove('active');
    }
  }

  private updateBombs(count: number): void {
    renderIconRow(this.bombContainer, MAX_BOMBS, count, 'hud-bomb-icon');
    this.kick(this.bombContainer, 'hud-kick');
  }

  private updateWave(wave: number, total: number): void {
    this.waveElement.textContent = `WAVE ${wave}/${total}`;
    this.kick(this.waveElement, 'wave-flash');
  }

  private showBossBar(name: string, _maxHealth: number): void {
    this.bossNameElement.textContent = name;
    this._bossRatio = 1;
    this._bossTrail = 1;
    this.bossHealthBar.style.width = '100%';
    this.bossTrail.style.width = '100%';
    this.bossContainer.classList.remove('hidden');
    this.kick(this.bossContainer, 'boss-in');
  }

  private updateBossHealth(health: number, maxHealth: number): void {
    this._bossRatio = Math.max(0, health / maxHealth);
    this._bossTrailDelay = 0.35;
    this.bossHealthBar.style.width = `${this._bossRatio * 100}%`;
    this.kick(this.bossContainer, 'boss-hit');
  }

  private hideBossBar(): void {
    this.bossContainer.classList.add('hidden');
  }

  /** Crosshair hit-marker (call when a player shot connects). */
  hitMarker(kill = false): void {
    this._crosshair.classList.remove('hit', 'kill');
    void this._crosshair.offsetWidth;
    this._crosshair.classList.add(kill ? 'kill' : 'hit');
    if (this._hitTimer !== null) clearTimeout(this._hitTimer);
    this._hitTimer = window.setTimeout(() => {
      this._crosshair.classList.remove('hit', 'kill');
      this._hitTimer = null;
    }, kill ? 260 : 140);
  }

  /** Per-frame continuous values + tweens. */
  update(dt: number, f: HudFrame): void {
    // Score roll
    if (this._shownScore !== this._targetScore) {
      const diff = this._targetScore - this._shownScore;
      const step = Math.max(1, Math.abs(diff) * Math.min(1, dt * 10));
      this._shownScore = diff > 0
        ? Math.min(this._targetScore, this._shownScore + step)
        : Math.max(this._targetScore, this._shownScore - step);
      this.scoreElement.textContent = Math.round(this._shownScore).toLocaleString();
    }

    // Hull + damage trail
    if (f.health !== this._health) {
      if (f.health < this._health) this._trailDelay = 0.4;
      else this._healthTrail = f.health;
      this._health = f.health;
      this.healthBar.style.width = `${(this._health / PLAYER.MAX_HEALTH) * 100}%`;
    }
    if (this._trailDelay > 0) this._trailDelay -= dt;
    else if (this._healthTrail > this._health) this._healthTrail = Math.max(this._health, this._healthTrail - dt * 60);
    this.healthTrail.style.width = `${(this._healthTrail / PLAYER.MAX_HEALTH) * 100}%`;
    this.healthWrap.classList.toggle('critical', this._health <= 30);

    if (f.shields !== this._shields) {
      this._shields = f.shields;
      renderIconRow(this.shieldContainer, PLAYER.MAX_SHIELDS, f.shields, 'hud-shield-icon');
    }

    // Boost meter
    this.boostBar.style.transform = `scaleX(${f.boost.toFixed(3)})`;
    this.boostWrap.classList.toggle('boosting', f.boosting);
    this.boostWrap.classList.toggle('empty', f.boost < 0.05);

    // Combo timer
    this.comboTimer.style.transform = `scaleX(${f.comboRatio.toFixed(3)})`;

    // Boss trail
    if (this._bossTrailDelay > 0) this._bossTrailDelay -= dt;
    else if (this._bossTrail > this._bossRatio) {
      this._bossTrail = Math.max(this._bossRatio, this._bossTrail - dt * 0.6);
      this.bossTrail.style.width = `${this._bossTrail * 100}%`;
    }

    this._crosshair.classList.toggle('locked', f.locked);
  }

  setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'block' : 'none';
    if (visible) {
      // Replay the slide-in on every show.
      for (const el of this.container.querySelectorAll<HTMLElement>('.hud-slide-left, .hud-slide-right, .hud-slide-up')) {
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = '';
      }
    }
  }

  // Move crosshair to the mouse position in screen coords (NDC -1..1).
  updateCrosshair(aimX: number, aimY: number): void {
    if (!this._crosshair) return;
    const cx = Math.max(-1, Math.min(1, aimX));
    const cy = Math.max(-1, Math.min(1, aimY));
    const px = (cx * 0.5 + 0.5) * 100;
    const py = (-cy * 0.5 + 0.5) * 100;
    this._crosshair.style.left = `${px}%`;
    this._crosshair.style.top = `${py}%`;
  }

  reset(): void {
    this._health = this._healthTrail = PLAYER.STARTING_HEALTH;
    this.healthBar.style.width = '100%';
    this.healthTrail.style.width = '100%';
    this._shields = -1;
    renderIconRow(this.shieldContainer, PLAYER.MAX_SHIELDS, PLAYER.STARTING_SHIELDS, 'hud-shield-icon');
    this._targetScore = this._shownScore = 0;
    this.scoreElement.textContent = '0';
    this._combo = 0;
    this.comboElement.classList.remove('active');
    renderIconRow(this.bombContainer, MAX_BOMBS, MAX_BOMBS, 'hud-bomb-icon');
    this.hideBossBar();
  }

  dispose(): void {
    if (this._hitTimer !== null) clearTimeout(this._hitTimer);
    this.container.innerHTML = '';
  }
}
