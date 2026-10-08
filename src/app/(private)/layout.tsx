import { navigationConfig } from "@/config/navigation";
import { AuthorizedPrivateShell } from "@/modules/auth/components/AuthorizedPrivateShell";
import { EmployeeInactivityTimeout } from "@/modules/auth/components/EmployeeInactivityTimeout";
import { RequirePermission } from "@/modules/auth/components/RequirePermission";
import { RequireSession } from "@/modules/auth/components/RequireSession";
import { ScopedActiveBranchProvider } from "@/modules/auth/components/ScopedActiveBranchProvider";
import { ScopedEntitlementProvider } from "@/modules/auth/components/ScopedEntitlementProvider";
import { CurrentSessionProvider } from "@/modules/auth/providers/CurrentSessionProvider";
import { PackingMutationCoordinatorProvider } from "@/modules/logistics/providers/PackingMutationCoordinatorProvider";
import type { ReactNode } from "react";

type PrivateLayoutProps = {
  children: ReactNode;
};

export default function PrivateLayout({ children }: PrivateLayoutProps) {
  return (
    <CurrentSessionProvider>
      <PackingMutationCoordinatorProvider>
        <RequireSession>
          <EmployeeInactivityTimeout />
          <ScopedEntitlementProvider>
            <ScopedActiveBranchProvider>
              <AuthorizedPrivateShell navigationItems={navigationConfig}>
                <RequirePermission>{children}</RequirePermission>
              </AuthorizedPrivateShell>
            </ScopedActiveBranchProvider>
          </ScopedEntitlementProvider>
        </RequireSession>
      </PackingMutationCoordinatorProvider>
    </CurrentSessionProvider>
  );
}
