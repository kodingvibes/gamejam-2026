// ─── Entry Point ────────────────────────────────────────────────────────────

import { Game } from './core/Game';

function main(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;

  if (!canvas) {
    console.error('Game canvas not found!');
    return;
  }

  const game = new Game(canvas);
  game.start();

  // Expose game instance for debugging
  (window as unknown as Record<string, unknown>).__game = game;
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
