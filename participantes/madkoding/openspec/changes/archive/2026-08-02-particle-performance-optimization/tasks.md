# Tasks: Particle & FX Performance

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~230 across 7 files |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |
| Decision needed before apply | Yes (single-pr requires size:exception) |

```text
Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low
```

Allocation-removal + buffer reshaping: small, localized edits; far under 400 lines; no chain needed.

## Phase 1: Per-file Refactors (independent, each compiles alone)

- [x] **T1 Starfield** (`src/fx/Starfield.ts`): Keep 2000-slot buffer; do NOT add capacity/cursor/updateRange. Replace `const arr = pos.array as Float32Array` with direct typed reads (e.g. `pos.getX/setX`) or a typed local; hoist redundant per-iteration `dx`/`dy`. Preserve exact recycle ranges and `dt*30` step; keep `needsUpdate = true`. **Accept**: `tsc` clean; no `as Float32Array` cast remains.
- [x] **T2 FoxTail** (`src/player/FoxTail.ts`): Replace 3 module `THREE.Color` constants with `Float32Array(3)` `LUT_HOT/LUT_MID/LUT_TIP`. Add `private static readonly _c = new THREE.Color()`. Per particle: `t<0.4` → lerp HOT→MID at `t/0.4`, else MID→TIP at `(t-0.4)/0.6`; write `_c.r/g/b` channels; `fade = 1 - t*0.7`; store `_c.* * fade`. Keep scatter formula verbatim; no `new Color` in update. **Accept**: `tsc` clean; zero `new Color`/`clone` in `update`; split point `t<0.4`, `1 - t*0.7` preserved.
- [x] **T3 ExplosionSystem** (`src/fx/ExplosionSystem.ts`): Drop `count` param from `spawnParticles` and both call sites; use module `PARTICLE_COUNT=80`. Change `Explosion.velocities` to `Float32Array` (80*3); allocate in `spawnParticles`; write velocities at `[i*3..i*3+2]`. Promote loop `new Color(0xffcc44)`/`new Color(0x330011)` to module `COLOR_MID`/`COLOR_TIP`. In `update`, read/write flat array; damping inline `*0.96`; jitter x/y only (never z). Keep `colorAttr.needsUpdate` in spawn only; `posAttr.needsUpdate` in update. **Accept**: `tsc` clean; no z-jitter; no `new Vector3`/`new Color` per frame.
- [x] **T4 HitSpark** (`src/fx/HitSpark.ts`): Add `private static readonly _scratchColor = new THREE.Color()`. Replace `baseColor.clone().multiplyScalar(randFloat(0.7,1))` with `_scratchColor.setHex(color)` then `colors[i*3]=_scratchColor.r*m; [..+1]=.g*m; [..+2]=.b*m`. Leave `update()` opacity-only as is. **Accept**: `tsc` clean; no `clone()` in spawn.
- [x] **T5 BackgroundShips** (`src/fx/BackgroundShips.ts`): Init `_positions` once in constructor as 4 `Vector3`s. Convert corvette loop to indexed `for (i...)`; replace `push(c.group.position.clone())` with `_positions[i].copy(c.group.position)`. Drop `_positions = []` reset. Keep `get positions()` unchanged. **Accept**: `tsc` clean; no `push`/`clone` in update.
- [x] **T6 EnemyTrail** (`src/enemies/EnemyTrail.ts`): Replace `history: Vector3[]` with `head: number` + `count: number`. Add `_scratchPositions`/`_scratchColors` Float32Array(480) in constructor. `start()`: pre-fill ring, write `startPos` in place, no clone. `update()`: advance `head=(head+1)%MAX`, write currentPos in place; two-pass copy ring→scratch (draw order newest→oldest)→`positions`/`colors`; fade `1-(idx/MAX)^2`; fill tail with oldest valid pos + zero color. `stop()`: `head=0; count=0`. Keep `setDrawRange(0,count)`. **Accept**: `tsc` clean; exact draw order (index 0 newest); no `unshift`/`clone`; no aliasing.
- [x] **T7 Projectile** (`src/weapons/Projectile.ts`): Add `private static readonly _scratchStep = new THREE.Vector3()`. In update: `_scratchStep.copy(this._velocity).multiplyScalar(dt); this.mesh.position.add(_scratchStep)`. **Accept**: `tsc` clean; no `clone()` per frame.

## Phase 2: Cross-cutting Verification

- [x] **T8 Verify**: `npm run build` + `npx tsc --noEmit` zero errors. Allocation scan: grep 7 files for `new THREE\.(Vector3|Color)`, `\.clone\(\)`, `\.push\(.*\.clone`, `\.unshift\(.*clone` inside `update(`/`spawn(` → zero hits. Visual A/B vs baseline pixel-identical; smoke-test one wave for ghosting/artifacts.

## Notes
- T1–T7 independent, each compiles alone; T8 runs last. Strict TS, no `any`. Pixel-identical.
