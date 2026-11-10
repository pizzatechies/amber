import { Suspense } from "react";
import Link from "next/link";
import Form from "next/form";
import { Bell, Search, ShoppingCart } from "lucide-react";
import { getCurrentUser, isAdmin, isInstructor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Logo } from "./logo";
import { UserMenu } from "./user-menu";

const navLink = "rounded-lg px-2.5 py-2 text-sm font-semibold text-fg hover:bg-surface-2";

export function SearchBox({ defaultValue, className }: { defaultValue?: string; className?: string }) {
  return (
    <Form action="/courses" className={className} role="search">
      <label className="relative block w-full">
        <span className="sr-only">Search courses</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" aria-hidden />
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder="Search for anything"
          className="h-10 w-full rounded-full border border-line-strong bg-surface pr-4 pl-10 text-sm placeholder:text-subtle hover:border-fg/40 focus:border-focus focus:outline-2 focus:outline-offset-0 focus:outline-focus/30"
        />
      </label>
    </Form>
  );
}

function IconLink({
  href,
  label,
  count,
  children,
}: {
  href: string;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={count > 0 ? `${label} (${count})` : label}
      className="relative inline-flex size-10 items-center justify-center rounded-full text-fg hover:bg-surface-2 [&_svg]:size-5"
    >
      {children}
      {count > 0 ? (
        <span className="absolute top-1 right-0.5 min-w-4.5 rounded-full bg-brand px-1 text-center text-[11px] leading-4.5 font-bold text-brand-ink">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

async function HeaderAccount() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <>
        <Link href="/teach" className={`${navLink} hidden lg:inline-flex`}>
          Teach
        </Link>
        <LinkButton href="/login" variant="ghost" className="hidden sm:inline-flex">
          Log in
        </LinkButton>
        <LinkButton href="/signup">Sign up</LinkButton>
      </>
    );
  }

  const [cartCount, unreadCount] = await Promise.all([
    db.cartItem.count({ where: { userId: user.id } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return (
    <>
      {isInstructor(user) ? (
        <Link href="/instructor" className={`${navLink} hidden lg:inline-flex`}>
          Instructor
        </Link>
      ) : (
        <Link href="/teach" className={`${navLink} hidden lg:inline-flex`}>
          Teach
        </Link>
      )}
      <Link href="/my-learning" className={`${navLink} hidden md:inline-flex`}>
        My learning
      </Link>
      <IconLink href="/cart" label="Cart" count={cartCount}>
        <ShoppingCart />
      </IconLink>
      <IconLink href="/notifications" label="Notifications" count={unreadCount}>
        <Bell />
      </IconLink>
      <UserMenu
        user={{
          name: user.name,
          email: user.email,
          avatarAssetId: user.avatarAssetId,
          isInstructor: isInstructor(user),
          isAdmin: isAdmin(user),
        }}
      />
    </>
  );
}

function HeaderAccountFallback() {
  return (
    <>
      <Skeleton className="size-9 rounded-full" />
      <Skeleton className="size-9 rounded-full" />
    </>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-2 sm:gap-4">
        <Logo />
        <Link href="/courses" className={`${navLink} hidden md:inline-flex`}>
          Browse
        </Link>
        <SearchBox className="hidden max-w-xl flex-1 sm:block" />
        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <Link
            href="/courses"
            aria-label="Search courses"
            className="inline-flex size-10 items-center justify-center rounded-full hover:bg-surface-2 sm:hidden"
          >
            <Search className="size-5" />
          </Link>
          <Suspense fallback={<HeaderAccountFallback />}>
            <HeaderAccount />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
