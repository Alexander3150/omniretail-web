"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Tabs } from "@/shared/components/Tabs";

const SECTIONS = [
  { value: "/cuenta/perfil", label: "Perfil" },
  { value: "/cuenta/direcciones", label: "Direcciones" },
  { value: "/cuenta/metodos-pago", label: "Métodos de pago" },
  { value: "/cuenta/pedidos", label: "Mis pedidos" },
];

export default function CuentaLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeValue =
    SECTIONS.find((section) => pathname.startsWith(section.value))?.value ?? SECTIONS[0].value;

  return (
    <div className="min-w-0 space-y-5">
      <Tabs items={SECTIONS} onChange={(value) => router.push(value)} value={activeValue} />
      {children}
    </div>
  );
}
