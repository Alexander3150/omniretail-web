"use client";

import { useEffect } from "react";
import type { DataEventName, DataEventPayload } from "@/core/types/events.types";
import { useDataEventBus } from "@/infrastructure/providers/RepositoryProvider";

export function useDataEvent(event: DataEventName, listener: (payload: DataEventPayload) => void) {
  const eventBus = useDataEventBus();

  useEffect(() => eventBus.subscribe(event, listener), [event, eventBus, listener]);
}
