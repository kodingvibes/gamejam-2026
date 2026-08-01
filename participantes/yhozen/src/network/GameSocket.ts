import {
  MULTIPLAYER_PATH,
  type ClientMessage,
  type PlayerState,
  type ServerMessage,
  type Vec3,
} from '../shared/protocol';

type MessageHandler = (message: ServerMessage) => void;
type StatusHandler = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;

export class GameSocket {
  private socket: WebSocket | null = null;
  private readonly handlers = new Set<MessageHandler>();
  private readonly statusHandlers = new Set<StatusHandler>();
  private readonly closeOnPageHide = (): void => this.close();

  constructor() {
    window.addEventListener('pagehide', this.closeOnPageHide);
  }

  connect(room: string, name: string): void {
    this.close();
    this.emitStatus('connecting');
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.socket = new WebSocket(`${protocol}//${location.host}${MULTIPLAYER_PATH}`);
    this.socket.addEventListener('open', () => {
      this.emitStatus('connected');
      this.send({ type: 'join', room, name });
    });
    this.socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        this.handlers.forEach((handler) => handler(message));
      } catch {
        this.emitStatus('error');
      }
    });
    this.socket.addEventListener('close', () => this.emitStatus('disconnected'));
    this.socket.addEventListener('error', () => this.emitStatus('error'));
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
    this.socket?.close();
    this.socket = null;
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private emitStatus(status: Parameters<StatusHandler>[0]): void {
    this.statusHandlers.forEach((handler) => handler(status));
  }
}
