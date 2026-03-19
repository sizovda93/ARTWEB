export interface NavItem {
  label: string;
  href: string;
}

export const studentNavItems: NavItem[] = [
  { label: "Дашборд", href: "/dashboard" },
];

export const adminNavItems: NavItem[] = [
  { label: "Дашборд", href: "/admin/dashboard" },
  { label: "Пользователи", href: "/admin/users" },
];
