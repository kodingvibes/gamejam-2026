import Phaser from "phaser";

/**
 * Procedurally synthesized weapon-shot sounds.
 *
 * There are no audio assets for SFX in the project, so we synthesize short
 * blips with the Web Audio API. The oscillator output is routed through
 * `scene.sound.destination`, which is Phaser's master mute/volume chain — so
 * the game's mute toggle and volume slider affect these sounds too.
 *
 * Every weapon has a distinct pitch/decay so shots read as different guns.
 */

type WebAudioManager = {
  context: AudioContext;
  destination: AudioNode;
};

/** Pitch (Hz) per weapon — distinct and recognisable. */
const PITCH: Record<string, number> = {
  Plasma: 520,
  Pulse: 880,
  Grenade: 200,
  Flamethrower: 160,
  Electric: 1100,
};

const DEFAULT_PITCH = 480;

/**
 * Play a short synthesized blip for the given weapon name. Safe to call
 * every frame (e.g. the Electric beam) — each call spawns an independent
 * short-lived oscillator that self-terminates.
 */
export function playWeaponSfx(
  scene: Phaser.Scene,
  weaponName: string,
): void {
  const sound = scene.sound as unknown as WebAudioManager;
  if (!sound.context || !sound.destination) {
    // Not Web Audio (or audio unavailable) — silently skip.
    return;
  }
  const ctx = sound.context;
  if (ctx.state !== "running") {
    return;
  }

  const freq = PITCH[weaponName] ?? DEFAULT_PITCH;
  const duration = weaponName === "Flamethrower" ? 0.12 : 0.07;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(
    freq * 0.6,
    ctx.currentTime + duration,
  );

  // Short attack then fast exponential decay so it reads as a "pew".
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(sound.destination);

  osc.start();
  osc.stop(ctx.currentTime + duration + 0.02);
}
