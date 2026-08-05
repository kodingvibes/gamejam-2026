// ─── Game Constants ──────────────────────────────────────────────────────────

export const GAME = {
  TARGET_FPS: 60,
  MAX_DELTA: 1 / 30, // 33ms cap
  LEVEL_COUNT: 1,
} as const;

export const RAIL = {
  WAYPOINT_SPACING: 30,
  LATERAL_LIMIT: 12,
  VERTICAL_LIMIT: 7,
  LATERAL_LERP_SPEED: 5,
  VERTICAL_LERP_SPEED: 5,
  RAIL_SPEED: 8,
  RAIL_SPEED_BOSS: 4,
} as const;

export const CAMERA = {
  // Chase lag: higher = camera catches up faster (less parallax).
  // Lower = more lag, ship moves more within the frame (more parallax).
  CHASE_LAG: 3.5,
  CHASE_UP: 4.0,
  CHASE_BACK: 10,
  LOOK_AHEAD: 20,
  LOOK_UP: 2.0,
} as const;

export const PLAYER = {
  STARTING_HEALTH: 100,
  MAX_HEALTH: 100,
  STARTING_SHIELDS: 3,
  MAX_SHIELDS: 5,
  LATERAL_SPEED: 22,
  VERTICAL_SPEED: 16,
  INVINCIBILITY_TIME: 1.5,
  HITBOX_RADIUS: 1.5,
  // How far the ship can drift in screen NDC space (0..1). 0.85 lets it reach
  // near the window edges while still leaving a small safety margin.
  SCREEN_LIMIT: 0.88,
  // Response when following mouse / keyboard relative movement.
  // Lower = more inertia, smoother, less twitchy.
  SCREEN_LAG: 8,
  // How fast the keyboard target drifts across the screen (NDC/sec).
  // Lower = ship takes longer to reach the edge, feels more weighted.
  SCREEN_DRIFT_SPEED: 6,
} as const;

export const ENEMIES = {
  DRONE: {
    name: 'DRONE',
    health: 20,
    speed: 0.6,
    damage: 10,
    score: 100,
    size: 1,
    color: 0xcc2222,
  },
  SCOUT: {
    name: 'SCOUT',
    health: 15,
    speed: 0.9,
    damage: 8,
    score: 150,
    size: 0.8,
    color: 0x22cc44,
  },
  FIGHTER: {
    name: 'FIGHTER',
    health: 50,
    speed: 0.75,
    damage: 20,
    score: 300,
    size: 1.4,
    color: 0xff8800,
  },
  INTERCEPTOR: {
    name: 'INTERCEPTOR',
    health: 35,
    speed: 1,
    damage: 15,
    score: 250,
    size: 1.1,
    color: 0x00ccff,
  },
  BOMBER: {
    name: 'BOMBER',
    health: 120,
    speed: 0.4,
    damage: 40,
    score: 600,
    size: 2.2,
    color: 0xcc44ff,
  },
} as const;

export const BOSS = {
  MOTHERSHIP: {
    name: 'MOTHER',
    health: 2000,
    speed: 5,
    damage: 30,
    score: 5000,
    size: 8,
    color: 0xff2222,
    phases: 3,
  },
} as const;

export const FX = {
  HIT_SPARK_DURATION: 0.15,
  STARFIELD_COUNT: 1000,
  STARFIELD_DEPTH: 500,
} as const;

export const SCREEN = {
  DAMAGE_FLASH_DURATION: 0.15,
} as const;

export const COLORS = {
  BACKGROUND: 0x1a1a2e,
  FOG: 0x1a1a2e,
} as const;
