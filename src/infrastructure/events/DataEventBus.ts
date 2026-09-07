import type { DataEventName, DataEventPayload } from "@/core/types/events.types";

type DataEventListener = (payload: DataEventPayload) => void;

export class DataEventBus {
  private readonly listeners = new Map<DataEventName, Set<DataEventListener>>();

  subscribe(event: DataEventName, listener: DataEventListener): () => void {
    const eventListeners = this.listeners.get(event) ?? new Set<DataEventListener>();
    eventListeners.add(listener);
    this.listeners.set(event, eventListeners);
    return () => this.unsubscribe(event, listener);
  }

  unsubscribe(event: DataEventName, listener: DataEventListener): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: DataEventName, payload: DataEventPayload = {}): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }
}
