import type { ReactNode } from "react";
import { Card, Skeleton } from "@/components/ui/misc";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <>
      <Card className="p-6 shadow-card sm:p-8">
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-sm text-muted">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </Card>
      {footer ? <p className="mt-6 text-center text-sm text-muted">{footer}</p> : null}
    </>
  );
}

export function FormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="mt-2 h-10 w-full" />
    </div>
  );
}
