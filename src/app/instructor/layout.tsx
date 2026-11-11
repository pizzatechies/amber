import { BookCopy, CircleDollarSign, LayoutDashboard, MessagesSquare, Star } from "lucide-react";
import { SiteHeader } from "@/components/site/header";
import { NavList, NavTabs } from "@/components/site/nav-tabs";

const items = [
  { href: "/instructor", label: "Dashboard", icon: <LayoutDashboard />, exact: true },
  { href: "/instructor/courses", label: "Courses", icon: <BookCopy /> },
  { href: "/instructor/questions", label: "Q&A", icon: <MessagesSquare /> },
  { href: "/instructor/reviews", label: "Reviews", icon: <Star /> },
  { href: "/instructor/earnings", label: "Earnings", icon: <CircleDollarSign /> },
];

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="container-page flex-1 gap-10 py-8 lg:grid lg:grid-cols-[12rem_minmax(0,1fr)]">
        <aside>
          <p className="mb-3 hidden px-3 text-xs font-bold tracking-wide text-subtle uppercase lg:block">Instructor studio</p>
          <NavList items={items} label="Instructor studio" className="hidden lg:flex" />
          <NavTabs items={items} label="Instructor studio" className="mb-6 lg:hidden" />
        </aside>
        <main id="main" className="min-w-0 pb-16">
          {children}
        </main>
      </div>
    </>
  );
}
