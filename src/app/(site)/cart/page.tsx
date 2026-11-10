import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { FlaskConical, ShoppingCart, Tag, X } from "lucide-react";
import { RatingLine } from "@/components/course/card";
import { CourseCover } from "@/components/course/cover";
import { ActionButton, ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Alert, Badge, Card, EmptyState, Skeleton } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { getCart } from "@/lib/commerce/cart";
import { formatDuration } from "@/lib/format";
import { formatMoney, formatPrice } from "@/lib/money";
import { payments } from "@/lib/payments";
import { requestTime } from "@/lib/request";
import { courseUrl } from "@/lib/urls";
import { pluralize } from "@/lib/utils";
import {
  applyCouponAction,
  checkoutAction,
  removeCouponAction,
  removeFromCartAction,
} from "@/server/actions/commerce";

export const metadata: Metadata = { title: "Your cart" };

export default function CartPage() {
  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">Your cart</h1>
      <Suspense fallback={<CartSkeleton />}>
        <CartContent />
      </Suspense>
    </div>
  );
}

async function CartContent() {
  const user = await requireUser("/cart");
  const cart = await getCart(user.id, await requestTime());
  const provider = payments();

  if (cart.lines.length === 0) {
    return (
      <EmptyState
        className="mt-8"
        icon={<ShoppingCart />}
        title="Your cart is empty"
        action={<LinkButton href="/courses">Browse courses</LinkButton>}
      >
        Courses you add will show up here.
      </EmptyState>
    );
  }

  const { totals } = cart;
  const isFree = totals.totalCents === 0;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-label="Cart items">
        <p className="mb-3 text-sm font-bold">{pluralize(cart.lines.length, "course")} in cart</p>
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {cart.lines.map((line) => (
            <li key={line.course.id} className="flex gap-4 py-5">
              <Link href={courseUrl(line.course.slug)} className="w-28 shrink-0 self-start overflow-hidden rounded-lg sm:w-40">
                <CourseCover title={line.course.title} seed={line.course.id} assetId={line.course.thumbnailAssetId} />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link href={courseUrl(line.course.slug)} className="leading-snug font-bold hover:text-brand-text">
                  {line.course.title}
                </Link>
                <p className="text-sm text-muted">By {line.course.instructorName}</p>
                <RatingLine avg={line.course.ratingAvg} count={line.course.ratingCount} />
                <p className="text-xs text-subtle">
                  {line.course.durationSec > 0 ? `${formatDuration(line.course.durationSec)} · ` : ""}
                  {pluralize(line.course.lectureCount, "lecture")}
                </p>
                {line.problem ? <p className="mt-1 text-sm font-semibold text-danger">{line.problem}</p> : null}
                {line.coupon ? (
                  <p className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge tone="success">
                      <Tag aria-hidden /> {line.coupon.code} · {line.coupon.percentOff}% off
                    </Badge>
                    <ActionButton
                      action={removeCouponAction.bind(null, line.course.id)}
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted"
                    >
                      Remove coupon
                    </ActionButton>
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <p className="font-bold">{line.problem ? "—" : formatPrice(line.priceCents)}</p>
                {line.discountCents > 0 && !line.problem ? (
                  <s className="text-sm text-subtle">{formatMoney(line.listCents)}</s>
                ) : null}
                <ActionButton
                  action={removeFromCartAction.bind(null, line.course.id)}
                  variant="ghost"
                  size="sm"
                  className="mt-auto text-muted"
                  aria-label={`Remove ${line.course.title} from cart`}
                >
                  <X aria-hidden /> Remove
                </ActionButton>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <aside aria-label="Order summary">
        <Card className="sticky top-24 flex flex-col gap-5 p-6">
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd>{formatMoney(totals.subtotalCents)}</dd>
            </div>
            {totals.discountCents > 0 ? (
              <div className="flex justify-between text-success">
                <dt>Coupon discount</dt>
                <dd>−{formatMoney(totals.discountCents)}</dd>
              </div>
            ) : null}
            <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
              <dt className="font-bold">Total</dt>
              <dd className="font-display text-3xl font-semibold">{formatMoney(totals.totalCents)}</dd>
            </div>
          </dl>

          {cart.purchasable.length > 0 ? (
            <ActionButton action={checkoutAction} size="lg" className="w-full">
              {isFree ? "Enroll now" : "Proceed to checkout"}
            </ActionButton>
          ) : (
            <Alert tone="warn">Nothing in your cart can be purchased right now.</Alert>
          )}

          {provider.isTestMode && !isFree ? (
            <p className="flex gap-2 rounded-lg bg-info-soft px-3 py-2.5 text-xs leading-relaxed text-info">
              <FlaskConical className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span className="text-fg">
                Payments are in <strong>test mode</strong>. You won&apos;t be charged.
              </span>
            </p>
          ) : null}

          <ActionForm action={applyCouponAction} resetOnSuccess className="border-t border-line pt-5">
            <p className="text-sm font-bold">Have a coupon?</p>
            <div className="mt-2 flex gap-2">
              <Input
                name="code"
                aria-label="Coupon code"
                placeholder="Enter code"
                autoComplete="off"
                className="uppercase placeholder:normal-case"
              />
              <SubmitButton variant="outline">Apply</SubmitButton>
            </div>
            <FieldError name="code" className="mt-1.5" />
          </ActionForm>
        </Card>
      </aside>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]" aria-busy="true">
      <div className="flex flex-col gap-5">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="aspect-video w-40" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
