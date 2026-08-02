// ─── Menu Screen ────────────────────────────────────────────────────────────

export class MenuScreen {
  private element: HTMLElement;
  private startButton: HTMLElement;
  private onKeyDown: (e: KeyboardEvent) => void;

  constructor(private onStart: () => void) {
    this.element = document.getElementById('menu-screen') as HTMLElement;
    this.startButton = document.getElementById('start-button') as HTMLElement;

    this.startButton.addEventListener('click', () => this.onStart());
    this.onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (!this.element.classList.contains('hidden')) this.onStart();
      }
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
    window.removeEventListener('keydown', this.onKeyDown);
  }
}
