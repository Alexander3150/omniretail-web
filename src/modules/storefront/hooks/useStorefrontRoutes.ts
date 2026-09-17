"use client";

import { useCallback } from "react";
import { usePublicTenant, useOptionalPublicTenant } from "@/modules/storefront/providers/PublicTenantProvider";

const segment = (value: string) => encodeURIComponent(value);

export function useStorefrontRoutes() {
  const { tenantSlug } = usePublicTenant();
  const base = `/tienda/${segment(tenantSlug)}`;
  return {
    home: useCallback(() => base, [base]), catalog: useCallback(() => `${base}/catalogo`, [base]),
    catalogCategory: useCallback((categoryId: string) => `${base}/catalogo?categoria=${segment(categoryId)}`, [base]),
    product: useCallback((id: string) => `${base}/catalogo/${segment(id)}`, [base]), offers: useCallback(() => `${base}/ofertas`, [base]),
    cart: useCallback(() => `${base}/carrito`, [base]), checkout: useCallback(() => `${base}/checkout`, [base]),
    register: useCallback(() => `${base}/registro`, [base]), login: useCallback(() => `${base}/iniciar-sesion`, [base]),
    forgotPassword: useCallback(() => `${base}/recuperar-contrasena`, [base]),
    resetPassword: useCallback((token: string) => `${base}/restablecer-contrasena/${segment(token)}`, [base]),
    account: useCallback(() => `${base}/cuenta`, [base]), accountOrders: useCallback(() => `${base}/cuenta/pedidos`, [base]),
    accountAddresses: useCallback(() => `${base}/cuenta/direcciones`, [base]),
    accountPaymentMethods: useCallback(() => `${base}/cuenta/metodos-pago`, [base]),
    accountProfile: useCallback(() => `${base}/cuenta/perfil`, [base]),
    accountSecurity: useCallback(() => `${base}/cuenta/seguridad`, [base]),
    accountSupport: useCallback(() => `${base}/cuenta/soporte`, [base]),
    accountOrder: useCallback((id: string) => `${base}/cuenta/pedidos/${segment(id)}`, [base]),
    confirmation: useCallback((trackingToken?: string) => trackingToken
      ? `${base}/pedido/confirmacion/${segment(trackingToken)}`
      : `${base}/pedido/confirmacion`, [base]),
    tracking: useCallback((token: string) => `${base}/pedido/seguimiento/${segment(token)}`, [base]),
    help: useCallback(() => `${base}/ayuda`, [base]),
    branches: useCallback(() => `${base}/sucursales`, [base]),
  };
}


export function useOptionalStorefrontRoutes() {
  const tenant = useOptionalPublicTenant();
  const tenantSlug = tenant?.tenantSlug;
  const base = tenantSlug ? `/tienda/${encodeURIComponent(tenantSlug)}` : null;
  return useCallback(() => {
    if (!base) return null;
    return {
      home: () => base,
      catalog: () => `${base}/catalogo`,
      catalogCategory: (categoryId: string) => `${base}/catalogo?categoria=${segment(categoryId)}`,
      product: (id: string) => `${base}/catalogo/${segment(id)}`,
      offers: () => `${base}/ofertas`,
      cart: () => `${base}/carrito`,
      checkout: () => `${base}/checkout`,
      register: () => `${base}/registro`,
      login: () => `${base}/iniciar-sesion`,
      forgotPassword: () => `${base}/recuperar-contrasena`,
      resetPassword: (token: string) => `${base}/restablecer-contrasena/${segment(token)}`,
      account: () => `${base}/cuenta`,
      accountOrders: () => `${base}/cuenta/pedidos`,
      accountAddresses: () => `${base}/cuenta/direcciones`,
      accountPaymentMethods: () => `${base}/cuenta/metodos-pago`,
      accountProfile: () => `${base}/cuenta/perfil`,
      accountSecurity: () => `${base}/cuenta/seguridad`,
      accountSupport: () => `${base}/cuenta/soporte`,
      accountOrder: (id: string) => `${base}/cuenta/pedidos/${segment(id)}`,
      confirmation: (trackingToken?: string) => trackingToken
        ? `${base}/pedido/confirmacion/${segment(trackingToken)}`
        : `${base}/pedido/confirmacion`,
      tracking: (token: string) => `${base}/pedido/seguimiento/${segment(token)}`,
      help: () => `${base}/ayuda`,
      branches: () => `${base}/sucursales`,
    };
  }, [base])();
}
