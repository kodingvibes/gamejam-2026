import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_PLAYERS_PER_ROOM,
  PLAYER_HEALTH,
  RESPAWN_DELAY_MS,
  RoomServer,
  SHOT_COOLDOWN_MS,
  SHOT_DAMAGE,
} from '../server/room-server.js';

class FakeSocket {
  constructor() { this.handlers = new Map(); this.messages = []; }
  on(name, handler) { this.handlers.set(name, handler); }
  send(message) { this.messages.push(JSON.parse(message)); }
  emit(name, payload) { this.handlers.get(name)?.(payload); }
  take(type) { return this.messages.filter((message) => message.type === type); }
}

function setup() {
  let time = 1_000;
  let sequence = 0;
  const server = new RoomServer({ now: () => time, idFactory: () => `p${++sequence}` });
  const sockets = [new FakeSocket(), new FakeSocket()];
  const ids = sockets.map((socket) => server.connect(socket));
  sockets.forEach((socket, index) => socket.emit('message', JSON.stringify({ type: 'join', room: 'test', name: `Player ${index + 1}` })));
  return { server, sockets, ids, advance(milliseconds) { time += milliseconds; } };
}

test('joins a room and limits it to four players', () => {
  const { server, sockets } = setup();
  assert.equal(sockets[0].take('welcome')[0].room, 'TEST');
  for (let index = 0; index < 3; index += 1) {
    const socket = new FakeSocket();
    const id = server.connect(socket);
    server.receive(id, JSON.stringify({ type: 'join', room: 'TEST', name: `Extra ${index}` }));
  }
  const full = new FakeSocket();
  const fullId = server.connect(full);
  server.receive(fullId, JSON.stringify({ type: 'join', room: 'TEST', name: 'Too many' }));
  assert.equal(server.rooms.get('TEST').players.size, MAX_PLAYERS_PER_ROOM);
  assert.equal(full.take('error')[0].code, 'ROOM_FULL');
});

test('rejects malformed or oversized packets', () => {
  const { server, sockets, ids } = setup();
  assert.equal(server.receive(ids[0], '{nope'), false);
  assert.equal(server.receive(ids[0], 'x'.repeat(9_000)), false);
  assert.equal(sockets[0].take('error').at(-1).code, 'INVALID_MESSAGE');
});

test('enforces shot cooldown, damage, score, and deterministic respawn', () => {
  const { server, sockets, ids, advance } = setup();
  const shot = { type: 'shot', origin: [0, 1, 0], direction: [0, 0, -1], targetId: ids[1] };
  server.receive(ids[0], JSON.stringify(shot));
  assert.equal(server.rooms.get('TEST').players.get(ids[1]).health, PLAYER_HEALTH - SHOT_DAMAGE);
  server.receive(ids[0], JSON.stringify(shot));
  assert.equal(sockets[0].take('error').at(-1).code, 'SHOT_COOLDOWN');
  advance(350); server.receive(ids[0], JSON.stringify(shot));
  advance(350); server.receive(ids[0], JSON.stringify(shot));
  assert.equal(server.rooms.get('TEST').players.get(ids[1]).alive, false);
  assert.equal(server.rooms.get('TEST').players.get(ids[0]).score, 1);
  advance(RESPAWN_DELAY_MS); server.tick();
  assert.equal(server.rooms.get('TEST').players.get(ids[1]).health, PLAYER_HEALTH);
  assert.equal(sockets[0].take('respawn').length, 1);
});

test('publishes validated states and removes disconnected peers', () => {
  const { server, sockets, ids } = setup();
  server.receive(ids[0], JSON.stringify({ type: 'state', state: { position: [3, 2, 1], velocity: [1, 0, 0], rotation: [0, 1, 0] } }));
  server.broadcastSnapshots();
  assert.deepEqual(sockets[1].take('snapshot').at(-1).players.find((player) => player.id === ids[0]).position, [3, 2, 1]);
  server.disconnect(ids[1]);
  assert.equal(sockets[0].take('peerLeft').at(-1).playerId, ids[1]);
});

test('declares the first player to five eliminations as winner', () => {
  const { server, sockets, ids, advance } = setup();
  const shot = { type: 'shot', origin: [0, 1, 0], direction: [0, 0, -1], targetId: ids[1] };

  for (let elimination = 1; elimination <= 5; elimination += 1) {
    for (let hit = 0; hit < 3; hit += 1) {
      server.receive(ids[0], JSON.stringify(shot));
      advance(SHOT_COOLDOWN_MS);
    }
    assert.equal(server.rooms.get('TEST').players.get(ids[0]).score, elimination);
    if (elimination < 5) {
      advance(RESPAWN_DELAY_MS);
      server.tick();
    }
  }

  assert.equal(sockets[0].take('score').at(-1).winnerId, ids[0]);
});
