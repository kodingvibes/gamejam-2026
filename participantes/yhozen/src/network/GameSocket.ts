import {
  type ClientMessage,
  type PlayerState,
  type ServerMessage,
  type Vec3,
} from '../shared/protocol';
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  multiplayerUrl,
  reconnectDelayMs,
} from './connection';

type MessageHandler = (message: ServerMessage) => void;
export type NetworkState = 'connecting' | 'joining' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

export interface NetworkStatus {
  state: NetworkState;
  attempt?: number;
  retryInMs?: number;
  latencyMs?: number;
  message?: string;
}

type StatusHandler = (status: NetworkStatus) => void;

export class GameSocket {
  private socket: WebSocket | null = null;
  private readonly handlers = new Set<MessageHandler>();
  private readonly statusHandlers = new Set<StatusHandler>();
  private readonly closeOnPageHide = (): void => this.close();
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private reconnectAttempt = 0;
  private room = '';
  private name = '';
  private stopped = true;
  private lastPongAt = 0;
  private latencyMs: number | undefined;

  constructor(private readonly configuredUrl = import.meta.env.VITE_MULTIPLAYER_URL) {
    window.addEventListener('pagehide', this.closeOnPageHide);
  }

  connect(room: string, name: string): void {
    this.stopCurrentSocket();
    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.room = room;
    this.name = name;
    this.stopped = false;
    this.reconnectAttempt = 0;
    this.latencyMs = undefined;
    this.open();
  }

  private open(): void {
    if (this.stopped) return;
    this.emitStatus({
      state: this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting',
      attempt: this.reconnectAttempt || undefined,
    });

    let socket: WebSocket;
    try {
      socket = new WebSocket(multiplayerUrl(location, this.configuredUrl));
    } catch (error) {
      this.stopped = true;
      this.emitStatus({ state: 'error', message: error instanceof Error ? error.message : 'Invalid multiplayer URL.' });
      return;
    }
    this.socket = socket;

    socket.addEventListener('open', () => {
      if (this.socket !== socket || this.stopped) return;
      this.lastPongAt = performance.now();
      this.startHeartbeat();
      this.emitStatus({ state: 'joining', attempt: this.reconnectAttempt || undefined });
      this.send({ type: 'join', room: this.room, name: this.name });
    });
    socket.addEventListener('message', (event) => {
      if (this.socket !== socket || this.stopped) return;
      try {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        const receivedAt = performance.now();
        this.lastPongAt = receivedAt;
        if (message.type === 'pong' && typeof message.clientTime === 'number') {
          this.latencyMs = Math.max(0, Math.round(receivedAt - message.clientTime));
          this.emitStatus({ state: 'connected', latencyMs: this.latencyMs });
        }
        if (message.type === 'welcome') {
          this.reconnectAttempt = 0;
          this.emitStatus({ state: 'connected', latencyMs: this.latencyMs });
        }
        this.handlers.forEach((handler) => handler(message));
      } catch {
        this.emitStatus({ state: 'error', message: 'The server sent an invalid message.' });
      }
    });
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.stopHeartbeat();
      if (this.stopped) {
        this.emitStatus({ state: 'disconnected' });
      } else {
        this.scheduleReconnect();
      }
    });
    socket.addEventListener('error', () => {
      if (this.socket === socket && !this.stopped) {
        this.emitStatus({ state: 'error', message: 'Unable to reach the multiplayer server.' });
      }
    });
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  sendState(state: PlayerState): void {
    this.send({ type: 'state', state });
  }

  shoot(origin: Vec3, direction: Vec3, targetId?: string): void {
    this.send({ type: 'shot', origin, direction, targetId });
  }

  ping(clientTime = performance.now()): void {
    this.send({ type: 'ping', clientTime });
  }

  close(): void {
    this.stopped = true;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.stopCurrentSocket();
    this.emitStatus({ state: 'disconnected' });
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer !== null) return;
    const retryInMs = reconnectDelayMs(this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.emitStatus({ state: 'reconnecting', attempt: this.reconnectAttempt, retryInMs });
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, retryInMs);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      const socket = this.socket;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const now = performance.now();
      if (now - this.lastPongAt >= HEARTBEAT_TIMEOUT_MS) {
        socket.close(4_000, 'Heartbeat timeout');
        return;
      }
      this.ping(now);
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private stopCurrentSocket(): void {
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1_000, 'Client closing');
  }

  private emitStatus(status: NetworkStatus): void {
    this.statusHandlers.forEach((handler) => handler(status));
  }
}
