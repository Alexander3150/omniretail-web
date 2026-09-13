import { OrderStatus } from "@/core/enums";

export type OrderTransitionOwner = "generic" | "picking" | "dispatch";

const transitions: Record<OrderTransitionOwner, ReadonlySet<string>> = {
  generic: new Set([
    transition(OrderStatus.pending, OrderStatus.confirmed),
    ...Object.values(OrderStatus)
      .filter((status) => status !== OrderStatus.cancelled && status !== OrderStatus.delivered)
      .map((status) => transition(status, OrderStatus.cancelled)),
  ]),
  picking: new Set([
    transition(OrderStatus.confirmed, OrderStatus.preparing),
    transition(OrderStatus.preparing, OrderStatus.picking),
    transition(OrderStatus.picking, OrderStatus.ready_for_dispatch),
    transition(OrderStatus.picking, OrderStatus.ready_for_pickup),
  ]),
  dispatch: new Set([transition(OrderStatus.ready_for_dispatch, OrderStatus.dispatched)]),
};

export function assertOrderStatusTransition(
  current: OrderStatus,
  next: OrderStatus,
  owner: OrderTransitionOwner,
): void {
  if (current === next) return;
  if (!transitions[owner].has(transition(current, next))) {
    throw new Error(`Order transition ${current} -> ${next} is not owned by ${owner}`);
  }
}

function transition(current: OrderStatus, next: OrderStatus): string {
  return `${current}->${next}`;
}
