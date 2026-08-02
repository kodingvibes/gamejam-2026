# Deployment decision

## Recommended prototype hosting

Run the existing Node entrypoint on one long-lived process:

```bash
npm ci
npm run build
npm start -- --host 0.0.0.0 --port 3000
```

This is the most reliable jam setup because the room server, health, scores,
respawn timers, and connected sockets intentionally live in one process. It also
keeps the static client and `/multiplayer` endpoint on one origin and one port.

The frontend can instead be hosted on Vercel with a separate long-lived game
server. Set the Vercel project Root Directory to `participantes/yhozen`, set
`VITE_MULTIPLAYER_URL` to the public game-server origin, and deploy. An `https`
origin is converted to `wss`, and `/multiplayer` is appended when no path is
provided. The client now detects stale connections, reconnects with exponential
backoff, rejoins its room, and shows round-trip latency in the HUD.

## Vercel Functions WebSockets

Vercel's current WebSocket documentation says Functions can accept WebSocket
connections through `experimental_upgradeWebSocket`. A socket stays pinned to
one Function instance only until that invocation reaches its maximum duration;
new players may reach other instances. Vercel therefore recommends Redis for
cross-instance room events and durable state. Local development of that API also
uses `vercel dev`, not this project's ordinary Vite middleware server.

That makes a direct Function port more than an HTTP upgrade change. A correct
production migration needs all of the following:

1. Adapt `/multiplayer` to `experimental_upgradeWebSocket`.
2. Store room membership, health, scores, cooldowns, and respawn deadlines in
   Redis with atomic updates.
3. Publish shots and snapshots across instances so every socket sees the room.
4. Rejoin and resynchronize after duration-driven disconnects; the client side
   of this behavior is already implemented.
5. Load-test the 20 Hz snapshot stream and set an appropriate Function maximum
   duration and region near Redis.

For this four-player feel prototype, a single long-lived Node game server avoids
cross-instance inconsistency and keeps the current deterministic room rules. A
Redis-backed Vercel Function adapter remains a production-networking follow-up,
not an unverified hosting shortcut.

Primary references checked on 2026-08-02:

- [WebSockets on Vercel Functions](https://vercel.com/docs/functions/websockets)
- [Vercel's WebSocket + Redis example](https://vercel.com/kb/guide/real-time-chat-websockets)
- [Function maximum duration](https://vercel.com/docs/functions/configuring-functions/duration)
- [General platform limits](https://vercel.com/docs/limits)

The last page still contains older language saying Functions cannot act as a
WebSocket server, while the newer June 2026 WebSocket guide documents the
experimental API. Treat the API as evolving and verify it with the current
Vercel CLI before replacing the long-lived server.
