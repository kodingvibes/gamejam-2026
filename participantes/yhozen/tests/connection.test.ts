import assert from 'node:assert/strict';
import test from 'node:test';
import {
  multiplayerUrl,
  RECONNECT_MAX_DELAY_MS,
  reconnectDelayMs,
} from '../src/network/connection';

const localLocation = {
  href: 'http://localhost:3000/?room=TEST',
  host: 'localhost:3000',
  protocol: 'http:',
};

test('uses the same host and secure WebSocket protocol by default', () => {
  assert.equal(multiplayerUrl(localLocation), 'ws://localhost:3000/multiplayer');
  assert.equal(multiplayerUrl({
    href: 'https://skatefire.example/?room=TEST',
    host: 'skatefire.example',
    protocol: 'https:',
  }), 'wss://skatefire.example/multiplayer');
});

test('normalizes a separately hosted multiplayer endpoint', () => {
  assert.equal(
    multiplayerUrl(localLocation, 'https://rooms.example'),
    'wss://rooms.example/multiplayer',
  );
  assert.equal(
    multiplayerUrl(localLocation, 'wss://rooms.example/custom-socket'),
    'wss://rooms.example/custom-socket',
  );
  assert.throws(() => multiplayerUrl(localLocation, 'ftp://rooms.example'), /VITE_MULTIPLAYER_URL/);
});

test('backs reconnects off exponentially with bounded jitter and cap', () => {
  assert.equal(reconnectDelayMs(0, 0.5), 1_000);
  assert.equal(reconnectDelayMs(1, 0.5), 2_000);
  assert.equal(reconnectDelayMs(0, 0), 800);
  assert.equal(reconnectDelayMs(0, 1), 1_200);
  assert.equal(reconnectDelayMs(20, 0.5), RECONNECT_MAX_DELAY_MS);
});
