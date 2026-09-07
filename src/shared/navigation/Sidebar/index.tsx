"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import type { NavigationItem } from "@/shared/types/navigation.types";

type SidebarProps = {
  items: NavigationItem[];
};

type SidebarItemProps = {
  item: NavigationItem;
  pathname: string;
  depth: number;
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

function SidebarItem({ item, pathname, depth }: SidebarItemProps) {
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
              <SidebarItem depth={depth + 1} item={child} key={child.id} pathname={pathname} />
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
        style={{ paddingLeft: offset }}
      >
        {item.label}
      </Link>
    </li>
  );
}

export function Sidebar({ items }: SidebarProps) {
  const pathname = usePathname();
  const visibleItems = useMemo(() => getRenderableNavigationItems(items), [items]);

  return (
    <aside className="min-h-screen w-56 border-r border-[var(--color-border)] bg-[var(--color-structure)] px-4 py-5 text-white">
      <nav aria-label="Navegacion principal">
        <ul className="space-y-1">
          {visibleItems.map((item) => (
            <SidebarItem depth={0} item={item} key={item.id} pathname={pathname} />
          ))}
        </ul>
      </nav>
    </aside>
  );
}
