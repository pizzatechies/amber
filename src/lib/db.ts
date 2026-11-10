import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForDb = globalThis as unknown as { __amberDb?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

/** Shared Prisma client. Reused across hot reloads in development. */
export const db: PrismaClient = globalForDb.__amberDb ?? createClient();

if (process.env.NODE_ENV !== "production") globalForDb.__amberDb = db;

export type Db = PrismaClient;
/** The client type inside `db.$transaction(async (tx) => ...)`. */
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
