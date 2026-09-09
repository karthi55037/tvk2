import { EventEmitter } from 'node:events';

export type RealtimeEvent = {
  type: 'notification' | 'chat' | 'refresh';
  topic?: string; // e.g. "chat:CLASS:class", "assignment:<id>"
  payload?: Record<string, unknown>;
};

declare global {
  // eslint-disable-next-line no-var
  var __csebBus: EventEmitter | undefined;
}

function bus(): EventEmitter {
  if (!globalThis.__csebBus) {
    const e = new EventEmitter();
    e.setMaxListeners(0);
    globalThis.__csebBus = e;
  }
  return globalThis.__csebBus;
}

/** Publish to a specific user's stream. */
export function publishToUser(userId: string, event: RealtimeEvent) {
  bus().emit(`user:${userId}`, event);
}

/** Publish to every connected client (safe, non-sensitive refresh hints only). */
export function publishAll(event: RealtimeEvent) {
  bus().emit('all', event);
}

export function subscribe(userId: string, onEvent: (e: RealtimeEvent) => void): () => void {
  const u = (e: RealtimeEvent) => onEvent(e);
  const a = (e: RealtimeEvent) => onEvent(e);
  bus().on(`user:${userId}`, u);
  bus().on('all', a);
  return () => {
    bus().off(`user:${userId}`, u);
    bus().off('all', a);
  };
}
