"use client";

import { useCallback } from "react";
import { usePublicTenant } from "@/modules/storefront/providers/PublicTenantProvider";

const segment = (value: string) => encodeURIComponent(value);

export function useStorefrontRoutes() {
  const { tenantSlug } = usePublicTenant();
  const base = `/tienda/${segment(tenantSlug)}`;
  return {
    home: useCallback(() => base, [base]), catalog: useCallback(() => `${base}/catalogo`, [base]),
    product: useCallback((id: string) => `${base}/catalogo/${segment(id)}`, [base]), offers: useCallback(() => `${base}/ofertas`, [base]),
    cart: useCallback(() => `${base}/carrito`, [base]), checkout: useCallback(() => `${base}/checkout`, [base]),
    register: useCallback(() => `${base}/registro`, [base]), login: useCallback(() => `${base}/iniciar-sesion`, [base]),
    account: useCallback(() => `${base}/cuenta`, [base]), accountOrders: useCallback(() => `${base}/cuenta/pedidos`, [base]),
    accountAddresses: useCallback(() => `${base}/cuenta/direcciones`, [base]),
    accountPaymentMethods: useCallback(() => `${base}/cuenta/metodos-pago`, [base]),
    accountProfile: useCallback(() => `${base}/cuenta/perfil`, [base]),
    accountSecurity: useCallback(() => `${base}/cuenta/seguridad`, [base]),
    accountSupport: useCallback(() => `${base}/cuenta/soporte`, [base]),
    accountOrder: useCallback((id: string) => `${base}/cuenta/pedidos/${segment(id)}`, [base]),
    tracking: useCallback((token: string) => `${base}/pedido/seguimiento/${segment(token)}`, [base]),
    help: useCallback(() => `${base}/ayuda`, [base]),
    branches: useCallback(() => `${base}/sucursales`, [base]),
  };
}
