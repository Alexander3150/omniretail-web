import { navigationConfig } from "@/config/navigation";
import { Sidebar } from "@/shared/navigation/Sidebar";
import { TopNavbar } from "@/shared/navigation/TopNavbar";
import { Suspense, type ReactNode } from "react";

type PrivateLayoutProps = {
  children: ReactNode;
};

export default function PrivateLayout({ children }: PrivateLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--color-app-background)]">
      <TopNavbar />
      <div className="flex min-h-[calc(100vh-64px)]">
        <Suspense
          fallback={
            <aside className="w-56 border-r border-[var(--color-border)] bg-[var(--color-structure)] px-4 py-5 text-white" />
          }
        >
          <Sidebar items={navigationConfig} />
        </Suspense>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
