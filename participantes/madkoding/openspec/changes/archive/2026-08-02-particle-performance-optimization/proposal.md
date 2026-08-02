# Proposal: Particle & FX Performance Optimization

## Intent

Eliminate per-frame garbage collection (GC) pressure and redundant GPU buffer re-uploads in the particle/FX systems. The hot game loop allocates temporary `Vector3`/`Color` objects hundreds of times per frame (`FoxTail` ×80, `ExplosionSystem` ×160, `Projectile` every frame, etc.), and `Starfield` re-uploads the full 2000-point buffer every frame. No visual or gameplay change — this is a pure performance refactor to remove GC hitches and reduce per-frame CPU/GPU work.

## Scope

### In Scope
- `src/fx/Starfield.ts` — large static buffer (e.g. 6000) + `mod`-based index recycling instead of full array rewrite every frame.
- `src/player/FoxTail.ts` — precompute hot→mid→tip gradient into a lookup `Float32Array`; apply fade inline; remove per-particle `new THREE.Color()`.
- `src/fx/ExplosionSystem.ts` — reuse scratch `Vector3`/`Color`; remove dead `count` param (lines 51–55, always 80).
- `src/fx/HitSpark.ts` — replace `baseColor.clone().multiplyScalar()` with inline `setRGB` + scratch color.
- `src/fx/BackgroundShips.ts` — pre-allocated `Vector3` buffer written directly (line 157) instead of `push(clone())`.
- `src/enemies/EnemyTrail.ts` — circular Vector3 pool / flat arrays instead of `history.unshift(clone())` (line 66) and `start()` triple clone.
- `src/weapons/Projectile.ts` — scratch vector instead of `this._velocity.clone().multiplyScalar(dt)` (line 93).

### Out of Scope
- Any visual, color, size, speed, opacity, or timing change (pixel-identical output).
- Any Three.js version bump (locked r160).
- Shadow, IBL, bloom, post-processing, or lighting changes.
- Any file outside `participantes/madkoding/src/` (multi-tenant repo constraint).

## Capabilities

> Contract with sdd-spec. No spec-level behavior change: this is a pure performance refactor; all outputs are pixel-identical.

### New Capabilities
None

### Modified Capabilities
None

## Approach

- Replace hot-loop allocations with pre-allocated scratch `Vector3`/`Color`/`Float32Array` members and static color lookups.
- `Starfield`: pre-size buffer to ~6000; maintain a cursor and recycle slots via `mod` to keep uploads sparse/localized.
- `EnemyTrail`: swap `unshift/clone` for a fixed circular buffer over the existing `Float32Array`.
- Preserve `needsUpdate` only where buffers genuinely change; keep strict TypeScript (no `any` without justification).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/fx/Starfield.ts` | Modified | Static buffer + index recycling |
| `src/player/FoxTail.ts` | Modified | Color lookup table, no per-frame alloc |
| `src/fx/ExplosionSystem.ts` | Modified | Scratch objects, drop dead `count` param |
| `src/fx/HitSpark.ts` | Modified | Inline `setRGB` scratch |
| `src/fx/BackgroundShips.ts` | Modified | Pre-allocated position buffer |
| `src/enemies/EnemyTrail.ts` | Modified | Circular history pool |
| `src/weapons/Projectile.ts` | Modified | Scratch velocity vector |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Off-by-one in index recycling | Med | Keep visual snapshot before/after for A/B comparison |
| Sparse buffer leaves stale/visual ghosting | Low | Verify starfield & trail output unchanged via run |

## Rollback Plan

Revert the single commit; all changes are localized to the 7 listed files with no API-surface change, so rollback is a clean `git revert`. Keep a pre-change screenshot reference for visual parity check.

## Dependencies

- None (pure refactor, Three.js r160 already pinned).

## Success Criteria

- [ ] `npm run build` passes
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] Per-frame allocations in the 7 files reduced to ~0 (no `new Vector3`/`Color` in hot `update()` loops)
- [ ] Rendering is pixel-identical to pre-change baseline (visual A/B check)
