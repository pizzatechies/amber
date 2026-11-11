import { Suspense } from "react";
import type { Metadata } from "next";
import { CategoryForm, CategoryRow } from "@/components/admin/controls";
import { Card, PageHeader, Skeleton } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Categories" };

export default function AdminCategoriesPage() {
  return (
    <>
      <PageHeader title="Categories" description="The subjects courses are filed under. The order here is the order shown to learners." />
      <Suspense fallback={<Skeleton className="mt-8 h-80 w-full" />}>
        <Categories />
      </Suspense>
    </>
  );
}

async function Categories() {
  await requireAdmin("/admin/categories");
  const rows = await db.category.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, description: true, _count: { select: { courses: true } } },
  });
  return (
    <div className="mt-8 flex flex-col gap-8">
      <Card className="p-5">
        <h2 className="mb-4 font-bold">Add a category</h2>
        <CategoryForm />
      </Card>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {rows.map((c, i) => (
          <CategoryRow
            key={c.id}
            category={{ id: c.id, name: c.name, description: c.description, courseCount: c._count.courses }}
            first={i === 0}
            last={i === rows.length - 1}
          />
        ))}
      </ul>
    </div>
  );
}
