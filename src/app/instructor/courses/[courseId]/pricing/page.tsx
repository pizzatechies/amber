import { Suspense } from "react";
import type { Metadata } from "next";
import { PricingForm } from "@/components/studio/course-forms";
import { CouponForm, CouponRowActions } from "@/components/studio/panels";
import { Table } from "@/components/studio/stat";
import { Badge, Skeleton } from "@/components/ui/misc";
import { couponProblem } from "@/lib/commerce/pricing";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requestTime } from "@/lib/request";
import { getSettings } from "@/lib/settings";
import { getStudioCourse } from "@/lib/studio-course";
import { courseUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Pricing and coupons" };
type Props = PageProps<"/instructor/courses/[courseId]/pricing">;

export default function PricingPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full max-w-3xl" />}>
      <Pricing params={props.params} />
    </Suspense>
  );
}

async function Pricing({ params }: Pick<Props, "params">) {
  const { course } = await getStudioCourse((await params).courseId);
  const [settings, coupons, now] = await Promise.all([
    getSettings(),
    db.coupon.findMany({ where: { courseId: course.id }, orderBy: { createdAt: "desc" } }),
    requestTime(),
  ]);

  return (
    <div className="flex flex-col gap-12">
      <section>
        <h2 className="mb-4 font-display text-xl font-semibold">Price</h2>
        <PricingForm courseId={course.id} priceCents={course.priceCents} sharePercent={settings.instructorSharePercent} />
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold">Coupons</h2>
        <p className="mt-1 mb-5 max-w-2xl text-sm text-muted">
          Discount codes for this course. Share a coupon link and the discount is applied automatically, or let students type the code in
          their cart.
        </p>
        {course.priceCents === 0 ? (
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">Coupons apply to paid courses. Set a price first.</p>
        ) : (
          <>
            <CouponForm courseId={course.id} />
            {coupons.length > 0 ? (
              <div className="mt-6">
                <Table head={["Code", "Discount", "Used", "Expires", "Status", ""]}>
                  {coupons.map((c) => {
                    const problem = couponProblem(c, now);
                    return (
                      <tr key={c.id}>
                        <td className="font-mono font-bold">{c.code}</td>
                        <td>{c.percentOff}%</td>
                        <td>
                          {c.redemptionCount}
                          {c.maxRedemptions !== null ? ` / ${c.maxRedemptions}` : ""}
                        </td>
                        <td>{c.expiresAt ? formatDate(c.expiresAt) : "Never"}</td>
                        <td>{problem ? <Badge tone="neutral">{c.isActive ? "Ended" : "Disabled"}</Badge> : <Badge tone="success">Active</Badge>}</td>
                        <td>
                          <CouponRowActions couponId={c.id} isActive={c.isActive} sharePath={`${courseUrl(course.slug)}?coupon=${c.code}`} />
                        </td>
                      </tr>
                    );
                  })}
                </Table>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
