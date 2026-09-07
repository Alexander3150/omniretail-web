import type { DataEventName, DataEventPayload } from "@/core/types/events.types";
import type { DataEventBus } from "@/infrastructure/events/DataEventBus";
import type { MockDatabase } from "@/infrastructure/mock/database/MockDatabase";
import type { MockDatabaseStore } from "@/infrastructure/mock/database/MockDatabaseStore";

export abstract class BaseMockRepository {
  constructor(
    protected readonly store: MockDatabaseStore,
    protected readonly eventBus: DataEventBus,
  ) {}

  protected now(): string {
    return new Date().toISOString();
  }

  protected id(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  protected emit(event: DataEventName, payload: DataEventPayload): void {
    this.eventBus.emit(event, payload);
  }

  protected missing(entity: string, id: string): Error {
    return new Error(`${entity} not found: ${id}`);
  }

  protected updateById<T extends { id: string; updatedAt?: string }>(
    table: T[],
    id: string,
    input: Partial<Omit<T, "id" | "createdAt" | "updatedAt">>,
    entityName: string,
  ): T {
    const index = table.findIndex((item) => item.id === id);
    if (index < 0) throw this.missing(entityName, id);
    const current = table[index];
    const updated = { ...current, ...input, updatedAt: this.now() } as T;
    table[index] = updated;
    return updated;
  }

  protected read<T>(selector: (database: MockDatabase) => T): T {
    return this.store.read(selector);
  }
}
