import Link from "next/link";
import { site } from "@/lib/site";
import { Logo } from "./logo";

const columns = [
  {
    title: "Learn",
    links: [
      { href: "/courses", label: "Browse courses" },
      { href: "/my-learning", label: "My learning" },
      { href: "/wishlist", label: "Wishlist" },
    ],
  },
  {
    title: "Teach",
    links: [
      { href: "/teach", label: "Become an instructor" },
      { href: "/instructor", label: "Instructor studio" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Log in" },
      { href: "/signup", label: "Create an account" },
      { href: "/account", label: "Settings" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-surface print:hidden">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">{site.description}</p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-sm font-bold">{col.title}</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-fg hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-1 py-5 text-xs text-subtle sm:flex-row sm:justify-between">
          <p>© {site.name}. Courses and materials belong to their instructors.</p>
          <p>
            Developed by <span className="font-semibold text-muted">Pizza Technologies</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
