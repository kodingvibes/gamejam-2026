import { MULTIPLAYER_PATH } from '../shared/protocol';

export const HEARTBEAT_INTERVAL_MS = 5_000;
export const HEARTBEAT_TIMEOUT_MS = 15_000;
export const RECONNECT_BASE_DELAY_MS = 1_000;
export const RECONNECT_MAX_DELAY_MS = 30_000;

interface BrowserLocation {
  href: string;
  host: string;
  protocol: string;
}

export function reconnectDelayMs(attempt: number, randomValue = Math.random()): number {
  const finiteAttempt = Number.isFinite(attempt) ? attempt : 0;
  const exponent = Math.max(0, Math.min(20, Math.floor(finiteAttempt)));
  const cappedDelay = Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * (2 ** exponent));
  const jitter = 0.8 + Math.min(1, Math.max(0, randomValue)) * 0.4;
  return Math.round(cappedDelay * jitter);
}

export function multiplayerUrl(current: BrowserLocation, configuredUrl?: string): string {
  if (!configuredUrl?.trim()) {
    const protocol = current.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${current.host}${MULTIPLAYER_PATH}`;
  }

  const url = new URL(configuredUrl.trim(), current.href);
  if (url.protocol === 'http:') url.protocol = 'ws:';
  if (url.protocol === 'https:') url.protocol = 'wss:';
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error('VITE_MULTIPLAYER_URL must use ws, wss, http, or https.');
  }
  if (url.pathname === '/' || url.pathname === '') url.pathname = MULTIPLAYER_PATH;
  return url.toString();
}
