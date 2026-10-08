// ─── Announcer: cinematic DOM banners (all motion lives in styles.css) ──────
//
//   stageIntro()  — "SECTOR 07" slam + level name type-on + wipe lines
//   stageClear()  — "MISSION COMPLETE" with a counting bonus tally
//   warning()     — hazard-striped boss alert with a pulsing frame
//   toast()       — short centre callouts ("SHIELD DOWN", "BOMB +1", …)
//
// Each banner is a fresh element removed on animationend, so overlapping
// calls never fight over shared state.

export class Announcer {
  private root: HTMLElement;
  private timers = new Set<number>();

  constructor() {
    let el = document.getElementById('announcer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'announcer';
      document.getElementById('game-container')?.appendChild(el);
    }
    this.root = el;
  }

  private mount(html: string, className: string, lifetimeMs: number): HTMLElement {
    const el = document.createElement('div');
    el.className = `ann ${className}`;
    el.innerHTML = html;
    this.root.appendChild(el);
    const t = window.setTimeout(() => { el.remove(); this.timers.delete(t); }, lifetimeMs);
    this.timers.add(t);
    return el;
  }

  private letters(text: string, baseDelay = 0, step = 0.035): string {
    return [...text].map((ch, i) =>
      `<span class="ann-ch" style="animation-delay:${(baseDelay + i * step).toFixed(3)}s">${ch === ' ' ? '&nbsp;' : escapeHtml(ch)}</span>`,
    ).join('');
  }

  stageIntro(levelNumber: number, name: string, total: number): void {
    const num = String(levelNumber).padStart(2, '0');
    this.mount(`
      <div class="ann-stage-line l1"></div>
      <div class="ann-stage-kicker">${this.letters(`SECTOR ${num} / ${total}`, 0.15, 0.03)}</div>
      <div class="ann-stage-name">${this.letters(name.toUpperCase(), 0.45, 0.04)}</div>
      <div class="ann-stage-line l2"></div>
    `, 'ann-stage', 3600);
  }

  stageClear(bonus: number, onTallyDone?: () => void): void {
    const el = this.mount(`
      <div class="ann-clear-title">${this.letters('MISSION COMPLETE', 0, 0.045)}</div>
      <div class="ann-clear-bonus">BONUS <span class="ann-tally">0</span></div>
    `, 'ann-clear', 4200);
    const tally = el.querySelector('.ann-tally') as HTMLElement;
    const start = performance.now() + 700;
    const dur = 1200;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / dur));
      const eased = 1 - Math.pow(1 - t, 3);
      tally.textContent = Math.round(bonus * eased).toLocaleString();
      if (t < 1 && el.isConnected) requestAnimationFrame(tick);
      else { tally.classList.add('done'); onTallyDone?.(); }
    };
    requestAnimationFrame(tick);
  }

  warning(title: string, subtitle: string): void {
    this.mount(`
      <div class="ann-warn-stripes top"></div>
      <div class="ann-warn-body">
        <div class="ann-warn-title">${this.letters(title, 0.1, 0.05)}</div>
        <div class="ann-warn-sub">${escapeHtml(subtitle)}</div>
      </div>
      <div class="ann-warn-stripes bottom"></div>
    `, 'ann-warn', 3200);
    document.getElementById('game-container')?.classList.add('alarm');
    const t = window.setTimeout(() => {
      document.getElementById('game-container')?.classList.remove('alarm');
      this.timers.delete(t);
    }, 3200);
    this.timers.add(t);
  }

  toast(text: string, tone: 'cyan' | 'amber' | 'red' | 'green' = 'cyan'): void {
    // Replace a toast that's still on screen so callouts never stack up.
    this.root.querySelectorAll('.ann-toast').forEach(n => n.remove());
    this.mount(`<span>${escapeHtml(text)}</span>`, `ann-toast tone-${tone}`, 1400);
  }

  clear(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.root.innerHTML = '';
    document.getElementById('game-container')?.classList.remove('alarm');
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
