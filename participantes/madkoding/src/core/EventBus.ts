// ─── Typed Event Bus ──────────────────────────────────────────────────────────

import { GameEvent, EventPayloads } from '../types/events';

type Listener<T = unknown> = (payload: T) => void;

export class EventBus {
  private static instance: EventBus;
  private listeners = new Map<string, Set<Listener>>();

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  on<E extends GameEvent>(event: E, listener: Listener<EventPayloads[E]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as Listener);
  }

  off<E extends GameEvent>(event: E, listener: Listener<EventPayloads[E]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener as Listener);
      if (set.size === 0) this.listeners.delete(event);
    }
  }

  emit<E extends GameEvent>(event: E, payload: EventPayloads[E]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const listener of set) {
        listener(payload);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
