import { navigationConfig } from "@/config/navigation";
import { ActiveBranchProvider } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";
import { PrivateShell } from "@/shared/navigation/PrivateShell";
import type { ReactNode } from "react";

type PrivateLayoutProps = {
  children: ReactNode;
};

export default function PrivateLayout({ children }: PrivateLayoutProps) {
  return (
    <ActiveBranchProvider>
      <PrivateShell navigationItems={navigationConfig}>{children}</PrivateShell>
    </ActiveBranchProvider>
  );
}
