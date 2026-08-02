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
  RAIL_SPEED: 12,
  RAIL_SPEED_BOSS: 6,
} as const;

export const PLAYER = {
  STARTING_HEALTH: 100,
  MAX_HEALTH: 100,
  STARTING_SHIELDS: 3,
  MAX_SHIELDS: 5,
  LATERAL_SPEED: 15,
  VERTICAL_SPEED: 15,
  INVINCIBILITY_TIME: 1.5,
  HITBOX_RADIUS: 1.5,
} as const;

export const ENEMIES = {
  DRONE: {
    name: 'DRONE',
    health: 20,
    speed: 15,
    damage: 10,
    score: 100,
    size: 1,
    color: 0xff4444,
  },
  SCOUT: {
    name: 'SCOUT',
    health: 15,
    speed: 22,
    damage: 8,
    score: 150,
    size: 0.8,
    color: 0x44ffaa,
  },
  FIGHTER: {
    name: 'FIGHTER',
    health: 50,
    speed: 18,
    damage: 20,
    score: 300,
    size: 1.4,
    color: 0xff8844,
  },
  INTERCEPTOR: {
    name: 'INTERCEPTOR',
    health: 35,
    speed: 25,
    damage: 15,
    score: 250,
    size: 1.1,
    color: 0x44aaff,
  },
  BOMBER: {
    name: 'BOMBER',
    health: 120,
    speed: 10,
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
  STARFIELD_COUNT: 2000,
  STARFIELD_DEPTH: 500,
} as const;

export const SCREEN = {
  DAMAGE_FLASH_DURATION: 0.15,
} as const;

export const COLORS = {
  BACKGROUND: 0x0a0a1a,
  FOG: 0x0a0a1a,
} as const;
