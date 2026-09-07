export interface NavigationItem {
  label: string;
  href: string;
  permissionKey?: string;
  children?: NavigationItem[];
}
