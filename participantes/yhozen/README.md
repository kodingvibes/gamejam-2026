# Skatefire — Yhozen · GameJam 2026

Skatefire is a multiplayer first-person skateboard shooter. Every shot applies
the same physical impulse opposite the bullet: fire backward to accelerate,
forward to brake, sideways to redirect, or downward to lift.

The prototype uses Phaser for scenes and the 2D HUD, Enable3D/Three.js for the
first-person world, Ammo for an 80 kg four-contact raycast skateboard, and a raw
WebSocket room server. Vite and multiplayer share one Node process and one port.

## Run it

Node.js 20.19 or newer is required (Conductor Cloud currently provides Node 24).

```bash
npm ci
npm run dev -- --host 0.0.0.0 --port 3000
```

Open `http://localhost:3000/?room=ABCD&name=Player`. Share that URL with up to
three other players. The WebSocket endpoint is `/multiplayer` on the same host.

Controls:

- `W` push, `S` brake, `A/D` carve, `Space` ollie.
- Mouse independently aims; click once for pointer lock and click again to fire.
- `C` recenters aim toward the board heading; `Esc` releases pointer lock.
- `F3` opens live physics/camera tuning. Arrow keys edit values and `R` resets.

Tuning is stored temporarily in `localStorage`. Reduced-motion preferences turn
off camera roll and speed lines while limiting FOV changes.

## Verify it

```bash
npm test
npm run build
npm start -- --host 0.0.0.0 --port 3000
```

The deterministic suite covers recoil direction, cooldown, damage, room limits,
malformed packets, snapshots, scoring, disconnects, and respawns. `npm start`
serves the production `dist/` bundle and multiplayer server together.

For browser automation, append `testMode=1`. Once Ammo and the arena are ready,
`window.__gameTest` exposes local/remote state, scripted input, firing, received
shot counters, and timed advancement. It is never exposed in normal play.

## Architecture

- `src/scenes/`: preload, lobby, Phaser HUD, and the Enable3D arena.
- `src/physics/`: raw Ammo `btRaycastVehicle` skateboard controller.
- `src/network/` and `src/shared/`: browser transport and typed wire protocol.
- `server/`: same-port Vite/static server plus authoritative room combat rules.
- `public/lib/`: Ammo runtime files required by `.withPhysics('/lib')`.
- `public/assets/`: generated atmosphere and material images; gameplay geometry,
  reticles, particles, trails, and collision remain code-native.
- `PLAYTEST.md`: measured browser evidence, tuning, ratings, and verdict.

The server owns rooms, health, shot cadence, scoring, and respawns. Local physics
remains client-authoritative for immediate controls; production anti-cheat,
authoritative server physics, matchmaking, accounts, and persistence are
intentionally deferred.

## Conductor Cloud

Set the repository Cloud Computer setup script to:

```bash
bash participantes/yhozen/scripts/setup.sh
```

Then forward only the selected game port (for example `3000`). The setup script
runs non-interactively from the repository root and installs the locked packages
inside this participant directory. No extra system packages, copied secrets, or
second server port are required.

All work for this entry stays under `participantes/yhozen/`, and all commits use
Conventional Commits as required by `AGENTS.md`.
