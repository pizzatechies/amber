"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionError, actionUser, formValues, ok, parse, run, type ActionResult, type FormState } from "@/lib/action";
import { rateLimit } from "@/lib/auth/rate-limit";
import { grantEnrollment } from "@/lib/commerce/enroll";
import { checkoutCart, closeUnpaidOrder, fulfillOrder } from "@/lib/commerce/orders";
import { couponProblem, normalizeCouponCode } from "@/lib/commerce/pricing";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { learnUrl } from "@/lib/urls";
import { idSchema } from "@/lib/validation";

/** A published course the user could buy or enroll in, or an explanatory error. */
async function buyableCourse(userId: string, courseId: string) {
  const course = await db.course.findUnique({
    where: { id: parse(idSchema, courseId) },
    select: { id: true, slug: true, title: true, status: true, priceCents: true, instructorId: true },
  });
  if (!course || course.status !== "PUBLISHED") throw new ActionError("This course isn't available.");
  if (course.instructorId === userId) throw new ActionError("This is your own course.");
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
    select: { revokedAt: true },
  });
  if (enrollment && !enrollment.revokedAt) throw new ActionError("You already have this course.");
  return course;
}

async function findUsableCoupon(courseId: string, rawCode: string | undefined) {
  if (!rawCode) return null;
  const coupon = await db.coupon.findUnique({
    where: { courseId_code: { courseId, code: normalizeCouponCode(rawCode) } },
  });
  return coupon && !couponProblem(coupon, Date.now()) ? coupon : null;
}

async function putInCart(userId: string, courseId: string, couponCode?: string) {
  const course = await buyableCourse(userId, courseId);
  const coupon = await findUsableCoupon(course.id, couponCode);
  await db.cartItem.upsert({
    where: { userId_courseId: { userId, courseId: course.id } },
    create: { userId, courseId: course.id, couponId: coupon?.id },
    // Keep an already-applied coupon unless a new valid one was supplied.
    update: coupon ? { couponId: coupon.id } : {},
  });
  return course;
}

export async function addToCartAction(courseId: string, couponCode?: string): Promise<ActionResult> {
  return run(async () => {
    const user = await actionUser();
    await putInCart(user.id, courseId, couponCode);
    refresh();
    return ok("Added to your cart.");
  });
}

/** Add the course to the cart and go straight to it. */
export async function buyNowAction(courseId: string, couponCode?: string): Promise<ActionResult> {
  return run(async () => {
    const user = await actionUser();
    await putInCart(user.id, courseId, couponCode);
    redirect("/cart");
  });
}

export async function removeFromCartAction(courseId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await actionUser();
    await db.cartItem.deleteMany({ where: { userId: user.id, courseId: parse(idSchema, courseId) } });
    refresh();
    return ok();
  });
}

export async function toggleWishlistAction(courseId: string): Promise<ActionResult<{ wishlisted: boolean }>> {
  return run(async () => {
    const user = await actionUser();
    const id = parse(idSchema, courseId);
    const key = { userId_courseId: { userId: user.id, courseId: id } };
    const existing = await db.wishlistItem.findUnique({ where: key, select: { courseId: true } });
    if (existing) {
      await db.wishlistItem.delete({ where: key });
    } else {
      const course = await db.course.findUnique({ where: { id }, select: { status: true } });
      if (!course || course.status !== "PUBLISHED") throw new ActionError("This course isn't available.");
      await db.wishlistItem.create({ data: { userId: user.id, courseId: id } });
    }
    refresh();
    return ok(existing ? "Removed from your wishlist." : "Saved to your wishlist.", { wishlisted: !existing });
  });
}

/** Enroll in a free course. Paid courses go through checkout instead. */
export async function enrollFreeAction(courseId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await actionUser();
    const course = await buyableCourse(user.id, courseId);
    if (course.priceCents > 0) throw new ActionError("This course isn't free. Add it to your cart to buy it.");

    await db.$transaction((tx) => grantEnrollment(tx, user.id, course.id, "FREE"));
    await notify({
      userId: course.instructorId,
      title: "New student enrolled",
      body: `${user.name} joined ${course.title}`,
      href: "/instructor",
    });
    redirect(learnUrl(course.slug));
  });
}

const couponFormSchema = z.object({ code: z.string().trim().min(1, "Enter a coupon code.").max(40) });

export async function applyCouponAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actionUser();
    const code = normalizeCouponCode(parse(couponFormSchema, formValues(formData)).code);

    // Slow down guessing of coupon codes.
    const limit = rateLimit(`coupon:${user.id}`, 20, 10 * 60 * 1000);
    if (!limit.ok) throw new ActionError("Too many attempts. Please wait a few minutes and try again.");

    const items = await db.cartItem.findMany({ where: { userId: user.id }, select: { courseId: true } });
    const coupons = await db.coupon.findMany({
      where: { code, courseId: { in: items.map((i) => i.courseId) } },
    });
    if (coupons.length === 0) {
      throw new ActionError("That code doesn't apply to anything in your cart.", {
        code: ["This code isn't valid for the courses in your cart."],
      });
    }
    const now = Date.now();
    const usable = coupons.filter((c) => !couponProblem(c, now));
    if (usable.length === 0) {
      const reason = couponProblem(coupons[0]!, now)!;
      throw new ActionError(reason, { code: [reason] });
    }

    await db.$transaction(
      usable.map((c) =>
        db.cartItem.update({
          where: { userId_courseId: { userId: user.id, courseId: c.courseId } },
          data: { couponId: c.id },
        }),
      ),
    );
    refresh();
    return ok(`Coupon ${code} applied.`);
  });
}

export async function removeCouponAction(courseId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await actionUser();
    await db.cartItem.updateMany({
      where: { userId: user.id, courseId: parse(idSchema, courseId) },
      data: { couponId: null },
    });
    refresh();
    return ok("Coupon removed.");
  });
}

/** Create an order from the cart and send the buyer to pay for it. */
export async function checkoutAction(): Promise<ActionResult> {
  return run(async () => {
    const user = await actionUser();
    const limit = rateLimit(`checkout:${user.id}`, 20, 10 * 60 * 1000);
    if (!limit.ok) throw new ActionError("Too many checkout attempts. Please wait a few minutes and try again.");
    redirect(await checkoutCart(user));
  });
}

/**
 * Resolve a simulated payment. Only orders that were started with the sandbox
 * provider can be completed this way, so it is inert once a real gateway is configured.
 */
export async function sandboxPayAction(orderId: string, outcome: "paid" | "declined"): Promise<ActionResult> {
  return run(async () => {
    const user = await actionUser();
    const order = await db.order.findFirst({
      where: { id: parse(idSchema, orderId), userId: user.id },
      select: { id: true, status: true, provider: true },
    });
    if (!order || order.provider !== "sandbox") throw new ActionError("Order not found.");
    if (order.status !== "PENDING") throw new ActionError("This order is no longer awaiting payment.");

    if (outcome === "paid") {
      await fulfillOrder(order.id);
    } else {
      await closeUnpaidOrder(order.id, "FAILED");
    }
    redirect(`/checkout/complete?order=${order.id}`);
  });
}
