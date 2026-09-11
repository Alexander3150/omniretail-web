"use client";

import { BranchSelector } from "@/shared/navigation/PrivateHeader/BranchSelector";
import { MenuIcon } from "@/shared/navigation/PrivateHeader/icons";
import { NotificationButton } from "@/shared/navigation/PrivateHeader/NotificationButton";
import { UserMenu } from "@/shared/navigation/PrivateHeader/UserMenu";

type PrivateHeaderProps = {
  onLogout?: () => void;
  onOpenSidebar: () => void;
  sidebarId: string;
  sidebarOpen: boolean;
  userMenuDescription?: string;
  userMenuLabel?: string;
};

export function PrivateHeader({
  onLogout,
  onOpenSidebar,
  sidebarId,
  sidebarOpen,
  userMenuDescription,
  userMenuLabel,
}: PrivateHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-[var(--color-border)] bg-white px-3 shadow-sm sm:px-4 md:px-6">
      <button
        aria-controls={sidebarId}
        aria-expanded={sidebarOpen}
        aria-label="Abrir navegacion"
        className="mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-white text-[var(--color-title)] transition hover:border-[var(--color-structure)] hover:bg-[var(--color-app-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)] lg:hidden"
        onClick={onOpenSidebar}
        type="button"
      >
        <MenuIcon />
      </button>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
        <div className="flex min-w-0 flex-1 justify-end">
          <BranchSelector />
        </div>
        <NotificationButton />
        <UserMenu description={userMenuDescription} label={userMenuLabel} onLogout={onLogout} />
      </div>
    </header>
  );
}
