// ─── Music Player: plays the background soundtrack on loop ──────────────────

export class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private _playing = false;

  play(): void {
    if (this._playing) return;
    this._playing = true;
    this.audio = new Audio('/Starfall Vanguard2.mp3');
    this.audio.volume = 0.75;
    this.audio.loop = true;
    this.audio.play().catch(() => {
      // Autoplay may be blocked until user interacts
    });
  }
}
