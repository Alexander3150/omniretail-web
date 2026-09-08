"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { CloseIcon } from "@/shared/navigation/PrivateHeader/icons";
import type { NavigationItem } from "@/shared/types/navigation.types";

type SidebarProps = {
  id?: string;
  isOpen?: boolean;
  items: NavigationItem[];
  onClose?: () => void;
  onNavigate?: () => void;
};

type SidebarItemProps = {
  depth: number;
  item: NavigationItem;
  onNavigate?: () => void;
  pathname: string;
};

export function isNavigationItemActive(pathname: string, href?: string): boolean {
  if (!href) {
    return false;
  }

  if (href === "/") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function hasActiveNavigationItem(
  items: NavigationItem[] | undefined,
  pathname: string,
): boolean {
  return (
    items?.some(
      (item) =>
        isNavigationItemActive(pathname, item.href) ||
        hasActiveNavigationItem(item.children, pathname),
    ) ?? false
  );
}

export function getRenderableNavigationItems(items: NavigationItem[]): NavigationItem[] {
  return items.flatMap<NavigationItem>((item) => {
    const children: NavigationItem[] | undefined = item.children
      ? getRenderableNavigationItems(item.children)
      : undefined;
    const hasChildren: boolean = Boolean(children?.length);

    if (!item.href && !hasChildren) {
      return [];
    }

    return [
      {
        ...item,
        children: hasChildren ? children : undefined,
      },
    ];
  });
}

function SidebarItem({ depth, item, onNavigate, pathname }: SidebarItemProps) {
  const hasChildren = Boolean(item.children?.length);
  const hasActiveChild = hasActiveNavigationItem(item.children, pathname);
  const isActive = isNavigationItemActive(pathname, item.href);
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const isOpen = manualOpen ?? hasActiveChild;
  const offset = 12 + depth * 12;

  if (hasChildren) {
    return (
      <li>
        <button
          aria-expanded={isOpen}
          className={`flex w-full items-center justify-between rounded-md py-2 pr-3 text-left text-sm font-semibold transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
            hasActiveChild ? "bg-white/15 text-white" : "text-white/85"
          }`}
          onClick={() => setManualOpen((current) => !(current ?? hasActiveChild))}
          style={{ paddingLeft: offset }}
          type="button"
        >
          <span>{item.label}</span>
          <span aria-hidden="true" className="ml-3 text-xs">
            {isOpen ? "-" : "+"}
          </span>
        </button>
        {isOpen ? (
          <ul className="mt-1 space-y-1">
            {item.children?.map((child) => (
              <SidebarItem
                depth={depth + 1}
                item={child}
                key={child.id}
                onNavigate={onNavigate}
                pathname={pathname}
              />
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  if (!item.href) {
    return null;
  }

  return (
    <li>
      <Link
        aria-current={isActive ? "page" : undefined}
        className={`block rounded-md py-2 pr-3 text-sm font-semibold transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
          isActive ? "bg-white/20 text-white" : "text-white/85"
        }`}
        href={item.href}
        onClick={onNavigate}
        style={{ paddingLeft: offset }}
      >
        {item.label}
      </Link>
    </li>
  );
}

export function Sidebar({ id, isOpen = false, items, onClose, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const visibleItems = useMemo(() => getRenderableNavigationItems(items), [items]);

  return (
    <aside
      aria-label="Menu principal"
      className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(280px,85vw)] flex-col border-r border-[var(--color-border)] bg-[var(--color-structure)] px-4 py-5 text-white shadow-xl transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:w-56 lg:translate-x-0 lg:shadow-none ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
      id={id}
    >
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <span className="text-sm font-bold">OmniRetail</span>
        <button
          aria-label="Cerrar navegacion"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-white transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          onClick={onClose}
          type="button"
        >
          <CloseIcon />
        </button>
      </div>
      <nav aria-label="Navegacion principal" className="min-h-0 flex-1 overflow-y-auto">
        <ul className="space-y-1 pb-4">
          {visibleItems.map((item) => (
            <SidebarItem
              depth={0}
              item={item}
              key={item.id}
              onNavigate={onNavigate}
              pathname={pathname}
            />
          ))}
        </ul>
      </nav>
    </aside>
  );
}
