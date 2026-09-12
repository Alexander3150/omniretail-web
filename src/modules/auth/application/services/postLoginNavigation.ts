import type { User } from "@/core/entities";
import { UserType } from "@/core/enums";

const CUSTOMER_PUBLIC_ROUTE_ROOTS = [
  "/",
  "/ayuda",
  "/carrito",
  "/catalogo",
  "/checkout",
  "/ofertas",
  "/pedido",
] as const;

function isRouteWithin(pathname: string, root: string): boolean {
  return root === "/" ? pathname === root : pathname === root || pathname.startsWith(`${root}/`);
}

export function isCustomerAccountPath(pathname: string): boolean {
  return isRouteWithin(pathname, "/cuenta");
}

export function canUserEnterPrivateRoute(user: User | null, pathname: string): boolean {
  return user?.type !== UserType.customer || isCustomerAccountPath(pathname);
}

export function isSafeCustomerReturnUrl(returnUrl: string): boolean {
  if (!returnUrl.startsWith("/") || returnUrl.startsWith("//")) return false;

  try {
    const url = new URL(returnUrl, "https://omniretail.local");
    if (url.origin !== "https://omniretail.local") return false;
    return (
      isCustomerAccountPath(url.pathname) ||
      CUSTOMER_PUBLIC_ROUTE_ROOTS.some((root) => isRouteWithin(url.pathname, root))
    );
  } catch {
    return false;
  }
}

export function resolvePostLoginDestination(user: User, returnUrl?: string): string {
  if (user.type !== UserType.customer) return "/inicio";
  return returnUrl && isSafeCustomerReturnUrl(returnUrl) ? returnUrl : "/";
}
