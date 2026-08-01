export interface TuningValues {
  pushForce: number;
  brakeForce: number;
  steering: number;
  grip: number;
  recoilImpulse: number;
  baseFov: number;
  cameraMotion: number;
}

export const TUNING_DEFAULTS: TuningValues = {
  pushForce: 900,
  brakeForce: 1_200,
  steering: 0.42,
  grip: 18,
  recoilImpulse: 160,
  baseFov: 76,
  cameraMotion: 0.14,
};

export const PLAYER_MASS = 80;
export const SOFT_SPEED_CAP = 18;
export const OLLIE_IMPULSE = 300;
export const SHOT_RANGE = 60;
export const SHOT_COOLDOWN_MS = 350;
export const STATE_SEND_INTERVAL_MS = 50;
export const REMOTE_INTERPOLATION_BUFFER_MS = 100;

export const SPAWN_POINTS = [
  [-12, 2.5, -12],
  [12, 2.5, 12],
  [-12, 2.5, 12],
  [12, 2.5, -12],
] as const;

export function loadTuning(): TuningValues {
  try {
    const stored = JSON.parse(localStorage.getItem('skatefire-tuning') ?? '{}') as Partial<TuningValues>;
    return { ...TUNING_DEFAULTS, ...stored };
  } catch {
    return { ...TUNING_DEFAULTS };
  }
}

export function saveTuning(values: TuningValues): void {
  localStorage.setItem('skatefire-tuning', JSON.stringify(values));
}
