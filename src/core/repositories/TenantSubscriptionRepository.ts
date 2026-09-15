import type { TenantSubscription } from "@/core/entities";

/**
 * Tenant-scoped -- `getByTenantId` nunca devuelve la Subscription de otro tenant. `create`/
 * `update` quedan preparados para seed/onboarding futuro (§5 del ticket foundation); este PR no
 * expone ninguna mutación desde la UI todavía.
 */
export interface TenantSubscriptionRepository {
  getByTenantId(tenantId: string): Promise<TenantSubscription | null>;
  create(
    input: Omit<TenantSubscription, "id" | "createdAt" | "updatedAt">,
  ): Promise<TenantSubscription>;
  update(
    tenantId: string,
    input: Partial<Omit<TenantSubscription, "id" | "tenantId" | "createdAt" | "updatedAt">>,
  ): Promise<TenantSubscription>;
}
