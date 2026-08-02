# Particle & FX Performance Invariants

## Purpose

Define the non-behavioral performance contract for the game's particle and FX subsystems. Modifications to any of the listed hot-path files MUST preserve these invariants. The contract is intentionally non-behavioral: visible game output is expected to remain pixel-identical to the pre-optimization baseline.

> Source delta: `openspec/changes/particle-performance-optimization/spec.md` (CAPABILITIES: None — pure perf refactor).

## Scope

The invariants in this spec apply to the following 7 files:

- `src/fx/Starfield.ts`
- `src/player/FoxTail.ts`
- `src/fx/ExplosionSystem.ts`
- `src/fx/HitSpark.ts`
- `src/fx/BackgroundShips.ts`
- `src/enemies/EnemyTrail.ts`
- `src/weapons/Projectile.ts`

## Requirements

### Requirement: Performance invariants preserved

The refactor MUST NOT change any observable gameplay or visual output. All behavior and rendered pixels MUST remain identical to the pre-change baseline. The system MUST eliminate per-frame allocations in the listed hot paths and MUST preserve strict TypeScript compilation.

The scope of this invariant is the 7 files modified by this change: `src/fx/Starfield.ts`, `src/player/FoxTail.ts`, `src/fx/ExplosionSystem.ts`, `src/fx/HitSpark.ts`, `src/fx/BackgroundShips.ts`, `src/enemies/EnemyTrail.ts`, `src/weapons/Projectile.ts`.

#### Scenario: Build and type-check pass

- GIVEN the refactored source
- WHEN `npm run build` and `npx tsc --noEmit` are executed
- THEN both complete with zero errors
- AND no `any` is introduced without justification (strict TS preserved)

#### Scenario: No per-frame allocations in hot paths

- GIVEN the `update()`/per-frame methods of the 7 in-scope files
- WHEN the source is inspected via code review / static analysis
- THEN no `new Vector3`, `new Color`, `clone()`, or array `push`/`unshift` allocation occurs on the per-frame path
- AND pre-allocated scratch `Vector3`/`Color`/`Float32Array` members are reused across frames

#### Scenario: Pixel-identical output

- GIVEN a pre-change visual baseline (screenshot/A-B reference)
- WHEN the refactored build renders the same scene/inputs
- THEN rendered output is pixel-identical to baseline
- AND no color, size, speed, opacity, or timing value is altered

#### Scenario: No stale- or ghost-data artifacts

- GIVEN the refactored `Starfield` sparse buffer and `EnemyTrail` circular pool
- WHEN running the game
- THEN no visual ghosting, stale particles, or missing trail segments appear versus baseline
- AND index recycling (`mod`-based) and circular buffer write-over do not expose stale state
