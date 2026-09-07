"use client";

import { BranchSelector } from "@/shared/navigation/PrivateHeader/BranchSelector";
import { NotificationButton } from "@/shared/navigation/PrivateHeader/NotificationButton";
import { UserMenu } from "@/shared/navigation/PrivateHeader/UserMenu";

export function PrivateHeader() {
  return (
    <header className="flex h-14 items-center justify-end border-b border-[var(--color-border)] bg-white px-4 shadow-sm md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <BranchSelector />
        <NotificationButton />
        <UserMenu />
      </div>
    </header>
  );
}
