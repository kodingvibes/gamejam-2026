// ─── Pause Overlay ──────────────────────────────────────────────────────────

export class PauseOverlay {
  private element: HTMLElement;
  private resumeButton: HTMLElement;
  private quitButton: HTMLElement;

  constructor(private actions: { resume: () => void; quit: () => void }) {
    this.element = document.getElementById('pause-overlay') as HTMLElement;
    this.resumeButton = document.getElementById('resume-button') as HTMLElement;
    this.quitButton = document.getElementById('quit-button') as HTMLElement;

    this.resumeButton.addEventListener('click', () => this.actions.resume());
    this.quitButton.addEventListener('click', () => this.actions.quit());
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
