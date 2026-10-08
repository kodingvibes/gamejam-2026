// ─── Score Popups: floating "+300 ×3" at the kill position ──────────────────
// Projects the world position once, then CSS animates the pop/rise/fade.
// A small pool of DOM nodes is recycled so heavy combos never thrash the DOM.

import * as THREE from 'three';

const POOL = 24;

export class ScorePopups {
  private root: HTMLElement;
  private nodes: HTMLElement[] = [];
  private cursor = 0;
  private _v = new THREE.Vector3();

  constructor(private camera: THREE.Camera) {
    this.root = document.createElement('div');
    this.root.id = 'score-popups';
    document.getElementById('game-container')?.appendChild(this.root);
    for (let i = 0; i < POOL; i++) {
      const n = document.createElement('div');
      n.className = 'score-pop';
      this.root.appendChild(n);
      this.nodes.push(n);
    }
  }

  spawn(world: THREE.Vector3, points: number, combo: number): void {
    const p = this._v.copy(world).project(this.camera);
    if (p.z > 1 || Math.abs(p.x) > 1.1 || Math.abs(p.y) > 1.1) return;
    const n = this.nodes[this.cursor];
    this.cursor = (this.cursor + 1) % POOL;
    const tier = combo >= 8 ? 'tier-3' : combo >= 4 ? 'tier-2' : combo >= 2 ? 'tier-1' : '';
    n.className = 'score-pop';
    n.innerHTML = `+${points.toLocaleString()}${combo > 1 ? `<small>×${combo}</small>` : ''}`;
    n.style.left = `${(p.x * 0.5 + 0.5) * 100}%`;
    n.style.top = `${(-p.y * 0.5 + 0.5) * 100}%`;
    n.style.setProperty('--drift', `${(Math.random() - 0.5) * 40}px`);
    // Restart the CSS animation on a recycled node.
    void n.offsetWidth;
    n.className = `score-pop live ${tier}`;
  }

  reset(): void {
    for (const n of this.nodes) n.className = 'score-pop';
  }

  dispose(): void {
    this.root.remove();
  }
}
