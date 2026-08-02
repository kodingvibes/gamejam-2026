# Design: Particle & FX Performance Optimization

## Overview

Pure perf refactor across 7 hot-path files. Replace per-frame `new Vector3`/`Color`/`clone()`/`push`/`unshift` allocations with pre-allocated scratch members and reusable `Float32Array` storage. `EnemyTrail` swaps the `Vector3[]` ring for an in-place circular buffer over the existing `Float32Array` (no shift/copy, ring head index). `ExplosionSystem` pre-allocates a flat `velocities` array per spawn and drops the dead `count` param. `FoxTail` keeps its CONTINUOUS gradient (no quantization LUT) computed via a static scratch `Color`. `Starfield` keeps its existing 2000-slot buffer and only drops the redundant cast. The other files get targeted inline fixes. Constraint: pixel-identical output, strict TS, no `any`.

## Per-file Design

### 1. `src/fx/Starfield.ts` — keep buffer sizing, remove the `as Float32Array` cast

Current: 2000-slot buffer, full sweep every frame, `needsUpdate = true` always.

**Design (minimal, honest):**
- **Do NOT resize the buffer.** Keep it at exactly `FX.STARFIELD_COUNT` (2000) slots. Do NOT add a `capacity` or `cursor` member — they would be dead state (never written, never read).
- **Do NOT add `updateRange`.** At full count it is a no-op; it provides no upload win.
- Constructor: keep the existing per-star random init unchanged.
- `update(dt, playerPos)`: keep the loop identical — for every `i` in `[0, FX.STARFIELD_COUNT)`: `arr[i*3+2] += dt*30`; recycle with the exact current math (`dz > 20 || |dx| > 300 || |dy| > 300` → `playerPos.x + randFloat(-300,300)`, `.y + randFloat(-300,300)`, `playerPos.z - randFloat(20, FX.STARFIELD_DEPTH)`). Keep `pos.needsUpdate = true` (positions genuinely change every frame).
- **Only real change:** remove the `as Float32Array` cast on line 41 (`const arr = pos.array as Float32Array;` → read directly off the typed `BufferAttribute`, e.g. `pos.getX(i)` / `pos.setX(...)` or a typed local) and tighten the loop to avoid the redundant per-iteration `dx`/`dy` recomputation when it can be hoisted. The upload is and remains the full 2000-slot array; the gain here is modest and is NOT a sparse-upload win. Do not over-claim.
- Pixel-identical output; the exact respawn ranges and movement step are preserved.

### 2. `src/player/FoxTail.ts` — continuous color math, zero per-frame alloc

Current: 80× `new THREE.Color()` per frame, double `lerpColors` chain.

**Design:**
- Replace the 3 `THREE.Color` module constants (`COLOR_HOT`, `COLOR_MID`, `COLOR_TIP`) with three static module-level `Float32Array(3)` RGB constants (`LUT_HOT`, `LUT_MID`, `LUT_TIP`) holding the same r/g/b as today.
- Do NOT use a discrete quantization LUT — that would introduce a (small but real) visual deviation. Keep the EXACT continuous math, but compute it without allocating `new Color` per particle:
  - Reuse one module-level scratch `THREE.Color` (`private static readonly _c = new THREE.Color();`).
  - In `update`, for each particle: if `t < 0.4`, lerp `LUT_HOT → LUT_MID` at `t / 0.4`; else lerp `LUT_MID → LUT_TIP` at `(t - 0.4) / 0.6`. Write each channel as `_c.r = mix(...)`, `_c.g = mix(...)`, `_c.b = mix(...)` (linear interp identical to `lerpColors`), then `fade = 1 - t * 0.7` and store `_c.r * fade`, etc. into the color array.
  - The scatter formula `(i / TAIL_PARTICLES) * PI * 2 + this.phase * 0.5` is preserved verbatim.
- Member: `private static readonly _c = new THREE.Color();` plus the three `Float32Array(3)` constants, all initialized once at module load.
- `needsUpdate = true` on both `position` and `color` (both genuinely change every frame — correct to set).
- Strict TS: no `any`; direct channel arithmetic avoids `noUncheckedIndexedAccess` index-guard friction.
- This preserves the continuous gradient EXACTLY (same split point `t < 0.4`, same interpolation endpoints) with zero per-frame `new Color`.

### 3. `src/fx/ExplosionSystem.ts` — scratch + drop dead param

Current: `spawnParticles(pos, size, color, count, duration)` always called with `count=80` (lines 42, 48); inside, `count` is unused (constant `PARTICLE_COUNT = 80` shadows it). Per-spawn: 1× `new Color(color)` + 80× `new Vector3` + 80× `new Color` inside the loop.

**Design:**
- Drop the `count` parameter from `spawnParticles` and from both call sites (`spawn` and `spawnEpic`). Use the constant `PARTICLE_COUNT = 80` declared once at module scope (was inline).
- Change the `Explosion` interface field `velocities` from `THREE.Vector3[]` to `Float32Array` (size `80 * 3`). The interface already has `color: THREE.Color` (not `baseColor`). Because `Explosion` objects are created per-spawn in `spawnParticles` (not pooled — the ObjectPool pools `Points` only), allocate the `velocities` Float32Array there in `spawnParticles` (spawn is NOT per-frame, so one array per spawn is acceptable).
- In `spawnParticles`: `color.setHex(spawnColor)` reusing the existing interface `color` field (no `new Color` per spawn beyond the loop constants). The two `new THREE.Color(0xffcc44)` / `new THREE.Color(0x330011)` inside the loop become module-level `static readonly COLOR_MID` / `static readonly COLOR_TIP`, initialized once.
- Per-particle velocity: write directly into the flat `velocities` Float32Array at `[i*3..i*3+2]` using `Math.sin(phi) * Math.cos(theta) * pSpeed`, etc. No `new Vector3`, no `push`.
- In `update`: read/write the flat `velocities` array directly: `positions[j*3] += velocities[j*3] * dt;` etc. Damping becomes inline `velocities[j*3] *= 0.96;` etc. **Preserve the current jitter exactly**: jitter is applied ONLY to x and y (`velocities[j*3] += (Math.random()-0.5)*dt*4` and `velocities[j*3+1] += ...`), NEVER to z — do NOT add z-jitter.
- `needsUpdate`: `posAttr.needsUpdate = true` stays in `update()` (positions change every frame). `colorAttr.needsUpdate = true` is already set once in `spawnParticles` (line 91) and stays there — `update()` does NOT set `colorAttr.needsUpdate` today, so there is nothing to remove. Leave it as is.
- Strict TS: `velocities: Float32Array` (was `THREE.Vector3[]`) — type signature change is internal-only, no external callers.

### 4. `src/fx/HitSpark.ts` — inline setRGB

Current: per-particle `baseColor.clone().multiplyScalar(randFloat(0.7, 1))`.

**Design:**
- Module-level scratch: `private static readonly _scratchColor = new THREE.Color();`.
- In `spawn`, replace:
  ```ts
  const baseColor = new THREE.Color(color);
  ...
  const c = baseColor.clone();
  c.multiplyScalar(THREE.MathUtils.randFloat(0.7, 1));
  colors[i*3] = c.r; ...
  ```
  with:
  ```ts
  _scratchColor.setHex(color);
  ...
  const m = THREE.MathUtils.randFloat(0.7, 1);
  colors[i*3]     = _scratchColor.r * m;
  colors[i*3 + 1] = _scratchColor.g * m;
  colors[i*3 + 2] = _scratchColor.b * m;
  ```
  Bit-identical math (Color.multiplyScalar does component-wise multiply on r/g/b — same result as `r*m, g*m, b*m`).
- `HitSpark` is per-spawn-allocated, not per-frame; this fix primarily removes the `clone()` allocation, not a per-frame loop allocation. Still in-scope per the proposal.
- `needsUpdate`: position/color/size `needsUpdate = true` is set once at spawn time; `update()` only touches `material.opacity` (no geometry `needsUpdate`), so nothing to remove there — leave as is.

### 5. `src/fx/BackgroundShips.ts` — pre-allocated position buffer

Current: `this._positions = []; this._positions.push(c.group.position.clone());` per corvette per frame (4× per frame).

**Design:**
- Replace the `private _positions: THREE.Vector3[]` with a pre-allocated `private _positions: THREE.Vector3[]` initialized once in the constructor: `this._positions = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];` (sized 4, matches corvette count).
- In `update`, replace the reset+push pattern with in-place writes: `this._positions[i].copy(c.group.position);` — no allocation, no `clone()`.
- Drop the `this._positions = []` line — the buffer is fixed-size.
- Strict TS: array size is fixed by constructor init, indexed by `corvette` loop index (matches current `for (const c of this.corvettes)` — convert to indexed loop for typed access: `for (let i = 0; i < this.corvettes.length; i++)`).
- Public getter `get positions(): THREE.Vector3[]` unchanged — same API surface, same consumer (`WaveManager`).

### 6. `src/enemies/EnemyTrail.ts` — circular buffer over Float32Array

Current: `Vector3[] history`; `unshift(clone())` per update; `start()` does 3× clone; loop then copies history into `positions[]`.

**Design:**
- Remove `private history: THREE.Vector3[]`. Add:
  - `private head: number = 0;` — index of the newest entry in the ring (advances on each push).
  - `private count: number = 0;` — number of valid entries (<= `MAX_TRAIL_POINTS`).
- `start(startPos)`: pre-fill ring — for `i = 0..2`, `head = i; count = i+1;` and write `startPos` directly into the ring slot (no clone — write `positions[(i) * 3 + 0..2]` directly via the Float32Array backing store, then mirror into a ring slot lookup array or compute on the fly in `update`). Concrete: since the loop in `update` needs to read the ring in draw order (newest → oldest), iterate `(head - k + MAX_TRAIL_POINTS) % MAX_TRAIL_POINTS`.
- `update(dt, currentPos)`:
  - Push: `head = (head + 1) % MAX_TRAIL_POINTS;` then write `currentPos.x/y/z` into `positions[head*3..+2]` (in-place, no clone). If `count < MAX_TRAIL_POINTS`, increment `count`.
  - Loop `idx = 0..MAX_TRAIL_POINTS - 1`:
    - If `idx < count`: ring index = `(head - idx + MAX_TRAIL_POINTS) % MAX_TRAIL_POINTS`; read `positions[ring*3..]` directly; apply fade `1 - (idx / MAX_TRAIL_POINTS)` squared and write into the OUTPUT slot `idx` (i.e., `positions[idx*3..]`).
    - Else: write the oldest valid position (history[count-1] equivalent — the ring slot at `(head - count + 1 + MAX_TRAIL_POINTS) % MAX_TRAIL_POINTS`) with zero color.
  - This **preserves exact draw order**: index 0 in the rendered line = newest, last index = oldest, mirroring the current `unshift` semantics.
- `needsUpdate = true` on position + color; `setDrawRange(0, count)` unchanged.
- `stop()`: reset `head = 0; count = 0;`.
- The ring and the output draw buffer are the SAME Float32Array — when we read from ring slot `r` and write to draw slot `idx`, we do it in two passes to avoid read/write aliasing:
  - **Pass 1 (positions)**: compute ring-index→draw-index mapping, copy via a small local two-element swap buffer OR use a second scratch Float32Array of size `MAX_TRAIL_POINTS * 3` (cheap — 480 floats, allocated once in constructor). The scratch approach is simpler and avoids any aliasing.
  - Add `private readonly _scratchPositions = new Float32Array(MAX_TRAIL_POINTS * 3);` and `private readonly _scratchColors = new Float32Array(MAX_TRAIL_POINTS * 3);`. Copy ring → scratch (by draw order), then memcpy scratch → `positions` / `colors`.
  - Bit-identical output: the geometry sees the same draw-order positions as the old code.
- Strict TS: `head` and `count` are `number`; modulo math uses `|0` no-op cast where needed.

### 7. `src/weapons/Projectile.ts` — scratch velocity vector

Current: `this.mesh.position.add(this._velocity.clone().multiplyScalar(dt));` per active projectile per frame.

**Design:**
- Add `private static readonly _scratchStep = new THREE.Vector3();`.
- In `update`: `this._scratchStep.copy(this._velocity).multiplyScalar(dt); this.mesh.position.add(this._scratchStep);`.
- Removes the per-frame `clone()` allocation (and the per-frame `multiplyScalar` returns a new `Vector3` chain in the old code, which throws away the clone immediately — `_velocity.clone().multiplyScalar(dt)` returns a brand-new object each frame).
- Behavior is bit-identical: `add` does `this.x += v.x; this.y += v.y; this.z += v.z` on the mesh position; the new code produces the same numeric inputs.
- Strict TS: no new types — just a static scratch member.

## Cross-cutting rules

- **`needsUpdate` scoping**: set ONLY when the buffer genuinely changed since last upload. `Starfield.update` (positions every frame) ✓; `FoxTail.update` (positions + colors every frame) ✓; `ExplosionSystem.update` sets `posAttr.needsUpdate` every frame (positions change) ✓ and `spawnParticles` sets `colorAttr.needsUpdate` once at spawn ✓ — leave both as they already are, no removal; `HitSpark.spawn` sets position/color/size `needsUpdate` once ✓ and `update` touches only material opacity (no geometry) — leave as is; `BackgroundShips` — N/A (no geometry); `EnemyTrail.update` (positions + colors every frame the timer fires) ✓; `Projectile.update` — N/A (mesh.position only, no buffer).
- **Strict TS**: no `any`. Type changes (`Explosion.velocities: Float32Array`) are internal-only. Use `Float32Array` (not `number[]`) for hot arrays. Indexed access uses `|0` clamps where needed for `noUncheckedIndexedAccess` if it's on.
- **Pixel identity**: every per-particle coefficient, gradient split point (`t < 0.4` → `t - 0.4 / 0.6`), `randFloat` range, `THREE.MathUtils.lerpColors` linear interp, scatter formula, fade exponent, `Math.sin/cos` frequencies, and `0.96` velocity damping are preserved verbatim. `FoxTail` keeps the CONTINUOUS gradient (no quantization). `ExplosionSystem` preserves jitter on x/y only (never z). The only behavioral surface change is allocation removal — no math is altered.

## Verification Strategy

1. **Build + type-check**: `npm run build` and `npx tsc --noEmit` both return zero errors. (Spec scenario.)
2. **Static allocation scan**: grep across the 7 files for `new THREE\.Vector3`, `new THREE\.Color`, `\.clone\(\)`, `\.push\(.*\.clone`, `\.unshift\(.*clone` inside any `update(` or `spawn(` body — must return zero hits post-refactor. (Spec scenario.)
3. **Visual A/B**: capture a baseline screenshot + a 5-second screen recording of starfield, fox-tail, explosion, hit-spark, background corvettes, enemy trails, and projectiles in flight (a representative gameplay segment with at least 2 enemies, 1 explosion, several projectiles, 3+ trails active). After refactor: re-capture the same scenario. Pixel-diff (e.g., `ffmpeg` SSIM or `magick compare -metric AE`) must report `0` or near-`0` within noise tolerance. (Spec scenario.)
4. **Frame-time spot-check**: Chrome DevTools Performance recording, 10-second sample — confirm no `Major GC` events attributable to the 7 files (compare GC pause count to baseline).
5. **Smoke test loop**: `npm run dev`, play one wave, watch for: ghost stars beyond view, trail segments jumping, explosion particles missing, projectile drift, missing fox-tail particles. (Spec scenario: "No stale- or ghost-data artifacts".)

## Rollback

Single commit, 7 files. `git revert HEAD` returns to baseline. No API surface change → safe.

## Open Questions

None. All seven file designs are deterministic and grounded in the current code.