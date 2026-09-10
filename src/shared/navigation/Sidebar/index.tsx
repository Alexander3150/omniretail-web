"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ComponentType, type SVGProps } from "react";
import { CloseIcon } from "@/shared/navigation/PrivateHeader/icons";
import type { NavigationItem } from "@/shared/types/navigation.types";

type SidebarProps = {
  allowedPermissions?: ReadonlySet<string>;
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

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const NAVIGATION_ICON_MAP: Record<string, IconComponent> = {
  home: HomeIcon,
  inventory: BoxesIcon,
  "inventory-alerts": PackageSearchIcon,
  catalog: TagsIcon,
  "catalog-products": PackageIcon,
  "catalog-categories": FolderTreeIcon,
  "catalog-locations": MapPinIcon,
  "catalog-units": RulerIcon,
  "inventory-movements": HistoryIcon,
  purchasing: ShoppingCartIcon,
  "purchasing-suppliers": BuildingIcon,
  "purchasing-orders": ClipboardListIcon,
  receiving: PackageCheckIcon,
  logistics: TruckIcon,
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
  return filterNavigationItemsByPermissions(items);
}

export function filterNavigationItemsByPermissions(
  items: NavigationItem[],
  allowedPermissions?: ReadonlySet<string>,
): NavigationItem[] {
  return items.flatMap<NavigationItem>((item) => {
    const children: NavigationItem[] | undefined = item.children
      ? filterNavigationItemsByPermissions(item.children, allowedPermissions)
      : undefined;
    const hasChildren: boolean = Boolean(children?.length);
    const hasPermission =
      !item.permission || !allowedPermissions || allowedPermissions.has(item.permission);
    const hasAccessibleHref = Boolean(item.href && hasPermission);

    if (!hasAccessibleHref && !hasChildren) {
      return [];
    }

    return [
      {
        ...item,
        href: hasAccessibleHref ? item.href : undefined,
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
  const isOpen = hasActiveChild || manualOpen === true;
  const Icon = NAVIGATION_ICON_MAP[item.id] ?? CircleIcon;
  const offset = 10 + depth * 14;
  const itemHeight = depth === 0 ? "min-h-10" : "min-h-9";

  if (hasChildren) {
    return (
      <li>
        <button
          aria-expanded={isOpen}
          className={`flex w-full items-center justify-between gap-2 rounded-md py-2 pr-2 text-left text-sm transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
            hasActiveChild ? "bg-white/10 font-semibold text-white" : "font-medium text-blue-50/85"
          } ${itemHeight}`}
          onClick={() => setManualOpen((current) => !(current ?? hasActiveChild))}
          style={{ paddingLeft: offset }}
          type="button"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="line-clamp-2 leading-5">{item.label}</span>
          </span>
          <ChevronIcon
            aria-hidden="true"
            className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
          />
        </button>
        {isOpen ? (
          <ul className="relative ml-5 mt-1 space-y-0.5 border-l border-white/15 pl-2">
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
        className={`flex items-center gap-2.5 rounded-md py-2 pr-2 text-sm transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
          isActive
            ? "bg-white text-[var(--color-structure)] shadow-sm"
            : "font-medium text-blue-50/85"
        } ${itemHeight}`}
        href={item.href}
        onClick={onNavigate}
        style={{ paddingLeft: offset }}
      >
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="line-clamp-2 leading-5">{item.label}</span>
      </Link>
    </li>
  );
}

export function Sidebar({
  allowedPermissions,
  id,
  isOpen = false,
  items,
  onClose,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();
  const visibleItems = useMemo(
    () => filterNavigationItemsByPermissions(items, allowedPermissions),
    [allowedPermissions, items],
  );

  return (
    <aside
      aria-label="Menu principal"
      className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(280px,85vw)] flex-col border-r border-white/10 bg-[var(--color-structure)] px-3 py-4 text-white shadow-xl transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:translate-x-0 lg:shadow-none ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
      id={id}
    >
      <div className="mb-4 flex items-center justify-between px-1 lg:hidden">
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
      <nav aria-label="Navegacion principal" className="min-h-0 flex-1 overflow-y-auto pr-1">
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

function Icon({ children, className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      {...props}
    >
      {children}
    </svg>
  );
}

function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </Icon>
  );
}

function BoxesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m7.5 4.3 4.5 2.6 4.5-2.6" />
      <path d="M3 8.5 12 14l9-5.5" />
      <path d="M12 14v8" />
      <path d="M3 8.5v7L12 21l9-5.5v-7" />
    </Icon>
  );
}

function PackageSearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m3 7 9 5 9-5" />
      <path d="M12 22V12" />
      <path d="M21 7v5" />
      <path d="M3 7v10l9 5" />
      <circle cx="17" cy="17" r="3" />
      <path d="m19.5 19.5 1.5 1.5" />
    </Icon>
  );
}

function TagsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r=".5" />
    </Icon>
  );
}

function PackageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m3 7 9 5 9-5" />
      <path d="M12 22V12" />
      <path d="M21 7v10l-9 5-9-5V7l9-5 9 5Z" />
    </Icon>
  );
}

function FolderTreeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 5h6l2 2h8v4H4Z" />
      <path d="M4 11v8h7" />
      <path d="M11 15h9v4h-9Z" />
    </Icon>
  );
}

function MapPinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Icon>
  );
}

function RulerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m4 16 12-12 4 4L8 20Z" />
      <path d="m8 12 2 2" />
      <path d="m11 9 2 2" />
      <path d="m14 6 2 2" />
    </Icon>
  );
}

function HistoryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v6h6" />
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}

function ShoppingCartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
      <path d="M2 3h3l3 13h10l3-9H6" />
    </Icon>
  );
}

function BuildingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M19 21V11l-6-4" />
      <path d="M9 9h1M9 13h1M9 17h1" />
    </Icon>
  );
}

function ClipboardListIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 5h6M9 3h6v4H9z" />
      <path d="M7 5H5v16h14V5h-2" />
      <path d="M8 12h8M8 16h8" />
    </Icon>
  );
}

function PackageCheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m3 7 9 5 9-5M12 22V12" />
      <path d="M21 7v5M3 7v10l9 5 2.5-1.4" />
      <path d="m16 17 2 2 4-5" />
    </Icon>
  );
}

function TruckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M10 17h4V5H2v12h3" />
      <path d="M14 8h4l4 4v5h-3" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </Icon>
  );
}

function CircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m9 18 6-6-6-6" />
    </Icon>
  );
}
