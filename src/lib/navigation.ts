export interface NavItem {
  label: string;
  href: string;
}

export const studentNavItems: NavItem[] = [
  { label: "Дашборд", href: "/dashboard" },
  { label: "Мои курсы", href: "/courses" },
  { label: "База знаний", href: "/knowledge-base" },
];

export const adminNavItems: NavItem[] = [
  { label: "Дашборд", href: "/admin/dashboard" },
  { label: "Пользователи", href: "/admin/users" },
  { label: "Курсы", href: "/admin/courses" },
  { label: "База знаний", href: "/admin/knowledge-base" },
];
