import { connection } from "next/server";
import { db } from "@/lib/db";

/** Liveness and database check for load balancers and uptime monitors. */
export async function GET() {
  await connection();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "database unavailable" }, { status: 503 });
  }
}
