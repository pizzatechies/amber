import { Suspense } from "react";
import type { Metadata } from "next";
import Form from "next/form";
import { Search } from "lucide-react";
import { UserControls } from "@/components/admin/controls";
import { Table } from "@/components/studio/stat";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, PageHeader, Pagination, Skeleton } from "@/components/ui/misc";
import { Input } from "@/components/ui/form";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { firstParam, pageParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Users" };
const PAGE_SIZE = 25;

export default function AdminUsersPage(props: PageProps<"/admin/users">) {
  return (
    <>
      <PageHeader title="Users" description="Change roles, or suspend accounts that break the rules." />
      <Suspense fallback={<Skeleton className="mt-8 h-80 w-full" />}>
        <Users searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Users({ searchParams }: Pick<PageProps<"/admin/users">, "searchParams">) {
  const sp = await searchParams;
  const admin = await requireAdmin("/admin/users");
  const q = (firstParam(sp.q) ?? "").trim().slice(0, 100);
  const page = pageParam(sp.page);
  const where = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] }
    : {};
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, name: true, email: true, role: true, status: true, avatarAssetId: true, createdAt: true,
        _count: { select: { courses: true, enrollments: true } },
      },
    }),
  ]);

  return (
    <>
      <Form action="/admin/users" role="search" className="mt-6 flex max-w-md gap-2">
        <Input name="q" type="search" defaultValue={q} placeholder="Search by name or email" aria-label="Search users" />
        <Button type="submit" variant="outline">
          <Search aria-hidden /> Search
        </Button>
      </Form>
      <div className="mt-6">
        {users.length === 0 ? (
          <p className="text-muted">No users match.</p>
        ) : (
          <Table head={["User", "Joined", "Activity", "Status", ""]}>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <span className="flex items-center gap-3">
                    <Avatar name={u.name} assetId={u.avatarAssetId} size={32} />
                    <span className="min-w-0">
                      <span className="block font-semibold">{u.name}</span>
                      <span className="block text-xs text-subtle">{u.email}</span>
                    </span>
                  </span>
                </td>
                <td className="whitespace-nowrap text-muted">{formatDate(u.createdAt)}</td>
                <td className="text-xs whitespace-nowrap text-muted">
                  {u._count.enrollments} enrolled · {u._count.courses} taught
                </td>
                <td>{u.status === "ACTIVE" ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Suspended</Badge>}</td>
                <td>
                  <UserControls userId={u.id} role={u.role} status={u.status} isSelf={u.id === admin.id} />
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
      <div className="mt-6">
        <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} basePath="/admin/users" params={{ q }} />
      </div>
    </>
  );
}
