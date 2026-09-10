import { navigationConfig } from "@/config/navigation";
import { RequireSession } from "@/modules/auth/components/RequireSession";
import { CurrentSessionProvider } from "@/modules/auth/providers/CurrentSessionProvider";
import { ActiveBranchProvider } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";
import { PrivateShell } from "@/shared/navigation/PrivateShell";
import type { ReactNode } from "react";

type PrivateLayoutProps = {
  children: ReactNode;
};

export default function PrivateLayout({ children }: PrivateLayoutProps) {
  return (
    <CurrentSessionProvider>
      <RequireSession>
        <ActiveBranchProvider>
          <PrivateShell navigationItems={navigationConfig}>{children}</PrivateShell>
        </ActiveBranchProvider>
      </RequireSession>
    </CurrentSessionProvider>
  );
}
