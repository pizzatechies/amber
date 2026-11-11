import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npm run db:seed",
  },
  datasource: {
    // Read leniently so `prisma generate` works at build time without a database.
    url: process.env["DATABASE_URL"],
  },
});
