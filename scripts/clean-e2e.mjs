import { PrismaClient } from "@prisma/client";
import { deleteUserCascade } from "@/lib/cascade";

/**
 * Removes the throwaway `e2e-*` accounts created by seed-probe.mjs, together
 * with every record inside their messes.
 *
 * Only addresses ending in `@test.local` are touched, so this can never remove
 * a real signup. Run it before handing a database to anyone else.
 */

const db = new PrismaClient();

const accounts = await db.user.findMany({
  where: { email: { endsWith: "@test.local" } },
  select: { id: true, email: true, name: true },
});

if (accounts.length === 0) {
  console.log("No @test.local accounts found; nothing to remove.");
} else {
  for (const account of accounts) {
    await deleteUserCascade(db, account.id);
    console.log(`removed ${account.email} (${account.name}) and its mess data`);
  }
  console.log(`\n${accounts.length} test account(s) removed.`);
}

await db.$disconnect();
