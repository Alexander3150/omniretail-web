import type { NavigationItem } from "@/shared/types/navigation.types";

export const customerNavigation = [
  {
    id: "customer-account",
    label: "Mi cuenta",
    href: "/cuenta",
    permission: "customer.account.read",
  },
] satisfies NavigationItem[];
