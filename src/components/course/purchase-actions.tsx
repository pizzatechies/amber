"use client";

import { useState } from "react";
import { Heart, LoaderCircle, PlayCircle, ShoppingCart } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { useServerAction } from "@/components/ui/action-form";
import { cn } from "@/lib/utils";
import { addToCartAction, buyNowAction, enrollFreeAction, toggleWishlistAction } from "@/server/actions/commerce";

export function WishlistButton({
  courseId,
  initial,
  signedIn,
  loginHref,
  className,
}: {
  courseId: string;
  initial: boolean;
  signedIn: boolean;
  loginHref: string;
  className?: string;
}) {
  const [wishlisted, setWishlisted] = useState(initial);
  const { run, pending } = useServerAction(toggleWishlistAction, {
    onSuccess: (data) => {
      if (data) setWishlisted(data.wishlisted);
    },
  });
  const label = wishlisted ? "Remove from wishlist" : "Save to wishlist";

  if (!signedIn) {
    return (
      <LinkButton href={loginHref} variant="outline" size="icon" aria-label={label} className={className}>
        <Heart />
      </LinkButton>
    );
  }
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={label}
      aria-pressed={wishlisted}
      disabled={pending}
      onClick={() => run(courseId)}
      className={className}
    >
      <Heart className={cn(wishlisted && "fill-danger text-danger")} />
    </Button>
  );
}

/** The call-to-action buttons on a course page, for someone who doesn't have the course yet. */
export function PurchaseActions({
  courseId,
  isFree,
  inCart,
  wishlisted,
  signedIn,
  loginHref,
  couponCode,
}: {
  courseId: string;
  isFree: boolean;
  inCart: boolean;
  wishlisted: boolean;
  signedIn: boolean;
  loginHref: string;
  couponCode?: string;
}) {
  const add = useServerAction(addToCartAction);
  const buy = useServerAction(buyNowAction);
  const enroll = useServerAction(enrollFreeAction);
  const busy = add.pending || buy.pending || enroll.pending;
  const spinner = <LoaderCircle className="animate-spin" aria-hidden />;

  const wishlist = (
    <WishlistButton courseId={courseId} initial={wishlisted} signedIn={signedIn} loginHref={loginHref} className="size-12" />
  );

  if (!signedIn) {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex gap-2.5">
          <LinkButton href={loginHref} size="lg" className="flex-1">
            {isFree ? "Enroll for free" : "Add to cart"}
          </LinkButton>
          {wishlist}
        </div>
        {isFree ? null : (
          <LinkButton href={loginHref} size="lg" variant="outline">
            Buy now
          </LinkButton>
        )}
        <p className="text-center text-xs text-subtle">You&apos;ll be asked to log in first.</p>
      </div>
    );
  }

  if (isFree) {
    return (
      <div className="flex gap-2.5">
        <Button size="lg" className="flex-1" disabled={busy} onClick={() => enroll.run(courseId)}>
          {enroll.pending ? spinner : <PlayCircle aria-hidden />}
          Enroll for free
        </Button>
        {wishlist}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-2.5">
        {inCart ? (
          <LinkButton href="/cart" size="lg" className="flex-1">
            <ShoppingCart aria-hidden /> Go to cart
          </LinkButton>
        ) : (
          <Button size="lg" className="flex-1" disabled={busy} onClick={() => add.run(courseId, couponCode)}>
            {add.pending ? spinner : <ShoppingCart aria-hidden />}
            Add to cart
          </Button>
        )}
        {wishlist}
      </div>
      <Button size="lg" variant="outline" disabled={busy} onClick={() => buy.run(courseId, couponCode)}>
        {buy.pending ? spinner : null}
        Buy now
      </Button>
    </div>
  );
}
