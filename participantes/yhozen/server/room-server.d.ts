import type { WebSocketServer } from 'ws';

export const MULTIPLAYER_PATH: '/multiplayer';

export interface RoomServerHandle {
  startSnapshotLoop(): ReturnType<typeof setInterval>;
  stopSnapshotLoop(): void;
  destroy(): void;
}

export function attachWebSocketServer(
  webSocketServer: WebSocketServer,
  options?: { now?: () => number; idFactory?: () => string },
): RoomServerHandle;
