# Apply Progress: particle-performance-optimization

Status: **T1–T8 done** (batch 1 — fresh write)

Pure performance refactor across 7 files. Pixel-identical output preserved (no color, size, speed, opacity, timing, or coefficient changed). Strict TypeScript, no `any`. No commit / no PR created.

## Per-task status

- [x] **T1 Starfield** — `src/fx/Starfield.ts`
  Replaced `const arr = pos.array as Float32Array` (old line 41) with direct typed `BufferAttribute` reads/writes (`pos.getX/getY/getZ`, `pos.setX/setY/setZ`). Hoisted `px/py/pz` and `step = dt*30` out of the loop. Buffer kept at `FX.STARFIELD_COUNT` (2000); NO `capacity`/`cursor`/`updateRange` added. Exact recycle ranges (`dz>20 || |dx|>300 || |dy|>300`, `playerPos.x/y + randFloat(-300,300)`, `playerPos.z - randFloat(20, FX.STARFIELD_DEPTH)`) and `dt*30` step preserved verbatim. `needsUpdate = true` kept.

- [x] **T2 FoxTail** — `src/player/FoxTail.ts`
  Replaced 3 module `THREE.Color` constants (`COLOR_HOT/MID/TIP`) with module-level `Float32Array(3)` `LUT_HOT` (0xffffee), `LUT_MID` (0xff9933), `LUT_TIP` (0xff3311). Added `private static readonly _c = new THREE.Color()`. Per particle: `t < 0.4` → lerp HOT→MID at `t/0.4`, else MID→TIP at `(t-0.4)/0.6`, writing `_c.r/g/b`; `fade = 1 - t*0.7`; stored `_c.* * fade`. Continuous gradient — NO quantization LUT. Scatter formula `(i/TAIL_PARTICLES)*PI*2 + this.phase*0.5` preserved verbatim. Zero `new Color` in `update`.

- [x] **T3 ExplosionSystem** — `src/fx/ExplosionSystem.ts`
  Dropped `count` param from `spawnParticles` and both call sites (`spawn`, `spawnEpic`); module `PARTICLE_COUNT = 80`. `Explosion.velocities` changed `THREE.Vector3[]` → `Float32Array` (80*3), allocated in `spawnParticles`, written at `[i*3..i*3+2]`. Promoted per-loop `new Color(0xffcc44)`/`new Color(0x330011)` to module `COLOR_MID`/`COLOR_TIP`; also replaced per-spawn `new Color(color)` (line 61) and per-particle `new Color()` (line 72) with module scratch `_scratchBase`/`_scratchC` to keep the spawn body allocation-free. `update` reads/writes the flat array directly; damping inline `*0.96` (all three axes, matching old `multiplyScalar`); jitter on x/y ONLY — never z. `colorAttr.needsUpdate` set in spawn only; `posAttr.needsUpdate` in update. No `_scratchPos`.

- [x] **T4 HitSpark** — `src/fx/HitSpark.ts`
  Added `private static readonly _scratchColor = new THREE.Color()`. Replaced `baseColor.clone().multiplyScalar(randFloat(0.7,1))` with `_scratchColor.setHex(color)` then `colors[i*3] = _scratchColor.r*m; [+1] = .g*m; [+2] = .b*m` where `m = randFloat(0.7,1)`. `update()` left opacity-only as-is.

- [x] **T5 BackgroundShips** — `src/fx/BackgroundShips.ts`
  `_positions` initialized once in constructor as an array of 4 `Vector3` (matches corvette count). Corvette loop in `update` converted to indexed `for (let i = 0; i < this.corvettes.length; i++)`. Replaced `this._positions.push(c.group.position.clone())` with `this._positions[i].copy(c.group.position)`. Dropped `this._positions = []` reset. `get positions()` unchanged (still returns `THREE.Vector3[]`).

- [x] **T6 EnemyTrail** — `src/enemies/EnemyTrail.ts`
  Replaced `history: THREE.Vector3[]` with `head: number` + `count: number`. Added `_scratchPositions`/`_scratchColors` `Float32Array(MAX_TRAIL_POINTS*3)` (480 floats) allocated once at field init. `start()` pre-fills the ring (slots 0–2, `head`/`count` advanced), writing `startPos` in place (no clone). `update()` advances `head = (head+1) % MAX_TRAIL_POINTS`, writes `currentPos` in place; two-pass copy ring→scratch (draw order newest→oldest)→`positions`/`colors`; fade `1-(idx/MAX)^2`; tail filled with oldest valid position + zero color. `stop()` resets `head = 0; count = 0`. `setDrawRange(0, count)` kept. Exact draw order preserved (index 0 = newest).

- [x] **T7 Projectile** — `src/weapons/Projectile.ts`
  Added `private static readonly _scratchStep = new THREE.Vector3()`. In `update`: `Projectile._scratchStep.copy(this._velocity).multiplyScalar(dt); this.mesh.position.add(Projectile._scratchStep);`. Removes the per-frame `_velocity.clone().multiplyScalar(dt)` allocation chain.

- [x] **T8 Verify**
  - `npm run build` → PASS, zero errors (68 modules, built in 135ms; only the pre-existing chunk-size warning).
  - `npx tsc --noEmit` → PASS, exit 0, zero errors.
  - **Allocation scan** across the 7 files for `new THREE\.(Vector3|Color)`, `\.clone\(\)`, `\.push\(.*\.clone`, `\.unshift\(.*clone` inside `update(`/`spawn(` bodies → **zero hits**. The only remaining `new Vector3/Color`/`clone` occurrences are one-time module/field/constructor allocations (scratch pools, LUT colors, `Projectile._velocity`/`_prevPosition`, `BackgroundShips` constructor buffer, `Projectile.init` lookAt clone, `createCorvette` material clone) — none on the per-frame hot path.
  - Visual A/B and frame-time/GC spot-check are deferred to a runnable game session (out of scope for this apply batch).

## Notes
- No commit, no PR, no `git add`/`git commit` performed per batch constraints.
- Cross-cutting `needsUpdate` scoping honored exactly per design (Starfield/FoxTail/EnemyTrail set per-frame positions+colors; ExplosionSystem sets pos in update and color at spawn; HitSpark geometry set at spawn, opacity-only in update; BackgroundShips/Projectile N/A).
