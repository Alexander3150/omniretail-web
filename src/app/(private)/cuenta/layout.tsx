"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import { Tabs } from "@/shared/components/Tabs";

const SECTIONS = [
  { value: "/cuenta/perfil", label: "Perfil", permission: "customer.account.read" },
  { value: "/cuenta/direcciones", label: "Direcciones", permission: "customer.address.manage" },
  { value: "/cuenta/metodos-pago", label: "Métodos de pago", permission: "customer.payment_method.manage" },
  { value: "/cuenta/pedidos", label: "Mis pedidos", permission: "storefront.orders.read" },
];

export default function CuentaLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { hasPermission } = useCurrentSession();

  // Mismo criterio que Sidebar (isNavigationItemActive/hasPermission): un
  // tab cuyo permiso no esta concedido ni siquiera se muestra, aunque
  // RequirePermission ya lo bloquearia igual si se navegara ahi a mano.
  const visibleSections = SECTIONS.filter((section) => hasPermission(section.permission));

  if (visibleSections.length === 0) {
    return <div className="min-w-0 space-y-5">{children}</div>;
  }

  const activeValue =
    visibleSections.find((section) => pathname.startsWith(section.value))?.value ??
    visibleSections[0].value;

  return (
    <div className="min-w-0 space-y-5">
      <Tabs items={visibleSections} onChange={(value) => router.push(value)} value={activeValue} />
      {children}
    </div>
  );
}
