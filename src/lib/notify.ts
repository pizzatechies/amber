import "server-only";
import { db } from "@/lib/db";

export type NotificationInput = { userId: string; title: string; body?: string; href?: string };

/** Create in-app notifications. Best-effort: never fails the calling action. */
export async function notify(input: NotificationInput | NotificationInput[]): Promise<void> {
  const items = (Array.isArray(input) ? input : [input]).map((n) => ({
    userId: n.userId,
    title: n.title.slice(0, 200),
    body: (n.body ?? "").slice(0, 500),
    href: n.href ?? "",
  }));
  if (items.length === 0) return;
  try {
    await db.notification.createMany({ data: items });
  } catch (err) {
    console.error("[notify] could not create notifications:", err);
  }
}
