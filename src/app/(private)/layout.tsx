import { navigationConfig } from "@/config/navigation";
import { Sidebar } from "@/shared/navigation/Sidebar";
import { ActiveBranchProvider } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";
import { PrivateHeader } from "@/shared/navigation/PrivateHeader";
import { Suspense, type ReactNode } from "react";

type PrivateLayoutProps = {
  children: ReactNode;
};

export default function PrivateLayout({ children }: PrivateLayoutProps) {
  return (
    <ActiveBranchProvider>
      <div className="flex min-h-screen bg-[var(--color-app-background)]">
        <Suspense
          fallback={
            <aside className="min-h-screen w-56 border-r border-[var(--color-border)] bg-[var(--color-structure)] px-4 py-5 text-white" />
          }
        >
          <Sidebar items={navigationConfig} />
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col">
          <PrivateHeader />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </ActiveBranchProvider>
  );
}
