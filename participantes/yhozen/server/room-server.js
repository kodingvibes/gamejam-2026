/**
 * A tiny, deliberately dependency-free authoritative room layer.  It accepts
 * WebSocket-shaped connections (send(), on('message'), on('close')) but keeps
 * the game rules separate so it can be tested without opening a port.
 */

export const MULTIPLAYER_PATH = '/multiplayer';
export const MAX_PLAYERS_PER_ROOM = 4;
export const MAX_MESSAGE_BYTES = 8 * 1024;
export const STATE_RATE_HZ = 20;
export const SHOT_COOLDOWN_MS = 350;
export const PLAYER_HEALTH = 100;
export const SHOT_DAMAGE = 34;
export const RESPAWN_DELAY_MS = 2_000;
export const SCORE_TO_WIN = 5;

const VECTOR_LIMIT = 10_000;
const ROOM_PATTERN = /^[A-Za-z0-9_-]{1,16}$/;
const NAME_PATTERN = /^[^\u0000-\u001f]{1,20}$/;
const EMPTY_STATE = Object.freeze({
  position: [0, 1, 0],
  velocity: [0, 0, 0],
  rotation: [0, 0, 0]
});

export const GAME_CONFIG = Object.freeze({
  maxPlayers: MAX_PLAYERS_PER_ROOM,
  stateRateHz: STATE_RATE_HZ,
  shotCooldownMs: SHOT_COOLDOWN_MS,
  playerHealth: PLAYER_HEALTH,
  shotDamage: SHOT_DAMAGE,
  respawnDelayMs: RESPAWN_DELAY_MS,
  scoreToWin: SCORE_TO_WIN
});

function cloneState(state = EMPTY_STATE) {
  return {
    position: [...state.position],
    velocity: [...state.velocity],
    rotation: [...state.rotation]
  };
}

function isVector(value) {
  return Array.isArray(value)
    && value.length === 3
    && value.every((part) => typeof part === 'number' && Number.isFinite(part) && Math.abs(part) <= VECTOR_LIMIT);
}

function isState(value) {
  return Boolean(value)
    && typeof value === 'object'
    && isVector(value.position)
    && isVector(value.velocity)
    && isVector(value.rotation);
}

function normalizeRawMessage(raw) {
  if (typeof raw === 'string') return raw;
  if (raw instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw))) {
    return new TextDecoder().decode(raw);
  }
  return null;
}

function parseMessage(raw) {
  const text = normalizeRawMessage(raw);
  if (text === null || new TextEncoder().encode(text).byteLength > MAX_MESSAGE_BYTES) return null;
  try {
    const message = JSON.parse(text);
    return message && typeof message === 'object' && !Array.isArray(message) ? message : null;
  } catch {
    return null;
  }
}

function defaultIdFactory() {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

function cleanRoom(value) {
  return typeof value === 'string' && ROOM_PATTERN.test(value) ? value.toUpperCase() : null;
}

function cleanName(value) {
  return typeof value === 'string' && NAME_PATTERN.test(value.trim()) ? value.trim() : null;
}

/** A serializable safe view.  Never expose sockets or cooldown timestamps. */
export function snapshotPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    health: player.health,
    score: player.score,
    alive: player.alive,
    ...cloneState(player.state)
  };
}

/**
 * Validates client state before it enters a room. Kept exported for client-free
 * deterministic tests and any future WebRTC transport.
 */
export function validateClientMessage(message) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return false;
  switch (message.type) {
    case 'join': return Boolean(cleanRoom(message.room) && cleanName(message.name));
    case 'state': return isState(message.state);
    case 'shot': return isVector(message.origin) && isVector(message.direction)
      && (message.targetId === undefined || (typeof message.targetId === 'string' && message.targetId.length <= 48));
    case 'ping': return message.clientTime === undefined || (typeof message.clientTime === 'number' && Number.isFinite(message.clientTime));
    default: return false;
  }
}

export class RoomServer {
  constructor({ now = () => Date.now(), idFactory = defaultIdFactory } = {}) {
    this.now = now;
    this.idFactory = idFactory;
    this.clients = new Map();
    this.rooms = new Map();
    this.snapshotTimer = null;
  }

  /** Register a WebSocket-compatible peer. It must send a `join` message first. */
  connect(socket) {
    const id = this.allocateId();
    const client = { id, socket, roomId: null, player: null };
    this.clients.set(id, client);
    if (socket?.on) {
      socket.on('message', (raw) => this.receive(id, raw));
      socket.on('close', () => this.disconnect(id));
      socket.on('error', () => this.disconnect(id));
    }
    return id;
  }

  allocateId() {
    let id = this.idFactory();
    while (this.clients.has(id)) id = this.idFactory();
    return id;
  }

  receive(clientId, raw) {
    const client = this.clients.get(clientId);
    if (!client) return false;
    const message = parseMessage(raw);
    if (!message || !validateClientMessage(message)) {
      this.send(client, { type: 'error', code: 'INVALID_MESSAGE', message: 'Malformed multiplayer message.' });
      return false;
    }
    if (message.type === 'join') return this.join(client, message);
    if (!client.player) {
      this.send(client, { type: 'error', code: 'NOT_JOINED', message: 'Join a room before playing.' });
      return false;
    }
    if (message.type === 'state') return this.updateState(client, message.state);
    if (message.type === 'shot') return this.shot(client, message);
    this.send(client, { type: 'pong', clientTime: message.clientTime, serverTime: this.now() });
    return true;
  }

  join(client, message) {
    const roomId = cleanRoom(message.room);
    const name = cleanName(message.name);
    if (!roomId || !name) return false;
    if (client.player) this.leaveRoom(client);
    const room = this.rooms.get(roomId) ?? { id: roomId, players: new Map() };
    if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
      this.send(client, { type: 'error', code: 'ROOM_FULL', message: 'This room already has four players.' });
      return false;
    }
    this.rooms.set(roomId, room);
    const player = {
      id: client.id,
      name,
      state: cloneState(),
      health: PLAYER_HEALTH,
      score: 0,
      alive: true,
      lastShotAt: -Infinity,
      respawnAt: null
    };
    client.roomId = roomId;
    client.player = player;
    room.players.set(player.id, player);
    this.send(client, {
      type: 'welcome', playerId: player.id, room: roomId,
      players: [...room.players.values()].map(snapshotPlayer), config: GAME_CONFIG
    });
    this.broadcast(room, { type: 'peerJoined', player: snapshotPlayer(player) }, player.id);
    return true;
  }

  updateState(client, state) {
    if (!client.player.alive) return false;
    client.player.state = cloneState(state);
    return true;
  }

  shot(client, message) {
    const player = client.player;
    const now = this.now();
    if (!player.alive) return false;
    if (now - player.lastShotAt < SHOT_COOLDOWN_MS) {
      this.send(client, { type: 'error', code: 'SHOT_COOLDOWN', message: 'Weapon is cooling down.' });
      return false;
    }
    player.lastShotAt = now;
    const room = this.rooms.get(client.roomId);
    this.broadcast(room, { type: 'shot', playerId: player.id, origin: [...message.origin], direction: [...message.direction], timestamp: now });
    // Hit detection is deliberately presentation/physics-owned for this prototype.
    // A claimed target is accepted only if it is an alive peer in the same room.
    if (message.targetId && message.targetId !== player.id) {
      const target = room.players.get(message.targetId);
      if (target?.alive) this.damage(room, player, target);
    }
    return true;
  }

  damage(room, source, target) {
    target.health = Math.max(0, target.health - SHOT_DAMAGE);
    this.broadcast(room, { type: 'damage', targetId: target.id, sourceId: source.id, amount: SHOT_DAMAGE, health: target.health });
    if (target.health > 0) return;
    target.alive = false;
    target.respawnAt = this.now() + RESPAWN_DELAY_MS;
    source.score += 1;
    const score = { type: 'score', playerId: source.id, score: source.score };
    if (source.score >= SCORE_TO_WIN) score.winnerId = source.id;
    this.broadcast(room, score);
  }

  tick() {
    const now = this.now();
    for (const room of this.rooms.values()) {
      for (const player of room.players.values()) {
        if (!player.alive && player.respawnAt !== null && now >= player.respawnAt) {
          player.alive = true;
          player.health = PLAYER_HEALTH;
          player.state = cloneState();
          player.respawnAt = null;
          this.broadcast(room, { type: 'respawn', playerId: player.id, state: cloneState(player.state), health: player.health });
        }
      }
    }
  }

  broadcastSnapshots() {
    const timestamp = this.now();
    for (const room of this.rooms.values()) {
      this.broadcast(room, { type: 'snapshot', players: [...room.players.values()].map(snapshotPlayer), timestamp });
    }
  }

  startSnapshotLoop() {
    this.stopSnapshotLoop();
    this.snapshotTimer = setInterval(() => {
      this.tick();
      this.broadcastSnapshots();
    }, 1_000 / STATE_RATE_HZ);
    return this.snapshotTimer;
  }

  stopSnapshotLoop() {
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    this.snapshotTimer = null;
  }

  disconnect(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return false;
    this.leaveRoom(client);
    this.clients.delete(clientId);
    return true;
  }

  leaveRoom(client) {
    const room = client.roomId && this.rooms.get(client.roomId);
    if (!room || !client.player) return;
    room.players.delete(client.player.id);
    this.broadcast(room, { type: 'peerLeft', playerId: client.player.id });
    if (room.players.size === 0) this.rooms.delete(room.id);
    client.roomId = null;
    client.player = null;
  }

  broadcast(room, message, exceptId) {
    if (!room) return;
    for (const player of room.players.values()) {
      if (player.id !== exceptId) this.send(this.clients.get(player.id), message);
    }
  }

  send(client, message) {
    if (!client?.socket?.send) return;
    try { client.socket.send(JSON.stringify(message)); } catch { this.disconnect(client.id); }
  }

  destroy() {
    this.stopSnapshotLoop();
    this.clients.clear();
    this.rooms.clear();
  }
}

/**
 * Hooks a `ws` WebSocketServer into a Node HTTP server without importing ws.
 * Usage in the app entrypoint: attachWebSocketServer(new WebSocketServer({server,
 * path: MULTIPLAYER_PATH})).startSnapshotLoop().
 */
export function attachWebSocketServer(webSocketServer, options) {
  const rooms = new RoomServer(options);
  webSocketServer.on('connection', (socket) => rooms.connect(socket));
  return rooms;
}
