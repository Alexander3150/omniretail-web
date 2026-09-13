"use client";

import type { ReactNode } from "react";
import { StorefrontFooter } from "@/modules/storefront/components/StorefrontFooter";
import { StorefrontHeader } from "@/modules/storefront/components/StorefrontHeader";

export function PublicStorefrontShell({ children }: { children: ReactNode }) {
  return (
    <>
      <StorefrontHeader />
      {children}
      <StorefrontFooter />
    </>
  );
}
