export interface NavItem {
  label: string;
  href: string;
}

export const studentNavItems: NavItem[] = [
  { label: "Дашборд", href: "/dashboard" },
  { label: "Мои курсы", href: "/courses" },
  { label: "База знаний", href: "/knowledge-base" },
  { label: "Вебинары", href: "/webinars" },
];

export const adminNavItems: NavItem[] = [
  { label: "Дашборд", href: "/admin/dashboard" },
  { label: "Пользователи", href: "/admin/users" },
  { label: "Курсы", href: "/admin/courses" },
  { label: "База знаний", href: "/admin/knowledge-base" },
  { label: "Проверка работ", href: "/admin/submissions" },
  { label: "Вебинары", href: "/admin/webinars" },
];
