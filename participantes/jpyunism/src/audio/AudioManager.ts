import Phaser from "phaser";
import { AudioSettings } from "../store/AudioSettings";

/**
 * Options accepted by `AudioManager.play()` and `AudioManager.crossFadeTo()`.
 *
 * All fields are optional. Reasonable defaults match the spec:
 *   - `loop`: false (one-shot)
 *   - `volume`: the persisted settings volume (clamped to [0, 1])
 *   - `fadeInMs`: 0 (start at target volume immediately)
 */
export interface AudioPlayOptions {
  loop?: boolean;
  /**
   * Target volume after any fade-in completes. If omitted, the persisted
   * settings volume is used. Global mute is applied on top of this by
   * Phaser's SoundManager regardless.
   */
  volume?: number;
  /**
   * If > 0, the new sound starts at volume 0 and tweens up to the target
   * volume over this duration. 0 (default) plays at the target volume
   * immediately — useful when a scene enters with no other music playing.
   */
  fadeInMs?: number;
}

/**
 * Runtime shape we rely on for volume tweens. Phaser 4's `BaseSound` type
 * declaration is intentionally minimal (no `volume` / `setVolume`), but the
 * actual runtime instances expose both — so we cast through a small
 * internal interface to keep call-sites typed.
 *
 * NOTE: This is a documented Phaser 4 typing gap, not a bug in our code.
 * Both `WebAudioSound` and `HTML5AudioSound` carry a `volume: number`
 * property and a `setVolume()` method on the actual runtime objects.
 */
interface SoundWithVolume {
  volume: number;
  setVolume(v: number): unknown;
  isPlaying: boolean;
  destroy(): void;
  pendingRemove: boolean;
  key: string;
}

type AnySound = Phaser.Sound.BaseSound & SoundWithVolume;

/**
 * Per-scene wrapper around Phaser's shared `SoundManager` for background
 * music. Each scene (`MenuScene`, `GameScene`, `GameOverScene`) constructs
 * its own instance in `create()` and uses it to play, cross-fade, and
 * stop the track that scene owns.
 *
 * Cross-fade semantics:
 *   - When a scene starts, the previous scene's music may still be playing
 *     on the global `SoundManager` (Phaser does not stop sounds on scene
 *     transitions). `crossFadeTo()` finds any other looping music currently
 *     playing, fades its volume to 0 over `fadeInMs`, destroys it on
 *     completion, and tweens the new track up to the target volume over
 *     the same window — all Linear, no easing.
 *   - `play()` is a simpler "start fresh" entry point. It still gates on
 *     Phaser's audio-unlock event so it works on the first key press.
 *
 * The mute flag is applied to `this.sound.mute` (the shared SoundManager)
 * so a single toggle in any scene silences every scene.
 */
export class AudioManager {
  private scene: Phaser.Scene;
  /** The BaseSound owned by THIS scene — refreshed on every play/cross-fade. */
  private current?: Phaser.Sound.BaseSound;
  /** Last explicit volume target. Used when a new track is added without an override. */
  private targetVolume: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const settings = AudioSettings.load();
    this.targetVolume = settings.volume;

    // Global mute — shared SoundManager affects every scene.
    this.scene.sound.mute = settings.muted;
  }

  /**
   * Start a fresh track. If audio is locked (browser autoplay policy),
   * the call is deferred until the `unlocked` event fires once.
   *
   * Honours `opts.fadeInMs` for a smooth ramp from 0 to target volume.
   */
  public play(key: string, opts?: AudioPlayOptions): void {
    const vol = clamp01(opts?.volume ?? this.targetVolume);
    const loop = opts?.loop ?? false;
    const fadeInMs = opts?.fadeInMs ?? 0;

    const playIt = (): void => {
      // If a sound already exists for this key (e.g. re-entering the same
      // scene), tear it down before allocating a new one.
      this.stop();

      const startVolume = fadeInMs > 0 ? 0 : vol;
      let sound: AnySound;
      try {
        sound = this.scene.sound.add(key, { loop, volume: startVolume }) as AnySound;
      } catch (e) {
        console.warn(`AudioManager: failed to decode "${key}" — skipping`, e);
        return;
      }
      sound.play();
      this.current = sound;

      if (fadeInMs > 0) {
        this.scene.tweens.add({
          targets: sound,
          volume: vol,
          duration: fadeInMs,
          ease: "Linear",
        });
      }
    };

    if (this.scene.sound.locked) {
      this.scene.sound.once("unlocked", playIt);
    } else {
      playIt();
    }
  }

  /**
   * Hard-stop the track owned by this scene (no fade). Idempotent.
   * Other scenes' tracks are unaffected.
   */
  public stop(): void {
    if (this.current) {
      this.current.stop();
      this.current.destroy();
      this.current = undefined;
    }
  }

  /**
   * Cross-fade from whatever is currently playing on the global SoundManager
   * to the new key. The "outgoing" track is whichever playing BaseSound is
   * NOT the one we're about to start — this lets the destination scene fade
   * out the previous scene's music without needing to know about it.
   *
   * Both tweens run in parallel over `fadeInMs` (Linear), giving the spec's
   * ~1000 ms menu↔game cross-fade. The outgoing track is destroyed on
   * fade-out completion.
   */
  public crossFadeTo(key: string, opts?: AudioPlayOptions): void {
    const vol = clamp01(opts?.volume ?? this.targetVolume);
    const loop = opts?.loop ?? false;
    const fadeMs = opts?.fadeInMs ?? 1000;

    // Spawn the new track at volume 0 so the fade-in is audible.
    const next = this.scene.sound.add(key, { loop, volume: 0 }) as AnySound;
    next.play();
    this.current = next;

    // Find any other music still playing and fade it out.
    // getAllPlaying() returns every BaseSound whose isPlaying flag is set;
    // we exclude the one we just added (and skip any already-pending-removal
    // entries so we don't trip over teardown races).
    const all = this.scene.sound.getAllPlaying<AnySound>();
    for (const other of all) {
      if (other === next) continue;
      if (other.pendingRemove) continue;
      this.scene.tweens.add({
        targets: other,
        volume: 0,
        duration: fadeMs,
        ease: "Linear",
        onComplete: () => {
          if (!other.pendingRemove) {
            other.destroy();
          }
        },
      });
    }

    // Fade the new track up to the target volume.
    this.scene.tweens.add({
      targets: next,
      volume: vol,
      duration: fadeMs,
      ease: "Linear",
    });
  }

  /**
   * Update the live track's volume and (optionally) persist the new value.
   * If the user is mid-fade, the tween's target is recomputed by overwriting
   * the base sound's `volume`; the tween picks up the new value on its next
   * tick.
   *
   * Pass `persist = false` when the caller is going to debounce the save
   * itself (e.g. a slider dragging at 60 fps). The in-memory `targetVolume`
   * is still updated so subsequent `play()` calls use the latest value.
   */
  public setVolume(v: number, persist: boolean = true): void {
    this.targetVolume = clamp01(v);
    if (this.current && !this.current.pendingRemove) {
      const sound = this.current as AnySound;
      sound.setVolume(this.targetVolume);
    }
    if (persist) {
      AudioSettings.setVolume(this.targetVolume);
    }
  }

  /**
   * Globally mute/unmute every scene via the shared SoundManager and
   * persist the boolean.
   */
  public setMuted(muted: boolean): void {
    this.scene.sound.mute = muted;
    AudioSettings.setMuted(muted);
  }

  /**
   * Get the most recent target volume (post-clamp). Useful for UI that
   * wants to display the current value without going through the store.
   */
  public getTargetVolume(): number {
    return this.targetVolume;
  }

  /**
   * Clean up. The scene should call this from its `shutdown` handler so
   * that remnants of the previous scene's audio are reclaimed promptly.
   */
  public destroy(): void {
    this.stop();
  }

  /**
   * Release ownership of the current track WITHOUT stopping it, so it keeps
   * playing on the shared SoundManager after this scene shuts down (e.g.
   * battle music continuing into the game-over screen). The sound will be
   * faded out and destroyed later by the next scene's cross-fade.
   */
  public detach(): void {
    this.current = undefined;
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) {
    return 0;
  }
  return Math.max(0, Math.min(1, v));
}