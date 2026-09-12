import { navigationConfig } from "@/config/navigation";
import { AuthorizedPrivateShell } from "@/modules/auth/components/AuthorizedPrivateShell";
import { RequirePermission } from "@/modules/auth/components/RequirePermission";
import { RequireSession } from "@/modules/auth/components/RequireSession";
import { ScopedActiveBranchProvider } from "@/modules/auth/components/ScopedActiveBranchProvider";
import { CurrentSessionProvider } from "@/modules/auth/providers/CurrentSessionProvider";
import type { ReactNode } from "react";

type PrivateLayoutProps = {
  children: ReactNode;
};

export default function PrivateLayout({ children }: PrivateLayoutProps) {
  return (
    <CurrentSessionProvider>
      <RequireSession>
        <ScopedActiveBranchProvider>
          <AuthorizedPrivateShell navigationItems={navigationConfig}>
            <RequirePermission>{children}</RequirePermission>
          </AuthorizedPrivateShell>
        </ScopedActiveBranchProvider>
      </RequireSession>
    </CurrentSessionProvider>
  );
}
