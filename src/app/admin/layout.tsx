import { BookCheck, LayoutDashboard, Receipt, Settings, Tags, Users } from "lucide-react";
import { SiteHeader } from "@/components/site/header";
import { NavList, NavTabs } from "@/components/site/nav-tabs";

const items = [
  { href: "/admin", label: "Overview", icon: <LayoutDashboard />, exact: true },
  { href: "/admin/courses", label: "Courses", icon: <BookCheck /> },
  { href: "/admin/users", label: "Users", icon: <Users /> },
  { href: "/admin/categories", label: "Categories", icon: <Tags /> },
  { href: "/admin/orders", label: "Orders", icon: <Receipt /> },
  { href: "/admin/settings", label: "Settings", icon: <Settings /> },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="container-page flex-1 gap-10 py-8 lg:grid lg:grid-cols-[12rem_minmax(0,1fr)]">
        <aside>
          <p className="mb-3 hidden px-3 text-xs font-bold tracking-wide text-subtle uppercase lg:block">Admin console</p>
          <NavList items={items} label="Admin console" className="hidden lg:flex" />
          <NavTabs items={items} label="Admin console" className="mb-6 lg:hidden" />
        </aside>
        <main id="main" className="min-w-0 pb-16">
          {children}
        </main>
      </div>
    </>
  );
}
