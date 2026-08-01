export class SoundSynth {
  private context: AudioContext | null = null;
  private wheelSource: OscillatorNode | null = null;
  private wheelGain: GainNode | null = null;

  unlock(): void {
    this.context ??= new AudioContext();
    void this.context.resume();
  }

  shot(): void {
    this.pulse(72, 0.09, 0.18, 'sawtooth', 720);
  }

  hit(): void {
    this.pulse(540, 0.07, 0.12, 'square', 180);
  }

  land(intensity = 1): void {
    this.pulse(45, 0.11, Math.min(0.18, 0.05 + intensity * 0.04), 'triangle', 28);
  }

  updateWheels(speed: number, grounded: boolean): void {
    if (!this.context) return;
    if (!this.wheelSource || !this.wheelGain) {
      this.wheelSource = this.context.createOscillator();
      this.wheelGain = this.context.createGain();
      this.wheelSource.type = 'sawtooth';
      this.wheelGain.gain.value = 0;
      this.wheelSource.connect(this.wheelGain).connect(this.context.destination);
      this.wheelSource.start();
    }
    const now = this.context.currentTime;
    this.wheelSource.frequency.setTargetAtTime(28 + speed * 5, now, 0.04);
    this.wheelGain.gain.setTargetAtTime(grounded ? Math.min(0.032, speed * 0.002) : 0, now, 0.08);
  }

  private pulse(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    endFrequency: number,
  ): void {
    this.unlock();
    if (!this.context) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const start = this.context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }
}
