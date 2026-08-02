# Skatefire prototype playtest

## Verdict

**GO.** Phaser 3, Enable3D, Three.js, and Ammo run together in development and
production. The recoil-skateboard loop is readable and fun, the required
two-player flow passes, and both independent Terra reviewers rate every feel
category at least 4/5 after fixes.

## Build and compatibility evidence

Final pass run on `2026-08-01` in the Conductor Amazon Linux cloud workspace:

- Phaser `3.90.0`, Enable3D `0.26.1`, Three `0.171.0`, and Ammo initialize in
  the production-compatible Vite app.
- `npm test`: 11/11 deterministic tests passed.
- `npm run build`: TypeScript and Vite production build passed. Vite reports
  only its non-blocking large-chunk advisory for the game-engine bundle.
- The production Node entrypoint served the app and `/multiplayer` on one port.
- Ammo JS/WASM, generated assets, and `/favicon.svg` returned HTTP 200.
- Browser console and page errors were empty apart from expected engine banners.
- `window.__gameTest` was ready only with `?testMode=1` and absent in normal mode.
- Pointer lock worked, and `Esc` released it.

## Gameplay measurements

| Gate | Browser result |
| --- | --- |
| Spawn safety | All four headings face center; the 1.4 s push regression stayed grounded and inside the arena |
| Push | Soft cap reached at approximately 18 m/s while retaining momentum |
| Brake | Independent repeat 1: 10.41→0.52 m/s; repeat 2: 9.30→0.53 m/s in 450 ms |
| Forward shot | Bullet aimed toward `-Z`; board received approximately `+1.99 m/s` on `Z` |
| Downward shot | At pitch `-1.40`, vertical velocity gained `+0.97 m/s` in 16 ms after gravity |
| Redirect | Side-aimed fire changed lateral velocity and replicated to the peer |
| Combat | Three 34-damage hits changed 100 HP to 0 and awarded one point |
| Respawn | Defeated client returned to 100 HP after approximately two seconds |
| Networking | Two browser clients observed position, aim, shots, damage, score, death, and respawn |
| Interpolation | Remote movement stayed coherent through the 100 ms snapshot buffer |
| First to five | Deterministic server test emitted the winner on the fifth elimination |

Both independent testers intentionally accelerated, braked, redirected with
shots, and voluntarily used recoil for traversal within two minutes.

## Four-player performance

One fresh browser renderer plus three live 20 Hz raw-WebSocket riders kept
`remoteCount: 3` through a continuous ten-second `requestAnimationFrame` audit:

| Window | Render FPS |
| --- | ---: |
| Seconds 1–10 | 60, 60, 60, 60, 60, 60, 60, 60, 60, 60 |
| Overall | 60.09 |
| Phaser `actualFps` at completion | 60.13 |

Earlier repeated CDP polling included Phaser's rolling warm-up history and
reported a transient low value even while frames were rendering. The continuous
rAF audit measures the actual presentation cadence without that probe artifact.

Performance safeguards now include one instanced draw for the procedural park,
prewarmed pooled remote rider meshes, shared remote materials/geometries,
allocation-free interpolation frames after warm-up, and 10 Hz HUD text updates.
Physics, camera movement, controls, and particles continue at the render cadence.

## Tuning used

| Setting | Value |
| --- | ---: |
| Combined rider/board mass | 80 kg |
| Push force | 900 N |
| Brake force | 1,200 N, integrated as `force × frame time` and stop-capped |
| Soft speed cap | 18 m/s |
| Ollie impulse | 300 N·s |
| Recoil impulse | 160 N·s |
| Wheel grip | 18 |
| Steering | 0.42 |
| Base FOV | 76° |
| Camera motion | 0.14 |
| Remote interpolation buffer | 100 ms |
| 3D internal pixel ratio | 0.32 |

The lower 3D backing resolution is a software/integrated-GPU safeguard. The
Phaser HUD stays at full CSS resolution and remains crisp over the upscaled world.

## Independent Terra verification

| Reviewer | Movement | Recoil clarity | Fun | Camera comfort | Verdict |
| --- | ---: | ---: | ---: | ---: | --- |
| Implementation/diff reviewer | 5/5 | 5/5 | 4/5 | 4/5 | GO |
| Two-player browser reviewer | 4/5 | 4/5 | 4/5 | 4/5 | GO |

Both reviewers began with `agent-browser --help`, used isolated browser sessions,
and confirmed clean console, errors, and network output. Their initial findings
were fixed and retested: outward-facing spawn, boundary escape, contact-dependent
braking, favicon 404, remote resource hitches, and static draw-call overhead.

## Visual evidence

- [Lobby invite UX over generated art](playtest/evidence/lobby.png)
- [In-arena recoil coaching and readability pass](playtest/evidence/recoil-coaching.png)
- [Arena with three remote riders](playtest/evidence/four-player-arena.png)
- [Concrete texture in a 2×2 tiled preview](playtest/evidence/concrete-2x2.png)

The concrete preview has no edge seams. Repetition is visible at this deliberately
small test scale, but at the arena's 8×8 UV repeat it reads as an even surface.

## 2026-08-02 review and networking follow-up

The mandatory post-push review identified generated Ammo loader code as project
code. The follow-up removes all three checked-in Emscripten artifacts. Vite now
serves and emits a matched loader/WASM set from exact locked npm dependencies;
development and production returned HTTP 200 for `ammo.js`, `ammo.wasm.js`, and
`ammo.wasm.wasm`, and both reached `window.__gameTest.ready` with live physics.

The same pass brought one deferred production concern forward without pretending
the in-memory server is globally durable:

- Heartbeat/pong latency appears in the HUD, with a 15-second stale-connection
  timeout.
- Disconnects use jittered exponential backoff capped at 30 seconds and rejoin
  the current room instead of ejecting the rider to the lobby.
- A real server stop showed `reconnecting`; restart restored `connected`, state
  snapshots, and a measured heartbeat without a page reload.
- A separate `VITE_MULTIPLAYER_URL` supports a static frontend plus long-lived
  game server, while `DEPLOYMENT.md` records the Redis requirement for a future
  multi-instance Vercel Functions port.
- The lobby now copies a clean room invite, the arena teaches the three core
  recoil directions, rider count is visible, and brighter fill/fog improves ramp
  silhouettes without adding shadows or geometry.

The deterministic suite now passes 14/14 tests. A fresh two-browser run confirmed
join, 20 Hz movement propagation, remote fire, 34 damage, recoil velocity, and
heartbeat latency for both players. After the lighting change, a continuous
five-second `requestAnimationFrame` sample measured 60.18 FPS with Phaser at
60.08 FPS in the single-renderer audit.
