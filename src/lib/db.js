import { PrismaClient } from "@prisma/client";

// Reuse a single client across hot reloads in development so we don't exhaust
// MongoDB connection limits.
const globalForPrisma = globalThis;

export const db = globalForPrisma.__messmatePrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__messmatePrisma = db;
}
