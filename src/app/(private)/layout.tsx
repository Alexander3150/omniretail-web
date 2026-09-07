import { Sidebar } from "@/shared/navigation/Sidebar";
import { TopNavbar } from "@/shared/navigation/TopNavbar";
import type { ReactNode } from "react";

type PrivateLayoutProps = {
  children: ReactNode;
};

export default function PrivateLayout({ children }: PrivateLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--color-app-background)]">
      <TopNavbar />
      <div className="flex min-h-[calc(100vh-64px)]">
        <Sidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
