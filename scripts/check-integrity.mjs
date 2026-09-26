import { PrismaClient } from "@prisma/client";

/**
 * Reports row counts per mess so orphaned data is visible. A mess with rows but
 * no owner, or meal rows pointing at a messId that no longer exists, means a
 * delete path skipped its explicit cleanup — MongoDB will not do it for us.
 */
const db = new PrismaClient();

const messes = await db.mess.findMany({
  select: {
    id: true,
    name: true,
    owner: { select: { email: true } },
    _count: { select: { members: true, meals: true, expenses: true, bills: true, customBills: true, payments: true } },
  },
  orderBy: { name: "asc" },
});

console.log(`messes: ${messes.length}\n`);

for (const mess of messes) {
  const c = mess._count;
  console.log(
    `${mess.name}  [${mess.owner?.email ?? "NO OWNER"}]  ` +
      `members=${c.members} meals=${c.meals} expenses=${c.expenses} ` +
      `bills=${c.bills} customBills=${c.customBills} payments=${c.payments}`,
  );
}

const known = new Set(messes.map((m) => m.id));
const orphans = [];

for (const [model, label] of [
  ["member", "members"],
  ["meal", "meals"],
  ["expense", "expenses"],
  ["bill", "bills"],
  ["customBill", "custom bills"],
  ["payment", "payments"],
]) {
  const rows = await db[model].findMany({ select: { messId: true } });
  const dangling = rows.filter((row) => !known.has(row.messId));
  if (dangling.length > 0) {
    orphans.push(`${label}: ${dangling.length} row(s) with no mess`);
  }
}

console.log("");
if (orphans.length > 0) {
  console.error("ORPHANED ROWS FOUND");
  for (const line of orphans) console.error(`  ${line}`);
  await db.$disconnect();
  process.exit(1);
}

console.log("no orphaned rows");

await db.$disconnect();
